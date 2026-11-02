"use strict";

(function () {
  const L = window.PrismLogic;
  const { Draw, Compositor, readTheme, theme } = window.PrismRender;
  const $ = (id) => document.getElementById(id);

  const el = {
    stage: $("stage"),
    board: $("board"),
    tray: $("tray"),
    levels: $("levels"),
    levelNo: $("levelNo"),
    levelName: $("levelName"),
    lit: $("lit"),
    status: $("status"),
    statusText: $("statusText"),
    next: $("next"),
    reset: $("reset"),
    theme: $("theme"),
  };

  const DRAG_START_PX = 8;
  const RETURN_LANE = 0.11;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const base = document.createElement("canvas");
  const light = document.createElement("canvas");
  const bctx = base.getContext("2d");
  const lctx = light.getContext("2d");
  const compositor = new Compositor(el.board);

  const state = {
    level: 0,
    pieces: [],
    inv: {},
    armed: null,
    drag: null,
    result: null,
    done: new Set(load("prism.done", [])),
    S: 1,
    baseDirty: true,
  };

  const level = () => L.LEVELS[state.level];

  function load(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* settings just won't persist */
    }
  }

  /* ------------------------------ theme ------------------------------ */

  const THEMES = [
    { id: "auto", icon: "◐", label: "auto" },
    { id: "light", icon: "☀", label: "light" },
    { id: "dark", icon: "☾", label: "dark" },
  ];

  function applyTheme() {
    readTheme();
    document.querySelector('meta[name="theme-color"]').content =
      theme.themeColor;
    const current = document.documentElement.dataset.theme || "auto";
    const t = THEMES.find((x) => x.id === current);
    el.theme.textContent = t.icon;
    el.theme.title = `Theme: ${t.label}`;
    el.theme.setAttribute("aria-label", `Theme: ${t.label}`);
    renderTray();
    state.baseDirty = true;
  }

  el.theme.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme || "auto";
    const next =
      THEMES[(THEMES.findIndex((x) => x.id === current) + 1) % THEMES.length]
        .id;
    if (next === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("prism.theme", next);
    } catch (e) {
      /* theme just won't persist */
    }
    applyTheme();
  });
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", applyTheme);

  /* ------------------------------ state ------------------------------ */

  function loadLevel(i) {
    state.level = i;
    state.pieces = [];
    state.inv = { ...level().tray };
    state.armed = null;
    state.drag = null;
    el.levelNo.textContent = "LEVEL " + String(i + 1).padStart(2, "0");
    el.levelName.textContent = level().name;
    update();
  }

  function update() {
    const lv = level();
    state.result = L.trace(lv, state.pieces);
    const n = state.result.lit.filter(Boolean).length;
    el.lit.textContent = `${n} / ${lv.receivers.length} lit`;
    el.lit.classList.toggle("all", state.result.solved);
    el.board.setAttribute(
      "aria-label",
      `Puzzle board, ${n} of ${lv.receivers.length} receivers lit`,
    );
    if (state.result.solved && !state.done.has(lv.id)) {
      state.done.add(lv.id);
      save("prism.done", [...state.done]);
    }
    renderStatus();
    renderTray();
    renderLevels();
    state.baseDirty = true;
  }

  function place(trayId, x, y) {
    const p = L.pieceFromTrayId(trayId, x, y);
    p.trayId = trayId;
    state.pieces.push(p);
    state.inv[trayId]--;
    if (state.inv[trayId] <= 0) state.armed = null;
    update();
  }

  function rotate(p) {
    const states = L.PIECES[p.type].states;
    if (states > 1) {
      p.k = (p.k + 1) % states;
      update();
    }
  }

  /* ------------------------------ UI chrome ------------------------------ */

  function renderStatus() {
    const last = state.level === L.LEVELS.length - 1;
    const solved = state.result.solved;
    el.status.classList.toggle("win", solved);
    el.statusText.textContent = solved
      ? last
        ? "All receivers lit. That was the last level."
        : "All receivers lit."
      : level().hint;
    el.next.hidden = !solved || last;
  }

  function renderLevels() {
    el.levels.textContent = "";
    L.LEVELS.forEach((lv, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = i + 1;
      b.title = lv.name;
      const solved = state.done.has(lv.id);
      b.setAttribute(
        "aria-label",
        `Level ${i + 1}, ${lv.name}${solved ? ", solved" : ""}`,
      );
      if (i === state.level) b.setAttribute("aria-current", "true");
      if (solved) b.classList.add("done");
      b.addEventListener("click", () => loadLevel(i));
      el.levels.appendChild(b);
    });
  }

  const trayName = (id) => {
    const [type, mask] = id.split(":");
    return type === "filter"
      ? `${L.COLOR_NAMES[mask]} filter`
      : L.PIECES[type].label;
  };

  function renderTray() {
    el.tray.textContent = "";
    Object.keys(level().tray).forEach((id) => {
      const count = state.inv[id];
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className =
        "chip" +
        (state.armed === id ? " armed" : "") +
        (count <= 0 ? " empty" : "");
      chip.setAttribute("aria-label", `${trayName(id)}, ${count} left`);
      chip.setAttribute("aria-pressed", state.armed === id ? "true" : "false");

      const icon = document.createElement("canvas");
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      icon.width = icon.height = Math.round(44 * dpr);
      const p = L.pieceFromTrayId(id, 0, 0);
      Draw.piece(
        icon.getContext("2d"),
        p,
        icon.width / 2,
        icon.height / 2,
        icon.width * 0.95,
      );
      chip.appendChild(icon);

      const name = document.createElement("span");
      name.className = "name";
      name.textContent =
        p.type === "filter" ? L.COLOR_NAMES[p.color] : L.PIECES[p.type].label;
      chip.appendChild(name);

      const cnt = document.createElement("span");
      cnt.className = "count";
      cnt.textContent = "×" + count;
      chip.appendChild(cnt);

      chip.addEventListener("pointerdown", (e) => startTrayDrag(e, id, chip));
      chip.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleArmed(id);
        }
      });
      el.tray.appendChild(chip);
    });
  }

  function toggleArmed(id) {
    if (state.inv[id] <= 0) return;
    state.armed = state.armed === id ? null : id;
    renderTray();
    state.baseDirty = true;
  }

  /* ------------------------------ layout ------------------------------ */

  function layout() {
    const r = el.stage.getBoundingClientRect();
    let w = r.width,
      h = (w * L.ROWS) / L.COLS;
    if (h > r.height) {
      h = r.height;
      w = (h * L.COLS) / L.ROWS;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const S = Math.max(8, Math.floor((w * dpr) / L.COLS));
    [el.board, base, light].forEach((c) => {
      c.width = S * L.COLS;
      c.height = S * L.ROWS;
    });
    el.board.style.width = (S * L.COLS) / dpr + "px";
    el.board.style.height = (S * L.ROWS) / dpr + "px";
    state.S = S;
    state.baseDirty = true;
  }

  /* ------------------------------ input ------------------------------ */

  function cellAt(clientX, clientY) {
    const r = el.board.getBoundingClientRect();
    const fx = ((clientX - r.left) / r.width) * L.COLS;
    const fy = ((clientY - r.top) / r.height) * L.ROWS;
    if (fx < 0 || fy < 0 || fx >= L.COLS || fy >= L.ROWS) return null;
    return { x: Math.floor(fx), y: Math.floor(fy) };
  }

  function overTray(clientX, clientY) {
    const r = el.tray.getBoundingClientRect();
    return (
      clientX >= r.left &&
      clientX <= r.right &&
      clientY >= r.top &&
      clientY <= r.bottom
    );
  }

  const pieceAt = (x, y) => state.pieces.find((p) => p.x === x && p.y === y);

  el.board.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const c = cellAt(e.clientX, e.clientY);
    if (!c || state.drag) return;
    const p = pieceAt(c.x, c.y);
    if (p) {
      state.drag = {
        kind: "piece",
        piece: p,
        from: { x: p.x, y: p.y },
        sx: e.clientX,
        sy: e.clientY,
        active: false,
      };
      el.board.setPointerCapture(e.pointerId);
      return;
    }
    if (state.armed && L.isFree(level(), state.pieces, c.x, c.y))
      place(state.armed, c.x, c.y);
  });

  function startTrayDrag(e, id, chip) {
    if (state.inv[id] <= 0 || state.drag) return;
    e.preventDefault();
    chip.setPointerCapture(e.pointerId);
    state.drag = {
      kind: "tray",
      trayId: id,
      sx: e.clientX,
      sy: e.clientY,
      active: false,
    };
  }

  window.addEventListener("pointermove", (e) => {
    const d = state.drag;
    if (!d) return;
    if (
      !d.active &&
      Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > DRAG_START_PX
    ) {
      d.active = true;
      state.armed = null;
      if (d.kind === "piece") {
        state.pieces = state.pieces.filter((p) => p !== d.piece);
        update();
        el.tray.classList.add("drop");
      } else {
        renderTray();
      }
    }
    if (d.active) {
      d.x = e.clientX;
      d.y = e.clientY;
      if (d.kind === "piece")
        el.tray.classList.toggle("over", overTray(e.clientX, e.clientY));
      state.baseDirty = true;
    }
  });

  function endDrag(e, cancelled) {
    const d = state.drag;
    if (!d) return;
    state.drag = null;
    el.tray.classList.remove("drop", "over");

    if (!d.active) {
      if (cancelled) return;
      if (d.kind === "piece") rotate(d.piece);
      else toggleArmed(d.trayId);
      return;
    }

    const c = cancelled ? null : cellAt(e.clientX, e.clientY);
    const free = c && L.isFree(level(), state.pieces, c.x, c.y);
    if (d.kind === "tray") {
      if (free) place(d.trayId, c.x, c.y);
      else update();
      return;
    }
    const p = d.piece;
    if (free) {
      p.x = c.x;
      p.y = c.y;
      state.pieces.push(p);
    } else if (!cancelled && (!c || overTray(e.clientX, e.clientY))) {
      state.inv[p.trayId]++;
    } else {
      p.x = d.from.x;
      p.y = d.from.y;
      state.pieces.push(p);
    }
    update();
  }

  window.addEventListener("pointerup", (e) => endDrag(e, false));
  window.addEventListener("pointercancel", (e) => endDrag(e, true));
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.armed) {
      state.armed = null;
      renderTray();
      state.baseDirty = true;
    }
  });

  el.reset.addEventListener("click", () => loadLevel(state.level));
  el.next.addEventListener("click", () =>
    loadLevel(Math.min(state.level + 1, L.LEVELS.length - 1)),
  );

  /* ------------------------------ drawing ------------------------------ */

  const center = (v, S) => (v + 0.5) * S;

  function overlapsBackwards(a, b) {
    if (b.d !== (a.d + 4) % 8) return false;
    const [dx, dy] = L.DIRS[a.d];
    if (Math.abs(dx * (b.y0 - a.y0) - dy * (b.x0 - a.x0)) > 1e-6) return false;
    const proj = (x, y) => (x - a.x0) * dx + (y - a.y0) * dy;
    const aEnd = proj(a.x1, a.y1);
    const b0 = proj(b.x0, b.y0),
      b1 = proj(b.x1, b.y1);
    return (
      Math.max(0, Math.min(b0, b1)) < Math.min(aEnd, Math.max(b0, b1)) - 1e-6
    );
  }

  /* Light sent straight back would draw on top of itself, so each direction
     moves to its own lane on the right-hand side of its travel. */
  function laneOffset(run, runs) {
    if (!runs.some((o) => o !== run && overlapsBackwards(run, o)))
      return [0, 0];
    const [dx, dy] = L.DIRS[run.d];
    const len = Math.hypot(dx, dy);
    return [(-dy / len) * RETURN_LANE, (dx / len) * RETURN_LANE];
  }

  function drawBase() {
    const S = state.S,
      lv = level(),
      ctx = bctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    Draw.board(ctx, S, L.COLS, L.ROWS);

    if (state.armed || (state.drag && state.drag.active)) {
      for (let x = 0; x < L.COLS; x++)
        for (let y = 0; y < L.ROWS; y++)
          if (L.isFree(lv, state.pieces, x, y)) Draw.freeCell(ctx, x, y, S);
    }

    lv.walls.forEach(([x, y]) => Draw.wall(ctx, x, y, S));
    (lv.doors || []).forEach(([x, y, c]) => Draw.door(ctx, x, y, c, S));
    lv.sources.forEach((s) =>
      Draw.source(ctx, center(s.x, S), center(s.y, S), s.d, S),
    );
    lv.receivers.forEach((r) =>
      Draw.receiver(ctx, center(r.x, S), center(r.y, S), r.c, S),
    );
    state.pieces.forEach((p) =>
      Draw.piece(ctx, p, center(p.x, S), center(p.y, S), S),
    );

    const d = state.drag;
    if (d && d.active && d.x !== undefined) {
      const c = cellAt(d.x, d.y);
      if (c)
        Draw.target(ctx, c.x, c.y, S, L.isFree(lv, state.pieces, c.x, c.y));
      const r = el.board.getBoundingClientRect();
      const gx = ((d.x - r.left) / r.width) * el.board.width;
      const gy = ((d.y - r.top) / r.height) * el.board.height;
      const ghost =
        d.kind === "piece" ? d.piece : L.pieceFromTrayId(d.trayId, 0, 0);
      ctx.globalAlpha = 0.85;
      Draw.piece(ctx, ghost, gx, gy, S);
      ctx.globalAlpha = 1;
    }
  }

  function drawLight(t) {
    const S = state.S,
      lv = level(),
      ctx = lctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, light.width, light.height);
    ctx.globalCompositeOperation = "lighter";

    const phase = reduceMotion ? 0.5 : (t / 1000) * 1.5;
    const all = state.result.runs;
    const runs = all.map((r) => {
      const [ox, oy] = laneOffset(r, all);
      return [
        center(r.x0 + ox, S),
        center(r.y0 + oy, S),
        center(r.x1 + ox, S),
        center(r.y1 + oy, S),
        r.c,
      ];
    });
    runs.forEach(([x0, y0, x1, y1, c]) => Draw.beam(ctx, x0, y0, x1, y1, c, S));
    runs.forEach(([x0, y0, x1, y1, c]) =>
      Draw.arrows(ctx, x0, y0, x1, y1, c, S, phase),
    );

    lv.sources.forEach((s) =>
      Draw.sourceLight(ctx, center(s.x, S), center(s.y, S), s.d, s.c, S),
    );
    lv.receivers.forEach((r, i) =>
      Draw.receiverLight(
        ctx,
        center(r.x, S),
        center(r.y, S),
        r.c,
        state.result.hits[i],
        state.result.lit[i],
        S,
        t,
      ),
    );
    ctx.globalCompositeOperation = "source-over";
  }

  function frame(t) {
    const baseDirty = state.baseDirty;
    if (baseDirty) drawBase();
    drawLight(t);
    compositor.render(base, light, baseDirty);
    state.baseDirty = false;
    requestAnimationFrame(frame);
  }

  /* ------------------------------ boot ------------------------------ */

  readTheme();
  new ResizeObserver(layout).observe(el.stage);
  loadLevel(0);
  applyTheme();
  layout();
  requestAnimationFrame(frame);

  window.__prism = { state, L, accelerated: compositor.accelerated, theme };
})();
