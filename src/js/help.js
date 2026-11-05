"use strict";

/* Help page demos: tiny 5×3 levels whose pieces change every STEP_MS,
   traced and drawn with the same rules and renderer as the game. */
(function () {
  const L = window.PrismLogic;
  const { Draw, Scene, Compositor, readTheme } = window.PrismRender;
  const E = 0,
    S = 2,
    W = 4;
  const R = 4,
    G = 2,
    B = 1,
    WH = 7;
  const STEP_MS = 1600;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const level = (o) => ({
    cols: 5,
    rows: 3,
    walls: [],
    receivers: [],
    sources: [],
    ...o,
  });
  const laser = (c = WH) => ({ x: 0, y: 1, d: E, c });

  const DEMOS = {
    arrows: () => ({
      level: level({ sources: [laser()] }),
      pieces: [{ type: "mirror", x: 3, y: 1, k: 4 }],
    }),
    finish: () => ({
      level: level({ sources: [laser()], receivers: [{ x: 2, y: 2, c: WH }] }),
      pieces: [{ type: "mirror", x: 2, y: 1, k: 2 }],
      charge: true,
    }),
    mixing: (step) => {
      const which = step % 3;
      const sources = [];
      if (which !== 1) sources.push({ x: 0, y: 1, d: E, c: R });
      if (which !== 0) sources.push({ x: 4, y: 1, d: W, c: B });
      return {
        level: level({ sources, receivers: [{ x: 2, y: 1, c: R | B }] }),
        pieces: [],
      };
    },
    laser: () => ({
      level: level({ sources: [laser()], walls: [[3, 1]] }),
      pieces: [],
    }),
    receiver: (step) => ({
      level: level({
        sources: [laser([WH, G, R][step % 3])],
        receivers: [{ x: 4, y: 1, c: R }],
      }),
      pieces: [],
    }),
    door: (step) => ({
      level: level({
        sources: [laser([WH, G, B, R][step % 4])],
        doors: [[2, 1, R]],
        receivers: [{ x: 4, y: 1, c: R }],
      }),
      pieces: [],
    }),
    sensor: (step) => ({
      level: level({
        sources: [laser()],
        sensors: [[4, 1]],
        receivers: [{ x: 2, y: 2, c: WH }],
      }),
      pieces: [{ type: "mirror", x: 2, y: 1, k: step % 2 ? 2 : 0 }],
    }),
    portal: () => ({
      level: level({
        sources: [{ x: 0, y: 0, d: E, c: WH }],
        portals: [[2, 0, 2, 2]],
        receivers: [{ x: 4, y: 2, c: WH }],
      }),
      pieces: [],
    }),
    mirror: (step) => ({
      level: level({ sources: [laser()], receivers: [{ x: 2, y: 2, c: WH }] }),
      pieces: [{ type: "mirror", x: 2, y: 1, k: step % 8 }],
    }),
    splitter: (step) => ({
      level: level({
        sources: [laser()],
        receivers: [
          { x: 2, y: 0, c: WH },
          { x: 4, y: 1, c: WH },
        ],
      }),
      pieces: [{ type: "splitter", x: 2, y: 1, k: step % 2 ? 6 : 2 }],
    }),
    prism: (step) => ({
      level: level({
        sources: [laser()],
        receivers: [
          { x: 3, y: 0, c: R },
          { x: 4, y: 1, c: G },
          { x: 3, y: 2, c: B },
        ],
      }),
      pieces: [{ type: "prism", x: 2, y: 1, k: step % 2 }],
    }),
    filter: (step) => ({
      level: level({
        sources: [laser()],
        receivers: [{ x: 4, y: 1, c: R | G }],
      }),
      pieces: [
        { type: "filter", x: 2, y: 1, k: 0, color: [3, 5, 6, 4][step % 4] },
      ],
    }),
    fixed: (step) => ({
      level: level({ sources: [laser()], receivers: [{ x: 2, y: 2, c: WH }] }),
      pieces: [{ type: "mirror", x: 2, y: 1, k: (step % 4) + 1, fixed: true }],
    }),
  };

  const demos = [...document.querySelectorAll("canvas[data-demo]")].map(
    (canvas) => {
      const base = document.createElement("canvas");
      const light = document.createElement("canvas");
      return {
        canvas,
        make: DEMOS[canvas.dataset.demo],
        base,
        light,
        bctx: base.getContext("2d"),
        lctx: light.getContext("2d"),
        comp: new Compositor(canvas, { webgl: false }),
        S: 0,
      };
    },
  );

  function size(d) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = d.canvas.getBoundingClientRect().width || 150;
    const S = Math.max(8, Math.floor((w * dpr) / 5));
    if (S === d.S) return;
    d.S = S;
    [d.canvas, d.base, d.light].forEach((c) => {
      c.width = S * 5;
      c.height = S * 3;
    });
  }

  function draw(d, t) {
    size(d);
    const step = Math.floor(t / STEP_MS);
    const { level: lv, pieces, charge } = d.make(step);
    const result = L.trace(lv, pieces);
    const S = d.S;

    d.bctx.setTransform(1, 0, 0, 1, 0, 0);
    Scene.base(d.bctx, lv, pieces, S, null);

    const ctx = d.lctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, d.light.width, d.light.height);
    ctx.globalCompositeOperation = "lighter";
    Scene.light(ctx, lv, result, S, t, reduceMotion ? 0.5 : (t / 1000) * 1.5);
    if (charge) {
      const p = Math.min(1, (t % 3200) / 2200);
      lv.receivers.forEach((r) =>
        Draw.receiverCharge(
          ctx,
          Scene.center(r.x, S),
          Scene.center(r.y, S),
          r.c,
          p,
          S,
        ),
      );
    }
    ctx.globalCompositeOperation = "source-over";
    d.comp.render(d.base, d.light, true);
  }

  function frame(t) {
    demos.forEach((d) => draw(d, t));
    requestAnimationFrame(frame);
  }

  readTheme();
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", readTheme);
  requestAnimationFrame(frame);
})();
