"use strict";

/* Darkroom look. Pieces are drawn with Canvas 2D onto two layers: "base"
   (matte hardware) and "light" (beams, arrows, lit receivers). WebGL then
   composites them and adds a GPU bloom pass to the light layer. */
(function (root) {
  const COLORS = {
    7: "#fff6e4",
    4: "#ff3b4e",
    2: "#3dff8a",
    1: "#3d7bff",
    6: "#ffd23d",
    3: "#3de8ff",
    5: "#d34dff",
  };
  const BOARD = "#0f1318";
  const DOT = "#26303b";

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  const Draw = {
    board(ctx, S, cols, rows) {
      ctx.fillStyle = BOARD;
      ctx.fillRect(0, 0, cols * S, rows * S);
      ctx.fillStyle = DOT;
      const d = Math.max(1, S * 0.045);
      for (let i = 1; i < cols; i++)
        for (let j = 1; j < rows; j++)
          ctx.fillRect(i * S - d / 2, j * S - d / 2, d, d);
    },

    freeCell(ctx, x, y, S) {
      rr(ctx, x * S + S * 0.12, y * S + S * 0.12, S * 0.76, S * 0.76, S * 0.14);
      ctx.strokeStyle = "rgba(147,163,184,0.22)";
      ctx.lineWidth = Math.max(1, S * 0.02);
      ctx.stroke();
    },

    target(ctx, x, y, S, ok) {
      rr(ctx, x * S + S * 0.06, y * S + S * 0.06, S * 0.88, S * 0.88, S * 0.16);
      ctx.strokeStyle = ok ? "rgba(200,220,255,0.75)" : "rgba(255,90,90,0.6)";
      ctx.lineWidth = Math.max(1.5, S * 0.035);
      ctx.stroke();
    },

    wall(ctx, x, y, S) {
      rr(ctx, x * S + S * 0.08, y * S + S * 0.08, S * 0.84, S * 0.84, S * 0.15);
      ctx.fillStyle = "#1b2129";
      ctx.fill();
      ctx.strokeStyle = "#2c3540";
      ctx.lineWidth = Math.max(1, S * 0.02);
      ctx.stroke();
    },

    source(ctx, cx, cy, d, S) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((d * Math.PI) / 4);
      rr(ctx, -S * 0.38, -S * 0.25, S * 0.64, S * 0.5, S * 0.12);
      ctx.fillStyle = "#1e252e";
      ctx.fill();
      ctx.strokeStyle = "#3a4552";
      ctx.lineWidth = Math.max(1, S * 0.02);
      ctx.stroke();
      ctx.fillStyle = "#2c3540";
      ctx.fillRect(S * 0.26, -S * 0.1, S * 0.16, S * 0.2);
      ctx.restore();
    },

    sourceLight(ctx, cx, cy, d, S) {
      const [dx, dy] = [
        Math.cos((d * Math.PI) / 4),
        Math.sin((d * Math.PI) / 4),
      ];
      const lx = cx - dx * S * 0.2,
        ly = cy - dy * S * 0.2;
      ctx.beginPath();
      ctx.arc(lx, ly, S * 0.06, 0, Math.PI * 2);
      ctx.fillStyle = "#ff3b4e";
      ctx.fill();
    },

    receiver(ctx, cx, cy, c, S) {
      ctx.beginPath();
      ctx.arc(cx, cy, S * 0.36, 0, Math.PI * 2);
      ctx.fillStyle = "#0b0e12";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, S * 0.3, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS[c];
      ctx.globalAlpha = 0.4;
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
        ctx.globalAlpha = 0.45 * pulse;
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
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      } else if (got) {
        // Light is arriving but it is the wrong colour: show what arrives.
        ctx.beginPath();
        ctx.arc(cx, cy, S * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = COLORS[got] || "#ffffff";
        ctx.fill();
      }
    },

    mirror(ctx, cx, cy, k, S) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((k * Math.PI) / 8);
      rr(ctx, -S * 0.42, -S * 0.085, S * 0.84, S * 0.17, S * 0.06);
      ctx.fillStyle = "#4a5563";
      ctx.fill();
      rr(ctx, -S * 0.4, -S * 0.032, S * 0.8, S * 0.064, S * 0.03);
      ctx.fillStyle = "#e8eef5";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, S * 0.05, 0, Math.PI * 2);
      ctx.fillStyle = BOARD;
      ctx.fill();
      ctx.restore();
    },

    splitter(ctx, cx, cy, k, S) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((k * Math.PI) / 8);
      rr(ctx, -S * 0.42, -S * 0.07, S * 0.84, S * 0.14, S * 0.05);
      ctx.fillStyle = "rgba(170,210,255,0.14)";
      ctx.fill();
      ctx.strokeStyle = "#7d8a99";
      ctx.lineWidth = Math.max(1, S * 0.022);
      ctx.stroke();
      ctx.setLineDash([S * 0.08, S * 0.06]);
      ctx.strokeStyle = "#e8eef5";
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
      ctx.fillStyle = "rgba(170,210,255,0.10)";
      ctx.fill();
      ctx.strokeStyle = "rgba(200,230,255,0.9)";
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
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
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
        ctx.globalAlpha = a;
        ctx.strokeStyle = COLORS[c];
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, S * 0.018);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* Chevrons travel along the beam in the direction the light moves, so a
       beam bounced straight back reads as arrows going both ways on one line. */
    arrows(ctx, x0, y0, x1, y1, c, S, phase) {
      const len = Math.hypot(x1 - x0, y1 - y0);
      if (len < S * 0.5) return;
      const ux = (x1 - x0) / len,
        uy = (y1 - y0) / len;
      const gap = S * 0.85;
      const a = S * 0.13;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (
        let s = ((phase * gap) % gap) + S * 0.3;
        s < len - S * 0.25;
        s += gap
      ) {
        const px = x0 + ux * s,
          py = y0 + uy * s;
        const fade = Math.min(1, s / (S * 0.6), (len - s) / (S * 0.6));
        ctx.globalAlpha = 0.95 * fade;
        ctx.strokeStyle = c === 7 ? "#ffd9a8" : "#ffffff";
        ctx.lineWidth = Math.max(1.2, S * 0.035);
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
  const FINAL_FS = `
    precision mediump float;
    varying vec2 uv;
    uniform sampler2D base;
    uniform sampler2D light;
    uniform sampler2D bloom;
    uniform float strength;
    void main(){
      vec3 c = texture2D(base, uv).rgb + texture2D(light, uv).rgb + texture2D(bloom, uv).rgb * strength;
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
        ctx.globalCompositeOperation = "lighter";
        ctx.filter = `blur(${Math.round(W / 60)}px)`;
        ctx.drawImage(light, 0, 0);
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
      gl.uniform1f(gl.getUniformLocation(p, "strength"), 1.25);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  root.PrismRender = { COLORS, Draw, Compositor };
})(window);
