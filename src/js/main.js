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
    levelDiff: $("levelDiff"),
    lit: $("lit"),
    dailyCard: $("dailyCard"),
    dailyDate: $("dailyDate"),
    dailyDiff: $("dailyDiff"),
    dailyPlay: $("dailyPlay"),
    dailyNote: $("dailyNote"),
    undo: $("undo"),
    redo: $("redo"),
    status: $("status"),
    statusText: $("statusText"),
    next: $("next"),
    reset: $("reset"),
    hint: $("hint"),
    prev: $("prevLevel"),
    fwd: $("nextLevel"),
    levelsBtn: $("levelsBtn"),
    doneCount: $("doneCount"),
    dialog: $("levelDialog"),
    grid: $("levelGrid"),
    codeForm: $("codeForm"),
    codeInput: $("codeInput"),
    codeError: $("codeError"),
    currentCode: $("currentCode"),
    codeText: $("codeText"),
    copyCode: $("copyCode"),
    tools: $("pieceTools"),
    building: $("building"),
    buildTitle: $("buildTitle"),
    buildInfo: $("buildInfo"),
    buildProgress: $("buildProgress"),
    buildCancel: $("buildCancel"),
    cursor: $("cellCursor"),
  };

  const DRAG_START_PX = 8;
  /* A level only counts as finished once its solution has stayed correct
     this long, so tapping pieces at random can't finish it by passing
     through a solved state on the way to the next rotation. */
  const SOLVE_HOLD_MS = 1500;
  /* Text in the player's language (src/js/i18n.js). */
  const I18n = window.PrismI18n;
  const t = I18n.t;
  /* Sound effects (src/js/sound.js); every call is a no-op when muted. */
  const Sound = window.PrismSound;
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
    /* Fewest hints each campaign level was solved with: { id: count }. */
    bestHints: load("prism.hints", {}),
    /* Hints used on the level being played. Kept across Reset and page
       reloads, so resetting after a hint doesn't make it a hint-free solve. */
    attempt: load("prism.attempt", { id: null, hints: 0 }),
    endless: null,
    endlessSolved: load("prism.endless", { easy: 0, medium: 0, hard: 0 }),
    /* Daily level: last date solved (YYYY-MM-DD) and the streak of days. */
    daily: load("prism.daily", { last: null, streak: 0 }),
    prefetch: null,
    /* Undo and redo: board snapshots before each change. */
    undo: [],
    redo: [],
    /* This attempt: moves made and active play time. */
    moves: 0,
    playMs: 0,
    playFrom: null,
    /* Best solve per campaign level: { id: { moves, ms } }. */
    bestStats: load("prism.stats", {}),
    lastSolve: null,
    busy: false,
    S: 1,
    baseDirty: true,
  };

  const level = () =>
    state.endless ? state.endless.level : L.LEVELS[state.level];

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

  /* The theme is chosen on the Settings page; this applies it. */
  function applyTheme() {
    readTheme();
    document.querySelector('meta[name="theme-color"]').content =
      theme.themeColor;
    renderTray();
    state.baseDirty = true;
  }

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", applyTheme);

  /* ------------------------------ state ------------------------------ */

  function startLevel(lv) {
    state.prevLit = null;
    state.undo = [];
    state.redo = [];
    state.moves = 0;
    state.playMs = 0;
    state.playFrom = document.hidden ? null : performance.now();
    state.lastSolve = null;
    Sound.holdStop();
    state.pieces = L.fixedPieces(lv);
    state.inv = { ...lv.tray };
    state.armed = null;
    state.drag = null;
    hideTools();
    update();
    renderUndo();
  }

  function loadLevel(i) {
    if (state.attempt.id !== L.LEVELS[i].id) {
      state.attempt = { id: L.LEVELS[i].id, hints: 0 };
      save("prism.attempt", state.attempt);
    }
    state.level = i;
    state.endless = null;
    if (state.prefetch) {
      state.prefetch.job.cancel();
      state.prefetch = null;
    }
    // The word "LEVEL" is dropped on narrow screens to leave room for the
    // difficulty tag.
    el.levelNo.innerHTML =
      `<span class="lvl-word">${t("levelWord")}</span>` +
      String(i + 1).padStart(2, "0") +
      " / " +
      String(L.LEVELS.length).padStart(2, "0");
    el.levelName.textContent = levelName(level());
    showDifficulty(level().difficulty);
    el.prev.disabled = i === 0;
    el.fwd.disabled = i === L.LEVELS.length - 1;
    el.prev.setAttribute("aria-label", t("prevLevel"));
    el.fwd.setAttribute("aria-label", t("nextLevel"));
    el.prev.title = t("prevLevel");
    el.fwd.title = t("nextLevel");
    save("prism.levelId", L.LEVELS[i].id);
    if (location.hash) history.replaceState(null, "", location.pathname);
    startLevel(level());
  }

  /* ------------------------------ endless ------------------------------ */

  /* Endless levels are built by src/js/generator.js in a Web Worker so the
     board keeps animating. Pages opened from file:// can't start workers;
     there the level is built on the page instead. While a level is being
     played, the next one of the same difficulty is already being built. */
  const DIFF_LABEL = { easy: t("easy"), medium: t("medium"), hard: t("hard") };

  /* A level's name and hint in the current language. Endless levels get
     their hint from what they contain. */
  const levelName = (lv) =>
    lv.code ? I18n.endlessName(lv.name) : I18n.levelText(lv).name;
  function levelHint(lv) {
    if (!lv.code) return I18n.levelText(lv).hint;
    const parts = [];
    if (lv.portals) parts.push(t("mPortals"));
    if (lv.sensors) parts.push(t("mSensors"));
    if (lv.doors) parts.push(t("mDoors"));
    if (lv.fixed) parts.push(t("mFixed"));
    if (lv.sources.length > 1) parts.push(t("mLasers"));
    const pieces = Object.values(lv.tray).reduce((a, b) => a + b, 0);
    const decoys = pieces > lv.solution.placed.length;
    return (
      (parts.length
        ? t("hasThese", { list: I18n.list(parts) })
        : t("lightAll")) + (decoys ? t("notEvery") : "")
    );
  }

  /* The tag beside the level number: how hard this level is. */
  function showDifficulty(d) {
    el.levelDiff.hidden = !d;
    if (!d) return;
    el.levelDiff.textContent = DIFF_LABEL[d];
    el.levelDiff.className = "rating " + d;
  }
  /* Builds Endless levels in Web Workers. A new level is searched for on
     several cores at once: each worker tries different seeds and the first
     level found wins (its code is its own seed, so any winner is valid).
     A code rebuilds exactly one seed, on one worker. Without workers
     (file://) the level is built on the page. Each build can be cancelled. */
  const Builder = (function () {
    const SCRIPT = "src/js/endless-worker.js";
    const CORES = Math.max(
      1,
      Math.min(4, (navigator.hardwareConcurrency || 2) - 1),
    );
    let supported = typeof Worker !== "undefined";

    function local(msg) {
      return new Promise((resolve) =>
        setTimeout(() => {
          const G = window.PrismGen;
          resolve(
            msg.code
              ? G.fromCode(msg.code)
              : G.makeLevel(msg.difficulty, msg.seed, 120000),
          );
        }, 30),
      );
    }

    /* Returns { promise, cancel }. The promise gives the level, or null if
       none was found or the build was cancelled. */
    /* `exact`: return the level with the lowest valid seed at or after
       msg.seed, so every device builds the same one (the daily level).
       Workers keep searching their share of seeds until they find a level
       or pass the best one found so far. */
    function build(msg, { cores = 1, onProgress, exact = false } = {}) {
      let workers = [];
      try {
        if (supported)
          for (let i = 0; i < (msg.code ? 1 : cores); i++)
            workers.push(new Worker(SCRIPT));
      } catch (e) {
        supported = false;
        workers.forEach((w) => w.terminate());
        workers = [];
      }
      if (!workers.length) return { promise: local(msg), cancel() {} };

      let finish;
      const promise = new Promise((resolve) => (finish = resolve));
      let done = false;
      const end = (result) => {
        if (done) return;
        done = true;
        workers.forEach((w) => w.terminate());
        finish(result);
      };
      const tried = workers.map(() => 0);
      let left = workers.length;
      let failed = false;
      let best = null;
      const seedOf = (lv) => Number(lv.code.split("-")[1]);
      const stopped = workers.map(() => false);
      const finish1 = (i) => {
        if (stopped[i]) return;
        stopped[i] = true;
        if (--left === 0) end(best || (failed ? local(msg) : null));
      };
      workers.forEach((w, i) => {
        w.onmessage = (e) => {
          if ("tried" in e.data) {
            tried[i] = e.data.tried;
            if (onProgress) onProgress(tried.reduce((a, b) => a + b, 0));
            // Past the best seed found so far: nothing lower can come from here.
            const at = msg.seed + i + (tried[i] - 1) * workers.length;
            if (exact && best && at > seedOf(best)) {
              w.terminate();
              finish1(i);
            }
            return;
          }
          if (!exact) {
            if (e.data.level) return end(e.data.level);
            if (--left === 0) end(failed ? local(msg) : null);
            return;
          }
          const lv = e.data.level;
          if (lv && (!best || seedOf(lv) < seedOf(best))) best = lv;
          finish1(i);
          // Others already past it can stop now.
          workers.forEach((x, j) => {
            const at = msg.seed + j + (tried[j] - 1) * workers.length;
            if (!stopped[j] && tried[j] && at > seedOf(best)) {
              x.terminate();
              finish1(j);
            }
          });
        };
        w.onerror = (e) => {
          e.preventDefault();
          failed = true;
          if (exact) return finish1(i);
          if (--left === 0) end(local(msg));
        };
        w.postMessage(
          msg.code ? msg : { ...msg, seed: msg.seed + i, step: workers.length },
        );
      });
      return { promise, cancel: () => end(null) };
    }
    return { build, CORES };
  })();

  const randomSeed = () => 1 + Math.floor(Math.random() * 999999);

  /* The next level of the same difficulty is built in the background on
     one core while the player plays, so "New level" is usually instant. */
  function prefetch(difficulty) {
    if (state.prefetch) state.prefetch.job.cancel();
    const job = Builder.build({ difficulty, seed: randomSeed() });
    const pf = { difficulty, job, level: undefined };
    job.promise.then((lv) => (pf.level = lv));
    state.prefetch = pf;
  }

  /* ------------------------------ building overlay ------------------------------ */

  /* Shown over the board when a build takes more than a moment: what is
     being built, roughly how long it takes, live progress, and Cancel. */
  const TYPICAL = {
    easy: t("typicalEasy"),
    medium: t("typicalMedium"),
    hard: t("typicalHard"),
  };
  const building = { job: null, timer: 0, tick: 0, started: 0, tried: 0 };

  function showBuilding(title, difficulty) {
    el.buildTitle.textContent = title;
    el.buildInfo.textContent = difficulty
      ? TYPICAL[difficulty]
      : t("rebuilding");
    el.buildProgress.textContent = "";
    el.building.hidden = false;
    building.tick = setInterval(renderProgress, 250);
  }
  function renderProgress() {
    const s = Math.floor((performance.now() - building.started) / 1000);
    const parts = [];
    if (building.tried) parts.push(t("tried", { n: building.tried }));
    if (s >= 1) parts.push(`${s} s`);
    el.buildProgress.textContent = parts.join(" · ");
  }
  function hideBuilding() {
    clearTimeout(building.timer);
    clearInterval(building.tick);
    building.job = null;
    el.building.hidden = true;
  }
  el.buildCancel.addEventListener("click", () => {
    if (building.job) building.job.cancel();
  });

  /* ------------------------------ daily ------------------------------ */

  /* One level per day, the same for everyone on the same date: its seed
     comes from the date, and the lowest valid seed from there is used. */
  const DAILY_BY_WEEKDAY = [
    "hard", // Sunday
    "easy",
    "medium",
    "hard",
    "easy",
    "medium",
    "hard",
  ];
  const dayKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  function dailyFor(d = new Date()) {
    const key = dayKey(d);
    let h = 0x811c9dc5;
    for (const ch of "prism-daily-" + key)
      h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
    return {
      key,
      difficulty: DAILY_BY_WEEKDAY[d.getDay()],
      seed: 1 + (h % 900000),
    };
  }
  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dayKey(d);
  }
  /* The streak only counts if the last solve was today or yesterday. */
  const currentStreak = () =>
    state.daily.last === dayKey() || state.daily.last === yesterdayKey()
      ? state.daily.streak
      : 0;
  function recordDaily(key) {
    if (state.daily.last === key) return;
    state.daily = {
      last: key,
      streak: state.daily.last === yesterdayKey() ? state.daily.streak + 1 : 1,
    };
    save("prism.daily", state.daily);
  }
  function renderDaily() {
    const d = dailyFor();
    const date = new Date().toLocaleDateString(I18n.locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    el.dailyDate.textContent = date;
    el.dailyDiff.textContent = DIFF_LABEL[d.difficulty];
    el.dailyDiff.className = "rating " + d.difficulty;
    const solved = state.daily.last === d.key;
    el.dailyPlay.textContent = solved ? t("playAgain") : t("play");
    const streak = currentStreak();
    el.dailyNote.textContent = solved
      ? t("dailySolved", { streak })
      : streak > 0
        ? t("dailyStreak", { streak })
        : t("dailyFresh");
    el.dailyCard.classList.toggle("done", solved);
  }
  el.dailyPlay.addEventListener("click", () => playEndless(null, null, true));

  async function playEndless(difficulty, code, daily = false) {
    if (state.busy) return;
    if (el.dialog.open) el.dialog.close();
    state.busy = true;
    state.drag = null;
    state.armed = null;
    const today = daily ? dailyFor() : null;
    if (today) difficulty = today.difficulty;
    const title = daily
      ? t("buildDaily")
      : code
        ? t("buildCode")
        : t("build" + difficulty[0].toUpperCase() + difficulty.slice(1));
    el.status.classList.remove("win", "warn");
    el.statusText.textContent = title;
    el.status.classList.add("busy");
    el.next.hidden = true;

    let lv = null;
    const pf = state.prefetch;
    if (!code && !daily && pf && pf.difficulty === difficulty && pf.level) {
      // Ready in the background: no wait at all.
      lv = pf.level;
      state.prefetch = null;
    } else {
      // Build now on every core; a half-done background build is dropped.
      if (pf) pf.job.cancel();
      state.prefetch = null;
      building.started = performance.now();
      building.tried = 0;
      const job = Builder.build(
        code
          ? { code }
          : { difficulty, seed: daily ? today.seed : randomSeed() },
        {
          cores: Builder.CORES,
          onProgress: (n) => (building.tried = n),
          exact: daily,
        },
      );
      building.job = job;
      // Only show the overlay if the wait is noticeable.
      building.timer = setTimeout(
        () => showBuilding(title, code ? null : difficulty),
        300,
      );
      lv = await job.promise;
      hideBuilding();
    }
    state.busy = false;
    el.status.classList.remove("busy");
    if (!lv) {
      renderStatus();
      if (code) showCodeError(true);
      return;
    }
    state.endless = {
      difficulty: lv.difficulty,
      level: lv,
      daily: daily ? today.key : null,
    };
    el.levelNo.textContent = daily
      ? t("daily") +
        " · " +
        new Date()
          .toLocaleDateString(I18n.locale, { day: "numeric", month: "short" })
          .toUpperCase()
      : t("endless");
    el.levelName.textContent = levelName(lv);
    showDifficulty(lv.difficulty);
    el.prev.disabled = false;
    el.fwd.disabled = false;
    el.prev.setAttribute("aria-label", t("backToLevels"));
    el.fwd.setAttribute("aria-label", t("newLevel"));
    el.prev.title = t("backToLevels");
    el.fwd.title = t("newLevel");
    history.replaceState(null, "", "#" + lv.code);
    startLevel(lv);
    renderEndless();
    prefetch(lv.difficulty);
  }

  function showCodeError(show) {
    el.codeError.hidden = !show;
  }

  function renderEndless() {
    document.querySelectorAll("[data-diff]").forEach((b) => {
      const n = state.endlessSolved[b.dataset.diff] || 0;
      b.querySelector(".solved").textContent = t("solvedCount", { n });
    });
    el.currentCode.hidden = !state.endless;
    if (state.endless) el.codeText.textContent = state.endless.level.code;
  }

  document
    .querySelectorAll("[data-diff]")
    .forEach((b) =>
      b.addEventListener("click", () => playEndless(b.dataset.diff)),
    );
  el.codeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = el.codeInput.value.trim().toUpperCase();
    if (!/^[EMH]-?\d{1,9}$/.test(code)) return showCodeError(true);
    showCodeError(false);
    playEndless(null, code);
  });
  el.copyCode.addEventListener("click", () => {
    const link =
      location.origin + location.pathname + "#" + state.endless.level.code;
    const done = () => {
      el.copyCode.textContent = t("copied");
      setTimeout(() => (el.copyCode.textContent = t("copyLink")), 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(link).then(done, () => {});
  });

  /* Call after every change the player (or a hint) makes. */
  function update() {
    const lv = level();
    state.result = L.trace(lv, state.pieces);
    playChanges(lv, state.result);
    const n = state.result.lit.filter(Boolean).length;
    el.lit.textContent = t("lit", { n, total: lv.receivers.length });
    state.holdSince = state.result.solved ? performance.now() : null;
    state.confirmed = false;
    state.lastMove = performance.now();
    state.stuck = false;
    el.hint.classList.remove("nudge");
    el.lit.classList.remove("all");
    el.board.setAttribute(
      "aria-label",
      t("board", { n, total: lv.receivers.length }),
    );
    renderStatus();
    renderTray();
    renderLevels();
    syncTools();
    state.baseDirty = true;
  }

  /* Sounds for what the last change did to the light: a note for each
     receiver that just lit, a buzz if a sensor was just hit, and the chord
     that swells while a solved board holds. */
  function playChanges(lv, r) {
    if (state.prevLit) {
      let n = 0;
      r.lit.forEach((on, i) => {
        if (on && !state.prevLit[i]) Sound.lit(lv.receivers[i].c, 0.07 * n++);
      });
      if (r.sensorHits.some((h, i) => h && !state.prevSensors[i]))
        Sound.sensor();
    }
    state.prevLit = r.lit.slice();
    state.prevSensors = r.sensorHits.slice();
    Sound.holdStop();
    if (r.solved) Sound.holdStart(SOLVE_HOLD_MS);
  }

  function confirmSolved() {
    const lv = level();
    Sound.solved();
    state.confirmed = true;
    pauseClock();
    recordSolve(lv);
    renderUndo();
    state.holdSince = null;
    el.lit.classList.add("all");
    if (state.endless && state.endless.daily) {
      recordDaily(state.endless.daily);
      renderDaily();
    } else if (state.endless) {
      const d = state.endless.difficulty;
      state.endlessSolved[d] = (state.endlessSolved[d] || 0) + 1;
      save("prism.endless", state.endlessSolved);
      renderEndless();
    } else {
      if (!state.done.has(lv.id)) {
        state.done.add(lv.id);
        save("prism.done", [...state.done]);
      }
      // Keep the best (fewest hints) solve; replaying starts a new count.
      const used = state.attempt.id === lv.id ? state.attempt.hints : 0;
      const best = state.bestHints[lv.id];
      if (best === undefined || used < best) {
        state.bestHints[lv.id] = used;
        save("prism.hints", state.bestHints);
      }
      state.attempt = { id: lv.id, hints: 0 };
      save("prism.attempt", state.attempt);
    }
    renderStatus();
    renderLevels();
  }

  /* ------------------------------ undo ------------------------------ */

  /* The board as text: enough to put it back exactly. */
  function snapshot() {
    // Fixed pieces keep their order (hints rely on it); the rest are sorted
    // by tile, so dragging a piece back to its own tile is no change.
    const fixed = state.pieces.filter((p) => p.fixed);
    const placed = state.pieces
      .filter((p) => !p.fixed)
      .sort((a, b) => a.y - b.y || a.x - b.x);
    return JSON.stringify({
      pieces: fixed.concat(placed).map((p) => ({
        type: p.type,
        x: p.x,
        y: p.y,
        k: p.k,
        color: p.color,
        trayId: p.trayId,
        fixed: p.fixed,
        hinted: p.hinted,
      })),
      inv: state.inv,
    });
  }
  function restoreSnapshot(snap) {
    const s = JSON.parse(snap);
    state.pieces = s.pieces.map((p) => {
      const q = { ...p };
      for (const k of Object.keys(q)) if (q[k] === undefined) delete q[k];
      return q;
    });
    state.inv = s.inv;
    state.armed = null;
    hideTools();
    update();
  }
  /* Records `before` as an undo step if the board really changed (moving a
     piece back where it was is not a step). Player moves count as moves;
     hints don't. */
  function commit(before, move) {
    if (snapshot() === before) return;
    state.undo.push(before);
    if (state.undo.length > 300) state.undo.shift();
    state.redo = [];
    if (move) state.moves++;
    renderUndo();
  }
  function act(fn, move = true) {
    const before = snapshot();
    fn();
    commit(before, move);
  }
  function undo() {
    if (!state.undo.length || state.confirmed || state.busy || state.drag)
      return;
    state.redo.push(snapshot());
    restoreSnapshot(state.undo.pop());
    Sound.pickup();
    renderUndo();
  }
  function redo() {
    if (!state.redo.length || state.confirmed || state.busy || state.drag)
      return;
    state.undo.push(snapshot());
    restoreSnapshot(state.redo.pop());
    Sound.pickup();
    renderUndo();
  }
  function renderUndo() {
    el.undo.disabled = !state.undo.length || state.confirmed;
    el.redo.disabled = !state.redo.length || state.confirmed;
  }
  el.undo.addEventListener("click", undo);
  el.redo.addEventListener("click", redo);
  window.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) undo();
    else if ((k === "z" && e.shiftKey) || k === "y") redo();
    else return;
    e.preventDefault();
  });

  /* ------------------------------ moves and time ------------------------------ */

  /* Play time only runs while the page is visible and the level unsolved. */
  function pauseClock() {
    if (state.playFrom === null) return;
    state.playMs += performance.now() - state.playFrom;
    state.playFrom = null;
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseClock();
    else if (!state.confirmed && state.playFrom === null)
      state.playFrom = performance.now();
  });
  const clock = (ms) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const movesText = (n) => t("moves", { n });

  function place(trayId, x, y) {
    act(() => {
      const p = L.pieceFromTrayId(trayId, x, y);
      p.trayId = trayId;
      state.pieces.push(p);
      state.inv[trayId]--;
      Sound.place();
      if (state.inv[trayId] <= 0) state.armed = null;
      update();
    });
  }

  /* Turns a piece by `by` steps (negative turns it back). */
  function rotate(p, by = 1) {
    const states = L.PIECES[p.type].states;
    if (states > 1 && !p.hinted)
      act(() => {
        if (states === 2) Sound.flip();
        else Sound.rotate();
        p.k = (((p.k + by) % states) + states) % states;
        update();
      });
  }

  const movable = (p) => !p.fixed && !p.hinted;

  /* Takes a placed piece back to the tray. */
  function takeBack(p) {
    if (!movable(p)) return;
    act(() => {
      state.pieces = state.pieces.filter((q) => q !== p);
      state.inv[p.trayId]++;
      Sound.remove();
      update();
    });
  }

  /* ------------------------------ hints ------------------------------ */

  /* Each level stores one known solution. A hint makes one part of the board
     match it: it turns a fixed piece, or places one tray piece in its correct
     spot (clearing the tile first and taking the piece off the board if the
     tray has none left), and locks that piece. Once every solution piece is
     in place, further hints take extra pieces back to the tray. */
  function giveHint() {
    if (state.confirmed) return;
    act(giveHintNow, false);
  }
  function giveHintNow() {
    if (!state.endless) {
      state.attempt.hints++;
      save("prism.attempt", state.attempt);
    }
    Sound.hint();
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

  el.hint.addEventListener("click", () => {
    if (!state.busy) giveHint();
  });

  /* ------------------------------ UI chrome ------------------------------ */

  /* Moves and time for this solve; the best of each is kept per level. */
  function recordSolve(lv) {
    const moves = state.moves;
    const ms = state.playMs;
    let best = false;
    if (!state.endless) {
      const prev = state.bestStats[lv.id];
      best = !!prev && (moves < prev.moves || ms < prev.ms);
      state.bestStats[lv.id] = prev
        ? { moves: Math.min(prev.moves, moves), ms: Math.min(prev.ms, ms) }
        : { moves, ms };
      save("prism.stats", state.bestStats);
    }
    state.lastSolve = { moves, ms, best };
  }
  function solveText() {
    const s = state.lastSolve;
    if (!s) return "";
    return ` ${movesText(s.moves)} · ${clock(s.ms)}${s.best ? " · " + t("newBest") : ""}`;
  }

  function renderStatus() {
    const last = !state.endless && state.level === L.LEVELS.length - 1;
    const won = state.confirmed;
    const res = state.result;
    const holding = res.solved && !won;
    const burning = res.dark.some((d) => !d);
    el.status.classList.toggle("win", won);
    el.status.classList.toggle("warn", !won && burning);
    el.statusText.textContent = won
      ? (last ? t("completeLast") : t("complete")) + solveText()
      : holding
        ? t("holding")
        : burning && res.lit.every(Boolean)
          ? t("burning")
          : state.stuck
            ? t("stuck")
            : levelHint(level());
    el.next.hidden = !won || last;
    el.next.textContent = state.endless ? t("newLevelBtn") : t("nextLevelBtn");
    el.hint.disabled = won;
  }

  /* ------------------------------ progress ------------------------------ */

  /* Saving and restoring live on the Settings page (src/js/progress.js does
     the work). A restore link opens this page with #restore-<code>. */
  const Progress = window.PrismProgress;

  /* Re-reads progress saved in this browser, e.g. after Settings changed it. */
  function reloadProgress() {
    const p = Progress.readLocal();
    state.done = new Set(p.done);
    state.endlessSolved = p.endless;
    state.bestHints = p.hints;
    renderLevels();
    renderEndless();
  }

  /* Returns a sentence describing the result, and whether it worked. */
  function restore(code) {
    const p = code && Progress.decode(code);
    if (!p) return [t("restoreDamaged"), false];
    const r = Progress.mergeLocal(p);
    reloadProgress();
    const at = L.LEVELS.findIndex((lv) => lv.id === Progress.SAVE_IDS[p.level]);
    if (!state.endless && at >= 0) loadLevel(at);
    return [Progress.describeRestore(r), true];
  }

  function renderLevels() {
    el.doneCount.textContent = t("done", {
      n: state.done.size,
      total: L.LEVELS.length,
    });
    el.grid.textContent = "";
    L.LEVELS.forEach((lv, i) => {
      // Levels run easy to hard; each difficulty starts a chapter.
      if (i === 0 || L.LEVELS[i - 1].difficulty !== lv.difficulty) {
        const all = L.LEVELS.filter((l) => l.difficulty === lv.difficulty);
        const solved = all.filter((l) => state.done.has(l.id)).length;
        const h = document.createElement("h3");
        h.className = "chapter " + lv.difficulty;
        h.innerHTML = `<span>${DIFF_LABEL[lv.difficulty]}</span><span class="count">${solved} / ${all.length}</span>`;
        el.grid.appendChild(h);
      }
      const b = document.createElement("button");
      b.type = "button";
      const solved = state.done.has(lv.id);
      b.className = "level-cell" + (solved ? " done" : "");
      if (!state.endless && i === state.level)
        b.setAttribute("aria-current", "true");
      const hints = solved ? state.bestHints[lv.id] : undefined;
      const hintText =
        hints === undefined
          ? ""
          : hints === 0
            ? t("noHints")
            : t("hints", { n: hints });
      b.setAttribute(
        "aria-label",
        t("tileLabel", {
          n: i + 1,
          name: levelName(lv),
          diff: DIFF_LABEL[lv.difficulty],
        }) +
          (solved
            ? t("tileSolved") +
              (hintText ? t("tileWith", { hints: hintText }) : "")
            : ""),
      );
      const num = document.createElement("span");
      num.className = "num";
      num.textContent = i + 1;
      const diff = document.createElement("span");
      diff.className = "rating " + lv.difficulty;
      diff.textContent = DIFF_LABEL[lv.difficulty];
      const head = document.createElement("span");
      head.className = "head";
      head.append(num, diff);
      const name = document.createElement("span");
      name.className = "nm";
      name.textContent = levelName(lv);
      b.append(head, name);
      if (hintText) {
        const h = document.createElement("span");
        h.className = "hints" + (hints === 0 ? " none" : "");
        h.textContent = hints === 0 ? hintText : `💡 ${hintText}`;
        b.append(h);
      }
      const best = solved && state.bestStats[lv.id];
      if (best) {
        const st = document.createElement("span");
        st.className = "stats";
        st.textContent = `${movesText(best.moves)} · ${clock(best.ms)}`;
        b.append(st);
      }
      b.addEventListener("click", () => {
        el.dialog.close();
        loadLevel(i);
      });
      el.grid.appendChild(b);
    });
  }

  el.levelsBtn.addEventListener("click", () => {
    renderDaily();
    if (el.dialog.showModal) el.dialog.showModal();
    else el.dialog.setAttribute("open", "");
    const cur = el.grid.querySelector('[aria-current="true"]');
    if (cur) cur.focus();
  });
  el.dialog.addEventListener("click", (e) => {
    if (e.target === el.dialog) el.dialog.close();
  });
  el.prev.addEventListener("click", () => {
    if (state.busy) return;
    if (state.endless) loadLevel(state.level);
    else loadLevel(Math.max(0, state.level - 1));
  });
  el.fwd.addEventListener("click", () => {
    if (state.endless) playEndless(state.endless.difficulty);
    else if (!state.busy)
      loadLevel(Math.min(L.LEVELS.length - 1, state.level + 1));
  });

  const COLOR_KEY = {
    7: "white",
    4: "red",
    2: "green",
    1: "blue",
    6: "yellow",
    5: "magenta",
    3: "cyan",
  };
  const pieceLabel = (p) =>
    p.type === "filter" ? t(COLOR_KEY[p.color]) : t(p.type);
  const trayName = (id) => {
    const p = L.pieceFromTrayId(id, 0, 0);
    return p.type === "filter"
      ? t("filterName", { color: t(COLOR_KEY[p.color]) })
      : t(p.type);
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
      chip.setAttribute(
        "aria-label",
        t("left", { name: trayName(id), n: count }),
      );
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
      name.textContent = pieceLabel(p);
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
    syncTools();
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
    if (!c || state.drag || state.busy) return;
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
    if (state.inv[id] <= 0 || state.drag || state.busy) return;
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
      d.before = snapshot();
      Sound.pickup();
      state.armed = null;
      hideTools();
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
      Sound.place();
    } else if (!cancelled && (!c || overTray(e.clientX, e.clientY))) {
      state.inv[p.trayId]++;
      Sound.remove();
    } else {
      p.x = d.from.x;
      p.y = d.from.y;
      state.pieces.push(p);
    }
    update();
    commit(d.before, true);
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

  /* ------------------------------ piece actions ------------------------------ */

  /* With a mouse or the keyboard, a small toolbar beside a placed piece
     offers its actions: turn it either way, flip a prism, or take it back to
     the tray. Touch keeps tap-to-turn and drag, where a toolbar would only
     cover the board. */
  const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ACTIONS = {
    left: {
      label: t("turnLeft"),
      icon: svg(
        '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
      ),
      run: (p) => rotate(p, -1),
    },
    right: {
      label: t("turnRight"),
      icon: svg(
        '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
      ),
      run: (p) => rotate(p, 1),
    },
    flip: {
      label: t("flip"),
      icon: svg(
        '<path d="M12 3v18" stroke-dasharray="2 3"/><path d="M8.5 7 3 17h5.5z"/><path d="M15.5 7 21 17h-5.5z"/>',
      ),
      run: (p) => rotate(p, 1),
    },
    remove: {
      label: t("takeBack"),
      icon: svg(
        '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
      ),
      run: takeBack,
    },
  };

  function actionsFor(p) {
    if (!p || p.hinted) return [];
    const n = L.PIECES[p.type].states;
    const list = n > 2 ? ["left", "right"] : n === 2 ? ["flip"] : [];
    if (movable(p)) list.push("remove");
    return list;
  }

  /* tools.via is "mouse" or "key": what opened the toolbar. */
  const tools = { piece: null, via: null, shown: "", hideTimer: 0 };

  function cellBox(x, y) {
    const b = el.board.getBoundingClientRect();
    const s = el.stage.getBoundingClientRect();
    const cs = b.width / L.COLS;
    return { left: b.left - s.left + x * cs, top: b.top - s.top + y * cs, cs };
  }

  function showTools(p, via) {
    clearTimeout(tools.hideTimer);
    const list = actionsFor(p);
    if (!list.length) return hideTools();
    tools.piece = p;
    tools.via = via;
    const sig = list.join();
    if (tools.shown !== sig) {
      tools.shown = sig;
      el.tools.innerHTML = "";
      for (const name of list) {
        const a = ACTIONS[name];
        const b = document.createElement("button");
        b.type = "button";
        b.className = name;
        b.title = a.label;
        b.setAttribute("aria-label", a.label.replace(/ \(.*\)$/, ""));
        b.innerHTML = a.icon;
        b.addEventListener("click", () => {
          const piece = tools.piece;
          if (!piece) return;
          a.run(piece);
          // After taking a piece back, keyboard users stay on the board.
          if (name === "remove" && tools.via === "key") el.board.focus();
        });
        el.tools.appendChild(b);
      }
    }
    el.tools.hidden = false;
    placeTools();
  }

  function placeTools() {
    const p = tools.piece;
    if (!p) return;
    const c = cellBox(p.x, p.y);
    const s = el.stage.getBoundingClientRect();
    const w = el.tools.offsetWidth,
      h = el.tools.offsetHeight;
    const left = Math.max(0, Math.min(s.width - w, c.left + c.cs / 2 - w / 2));
    // Above the piece, or below it when there is no room above.
    let top = c.top - h - 4;
    if (top < 0) top = c.top + c.cs + 4;
    el.tools.style.left = left + "px";
    el.tools.style.top = top + "px";
  }

  function hideTools() {
    clearTimeout(tools.hideTimer);
    tools.piece = null;
    tools.via = null;
    el.tools.hidden = true;
  }

  function hideToolsSoon() {
    clearTimeout(tools.hideTimer);
    tools.hideTimer = setTimeout(hideTools, 250);
  }

  /* After any change: follow the piece, or close if it is gone. */
  function syncTools() {
    placeCursor();
    if (state.cursor && document.activeElement === el.board)
      return showTools(pieceAt(state.cursor.x, state.cursor.y), "key");
    const p = tools.piece;
    if (!p) return;
    if (!state.pieces.includes(p) || state.drag) hideTools();
    else showTools(p, tools.via);
  }

  el.board.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || state.drag) return;
    const c = cellAt(e.clientX, e.clientY);
    const p = c && pieceAt(c.x, c.y);
    if (p && actionsFor(p).length) showTools(p, "mouse");
    else if (tools.via === "mouse") hideToolsSoon();
  });
  el.board.addEventListener("pointerleave", () => {
    if (tools.via === "mouse") hideToolsSoon();
  });
  el.tools.addEventListener("pointerenter", () =>
    clearTimeout(tools.hideTimer),
  );
  el.tools.addEventListener("pointerleave", (e) => {
    if (tools.via === "mouse" && !el.board.contains(e.relatedTarget))
      hideToolsSoon();
  });

  /* ------------------------------ keyboard ------------------------------ */

  /* The board is focusable: arrow keys move a cursor over the tiles. */
  function placeCursor() {
    const k = state.cursor;
    if (!k || document.activeElement !== el.board) {
      el.cursor.hidden = true;
      return;
    }
    const c = cellBox(k.x, k.y);
    el.cursor.hidden = false;
    Object.assign(el.cursor.style, {
      left: c.left + "px",
      top: c.top + "px",
      width: c.cs + "px",
      height: c.cs + "px",
    });
  }

  el.board.addEventListener("focus", () => {
    if (!el.board.matches(":focus-visible")) return;
    if (!state.cursor)
      state.cursor = { x: Math.floor(L.COLS / 2), y: Math.floor(L.ROWS / 2) };
    syncTools();
  });
  el.board.addEventListener("blur", (e) => {
    el.cursor.hidden = true;
    if (tools.via === "key" && !el.tools.contains(e.relatedTarget)) hideTools();
  });
  el.tools.addEventListener("focusout", (e) => {
    if (
      tools.via === "key" &&
      !el.tools.contains(e.relatedTarget) &&
      e.relatedTarget !== el.board
    )
      hideTools();
  });

  const MOVES = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  el.board.addEventListener("keydown", (e) => {
    if (state.busy || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!state.cursor) state.cursor = { x: 0, y: 0 };
    const k = state.cursor;
    const p = pieceAt(k.x, k.y);
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (MOVES[e.key]) {
      const [dx, dy] = MOVES[e.key];
      k.x = Math.max(0, Math.min(L.COLS - 1, k.x + dx));
      k.y = Math.max(0, Math.min(L.ROWS - 1, k.y + dy));
      syncTools();
    } else if (key === "Enter" || key === " ") {
      if (p) rotate(p, 1);
      else if (state.armed && L.isFree(level(), state.pieces, k.x, k.y))
        place(state.armed, k.x, k.y);
      else return;
    } else if (key === "r" && p) {
      rotate(p, e.shiftKey ? -1 : 1);
    } else if (key === "f" && p && L.PIECES[p.type].states === 2) {
      rotate(p, 1);
    } else if ((key === "Delete" || key === "Backspace") && p) {
      takeBack(p);
    } else return;
    e.preventDefault();
  });

  el.reset.addEventListener("click", () => {
    if (state.busy) return;
    if (state.endless) startLevel(state.endless.level);
    else loadLevel(state.level);
  });
  el.next.addEventListener("click", () =>
    state.endless
      ? playEndless(state.endless.difficulty)
      : loadLevel(Math.min(state.level + 1, L.LEVELS.length - 1)),
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
  const savedLevel = L.LEVELS.findIndex(
    (lv) => lv.id === Progress.currentLevelId(),
  );
  const sharedCode = /^#([EMH]-\d{1,9})$/i.exec(location.hash);
  const restoreCode = /^#restore-([0-9A-Za-z]+)$/.exec(location.hash);
  loadLevel(savedLevel >= 0 && savedLevel < L.LEVELS.length ? savedLevel : 0);
  if (sharedCode) playEndless(null, sharedCode[1].toUpperCase());
  if (restoreCode) {
    const [text, ok] = restore(restoreCode[1]);
    el.statusText.textContent = ok
      ? text + t("restoreOkTail")
      : text + t("restoreBadTail");
    el.status.classList.toggle("win", ok);
    el.status.classList.toggle("warn", !ok);
    history.replaceState(null, "", location.pathname);
  }
  renderEndless();
  applyTheme();
  layout();
  requestAnimationFrame(frame);

  /* Coming back from Settings with the browser's back button can show this
     page from memory without reloading it; pick up any theme or progress
     changes made there. */
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    let saved = null;
    try {
      saved = localStorage.getItem("prism.theme");
    } catch (err) {
      /* keep the current theme */
    }
    if (saved === "light" || saved === "dark")
      document.documentElement.dataset.theme = saved;
    else delete document.documentElement.dataset.theme;
    applyTheme();
    reloadProgress();
  });

  window.__prism = {
    state,
    L,
    accelerated: compositor.accelerated,
    theme,
    giveHint,
    loadLevel,
    playEndless,
    restore,
  };
})();
