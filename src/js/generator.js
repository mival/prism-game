"use strict";

/* Level generator and solver for Endless mode. Pure code on top of
   PrismLogic, so it runs on the page, in a Web Worker, and in Node.

   A level is built backwards from a random intended solution: pieces go on
   the beam's path, receivers go where the light ends up, and sensors and
   walls go where a wrong move would send the light. A search over every
   placement then rejects levels that are already solved, can be solved with
   fewer pieces than intended, or have too many solutions. */
(function (root) {
  const L =
    typeof module !== "undefined" && module.exports
      ? require("./logic.js")
      : root.PrismLogic;
  const key = (x, y) => x + "," + y;

  /* ------------------------------ solver ------------------------------ */

  function trayIds(level) {
    const ids = [];
    for (const [id, n] of Object.entries(level.tray))
      for (let i = 0; i < n; i++) ids.push(id);
    return ids;
  }

  function* fixedStates(level) {
    const fixed = L.fixedPieces(level);
    const states = fixed.map((f) => L.PIECES[f.type].states);
    const idx = fixed.map(() => 0);
    for (;;) {
      yield fixed.map((f, i) => ({ ...f, k: idx[i] }));
      let i = 0;
      while (i < idx.length && ++idx[i] >= states[i]) idx[i++] = 0;
      if (i >= idx.length) return;
    }
  }

  /* Free tiles the light currently crosses: the only places where a new
     piece can change anything. */
  function pathCells(level, pieces) {
    const set = new Set();
    for (const r of L.trace(level, pieces).runs) {
      const [dx, dy] = L.DIRS[r.d];
      let x = r.x0,
        y = r.y0;
      for (let i = 0; i < 20; i++) {
        if (L.isFree(level, pieces, x, y)) set.add(key(x, y));
        if (Math.abs(x - r.x1) < 0.6 && Math.abs(y - r.y1) < 0.6) break;
        x += dx;
        y += dy;
      }
    }
    return [...set].map((s) => s.split(",").map(Number));
  }

  /* Solutions that use at most `depth` tray pieces, up to `cap` of them.
     Each is { fixed: [k...], placed: [{ id, x, y, k }] }. */
  function search(level, depth, cap) {
    const ids = trayIds(level);
    const solutions = [];
    for (const fixed of fixedStates(level)) {
      const seen = new Set();
      (function dfs(placed, remaining) {
        if (solutions.length >= cap) return;
        const all = fixed.concat(placed);
        if (L.trace(level, all).solved) {
          solutions.push({
            fixed: fixed.map((f) => f.k),
            placed: placed.map((p) => ({
              id: p.type === "filter" ? "filter:" + p.color : p.type,
              x: p.x,
              y: p.y,
              k: p.k,
            })),
          });
          return;
        }
        if (placed.length >= depth) return;
        for (const [x, y] of pathCells(level, all))
          for (const id of new Set(remaining)) {
            const base = L.pieceFromTrayId(id, x, y);
            for (let k = 0; k < L.PIECES[base.type].states; k++) {
              const next = placed.concat({ ...base, k });
              const sig = next
                .map(
                  (q) => q.type + (q.color || "") + q.x + "," + q.y + "," + q.k,
                )
                .sort()
                .join("|");
              if (seen.has(sig)) continue;
              seen.add(sig);
              const rem = remaining.slice();
              rem.splice(rem.indexOf(id), 1);
              dfs(next, rem);
            }
          }
      })([], ids);
      if (solutions.length >= cap) break;
    }
    return solutions;
  }

  /* Fewest pieces needed and how many solutions exist at that count. */
  function analyse(level, maxDepth, cap) {
    const startSolved = L.trace(level, L.fixedPieces(level)).solved;
    const total = trayIds(level).length;
    for (let d = 0; d <= Math.min(total, maxDepth); d++) {
      const one = search(level, d, 1);
      if (one.length)
        return {
          fewest: d,
          solutions: search(level, d, cap).length,
          startSolved,
        };
    }
    return { fewest: null, solutions: 0, startSolved };
  }

  /* ------------------------------ builder ------------------------------ */

  function rng(seed) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

  function lightCells(level, pieces) {
    const cells = [];
    for (const run of L.trace(level, pieces).runs) {
      const [dx, dy] = L.DIRS[run.d];
      let x = run.x0,
        y = run.y0;
      for (let i = 0; i < 20; i++) {
        cells.push({ x, y, d: run.d, c: run.c, start: i === 0 });
        if (Math.abs(x - run.x1) < 0.6 && Math.abs(y - run.y1) < 0.6) break;
        x += dx;
        y += dy;
      }
    }
    return cells;
  }

  /* recipe = { sources: [colour...], steps: ["mirror", "portal",
     "fixed:mirror", "door", "filter", ...], receivers, sensors, walls } */
  function build(recipe, seed) {
    const r = rng(seed);
    const level = {
      sources: [],
      receivers: [],
      walls: [],
      doors: [],
      sensors: [],
      portals: [],
      fixed: [],
      tray: {},
    };
    const placed = [];
    const all = () => L.fixedPieces(level).concat(placed);
    const free = (x, y) => L.isFree(level, all(), x, y);

    for (const c of recipe.sources) {
      for (let t = 0; t < 50; t++) {
        const side = Math.floor(r() * 4);
        const s =
          side === 0
            ? { x: 0, y: 1 + Math.floor(r() * 7), d: 0 }
            : side === 1
              ? { x: 6, y: 1 + Math.floor(r() * 7), d: 4 }
              : side === 2
                ? { x: 1 + Math.floor(r() * 5), y: 0, d: 2 }
                : { x: 1 + Math.floor(r() * 5), y: 8, d: 6 };
        if (free(s.x, s.y)) {
          level.sources.push({ ...s, c });
          break;
        }
      }
    }
    if (level.sources.length !== recipe.sources.length) return null;

    let intended = 0;
    for (const step of recipe.steps) {
      const path = lightCells(level, all()).filter(
        (p) => !p.start && free(p.x, p.y),
      );
      if (!path.length) return null;
      let ok = false;
      for (let t = 0; t < 40 && !ok; t++) {
        const at = pick(r, path);
        const before = JSON.stringify(L.trace(level, all()).runs);
        if (step === "portal") {
          const spots = [];
          for (let x = 0; x < L.COLS; x++)
            for (let y = 0; y < L.ROWS; y++)
              if (free(x, y) && Math.abs(x - at.x) + Math.abs(y - at.y) > 3)
                spots.push([x, y]);
          if (!spots.length) continue;
          const [bx, by] = pick(r, spots);
          level.portals.push([at.x, at.y, bx, by]);
          ok = true;
        } else if (step === "door") {
          const comps = [4, 2, 1].filter((m) => at.c & m && at.c !== m);
          if (!comps.length) continue;
          level.doors.push([at.x, at.y, pick(r, comps)]);
          ok = true;
        } else {
          const fixed = step.startsWith("fixed:");
          const type = fixed ? step.slice(6) : step;
          let id = type;
          if (type === "filter") {
            const subsets = [1, 2, 3, 4, 5, 6].filter(
              (m) => (m & at.c) === m && m !== at.c,
            );
            if (!subsets.length) continue;
            id = "filter:" + pick(r, subsets);
          }
          const p = L.pieceFromTrayId(id, at.x, at.y);
          p.k = Math.floor(r() * L.PIECES[p.type].states);
          const outs = L.PIECES[p.type].out(p, at.d, at.c);
          if (p.type !== "filter" && outs.length === 1 && outs[0].d === at.d)
            continue;
          if (fixed) {
            const f = { type: p.type, x: p.x, y: p.y, k: p.k };
            if (p.color) f.color = p.color;
            level.fixed.push(f);
          } else placed.push(p);
          ok = JSON.stringify(L.trace(level, all()).runs) !== before;
          if (!ok) {
            if (fixed) level.fixed.pop();
            else placed.pop();
          } else if (!fixed) {
            intended++;
            level.tray[id] = (level.tray[id] || 0) + 1;
          }
        }
      }
      if (!ok) return null;
    }

    // Receivers where the light ends at an edge or a wall.
    const ends = new Set();
    for (const run of L.trace(level, all()).runs) {
      const [dx, dy] = L.DIRS[run.d];
      const fx = run.x1 - dx / 2,
        fy = run.y1 - dy / 2;
      if (!Number.isInteger(fx) || !Number.isInteger(fy)) continue;
      if (!free(fx, fy) || (fx === run.x0 && fy === run.y0)) continue;
      ends.add(key(fx, fy));
    }
    const spots = [...ends].map((s) => s.split(",").map(Number));
    if (spots.length < recipe.receivers) return null;
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    spots
      .slice(0, recipe.receivers)
      .forEach(([x, y]) => level.receivers.push({ x, y, c: 7 }));
    const hits = L.trace(level, all()).hits;
    level.receivers.forEach((rc, i) => (rc.c = hits[i]));
    if (level.receivers.some((rc) => !rc.c)) return null;
    if (!L.trace(level, all()).solved) return null;

    // Sensors and walls go where wrong moves send light: past each piece.
    const onPath = new Set(lightCells(level, all()).map((p) => key(p.x, p.y)));
    const tempting = [];
    for (const p of all())
      for (let d = 0; d < 8; d++) {
        const [dx, dy] = L.DIRS[d];
        for (let s = 1; s < 4; s++) {
          const x = p.x + dx * s,
            y = p.y + dy * s;
          if (free(x, y) && !onPath.has(key(x, y))) {
            tempting.push([x, y]);
            break;
          }
        }
      }
    for (let i = 0; i < (recipe.sensors || 0) && tempting.length; i++) {
      const [x, y] = tempting.splice(Math.floor(r() * tempting.length), 1)[0];
      if (free(x, y)) level.sensors.push([x, y]);
    }
    for (let i = 0; i < (recipe.walls || 4); i++)
      for (let t = 0; t < 30; t++) {
        const x = Math.floor(r() * L.COLS),
          y = Math.floor(r() * L.ROWS);
        if (free(x, y) && !onPath.has(key(x, y))) {
          level.walls.push([x, y]);
          break;
        }
      }
    if (!L.trace(level, all()).solved) return null;

    // Every element of the intended solution must actually be reached.
    const lit = new Set(lightCells(level, all()).map((p) => key(p.x, p.y)));
    const elements = all()
      .map((p) => [p.x, p.y])
      .concat(level.doors.map(([x, y]) => [x, y]))
      .concat(
        level.portals.flatMap(([a, b, c, d]) => [
          [a, b],
          [c, d],
        ]),
      );
    if (elements.some(([x, y]) => !lit.has(key(x, y)))) return null;

    // Fixed pieces start turned away from their solution.
    level.fixed.forEach((f) => {
      const n = L.PIECES[f.type].states;
      f.k = (f.k + 1 + Math.floor(r() * (n - 1))) % n;
    });
    for (const k of ["doors", "sensors", "portals", "fixed"])
      if (!level[k].length) delete level[k];
    return { level, intended };
  }

  /* One extra wall where it removes the most solutions. */
  function tighten(level, fewest, count) {
    let best = null;
    for (let x = 0; x < L.COLS; x++)
      for (let y = 0; y < L.ROWS; y++) {
        if (!L.isFree(level, L.fixedPieces(level), x, y)) continue;
        const test = { ...level, walls: level.walls.concat([[x, y]]) };
        if (L.trace(test, L.fixedPieces(test)).solved) continue;
        let shallower = false;
        for (let d = 0; d < fewest; d++)
          if (search(test, d, 1).length) {
            shallower = true;
            break;
          }
        if (shallower) continue;
        const n = search(test, fewest, count).length;
        if (n > 0 && n < count && (!best || n < best.n)) best = { test, n };
      }
    return best ? { level: best.test, count: best.n } : { level, count };
  }

  /* Keeps a decoy only if it adds no solution and no shortcut. */
  function isCleanDecoy(level, fewest, count, id) {
    const test = {
      ...level,
      tray: { ...level.tray, [id]: (level.tray[id] || 0) + 1 },
    };
    for (let d = 0; d < fewest; d++)
      if (search(test, d, 1).length) return false;
    return search(test, fewest, count + 1).length === count;
  }

  /* ------------------------------ difficulties ------------------------------ */

  const W = 7,
    R = 4,
    B = 1;
  const RECIPES = {
    easy: [
      { sources: [W], steps: ["mirror"], receivers: 1, walls: 5 },
      { sources: [W], steps: ["mirror", "mirror"], receivers: 1, walls: 4 },
      { sources: [W], steps: ["portal", "mirror"], receivers: 1, walls: 4 },
      { sources: [W], steps: ["splitter"], receivers: 2, walls: 4 },
      { sources: [W], steps: ["prism"], receivers: 2, walls: 4 },
      { sources: [W], steps: ["mirror"], receivers: 1, sensors: 2, walls: 3 },
    ],
    medium: [
      {
        sources: [W],
        steps: ["splitter", "mirror"],
        receivers: 2,
        sensors: 2,
        walls: 3,
      },
      { sources: [W], steps: ["prism", "mirror"], receivers: 2, walls: 4 },
      {
        sources: [W],
        steps: ["portal", "splitter", "mirror"],
        receivers: 2,
        walls: 3,
      },
      {
        sources: [W],
        steps: ["fixed:mirror", "splitter", "mirror"],
        receivers: 2,
        walls: 3,
      },
      {
        sources: [W],
        steps: ["splitter", "door", "mirror"],
        receivers: 2,
        walls: 4,
      },
      {
        sources: [R, B],
        steps: ["mirror", "mirror"],
        receivers: 2,
        sensors: 1,
        walls: 3,
      },
      {
        sources: [W],
        steps: ["mirror", "mirror"],
        receivers: 1,
        sensors: 3,
        walls: 3,
      },
    ],
    hard: [
      {
        sources: [W],
        steps: ["splitter", "prism", "mirror"],
        receivers: 3,
        sensors: 1,
        walls: 3,
      },
      {
        sources: [W],
        steps: ["prism", "mirror", "mirror"],
        receivers: 2,
        sensors: 2,
        walls: 3,
      },
      {
        sources: [W],
        steps: ["splitter", "mirror", "mirror"],
        receivers: 2,
        sensors: 2,
        walls: 3,
      },
      {
        sources: [W],
        steps: ["fixed:splitter", "prism", "mirror", "portal"],
        receivers: 3,
        walls: 3,
      },
      {
        sources: [W],
        steps: ["splitter", "filter", "mirror"],
        receivers: 2,
        sensors: 2,
        walls: 3,
      },
      {
        sources: [R, B],
        steps: ["splitter", "mirror", "mirror"],
        receivers: 2,
        sensors: 2,
        walls: 3,
      },
    ],
  };
  const LIMITS = {
    easy: { maxSolutions: 3, tighten: true, decoys: 1 },
    medium: { maxSolutions: 3, tighten: true, decoys: 2 },
    hard: { maxSolutions: 4, tighten: false, decoys: 2 },
  };
  const DECOYS = [
    "mirror",
    "splitter",
    "prism",
    "filter:4",
    "filter:2",
    "filter:1",
    "filter:6",
    "filter:3",
    "filter:5",
  ];

  const ADJ = [
    "Amber",
    "Quiet",
    "Hollow",
    "Bright",
    "Silver",
    "Folded",
    "Distant",
    "Narrow",
    "Velvet",
    "Restless",
    "Sunken",
    "Paper",
    "Cold",
    "Second",
    "Lucky",
    "Tilted",
  ];
  const NOUN = [
    "Lens",
    "Relay",
    "Corner",
    "Halo",
    "Lantern",
    "Signal",
    "Mirror",
    "Spectrum",
    "Window",
    "Beacon",
    "Passage",
    "Flare",
    "Arc",
    "Gate",
    "Ember",
    "Glint",
  ];

  function describe(level, decoys) {
    const parts = [];
    if (level.portals) parts.push("portals");
    if (level.sensors) parts.push("dark sensors");
    if (level.doors) parts.push("glass doors");
    if (level.fixed) parts.push("a fixed piece");
    if (level.sources.length > 1) parts.push("two lasers");
    const has = parts.length
      ? "This one has " +
        (parts.length > 1
          ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1]
          : parts[0]) +
        "."
      : "Light every receiver.";
    return decoys ? has + " Not every piece is needed." : has;
  }

  const CODE_LETTER = { easy: "E", medium: "M", hard: "H" };
  const LETTER_DIFF = { E: "easy", M: "medium", H: "hard" };

  /* Tries one seed. Returns a playable level or null; the same difficulty
     and seed always give the same level, which is what makes codes work. */
  function tryLevel(difficulty, seed) {
    const recipes = RECIPES[difficulty];
    const r = rng(seed * 7 + 3);
    const recipe = recipes[Math.floor(r() * recipes.length)];
    const limits = LIMITS[difficulty];
    const built = build(recipe, seed);
    if (!built) return null;
    let level = built.level;
    const a = analyse(level, built.intended, limits.maxSolutions + 1);
    if (a.startSolved || a.fewest !== built.intended) return null;
    let count = a.solutions;
    if (count > limits.maxSolutions) {
      if (!limits.tighten) return null;
      const t = tighten(level, a.fewest, count);
      level = t.level;
      count = t.count;
      if (count > limits.maxSolutions) return null;
    } else if (limits.tighten && count > 1) {
      const t = tighten(level, a.fewest, count);
      level = t.level;
      count = t.count;
    }
    const decoys = [];
    const pool = DECOYS.slice();
    for (
      let tries = 0;
      tries < 3 && decoys.length < limits.decoys && pool.length;
      tries++
    ) {
      const id = pool.splice(Math.floor(r() * pool.length), 1)[0];
      if (isCleanDecoy(level, a.fewest, count, id)) {
        decoys.push(id);
        level = {
          ...level,
          tray: { ...level.tray, [id]: (level.tray[id] || 0) + 1 },
        };
      }
    }
    const code = CODE_LETTER[difficulty] + "-" + seed;
    level.id = "endless-" + code;
    level.name = pick(r, ADJ) + " " + pick(r, NOUN);
    level.hint = describe(level, decoys.length);
    level.solution = search(level, a.fewest, 1)[0];
    level.code = code;
    level.difficulty = difficulty;
    return level;
  }

  /* Keeps trying seeds from `seed` on until one gives a level, or the time
     budget runs out (then returns null). */
  function makeLevel(difficulty, seed, budgetMs) {
    const until = Date.now() + (budgetMs || 120000);
    for (let s = seed; Date.now() < until; s++) {
      const level = tryLevel(difficulty, s);
      if (level) return level;
    }
    return null;
  }

  /* "M-48213" → the level it names, or null if the code is malformed. */
  function fromCode(code) {
    const m = /^([EMH])-?(\d{1,9})$/i.exec(String(code).trim());
    if (!m) return null;
    return tryLevel(LETTER_DIFF[m[1].toUpperCase()], Number(m[2]));
  }

  const api = {
    search,
    analyse,
    build,
    tryLevel,
    makeLevel,
    fromCode,
    RECIPES,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PrismGen = api;
})(typeof window !== "undefined" ? window : globalThis);
