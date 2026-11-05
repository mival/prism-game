"use strict";

(function () {
  const L = window.PrismLogic;
  const { Draw, Scene, Compositor, readTheme, theme } = window.PrismRender;
  const $ = (id) => document.getElementById(id);

  const el = {
    stage: $("stage"),
    board: $("board"),
    tray: $("tray"),
    levelNo: $("levelNo"),
    levelName: $("levelName"),
    lit: $("lit"),
    status: $("status"),
    statusText: $("statusText"),
    next: $("next"),
    reset: $("reset"),
    theme: $("theme"),
    hint: $("hint"),
    prev: $("prevLevel"),
    fwd: $("nextLevel"),
    levelsBtn: $("levelsBtn"),
    doneCount: $("doneCount"),
    dialog: $("levelDialog"),
    grid: $("levelGrid"),
  };

  const DRAG_START_PX = 8;
  /* A level only counts as finished once its solution has stayed correct
     this long, so tapping pieces at random can't finish it by passing
     through a solved state on the way to the next rotation. */
  const SOLVE_HOLD_MS = 1500;
  /* After this long without a move, the hint button offers itself. */
  const STUCK_MS = 30000;
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
    holdSince: null,
    confirmed: false,
    lastMove: 0,
    stuck: false,
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
    state.pieces = L.fixedPieces(level());
    state.inv = { ...level().tray };
    state.armed = null;
    state.drag = null;
    el.levelNo.textContent =
      "LEVEL " +
      String(i + 1).padStart(2, "0") +
      " / " +
      String(L.LEVELS.length).padStart(2, "0");
    el.levelName.textContent = level().name;
    el.prev.disabled = i === 0;
    el.fwd.disabled = i === L.LEVELS.length - 1;
    save("prism.level", i);
    update();
  }

  /* Call after every change the player (or a hint) makes. */
  function update() {
    const lv = level();
    state.result = L.trace(lv, state.pieces);
    const n = state.result.lit.filter(Boolean).length;
    el.lit.textContent = `${n} / ${lv.receivers.length} lit`;
    state.holdSince = state.result.solved ? performance.now() : null;
    state.confirmed = false;
    state.lastMove = performance.now();
    state.stuck = false;
    el.hint.classList.remove("nudge");
    el.lit.classList.remove("all");
    el.board.setAttribute(
      "aria-label",
      `Puzzle board, ${n} of ${lv.receivers.length} receivers lit`,
    );
    renderStatus();
    renderTray();
    renderLevels();
    state.baseDirty = true;
  }

  function confirmSolved() {
    const lv = level();
    state.confirmed = true;
    state.holdSince = null;
    el.lit.classList.add("all");
    if (!state.done.has(lv.id)) {
      state.done.add(lv.id);
      save("prism.done", [...state.done]);
    }
    renderStatus();
    renderLevels();
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
    if (states > 1 && !p.hinted) {
      p.k = (p.k + 1) % states;
      update();
    }
  }

  const movable = (p) => !p.fixed && !p.hinted;

  /* ------------------------------ hints ------------------------------ */

  /* Each level stores one known solution. A hint makes one part of the board
     match it: it turns a fixed piece, or places one tray piece in its correct
     spot (clearing the tile first and taking the piece off the board if the
     tray has none left), and locks that piece. Once every solution piece is
     in place, further hints take extra pieces back to the tray. */
  function giveHint() {
    if (state.confirmed) return;
    const lv = level();
    const sol = lv.solution;
    const fixed = state.pieces.filter((p) => p.fixed);
    for (let i = 0; i < fixed.length; i++) {
      if (fixed[i].k !== sol.fixed[i]) {
        fixed[i].k = sol.fixed[i];
        fixed[i].hinted = true;
        return update();
      }
    }
    for (const s of sol.placed) {
      const here = state.pieces.find((p) => p.x === s.x && p.y === s.y);
      if (here && here.trayId === s.id && here.k === s.k) {
        if (!here.hinted) {
          here.hinted = true;
          return update();
        }
        continue;
      }
      if (here) {
        state.pieces = state.pieces.filter((p) => p !== here);
        state.inv[here.trayId]++;
      }
      if (state.inv[s.id] <= 0) {
        const spare = state.pieces.find(
          (p) =>
            p.trayId === s.id &&
            !p.hinted &&
            !sol.placed.some(
              (o) =>
                o.x === p.x && o.y === p.y && o.id === p.trayId && o.k === p.k,
            ),
        );
        if (spare) {
          state.pieces = state.pieces.filter((p) => p !== spare);
          state.inv[s.id]++;
        }
      }
      const p = L.pieceFromTrayId(s.id, s.x, s.y);
      p.trayId = s.id;
      p.k = s.k;
      p.hinted = true;
      state.pieces.push(p);
      state.inv[s.id]--;
      state.armed = null;
      return update();
    }
    const extra = state.pieces.find((p) => !p.fixed && !p.hinted);
    if (extra) {
      state.pieces = state.pieces.filter((p) => p !== extra);
      state.inv[extra.trayId]++;
      update();
    }
  }

  el.hint.addEventListener("click", giveHint);

  /* ------------------------------ UI chrome ------------------------------ */

  function renderStatus() {
    const last = state.level === L.LEVELS.length - 1;
    const won = state.confirmed;
    const res = state.result;
    const holding = res.solved && !won;
    const burning = res.dark.some((d) => !d);
    el.status.classList.toggle("win", won);
    el.status.classList.toggle("warn", !won && burning);
    el.statusText.textContent = won
      ? last
        ? "Level complete. That was the last one."
        : "Level complete."
      : holding
        ? "All receivers lit. Keep it like this to finish the level."
        : burning && res.lit.every(Boolean)
          ? "Every receiver is lit, but light is hitting a dark sensor."
          : state.stuck
            ? "Stuck? The hint button places one piece in its correct spot."
            : level().hint;
    el.next.hidden = !won || last;
    el.hint.disabled = won;
  }

  function renderLevels() {
    el.doneCount.textContent = `${state.done.size}/${L.LEVELS.length} done`;
    el.grid.textContent = "";
    L.LEVELS.forEach((lv, i) => {
      const b = document.createElement("button");
      b.type = "button";
      const solved = state.done.has(lv.id);
      b.className = "level-cell" + (solved ? " done" : "");
      if (i === state.level) b.setAttribute("aria-current", "true");
      b.setAttribute(
        "aria-label",
        `Level ${i + 1}, ${lv.name}${solved ? ", solved" : ""}`,
      );
      const num = document.createElement("span");
      num.className = "num";
      num.textContent = i + 1;
      const name = document.createElement("span");
      name.className = "nm";
      name.textContent = lv.name;
      b.append(num, name);
      b.addEventListener("click", () => {
        el.dialog.close();
        loadLevel(i);
      });
      el.grid.appendChild(b);
    });
  }

  el.levelsBtn.addEventListener("click", () => {
    if (el.dialog.showModal) el.dialog.showModal();
    else el.dialog.setAttribute("open", "");
    const cur = el.grid.querySelector('[aria-current="true"]');
    if (cur) cur.focus();
  });
  el.dialog.addEventListener("click", (e) => {
    if (e.target === el.dialog) el.dialog.close();
  });
  el.prev.addEventListener("click", () =>
    loadLevel(Math.max(0, state.level - 1)),
  );
  el.fwd.addEventListener("click", () =>
    loadLevel(Math.min(L.LEVELS.length - 1, state.level + 1)),
  );

  const trayName = (id) => {
    const [type, mask] = id.split(":");
    return type === "filter"
      ? `${L.COLOR_NAMES[mask]} filter`
      : L.PIECES[type].label;
  };

  function renderTray() {
    el.tray.textContent = "";
    const ids = Object.keys(level().tray);
    el.tray.toggleAttribute("data-many", ids.length > 4);
    ids.forEach((id) => {
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
      Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > DRAG_START_PX &&
      (d.kind === "tray" || movable(d.piece))
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

  const center = Scene.center;

  function drawBase() {
    const S = state.S,
      lv = level(),
      ctx = bctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const d = state.drag;
    Scene.base(ctx, lv, state.pieces, S, null);

    if (state.armed || (d && d.active)) {
      for (let x = 0; x < L.COLS; x++)
        for (let y = 0; y < L.ROWS; y++)
          if (L.isFree(lv, state.pieces, x, y)) Draw.freeCell(ctx, x, y, S);
    }

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
    Scene.light(ctx, lv, state.result, S, t, phase);

    const charge = state.confirmed
      ? 1
      : state.holdSince !== null && !(state.drag && state.drag.active)
        ? Math.min(1, (t - state.holdSince) / SOLVE_HOLD_MS)
        : 0;
    if (charge > 0)
      lv.receivers.forEach((r) =>
        Draw.receiverCharge(
          ctx,
          center(r.x, S),
          center(r.y, S),
          r.c,
          charge,
          S,
        ),
      );
    ctx.globalCompositeOperation = "source-over";
  }

  function frame(t) {
    if (
      state.holdSince !== null &&
      !state.confirmed &&
      !(state.drag && state.drag.active) &&
      t - state.holdSince >= SOLVE_HOLD_MS
    )
      confirmSolved();
    if (
      !state.confirmed &&
      !state.stuck &&
      !state.drag &&
      t - state.lastMove >= STUCK_MS
    ) {
      state.stuck = true;
      el.hint.classList.add("nudge");
      renderStatus();
    }
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
  const savedLevel = Number(load("prism.level", 0));
  loadLevel(savedLevel >= 0 && savedLevel < L.LEVELS.length ? savedLevel : 0);
  applyTheme();
  layout();
  requestAnimationFrame(frame);

  window.__prism = {
    state,
    L,
    accelerated: compositor.accelerated,
    theme,
    giveHint,
    loadLevel,
  };
})();
