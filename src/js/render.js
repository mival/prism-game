"use strict";

/* Pieces are drawn with Canvas 2D onto two layers: "base" (hardware) and
   "light" (beams, arrows, lit receivers). WebGL then composites them and adds
   a GPU bloom pass to the light layer. Every color comes from the CSS
   variables in src/css/theme.css; call readTheme() after the theme changes. */
(function (root) {
  const T = {};
  const COLORS = {};
  const MASK_TOKENS = {
    7: "--beam-white",
    4: "--beam-red",
    2: "--beam-green",
    1: "--beam-blue",
    6: "--beam-yellow",
    3: "--beam-cyan",
    5: "--beam-magenta",
  };
  const TOKENS = [
    "board",
    "board-dot",
    "cell-hint",
    "target-ok",
    "target-bad",
    "wall",
    "wall-edge",
    "source-body",
    "source-edge",
    "source-nozzle",
    "source-led",
    "receiver-socket",
    "receiver-core",
    "mirror-back",
    "mirror-face",
    "splitter-glass",
    "splitter-edge",
    "splitter-dash",
    "prism-glass",
    "prism-edge",
    "filter-glare",
    "beam-core",
    "beam-arrow",
    "beam-arrow-on-white",
    "beam-blend",
    "theme-color",
  ];
  const NUMBERS = [
    "door-alpha",
    "receiver-idle-alpha",
    "beam-glow",
    "bloom-strength",
  ];

  const camel = (s) => s.replace(/-(\w)/g, (_, c) => c.toUpperCase());

  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    const get = (name) => cs.getPropertyValue("--" + name).trim();
    TOKENS.forEach((t) => (T[camel(t)] = get(t)));
    NUMBERS.forEach((t) => (T[camel(t)] = parseFloat(get(t)) || 0));
    Object.entries(MASK_TOKENS).forEach(
      ([m, v]) => (COLORS[m] = cs.getPropertyValue(v).trim()),
    );
    T.additive = T.beamBlend !== "over";
    return T;
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  const Draw = {
    board(ctx, S, cols, rows) {
      ctx.fillStyle = T.board;
      ctx.fillRect(0, 0, cols * S, rows * S);
      ctx.fillStyle = T.boardDot;
      const d = Math.max(1, S * 0.045);
      for (let i = 1; i < cols; i++)
        for (let j = 1; j < rows; j++)
          ctx.fillRect(i * S - d / 2, j * S - d / 2, d, d);
    },

    freeCell(ctx, x, y, S) {
      rr(ctx, x * S + S * 0.12, y * S + S * 0.12, S * 0.76, S * 0.76, S * 0.14);
      ctx.strokeStyle = T.cellHint;
      ctx.lineWidth = Math.max(1, S * 0.02);
      ctx.stroke();
    },

    target(ctx, x, y, S, ok) {
      rr(ctx, x * S + S * 0.06, y * S + S * 0.06, S * 0.88, S * 0.88, S * 0.16);
      ctx.strokeStyle = ok ? T.targetOk : T.targetBad;
      ctx.lineWidth = Math.max(1.5, S * 0.035);
      ctx.stroke();
    },

    wall(ctx, x, y, S) {
      rr(ctx, x * S + S * 0.08, y * S + S * 0.08, S * 0.84, S * 0.84, S * 0.15);
      ctx.fillStyle = T.wall;
      ctx.fill();
      ctx.strokeStyle = T.wallEdge;
      ctx.lineWidth = Math.max(1, S * 0.02);
      ctx.stroke();
    },

    /* A wall of coloured glass: same footprint as a wall, tinted, with
       vertical panes so it doesn't read as a placeable filter. */
    door(ctx, x, y, c, S) {
      const x0 = x * S + S * 0.08,
        y0 = y * S + S * 0.08,
        w = S * 0.84;
      rr(ctx, x0, y0, w, w, S * 0.15);
      ctx.fillStyle = T.wall;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = T.doorAlpha * 2;
      ctx.fillStyle = COLORS[c];
      ctx.fillRect(x0, y0, w, w);
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = COLORS[c];
      ctx.lineWidth = Math.max(1, S * 0.025);
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x0 + (w * i) / 4, y0);
        ctx.lineTo(x0 + (w * i) / 4, y0 + w);
        ctx.stroke();
      }
      ctx.restore();
      rr(ctx, x0, y0, w, w, S * 0.15);
      ctx.strokeStyle = COLORS[c];
      ctx.lineWidth = Math.max(1.5, S * 0.04);
      ctx.stroke();
    },

    source(ctx, cx, cy, d, S) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((d * Math.PI) / 4);
      rr(ctx, -S * 0.38, -S * 0.25, S * 0.64, S * 0.5, S * 0.12);
      ctx.fillStyle = T.sourceBody;
      ctx.fill();
      ctx.strokeStyle = T.sourceEdge;
      ctx.lineWidth = Math.max(1, S * 0.02);
      ctx.stroke();
      ctx.fillStyle = T.sourceNozzle;
      ctx.fillRect(S * 0.26, -S * 0.1, S * 0.16, S * 0.2);
      ctx.restore();
    },

    sourceLight(ctx, cx, cy, d, c, S) {
      const a = (d * Math.PI) / 4;
      ctx.beginPath();
      ctx.arc(
        cx - Math.cos(a) * S * 0.2,
        cy - Math.sin(a) * S * 0.2,
        S * 0.06,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = c === 7 ? T.sourceLed : COLORS[c];
      ctx.fill();
    },

    receiver(ctx, cx, cy, c, S) {
      ctx.beginPath();
      ctx.arc(cx, cy, S * 0.36, 0, Math.PI * 2);
      ctx.fillStyle = T.receiverSocket;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, S * 0.3, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS[c];
      ctx.globalAlpha = T.receiverIdleAlpha;
      ctx.lineWidth = S * 0.065;
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    receiverLight(ctx, cx, cy, need, got, lit, S, t) {
      if (lit) {
        const pulse = 0.85 + 0.15 * Math.sin(t / 380);
        const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, S * 0.62);
        g.addColorStop(0, COLORS[need]);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = 0.45 * pulse * T.beamGlow;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, S * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, S * 0.3, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS[need];
        ctx.lineWidth = S * 0.065;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, S * 0.13, 0, Math.PI * 2);
        ctx.fillStyle = T.receiverCore;
        ctx.fill();
      } else if (got) {
        // Light is arriving but it is the wrong colour: show what arrives.
        ctx.beginPath();
        ctx.arc(cx, cy, S * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = COLORS[got];
        ctx.fill();
      }
    },

    mirror(ctx, cx, cy, k, S) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((k * Math.PI) / 8);
      rr(ctx, -S * 0.42, -S * 0.085, S * 0.84, S * 0.17, S * 0.06);
      ctx.fillStyle = T.mirrorBack;
      ctx.fill();
      rr(ctx, -S * 0.4, -S * 0.032, S * 0.8, S * 0.064, S * 0.03);
      ctx.fillStyle = T.mirrorFace;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, S * 0.05, 0, Math.PI * 2);
      ctx.fillStyle = T.board;
      ctx.fill();
      ctx.restore();
    },

    splitter(ctx, cx, cy, k, S) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((k * Math.PI) / 8);
      rr(ctx, -S * 0.42, -S * 0.07, S * 0.84, S * 0.14, S * 0.05);
      ctx.fillStyle = T.splitterGlass;
      ctx.fill();
      ctx.strokeStyle = T.splitterEdge;
      ctx.lineWidth = Math.max(1, S * 0.022);
      ctx.stroke();
      ctx.setLineDash([S * 0.08, S * 0.06]);
      ctx.strokeStyle = T.splitterDash;
      ctx.lineWidth = Math.max(1, S * 0.04);
      ctx.beginPath();
      ctx.moveTo(-S * 0.36, 0);
      ctx.lineTo(S * 0.36, 0);
      ctx.stroke();
      ctx.restore();
    },

    prism(ctx, cx, cy, k, S) {
      ctx.save();
      ctx.translate(cx, cy);
      if (k === 1) ctx.rotate(Math.PI);
      const p = [
        [0, -S * 0.36],
        [-S * 0.35, S * 0.26],
        [S * 0.35, S * 0.26],
      ];
      ctx.beginPath();
      p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = T.prismGlass;
      ctx.fill();
      ctx.strokeStyle = T.prismEdge;
      ctx.lineWidth = Math.max(1, S * 0.03);
      ctx.stroke();
      const g = ctx.createLinearGradient(p[0][0], p[0][1], p[2][0], p[2][1]);
      g.addColorStop(0, COLORS[4]);
      g.addColorStop(0.5, COLORS[2]);
      g.addColorStop(1, COLORS[1]);
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      ctx.lineTo(p[2][0], p[2][1]);
      ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(1.5, S * 0.045);
      ctx.stroke();
      ctx.restore();
    },

    filter(ctx, cx, cy, color, S) {
      rr(ctx, cx - S * 0.3, cy - S * 0.3, S * 0.6, S * 0.6, S * 0.1);
      ctx.fillStyle = COLORS[color];
      ctx.globalAlpha = 0.22;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = COLORS[color];
      ctx.lineWidth = Math.max(1.5, S * 0.04);
      ctx.stroke();
      ctx.strokeStyle = T.filterGlare;
      ctx.lineWidth = Math.max(1, S * 0.02);
      ctx.beginPath();
      ctx.moveTo(cx - S * 0.18, cy - S * 0.18);
      ctx.lineTo(cx - S * 0.05, cy - S * 0.18);
      ctx.stroke();
    },

    piece(ctx, p, cx, cy, S) {
      if (p.type === "mirror") Draw.mirror(ctx, cx, cy, p.k, S);
      else if (p.type === "splitter") Draw.splitter(ctx, cx, cy, p.k, S);
      else if (p.type === "prism") Draw.prism(ctx, cx, cy, p.k, S);
      else if (p.type === "filter") Draw.filter(ctx, cx, cy, p.color, S);
    },

    beam(ctx, x0, y0, x1, y1, c, S) {
      ctx.lineCap = "round";
      const layers = [
        [S * 0.24, 0.07],
        [S * 0.11, 0.22],
        [S * 0.05, 0.75],
      ];
      for (const [w, a] of layers) {
        ctx.globalAlpha = Math.min(1, a * (w > S * 0.06 ? T.beamGlow : 1));
        ctx.strokeStyle = COLORS[c];
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = T.beamCore;
      ctx.lineWidth = Math.max(1, S * 0.018);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* Chevrons travel along the beam in the direction the light moves, so a
       beam bounced straight back reads as arrows going both ways. */
    arrows(ctx, x0, y0, x1, y1, c, S, phase) {
      const len = Math.hypot(x1 - x0, y1 - y0);
      if (len < S * 0.5) return;
      const ux = (x1 - x0) / len,
        uy = (y1 - y0) / len;
      const gap = S * 0.85;
      const a = S * 0.13;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const arrow = c === 7 ? T.beamArrowOnWhite : T.beamArrow;
      ctx.strokeStyle = arrow === "beam" ? COLORS[c] : arrow;
      ctx.lineWidth = Math.max(1.2, S * 0.035);
      for (
        let s = ((phase * gap) % gap) + S * 0.3;
        s < len - S * 0.25;
        s += gap
      ) {
        const px = x0 + ux * s,
          py = y0 + uy * s;
        ctx.globalAlpha =
          0.95 * Math.min(1, s / (S * 0.6), (len - s) / (S * 0.6));
        ctx.beginPath();
        ctx.moveTo(px - ux * a - uy * a, py - uy * a + ux * a);
        ctx.lineTo(px, py);
        ctx.lineTo(px - ux * a + uy * a, py - uy * a - ux * a);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
  };

  /* ------------------------------ compositor ------------------------------ */

  const VS = `
    attribute vec2 p;
    varying vec2 uv;
    void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
  const BLUR_FS = `
    precision mediump float;
    varying vec2 uv;
    uniform sampler2D t;
    uniform vec2 dir;
    void main(){
      vec3 c = texture2D(t, uv).rgb * 0.227;
      c += texture2D(t, uv + dir * 1.385).rgb * 0.316;
      c += texture2D(t, uv - dir * 1.385).rgb * 0.316;
      c += texture2D(t, uv + dir * 3.231).rgb * 0.070;
      c += texture2D(t, uv - dir * 3.231).rgb * 0.070;
      gl_FragColor = vec4(c, 1.0);
    }`;
  /* additive: light glows on a dark board. over: the light layer is painted on
     top and the bloom tints the board towards the beam's colour instead of
     brightening it, which would wash out on a light board. */
  const FINAL_FS = `
    precision mediump float;
    varying vec2 uv;
    uniform sampler2D base;
    uniform sampler2D light;
    uniform sampler2D bloom;
    uniform float strength;
    uniform float additive;
    void main(){
      vec3 b = texture2D(base, uv).rgb;
      vec4 l = texture2D(light, uv);
      vec3 bl = texture2D(bloom, uv).rgb;
      vec3 c;
      if (additive > 0.5) {
        c = b + l.rgb + bl * strength;
      } else {
        c = b * (1.0 - l.a) + l.rgb;
        float peak = max(bl.r, max(bl.g, bl.b));
        vec3 tint = bl / max(peak, 0.001);
        c = mix(c, c * tint, clamp(peak * strength, 0.0, 0.6));
      }
      gl_FragColor = vec4(min(c, vec3(1.0)), 1.0);
    }`;

  class Compositor {
    constructor(canvas) {
      this.canvas = canvas;
      const opts = {
        alpha: false,
        antialias: false,
        premultipliedAlpha: false,
      };
      this.gl =
        canvas.getContext("webgl", opts) ||
        canvas.getContext("experimental-webgl", opts);
      if (this.gl) {
        try {
          this.initGL();
        } catch (e) {
          console.warn("WebGL setup failed, using 2D fallback", e);
          this.gl = null;
        }
      }
      if (!this.gl) this.ctx = canvas.getContext("2d");
    }

    get accelerated() {
      return !!this.gl;
    }

    initGL() {
      const gl = this.gl;
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
          throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const program = (fs) => {
        const p = gl.createProgram();
        gl.attachShader(p, compile(gl.VERTEX_SHADER, VS));
        gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
        gl.bindAttribLocation(p, 0, "p");
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS))
          throw new Error(gl.getProgramInfoLog(p));
        return p;
      };
      this.blurProg = program(BLUR_FS);
      this.finalProg = program(FINAL_FS);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW,
      );
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      this.baseTex = this.texture();
      this.lightTex = this.texture();
      this.fbA = this.target();
      this.fbB = this.target();
    }

    texture() {
      const gl = this.gl;
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }

    target() {
      const gl = this.gl;
      const tex = this.texture();
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        tex,
        0,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { tex, fb, w: 1, h: 1 };
    }

    sizeTarget(t, w, h) {
      if (t.w === w && t.h === h) return;
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        w,
        h,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
      t.w = w;
      t.h = h;
    }

    upload(tex, source, premultiply) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source,
      );
    }

    blur(src, dst, dx, dy) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.viewport(0, 0, dst.w, dst.h);
      gl.useProgram(this.blurProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src);
      gl.uniform1i(gl.getUniformLocation(this.blurProg, "t"), 0);
      gl.uniform2f(gl.getUniformLocation(this.blurProg, "dir"), dx, dy);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    render(base, light, baseDirty) {
      const W = this.canvas.width,
        H = this.canvas.height;
      if (!this.gl) {
        const ctx = this.ctx;
        ctx.globalCompositeOperation = "source-over";
        ctx.filter = "none";
        ctx.drawImage(base, 0, 0);
        ctx.globalCompositeOperation = T.additive ? "lighter" : "source-over";
        ctx.globalAlpha = T.additive ? 1 : 0.35;
        ctx.filter = `blur(${Math.round(W / 60)}px)`;
        ctx.drawImage(light, 0, 0);
        ctx.globalAlpha = 1;
        ctx.filter = "none";
        ctx.drawImage(light, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        return;
      }
      const gl = this.gl;
      if (baseDirty) this.upload(this.baseTex, base, false);
      this.upload(this.lightTex, light, true);

      const bw = Math.max(1, Math.round(W / 2)),
        bh = Math.max(1, Math.round(H / 2));
      this.sizeTarget(this.fbA, bw, bh);
      this.sizeTarget(this.fbB, bw, bh);
      this.blur(this.lightTex, this.fbA, 1.5 / W, 0);
      this.blur(this.fbA.tex, this.fbB, 0, 1.5 / bh);
      this.blur(this.fbB.tex, this.fbA, 3 / bw, 0);
      this.blur(this.fbA.tex, this.fbB, 0, 3 / bh);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      const p = this.finalProg;
      gl.useProgram(p);
      [this.baseTex, this.lightTex, this.fbB.tex].forEach((t, i) => {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, t);
      });
      gl.uniform1i(gl.getUniformLocation(p, "base"), 0);
      gl.uniform1i(gl.getUniformLocation(p, "light"), 1);
      gl.uniform1i(gl.getUniformLocation(p, "bloom"), 2);
      gl.uniform1f(gl.getUniformLocation(p, "strength"), T.bloomStrength);
      gl.uniform1f(gl.getUniformLocation(p, "additive"), T.additive ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  root.PrismRender = { COLORS, Draw, Compositor, readTheme, theme: T };
})(window);
