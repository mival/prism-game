"use strict";

/* ============================== CONSTANTS ============================== */
const WORLD_W = 960,
  WORLD_H = 600;
const GRID = 20;
const SNAP = GRID * 2; // placed pieces lock to the drawn grid lines
/* Pieces rotate in 45° steps and prisms bend by 45°, so every beam stays on
   lines through cell centres (axis-aligned or diagonal). */
const ROT_STEP = Math.PI / 4;
const PRISM_BEND = Math.PI / 4;
const EPS = 0.001;
const MAX_BOUNCES = 60;
const MIRROR_HALF_LEN = 55;
/* Small enough that diagonal beams through neighbouring cell centres
   (40/√2 ≈ 28 away) never clip a prism they aren't aimed at. */
const PRISM_R = 24;

/* ============================== VEC MATH ============================== */
const V = {
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
  scale: (a, s) => ({ x: a.x * s, y: a.y * s }),
  dot: (a, b) => a.x * b.x + a.y * b.y,
  len: (a) => Math.hypot(a.x, a.y),
  norm: (a) => {
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  },
  fromAngle: (a) => ({ x: Math.cos(a), y: Math.sin(a) }),
  perp: (a) => ({ x: -a.y, y: a.x }),
  rot: (p, a) => ({
    x: p.x * Math.cos(a) - p.y * Math.sin(a),
    y: p.x * Math.sin(a) + p.y * Math.cos(a),
  }),
  neg: (a) => ({ x: -a.x, y: -a.y }),
};

function reflect(I, N) {
  const d = V.dot(I, N);
  return { x: I.x - 2 * d * N.x, y: I.y - 2 * d * N.y };
}
/* Bend a beam by PRISM_BEND away from the prism's apex (towards its base),
   or let it straight through when it travels along the apex axis. */
function prismBend(d, apex) {
  const a = V.rot(d, PRISM_BEND),
    b = V.rot(d, -PRISM_BEND);
  const da = V.dot(a, apex),
    db = V.dot(b, apex);
  if (Math.abs(da - db) < 1e-6) return d;
  return da < db ? a : b;
}

/* ray p + t*d  vs segment a-b -> smallest t>eps, else null */
function raySegmentT(p, d, a, b) {
  const s = V.sub(b, a);
  const rxs = d.x * s.y - d.y * s.x;
  if (Math.abs(rxs) < 1e-9) return null;
  const qp = V.sub(a, p);
  const t = (qp.x * s.y - qp.y * s.x) / rxs;
  const u = (qp.x * d.y - qp.y * d.x) / rxs;
  if (t > 1e-4 && u >= -1e-4 && u <= 1 + 1e-4) return t;
  return null;
}
function rayCircleT(p, d, c, r) {
  const oc = V.sub(p, c);
  const b = 2 * V.dot(oc, d);
  const cc = V.dot(oc, oc) - r * r;
  const disc = b * b - 4 * cc;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const t1 = (-b - sq) / 2,
    t2 = (-b + sq) / 2;
  if (t1 > 1e-4) return t1;
  if (t2 > 1e-4) return t2;
  return null;
}
function pointSegDist(p, a, b) {
  const ab = V.sub(b, a);
  const ap = V.sub(p, a);
  const t = Math.max(0, Math.min(1, V.dot(ap, ab) / (V.dot(ab, ab) || 1)));
  const proj = V.add(a, V.scale(ab, t));
  return V.len(V.sub(p, proj));
}
function segSegDist(a, b, c, d) {
  const cross = (o, p, q) =>
    (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  const d1 = cross(c, d, a),
    d2 = cross(c, d, b),
    d3 = cross(a, b, c),
    d4 = cross(a, b, d);
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
  return Math.min(
    pointSegDist(a, c, d),
    pointSegDist(b, c, d),
    pointSegDist(c, a, b),
    pointSegDist(d, a, b),
  );
}
function pointInPolygon(p, verts) {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const vi = verts[i],
      vj = verts[j];
    const intersect =
      vi.y > p.y !== vj.y > p.y &&
      p.x < ((vj.x - vi.x) * (p.y - vi.y)) / (vj.y - vi.y || 1e-9) + vi.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

/* ============================== LEVELS ============================== */
/* Lasers and receivers sit on cell centres (20 + 40k) so beams run through
   the middle of the cells pieces snap into; walls sit on grid lines (40k). */
const LEVELS = [
  {
    name: "First Light",
    hint: "Drag a <b>mirror</b> into the beam's path and position it to bounce the laser down into the golden receiver.",
    laser: { x: 60, y: 100, angle: 0 },
    goal: { x: 540, y: 540, r: 24 },
    walls: [],
    inventory: { mirror: 2, prism: 0 },
  },
  {
    name: "Bent Light",
    hint: "A wall blocks the direct route. Use a <b>mirror</b> to steer the beam around it, then a <b>prism</b> to bend it the rest of the way into the receiver.",
    laser: { x: 60, y: 140, angle: 0 },
    goal: { x: 460, y: 540, r: 22 },
    walls: [{ x1: 400, y1: 0, x2: 400, y2: 320 }],
    inventory: { mirror: 1, prism: 1 },
  },
  {
    name: "The Gauntlet",
    hint: "Two barriers stand between the laser and the receiver. Combine <b>mirrors</b> and <b>prisms</b> — a prism bends light by 45°, a mirror turns it sharply.",
    laser: { x: 60, y: 540, angle: -90 },
    goal: { x: 900, y: 100, r: 20 },
    walls: [
      { x1: 240, y1: 280, x2: 240, y2: 600 },
      { x1: 640, y1: 0, x2: 640, y2: 360 },
    ],
    inventory: { mirror: 2, prism: 2 },
  },
];

/* ============================== STATE ============================== */
const state = {
  levelIndex: 0,
  placed: [], // {id,type,x,y,angle}
  inventory: { mirror: 0, prism: 0 },
  selectedId: null,
  armed: null, // 'mirror' | 'prism' | null
  solved: false,
  dragMode: null, // 'move' | 'rotate'
  dragOffset: { x: 0, y: 0 },
  nextId: 1,
  completed: new Set(),
  lastTrace: null,
};

function currentLevel() {
  return LEVELS[state.levelIndex];
}

function loadLevel(idx) {
  state.levelIndex = idx;
  const lvl = LEVELS[idx];
  state.placed = [];
  state.inventory = {
    mirror: lvl.inventory.mirror,
    prism: lvl.inventory.prism,
  };
  state.selectedId = null;
  state.armed = null;
  state.solved = false;
  clearTimeout(winOverlayTimer);
  document.getElementById("winOverlay").classList.remove("show");
  document.getElementById("hintTitle").textContent =
    `Lvl ${idx + 1} — ${lvl.name}`;
  document.getElementById("hintBody").innerHTML = lvl.hint;
  document.getElementById("hintBadge").classList.remove("collapsed");
  document.getElementById("hintToggle").textContent = "▾";
  document.getElementById("nextBtn").style.display =
    idx >= LEVELS.length - 1 ? "none" : "inline-block";
  renderTray();
  renderLevelButtons();
  fitBoardMobile();
}

function resetLevel() {
  loadLevel(state.levelIndex);
}

/* ============================== GEOMETRY BUILDERS ============================== */
function mirrorEndpoints(obj) {
  const dir = V.fromAngle(obj.angle);
  const half = V.scale(dir, MIRROR_HALF_LEN);
  return [V.sub(obj, half), V.add(obj, half)];
}
/* Equilateral prism centred on its pivot, apex pointing along `angle`
   (angle 0 = apex up). Fits inside one grid cell. */
function prismVertices(obj) {
  const c = Math.cos(Math.PI / 6) * PRISM_R;
  const local = [
    { x: 0, y: -PRISM_R },
    { x: c, y: PRISM_R / 2 },
    { x: -c, y: PRISM_R / 2 },
  ];
  return local.map((p) => {
    const rp = V.rot(p, obj.angle);
    return { x: obj.x + rp.x, y: obj.y + rp.y };
  });
}
function polyCentroid(verts) {
  let cx = 0,
    cy = 0;
  verts.forEach((v) => {
    cx += v.x;
    cy += v.y;
  });
  return { x: cx / verts.length, y: cy / verts.length };
}

/* ============================== BEAM TRACE ============================== */
function traceBeam(placed, laser) {
  const origin0 = { x: laser.x, y: laser.y };
  const dir0 = V.fromAngle((laser.angle * Math.PI) / 180);
  const lvl = currentLevel();

  const mirrors = placed
    .filter((o) => o.type === "mirror")
    .map((o) => {
      const [a, b] = mirrorEndpoints(o);
      return { a, b };
    });
  const prisms = placed
    .filter((o) => o.type === "prism")
    .map((o) => {
      const verts = prismVertices(o);
      return {
        verts,
        centre: { x: o.x, y: o.y },
        apex: V.rot({ x: 0, y: -1 }, o.angle),
      };
    });
  const boundary = [
    { a: { x: 0, y: 0 }, b: { x: WORLD_W, y: 0 } },
    { a: { x: WORLD_W, y: 0 }, b: { x: WORLD_W, y: WORLD_H } },
    { a: { x: WORLD_W, y: WORLD_H }, b: { x: 0, y: WORLD_H } },
    { a: { x: 0, y: WORLD_H }, b: { x: 0, y: 0 } },
  ];
  const walls = lvl.walls.map((w) => ({
    a: { x: w.x1, y: w.y1 },
    b: { x: w.x2, y: w.y2 },
  }));

  let o = origin0,
    d = V.norm(dir0);
  const segments = [];
  let hitGoal = false;
  let insidePrism = null; // the prism the beam is currently leaving

  for (let bounce = 0; bounce < MAX_BOUNCES; bounce++) {
    let best = null;

    for (const m of mirrors) {
      const t = raySegmentT(o, d, m.a, m.b);
      if (t !== null && (!best || t < best.t))
        best = { t, kind: "mirror", a: m.a, b: m.b };
    }
    for (const w of walls) {
      const t = raySegmentT(o, d, w.a, w.b);
      if (t !== null && (!best || t < best.t)) best = { t, kind: "wall" };
    }
    for (const bnd of boundary) {
      const t = raySegmentT(o, d, bnd.a, bnd.b);
      if (t !== null && (!best || t < best.t)) best = { t, kind: "wall" };
    }
    for (const pr of prisms) {
      if (pr === insidePrism) continue;
      const n = pr.verts.length;
      for (let i = 0; i < n; i++) {
        const a = pr.verts[i],
          b = pr.verts[(i + 1) % n];
        const t = raySegmentT(o, d, a, b);
        if (t !== null && (!best || t < best.t))
          best = { t, kind: "prism", prism: pr };
      }
    }
    {
      const t = rayCircleT(o, d, { x: lvl.goal.x, y: lvl.goal.y }, lvl.goal.r);
      if (t !== null && (!best || t < best.t)) best = { t, kind: "goal" };
    }

    if (!best) {
      segments.push({
        x1: o.x,
        y1: o.y,
        x2: o.x + d.x * 2000,
        y2: o.y + d.y * 2000,
      });
      break;
    }
    const hit = V.add(o, V.scale(d, best.t));
    segments.push({ x1: o.x, y1: o.y, x2: hit.x, y2: hit.y });
    insidePrism = null;

    if (best.kind === "wall") {
      break;
    }
    if (best.kind === "goal") {
      hitGoal = true;
      break;
    }

    if (best.kind === "mirror") {
      const edge = V.sub(best.b, best.a);
      let n = V.norm(V.perp(edge));
      if (V.dot(d, n) > 0) n = V.neg(n);
      d = V.norm(reflect(d, n));
      o = V.add(hit, V.scale(d, EPS));
    } else if (best.kind === "prism") {
      // The beam bends at the prism's centre so it leaves on a grid line.
      const pr = best.prism;
      segments.push({ x1: hit.x, y1: hit.y, x2: pr.centre.x, y2: pr.centre.y });
      d = V.norm(prismBend(d, pr.apex));
      o = pr.centre;
      insidePrism = pr;
    }
  }
  return { segments, hitGoal };
}

/* ============================== WEBGL RENDERER ============================== */
const canvas = document.getElementById("glcanvas");
let gl =
  canvas.getContext("webgl2", { antialias: true, alpha: false }) ||
  canvas.getContext("webgl", { antialias: true, alpha: false });
let usingGL = !!gl;

let prog, aPos, aColor, uRes;

function compileShader(src, type) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
  }
  return s;
}
function initGL() {
  const vsSrc = `
    attribute vec2 aPos;
    attribute vec4 aColor;
    uniform vec2 uRes;
    varying vec4 vColor;
    void main(){
      vec2 clip = vec2((aPos.x/uRes.x)*2.0-1.0, 1.0-(aPos.y/uRes.y)*2.0);
      gl_Position = vec4(clip,0.0,1.0);
      vColor = aColor;
    }`;
  const fsSrc = `
    precision mediump float;
    varying vec4 vColor;
    void main(){ gl_FragColor = vColor; }`;
  const vs = compileShader(vsSrc, gl.VERTEX_SHADER);
  const fs = compileShader(fsSrc, gl.FRAGMENT_SHADER);
  prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
  }
  gl.useProgram(prog);
  aPos = gl.getAttribLocation(prog, "aPos");
  aColor = gl.getAttribLocation(prog, "aColor");
  uRes = gl.getUniformLocation(prog, "uRes");
  gl.enable(gl.BLEND);
}

/* Batch: preallocated interleaved vertex data, each vertex = x,y,r,g,b,a.
   The typed array and its GL buffer are reused across frames and only
   reallocated (doubled) when a frame needs more room. */
const FLOATS_PER_VERT = 6;
function createBatch(capacity = 1 << 16) {
  return { data: new Float32Array(capacity), len: 0, glBuf: null, glCap: 0 };
}
const batchOpaque = createBatch();
const batchGlow = createBatch();

function pushVert(batch, p, col) {
  if (batch.len + FLOATS_PER_VERT > batch.data.length) {
    const grown = new Float32Array(batch.data.length * 2);
    grown.set(batch.data);
    batch.data = grown;
  }
  const d = batch.data;
  let i = batch.len;
  d[i++] = p.x;
  d[i++] = p.y;
  d[i++] = col[0];
  d[i++] = col[1];
  d[i++] = col[2];
  d[i++] = col[3];
  batch.len = i;
}
function pushTri(batch, p0, p1, p2, col) {
  pushVert(batch, p0, col);
  pushVert(batch, p1, col);
  pushVert(batch, p2, col);
}
function pushQuad(batch, p0, p1, p2, p3, col) {
  pushTri(batch, p0, p1, p2, col);
  pushTri(batch, p0, p2, p3, col);
}
function thickLine(batch, x1, y1, x2, y2, width, col) {
  const d = V.norm({ x: x2 - x1, y: y2 - y1 });
  const n = V.perp(d);
  const hw = width / 2;
  const p0 = { x: x1 + n.x * hw, y: y1 + n.y * hw };
  const p1 = { x: x2 + n.x * hw, y: y2 + n.y * hw };
  const p2 = { x: x2 - n.x * hw, y: y2 - n.y * hw };
  const p3 = { x: x1 - n.x * hw, y: y1 - n.y * hw };
  pushQuad(batch, p0, p1, p2, p3, col);
}
function circleTris(batch, cx, cy, r, col, segs = 28) {
  const pts = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  for (let i = 0; i < segs; i++) {
    pushTri(batch, { x: cx, y: cy }, pts[i], pts[(i + 1) % segs], col);
  }
}
function ringTris(batch, cx, cy, rOuter, rInner, col, segs = 40) {
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2,
      a1 = ((i + 1) / segs) * Math.PI * 2;
    const p0 = { x: cx + Math.cos(a0) * rOuter, y: cy + Math.sin(a0) * rOuter };
    const p1 = { x: cx + Math.cos(a1) * rOuter, y: cy + Math.sin(a1) * rOuter };
    const p2 = { x: cx + Math.cos(a1) * rInner, y: cy + Math.sin(a1) * rInner };
    const p3 = { x: cx + Math.cos(a0) * rInner, y: cy + Math.sin(a0) * rInner };
    pushQuad(batch, p0, p1, p2, p3, col);
  }
}
function polyTris(batch, verts, col) {
  const c = polyCentroid(verts);
  for (let i = 0; i < verts.length; i++) {
    pushTri(batch, c, verts[i], verts[(i + 1) % verts.length], col);
  }
}
function polyOutline(batch, verts, width, col) {
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i],
      b = verts[(i + 1) % verts.length];
    thickLine(batch, a.x, a.y, b.x, b.y, width, col);
  }
}

function flush(batch, blendMode) {
  if (batch.len === 0) return;
  const stride = FLOATS_PER_VERT * 4;
  if (!batch.glBuf) batch.glBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, batch.glBuf);
  if (batch.glCap < batch.data.length) {
    gl.bufferData(gl.ARRAY_BUFFER, batch.data.byteLength, gl.DYNAMIC_DRAW);
    batch.glCap = batch.data.length;
  }
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, batch.data.subarray(0, batch.len));
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(aColor);
  gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, stride, 8);
  if (blendMode === "additive") {
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  } else {
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
  gl.drawArrays(gl.TRIANGLES, 0, batch.len / FLOATS_PER_VERT);
}

/* ============================== COLORS ============================== */
const COL = {
  bg: [0.02, 0.03, 0.06, 1],
  grid: [0.2, 0.27, 0.42, 0.75],
  gridCell: [0.37, 0.91, 1, 0.12],
  wall: [0.35, 0.38, 0.5, 1],
  wallEdge: [0.55, 0.6, 0.75, 1],
  mirrorBody: [0.72, 0.8, 0.92, 1],
  mirrorEdge: [0.85, 0.95, 1, 1],
  mirrorSel: [0.37, 0.91, 1, 1],
  prismFill: [0.25, 0.55, 0.75, 0.35],
  prismEdge: [0.55, 0.95, 1, 0.9],
  prismSel: [1, 0.6, 0.85, 0.9],
  goalOuter: [1, 0.85, 0.3, 0.9],
  goalInner: [1, 0.95, 0.6, 1],
  goalSolved: [0.4, 1, 0.6, 1],
  laser: [1, 0.35, 0.4, 1],
  beamCore: [1, 0.95, 0.85, 1],
  beamGlowA: [1, 0.4, 0.35, 0.5],
  beamGlowB: [1, 0.75, 0.35, 0.28],
  handle: [1, 1, 1, 0.9],
};

/* ============================== RENDER FRAME ============================== */
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(rect.width * dpr),
    h = Math.round(rect.height * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  if (usingGL) gl.viewport(0, 0, canvas.width, canvas.height);
}

function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * WORLD_W;
  const y = ((clientY - rect.top) / rect.height) * WORLD_H;
  return { x, y };
}
function worldToScreen(x, y) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: rect.left + (x / WORLD_W) * rect.width,
    y: rect.top + (y / WORLD_H) * rect.height,
  };
}

/* Touch targets must stay a constant physical size however small the canvas
   is scaled down to — a fixed world-unit threshold shrinks to nothing on a
   phone, so hit-testing converts a CSS-pixel tolerance into world units. */
function worldPerPixel() {
  const rect = canvas.getBoundingClientRect();
  return WORLD_W / (rect.width || 1);
}
const TOUCH_BODY_PX = 24;
const TOUCH_HANDLE_PX = 22;

/* ============================== MOBILE LAYOUT ============================== */
const MOBILE_QUERY = window.matchMedia("(max-width:700px), (max-height:500px)");
const LANDSCAPE_SIDEBAR_QUERY = window.matchMedia(
  "(max-height:500px) and (orientation:landscape)",
);
function fitBoardMobile() {
  if (!MOBILE_QUERY.matches) {
    boardEl.style.width = "";
    boardEl.style.height = "";
    return;
  }
  const appEl = document.getElementById("app");
  const headerEl = document.querySelector("header");
  const consoleEl = document.querySelector(".console");
  const appRect = appEl.getBoundingClientRect();
  const appStyle = getComputedStyle(appEl);
  const mainStyle = getComputedStyle(document.querySelector("main"));
  const padX =
    parseFloat(appStyle.paddingLeft) + parseFloat(appStyle.paddingRight);
  const padY =
    parseFloat(appStyle.paddingTop) + parseFloat(appStyle.paddingBottom);
  const appGap = parseFloat(appStyle.rowGap || appStyle.gap) || 0;
  const headerH = headerEl.getBoundingClientRect().height;

  const outerAvailW = appRect.width - padX;
  const outerAvailH = appRect.height - padY - headerH - appGap;

  // Measure the console at its own intrinsic size (it never grows/shrinks,
  // see flex:0 0 auto) before sizing the board off whatever space is left.
  const consoleRect = consoleEl.getBoundingClientRect();

  let availW, availH;
  if (LANDSCAPE_SIDEBAR_QUERY.matches) {
    // Phone landscape: tray sits beside the board, so it eats width, not height.
    const mainColGap = parseFloat(mainStyle.columnGap || mainStyle.gap) || 0;
    availW = outerAvailW - consoleRect.width - mainColGap;
    availH = outerAvailH;
  } else {
    const mainRowGap = parseFloat(mainStyle.rowGap || mainStyle.gap) || 0;
    availW = outerAvailW;
    availH = outerAvailH - consoleRect.height - mainRowGap;
  }

  const ratio = WORLD_W / WORLD_H;
  let w = availW;
  let h = w / ratio;
  if (h > availH) {
    h = Math.max(80, availH);
    w = h * ratio;
  }

  boardEl.style.width = Math.floor(w) + "px";
  boardEl.style.height = Math.floor(h) + "px";
}

let pulseT = 0;

function drawScene() {
  resizeCanvas();
  batchOpaque.len = 0;
  batchGlow.len = 0;

  if (usingGL) {
    gl.clearColor(COL.bg[0], COL.bg[1], COL.bg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uRes, WORLD_W, WORLD_H);
  }

  // grid — at least one CSS pixel wide so it stays visible on small boards
  const gridW = Math.max(1, worldPerPixel());
  for (let x = 0; x <= WORLD_W; x += SNAP) {
    thickLine(batchOpaque, x, 0, x, WORLD_H, gridW, COL.grid);
  }
  for (let y = 0; y <= WORLD_H; y += SNAP) {
    thickLine(batchOpaque, 0, y, WORLD_W, y, gridW, COL.grid);
  }
  // highlight the cell a piece is being dragged into
  const dragged =
    (trayDrag && trayDrag.preview) ||
    (state.dragMode === "move" &&
      state.placed.find((o) => o.id === state.selectedId));
  if (dragged) {
    const h = SNAP / 2;
    pushQuad(
      batchOpaque,
      { x: dragged.x - h, y: dragged.y - h },
      { x: dragged.x + h, y: dragged.y - h },
      { x: dragged.x + h, y: dragged.y + h },
      { x: dragged.x - h, y: dragged.y + h },
      COL.gridCell,
    );
  }

  const lvl = currentLevel();

  // walls
  lvl.walls.forEach((w) => {
    thickLine(batchOpaque, w.x1, w.y1, w.x2, w.y2, 14, COL.wall);
    thickLine(batchOpaque, w.x1, w.y1, w.x2, w.y2, 4, COL.wallEdge);
  });

  // goal
  const solvedNow = state.solved;
  const pr = 6 + Math.sin(pulseT * 2.4) * 2.5;
  const goalCol = solvedNow ? COL.goalSolved : COL.goalOuter;
  ringTris(
    batchGlow,
    lvl.goal.x,
    lvl.goal.y,
    lvl.goal.r + pr + 10,
    lvl.goal.r + pr,
    [goalCol[0], goalCol[1], goalCol[2], 0.35],
  );
  ringTris(
    batchOpaque,
    lvl.goal.x,
    lvl.goal.y,
    lvl.goal.r,
    lvl.goal.r - 5,
    goalCol,
  );
  circleTris(
    batchOpaque,
    lvl.goal.x,
    lvl.goal.y,
    lvl.goal.r - 6,
    solvedNow ? [0.2, 0.5, 0.3, 1] : [0.35, 0.28, 0.08, 1],
  );
  circleTris(batchGlow, lvl.goal.x, lvl.goal.y, 5, [
    goalCol[0],
    goalCol[1],
    goalCol[2],
    0.9,
  ]);

  // laser source
  const ldir = V.fromAngle((lvl.laser.angle * Math.PI) / 180);
  const lp = { x: lvl.laser.x, y: lvl.laser.y };
  const back = V.sub(lp, V.scale(ldir, 22));
  const side = V.perp(ldir);
  const bp1 = V.add(back, V.scale(side, 12));
  const bp2 = V.sub(back, V.scale(side, 12));
  const tip = V.add(lp, V.scale(ldir, 6));
  pushTri(batchOpaque, bp1, bp2, tip, [0.8, 0.15, 0.2, 1]);
  circleTris(batchGlow, lp.x, lp.y, 14, [1, 0.3, 0.3, 0.5]);
  circleTris(batchOpaque, lp.x, lp.y, 6, COL.laser);

  // placed objects
  state.placed.forEach((obj) =>
    drawPiece(obj, obj.id === state.selectedId, true),
  );
  // piece being dragged in from the tray
  if (trayDrag && trayDrag.preview) drawPiece(trayDrag.preview, true, false);

  // beam
  const result = traceBeam(state.placed, lvl.laser);
  state.lastTrace = result;
  const wasSolved = state.solved;
  state.solved = result.hitGoal;
  if (state.solved && !wasSolved) {
    onSolved();
  }
  if (!state.solved && wasSolved) {
    /* stays solved once shown; ignore flicker */ state.solved = wasSolved;
  }

  result.segments.forEach((seg) => {
    thickLine(batchGlow, seg.x1, seg.y1, seg.x2, seg.y2, 14, COL.beamGlowB);
    thickLine(batchGlow, seg.x1, seg.y1, seg.x2, seg.y2, 7, COL.beamGlowA);
    thickLine(batchOpaque, seg.x1, seg.y1, seg.x2, seg.y2, 2.2, COL.beamCore);
  });

  if (usingGL) {
    flush(batchGlow, "additive");
    flush(batchOpaque, "normal");
  }
}

function drawPiece(obj, isSel, showHandle) {
  if (obj.type === "mirror") {
    const [a, b] = mirrorEndpoints(obj);
    if (isSel) {
      thickLine(batchGlow, a.x, a.y, b.x, b.y, 20, [
        COL.mirrorSel[0],
        COL.mirrorSel[1],
        COL.mirrorSel[2],
        0.35,
      ]);
    }
    thickLine(
      batchOpaque,
      a.x,
      a.y,
      b.x,
      b.y,
      10,
      isSel ? COL.mirrorSel : COL.mirrorBody,
    );
    thickLine(batchOpaque, a.x, a.y, b.x, b.y, 3, COL.mirrorEdge);
    circleTris(batchOpaque, a.x, a.y, 5, COL.mirrorEdge);
    circleTris(batchOpaque, b.x, b.y, 5, COL.mirrorEdge);
  } else if (obj.type === "prism") {
    const verts = prismVertices(obj);
    if (isSel) {
      polyOutline(batchGlow, verts, 18, [
        COL.prismSel[0],
        COL.prismSel[1],
        COL.prismSel[2],
        0.3,
      ]);
    }
    polyTris(batchOpaque, verts, COL.prismFill);
    polyOutline(batchOpaque, verts, 3, isSel ? COL.prismSel : COL.prismEdge);
  }
  if (isSel && showHandle) {
    const handle = rotateHandlePos(obj);
    const handleR = Math.max(8, 15 * worldPerPixel());
    thickLine(batchOpaque, obj.x, obj.y, handle.x, handle.y, 2, [1, 1, 1, 0.5]);
    circleTris(batchOpaque, handle.x, handle.y, handleR, COL.handle);
    circleTris(
      batchOpaque,
      handle.x,
      handle.y,
      handleR * 0.5,
      [0.1, 0.1, 0.15, 1],
    );
  }
}

function rotateHandlePos(obj) {
  const dist = obj.type === "mirror" ? MIRROR_HALF_LEN + 28 : PRISM_R + 28;
  const dir = V.fromAngle(obj.angle);
  return V.add(obj, V.scale(dir, dist));
}

/* ============================== SOLVE / WIN ============================== */
let audioCtx = null;
function chime() {
  try {
    audioCtx =
      audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, t0 + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + i * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.09 + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t0 + i * 0.09);
      osc.stop(t0 + i * 0.09 + 0.42);
    });
  } catch (e) {
    /* audio not available, ignore */
  }
}

/* Pause on the solved board (receiver lit, chime) before the overlay covers it. */
const WIN_OVERLAY_DELAY_MS = 1200;
let winOverlayTimer = null;

function onSolved() {
  state.completed.add(state.levelIndex);
  renderLevelButtons();
  chime();
  const overlay = document.getElementById("winOverlay");
  const isLast = state.levelIndex >= LEVELS.length - 1;
  document.getElementById("winTitle").textContent = isLast
    ? "All Levels Solved!"
    : "Beam Locked On Target";
  document.getElementById("winText").textContent = isLast
    ? "You routed the laser through every level. Replay any level from the level selector above."
    : "The receiver is powered. Advance to the next level whenever you're ready.";
  document.getElementById("nextBtn").style.display = isLast
    ? "none"
    : "inline-block";
  clearTimeout(winOverlayTimer);
  winOverlayTimer = setTimeout(
    () => overlay.classList.add("show"),
    WIN_OVERLAY_DELAY_MS,
  );
}

/* ============================== UI: TRAY / LEVELS ============================== */
function renderTray() {
  const tray = document.getElementById("tray");
  tray.innerHTML = "";
  const defs = [
    { type: "mirror", label: "Mirror", icon: mirrorIcon() },
    { type: "prism", label: "Prism", icon: prismIcon() },
  ];
  defs.forEach((d) => {
    const count = state.inventory[d.type];
    const card = document.createElement("div");
    card.className =
      "piece-card" +
      (state.armed === d.type ? " armed" : "") +
      (count <= 0 ? " empty" : "");
    card.innerHTML = `<div class="ico">${d.icon}</div><div class="name">${d.label}</div><div class="count">x <b>${count}</b></div>`;
    card.addEventListener("pointerdown", (e) => {
      suppressTrayClick = false;
      if (state.inventory[d.type] <= 0) return;
      trayDrag = {
        type: d.type,
        startX: e.clientX,
        startY: e.clientY,
        active: false,
        preview: null,
      };
    });
    card.addEventListener("click", () => {
      if (suppressTrayClick) {
        suppressTrayClick = false;
        return;
      }
      if (state.inventory[d.type] <= 0) return;
      state.armed = state.armed === d.type ? null : d.type;
      state.selectedId = null;
      document.getElementById("board").classList.toggle("armed", !!state.armed);
      renderTray();
    });
    tray.appendChild(card);
  });
}
function mirrorIcon() {
  return `<svg width="40" height="34" viewBox="0 0 40 34"><line x1="6" y1="28" x2="34" y2="6" stroke="#cfe6ff" stroke-width="5" stroke-linecap="round"/></svg>`;
}
function prismIcon() {
  return `<svg width="40" height="34" viewBox="0 0 40 34"><polygon points="20,4 5,30 35,30" fill="#3a8bb8aa" stroke="#8fe8ff" stroke-width="2"/></svg>`;
}

function renderLevelButtons() {
  const box = document.getElementById("levelButtons");
  box.innerHTML = "";
  LEVELS.forEach((lvl, i) => {
    const b = document.createElement("button");
    b.className =
      "lvl-btn" +
      (i === state.levelIndex ? " active" : "") +
      (state.completed.has(i) ? " done" : "");
    b.textContent = i + 1;
    b.title = lvl.name;
    b.addEventListener("click", () => loadLevel(i));
    box.appendChild(b);
  });
}

/* ============================== INPUT ============================== */
const boardEl = document.getElementById("board");
const floatToolbar = document.getElementById("floatToolbar");

function hitTestPlaced(pt) {
  const tol = TOUCH_BODY_PX * worldPerPixel();
  for (let i = state.placed.length - 1; i >= 0; i--) {
    const obj = state.placed[i];
    if (obj.type === "mirror") {
      const [a, b] = mirrorEndpoints(obj);
      if (pointSegDist(pt, a, b) < tol) return obj;
    } else if (obj.type === "prism") {
      const verts = prismVertices(obj);
      if (pointInPolygon(pt, verts)) return obj;
      for (let k = 0; k < verts.length; k++) {
        if (pointSegDist(pt, verts[k], verts[(k + 1) % verts.length]) < tol)
          return obj;
      }
    }
  }
  return null;
}
/* Pieces sit in the middle of grid cells, i.e. on SNAP/2 + k*SNAP. */
const CELL_HALF = SNAP / 2;
function snapCell(v, margin, size) {
  const lo = Math.ceil((margin - CELL_HALF) / SNAP);
  const hi = Math.floor((size - margin - CELL_HALF) / SNAP);
  const k = Math.round((v - CELL_HALF) / SNAP);
  return Math.max(lo, Math.min(hi, k)) * SNAP + CELL_HALF;
}

/* Snap to the nearest cell centre; whether the piece actually fits there
   (inside the board, clear of walls) is checked by pieceBlocked. */
function placeOnGrid(obj, x, y) {
  obj.x = snapCell(x, CELL_HALF, WORLD_W);
  obj.y = snapCell(y, CELL_HALF, WORLD_H);
}

/* Half the drawn wall thickness plus half the mirror body. */
const WALL_CLEARANCE = 12;
/* Room for the mirror's end caps inside the board edge. */
const EDGE_CLEARANCE = 6;
function pieceOutline(obj) {
  return obj.type === "mirror" ? mirrorEndpoints(obj) : prismVertices(obj);
}
function pieceBlocked(obj) {
  const pts = pieceOutline(obj);
  const outside = pts.some(
    (p) =>
      p.x < EDGE_CLEARANCE ||
      p.y < EDGE_CLEARANCE ||
      p.x > WORLD_W - EDGE_CLEARANCE ||
      p.y > WORLD_H - EDGE_CLEARANCE,
  );
  if (outside) return true;
  // one piece per cell, and never on the laser or receiver
  const lvl = currentLevel();
  const sameCell = (p) =>
    Math.abs(p.x - obj.x) < CELL_HALF && Math.abs(p.y - obj.y) < CELL_HALF;
  if (sameCell(lvl.laser) || sameCell(lvl.goal)) return true;
  if (state.placed.some((o) => o.id !== obj.id && sameCell(o))) return true;
  const edges =
    obj.type === "mirror"
      ? [pts]
      : pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);
  return lvl.walls.some((w) => {
    const a = { x: w.x1, y: w.y1 },
      b = { x: w.x2, y: w.y2 };
    if (obj.type === "prism" && pointInPolygon(a, pts)) return true;
    return edges.some(([p, q]) => segSegDist(p, q, a, b) < WALL_CLEARANCE);
  });
}

/* Apply a move/rotation only if the piece stays inside the board and clear of walls. */
function tryUpdatePiece(obj, update) {
  const next = { ...obj };
  update(next);
  if (pieceBlocked(next)) return false;
  obj.x = next.x;
  obj.y = next.y;
  obj.angle = next.angle;
  return true;
}

/* The snapped piece a drop at `pt` would create, or null if it can't go there. */
function candidatePiece(type, pt) {
  if (!canPlaceAt(pt)) return null;
  const obj = { id: -1, type, angle: type === "mirror" ? -Math.PI / 4 : 0 };
  placeOnGrid(obj, pt.x, pt.y);
  return pieceBlocked(obj) ? null : obj;
}

function snapAngle(a) {
  return Math.round(a / ROT_STEP) * ROT_STEP;
}

function canPlaceAt(pt) {
  const lvl = currentLevel();
  return (
    V.len(V.sub(pt, { x: lvl.laser.x, y: lvl.laser.y })) >= 30 &&
    V.len(V.sub(pt, { x: lvl.goal.x, y: lvl.goal.y })) >= 30
  );
}

function placePiece(type, pt) {
  const obj = candidatePiece(type, pt);
  if (!obj) return false;
  obj.id = state.nextId++;
  state.placed.push(obj);
  state.inventory[type]--;
  state.selectedId = obj.id;
  state.armed = null;
  boardEl.classList.remove("armed");
  renderTray();
  return true;
}

let pointerDownWorld = null;

/* Drag & drop from the tray: a press on a card that moves past a small
   threshold becomes a drag; releasing over the board places the piece.
   A press that doesn't move stays a click, which arms the piece instead. */
const TRAY_DRAG_PX = 6;
let trayDrag = null;
let suppressTrayClick = false;

function trayDropPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const inside =
    e.clientX >= rect.left &&
    e.clientX <= rect.right &&
    e.clientY >= rect.top &&
    e.clientY <= rect.bottom;
  if (!inside) return null;
  return screenToWorld(e.clientX, e.clientY);
}

window.addEventListener("pointermove", (e) => {
  if (!trayDrag) return;
  if (!trayDrag.active) {
    const moved = Math.hypot(
      e.clientX - trayDrag.startX,
      e.clientY - trayDrag.startY,
    );
    if (moved < TRAY_DRAG_PX) return;
    trayDrag.active = true;
    state.armed = null;
    state.selectedId = null;
    boardEl.classList.remove("armed");
    boardEl.classList.add("dropping");
  }
  const pt = trayDropPoint(e);
  trayDrag.preview = pt ? candidatePiece(trayDrag.type, pt) : null;
});

function endTrayDrag(e, drop) {
  if (!trayDrag) return;
  if (trayDrag.active) {
    suppressTrayClick = true;
    const pt = drop ? trayDropPoint(e) : null;
    const placed =
      pt && state.inventory[trayDrag.type] > 0 && placePiece(trayDrag.type, pt);
    if (!placed) renderTray();
    boardEl.classList.remove("dropping");
  }
  trayDrag = null;
}
window.addEventListener("pointerup", (e) => endTrayDrag(e, true));
window.addEventListener("pointercancel", (e) => endTrayDrag(e, false));

canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  const pt = screenToWorld(e.clientX, e.clientY);
  pointerDownWorld = pt;

  if (state.armed) {
    placePiece(state.armed, pt);
    return;
  }

  // check rotate handle of currently selected
  if (state.selectedId !== null) {
    const sel = state.placed.find((o) => o.id === state.selectedId);
    if (sel) {
      const handle = rotateHandlePos(sel);
      const handleTol = TOUCH_HANDLE_PX * worldPerPixel();
      if (V.len(V.sub(pt, handle)) < handleTol) {
        state.dragMode = "rotate";
        return;
      }
    }
  }

  const hit = hitTestPlaced(pt);
  if (hit) {
    state.selectedId = hit.id;
    state.dragMode = "move";
    state.dragOffset = { x: pt.x - hit.x, y: pt.y - hit.y };
  } else {
    state.selectedId = null;
    state.dragMode = null;
  }
});

canvas.addEventListener("pointermove", (e) => {
  if (!state.dragMode || state.selectedId === null) return;
  const pt = screenToWorld(e.clientX, e.clientY);
  const obj = state.placed.find((o) => o.id === state.selectedId);
  if (!obj) return;
  if (state.dragMode === "move") {
    tryUpdatePiece(obj, (o) =>
      placeOnGrid(o, pt.x - state.dragOffset.x, pt.y - state.dragOffset.y),
    );
  } else if (state.dragMode === "rotate") {
    tryUpdatePiece(obj, (o) => {
      o.angle = snapAngle(Math.atan2(pt.y - o.y, pt.x - o.x));
    });
  }
});

window.addEventListener("pointerup", () => {
  state.dragMode = null;
});

window.addEventListener("keydown", (e) => {
  if (
    (e.key === "Delete" || e.key === "Backspace") &&
    state.selectedId !== null
  ) {
    removeSelected();
  }
});

function removeSelected() {
  const idx = state.placed.findIndex((o) => o.id === state.selectedId);
  if (idx >= 0) {
    const obj = state.placed[idx];
    state.inventory[obj.type]++;
    state.placed.splice(idx, 1);
    state.selectedId = null;
    renderTray();
  }
}

document.getElementById("rotCCW").addEventListener("click", () => {
  const obj = state.placed.find((o) => o.id === state.selectedId);
  if (obj)
    tryUpdatePiece(obj, (o) => (o.angle = snapAngle(o.angle - ROT_STEP)));
});
document.getElementById("rotCW").addEventListener("click", () => {
  const obj = state.placed.find((o) => o.id === state.selectedId);
  if (obj)
    tryUpdatePiece(obj, (o) => (o.angle = snapAngle(o.angle + ROT_STEP)));
});
document.getElementById("delSel").addEventListener("click", removeSelected);

document.getElementById("hintToggle").addEventListener("click", () => {
  const badge = document.getElementById("hintBadge");
  const collapsed = badge.classList.toggle("collapsed");
  document.getElementById("hintToggle").textContent = collapsed ? "▸" : "▾";
  fitBoardMobile();
});

document.getElementById("resetBtn").addEventListener("click", resetLevel);
document.getElementById("replayBtn").addEventListener("click", () => {
  document.getElementById("winOverlay").classList.remove("show");
  resetLevel();
});
document.getElementById("nextBtn").addEventListener("click", () => {
  document.getElementById("winOverlay").classList.remove("show");
  loadLevel(Math.min(state.levelIndex + 1, LEVELS.length - 1));
});

/* ============================== MAIN LOOP ============================== */
function updateFloatToolbar() {
  const sel = state.placed.find((o) => o.id === state.selectedId);
  if (!sel) {
    floatToolbar.style.display = "none";
    return;
  }
  const s = worldToScreen(sel.x, sel.y);
  const boardRect = boardEl.getBoundingClientRect();
  floatToolbar.style.display = "flex";
  floatToolbar.style.left = s.x - boardRect.left + "px";
  floatToolbar.style.top =
    s.y - boardRect.top - (sel.type === "mirror" ? 20 : 34) + "px";
}

function frame(ts) {
  pulseT = ts / 1000;
  drawScene();
  updateFloatToolbar();
  requestAnimationFrame(frame);
}

/* ============================== BOOT ============================== */
if (usingGL) {
  initGL();
} else {
  console.warn(
    "WebGL unavailable — falling back cannot render. Please use a browser with WebGL support.",
  );
}
loadLevel(0);
fitBoardMobile();
requestAnimationFrame(frame);
window.addEventListener("resize", () => {
  fitBoardMobile();
  resizeCanvas();
});
window.addEventListener("orientationchange", fitBoardMobile);
MOBILE_QUERY.addEventListener("change", fitBoardMobile);

/* debug hooks for automated testing */
window.__PRISM_DEBUG__ = {
  state,
  LEVELS,
  traceBeam,
  currentLevel,
  loadLevel,
  V,
};
