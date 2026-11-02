"use strict";

/* Pure puzzle rules: no DOM, so the level solver tests can load this in Node. */
(function (root) {
  const COLS = 7;
  const ROWS = 9;

  // Index grows clockwise on screen (y points down): 0 = east, 2 = south.
  const DIRS = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];

  const R = 4,
    G = 2,
    B = 1,
    WHITE = 7;

  const COLOR_NAMES = {
    7: "white",
    4: "red",
    2: "green",
    1: "blue",
    6: "yellow",
    3: "cyan",
    5: "magenta",
  };

  /* Mirror and splitter orientation k is the surface angle in 22.5° steps.
     Reflecting travel angle d·45° across a line at k·22.5° gives (k − d)·45°. */
  const reflectDir = (k, d) => (((k - d) % 8) + 8) % 8;
  const turn = (d, by) => (((d + by) % 8) + 8) % 8;

  const PIECES = {
    mirror: {
      label: "Mirror",
      states: 8,
      out: (p, d, c) => [{ d: reflectDir(p.k, d), c }],
    },
    splitter: {
      label: "Splitter",
      states: 8,
      out: (p, d, c) => {
        const r = reflectDir(p.k, d);
        return r === d
          ? [{ d, c }]
          : [
              { d, c },
              { d: r, c },
            ];
      },
    },
    // State 0 bends red left and blue right of the travel direction; state 1 swaps them.
    prism: {
      label: "Prism",
      states: 2,
      out: (p, d, c) => {
        const side = p.k === 0 ? -1 : 1;
        const res = [];
        if (c & R) res.push({ d: turn(d, side), c: R });
        if (c & G) res.push({ d, c: G });
        if (c & B) res.push({ d: turn(d, -side), c: B });
        return res;
      },
    },
    filter: {
      label: "Filter",
      states: 1,
      out: (p, d, c) => (c & p.color ? [{ d, c: c & p.color }] : []),
    },
  };

  /* Tray ids are "mirror", "prism", "splitter" or "filter:<mask>". */
  function pieceFromTrayId(id, x, y) {
    const [type, mask] = id.split(":");
    const p = {
      type,
      x,
      y,
      k: type === "mirror" || type === "splitter" ? 2 : 0,
    };
    if (type === "filter") p.color = Number(mask);
    return p;
  }

  const LEVELS = [
    {
      id: "first-light",
      name: "First Light",
      hint: "Place the mirror where it turns the beam down into the receiver. Tap a placed piece to rotate it.",
      source: { x: 0, y: 2, d: 0 },
      receivers: [{ x: 4, y: 6, c: WHITE }],
      walls: [
        [5, 2],
        [2, 4],
        [1, 6],
        [6, 7],
      ],
      tray: { mirror: 1 },
    },
    {
      id: "spectrum",
      name: "Spectrum",
      hint: "A prism splits white light into red, green and blue. Each receiver lights only for its own color.",
      source: { x: 0, y: 2, d: 0 },
      receivers: [
        { x: 5, y: 0, c: R },
        { x: 6, y: 7, c: G },
        { x: 2, y: 7, c: B },
      ],
      walls: [
        [3, 5],
        [1, 4],
        [1, 5],
        [0, 8],
        [4, 8],
      ],
      tray: { prism: 1, mirror: 2 },
    },
    {
      id: "recombine",
      name: "Recombine",
      hint: "A splitter sends the beam two ways at once. Filters pass only the colors they show.",
      source: { x: 0, y: 6, d: 0 },
      receivers: [
        { x: 3, y: 0, c: R | G },
        { x: 6, y: 3, c: G | B },
      ],
      walls: [
        [0, 0],
        [1, 3],
        [5, 1],
        [2, 8],
        [4, 4],
        [5, 7],
      ],
      tray: { splitter: 1, mirror: 1, "filter:6": 1, "filter:3": 1 },
    },
  ];

  const key = (x, y) => x + "," + y;

  /* Follows every beam from the source. Each run is one straight stretch of
     light, from where it starts to where it stops or turns, with its colour and
     direction; a beam sent back the way it came shows up as a second run on the
     same line with the opposite direction. */
  function trace(level, pieces) {
    const cells = new Map();
    level.walls.forEach(([x, y]) => cells.set(key(x, y), { kind: "wall" }));
    level.receivers.forEach((r, i) =>
      cells.set(key(r.x, r.y), { kind: "receiver", i }),
    );
    cells.set(key(level.source.x, level.source.y), { kind: "source" });
    pieces.forEach((p) => cells.set(key(p.x, p.y), { kind: "piece", p }));

    const hits = level.receivers.map(() => 0);
    const runs = [];
    const seen = new Set();
    const queue = [
      { x: level.source.x, y: level.source.y, d: level.source.d, c: WHITE },
    ];
    let guard = 0;

    while (queue.length && guard++ < 500) {
      const b = queue.shift();
      const id = b.x + "," + b.y + "," + b.d + "," + b.c;
      if (seen.has(id)) continue;
      seen.add(id);

      const [dx, dy] = DIRS[b.d];
      let x = b.x,
        y = b.y;
      for (;;) {
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
          runs.push({
            x0: b.x,
            y0: b.y,
            x1: x + dx / 2,
            y1: y + dy / 2,
            c: b.c,
            d: b.d,
          });
          break;
        }
        const cell = cells.get(key(nx, ny));
        if (!cell) {
          x = nx;
          y = ny;
          continue;
        }
        if (cell.kind === "wall") {
          runs.push({
            x0: b.x,
            y0: b.y,
            x1: x + dx / 2,
            y1: y + dy / 2,
            c: b.c,
            d: b.d,
          });
          break;
        }
        runs.push({ x0: b.x, y0: b.y, x1: nx, y1: ny, c: b.c, d: b.d });
        if (cell.kind === "receiver") hits[cell.i] |= b.c;
        if (cell.kind === "piece") {
          PIECES[cell.p.type]
            .out(cell.p, b.d, b.c)
            .forEach((o) => queue.push({ x: nx, y: ny, d: o.d, c: o.c }));
        }
        break;
      }
    }

    const lit = level.receivers.map((r, i) => hits[i] === r.c);
    return { runs, hits, lit, solved: lit.every(Boolean) };
  }

  function isFree(level, pieces, x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
    if (level.source.x === x && level.source.y === y) return false;
    if (level.walls.some(([wx, wy]) => wx === x && wy === y)) return false;
    if (level.receivers.some((r) => r.x === x && r.y === y)) return false;
    return !pieces.some((p) => p.x === x && p.y === y);
  }

  const api = {
    COLS,
    ROWS,
    DIRS,
    R,
    G,
    B,
    WHITE,
    COLOR_NAMES,
    PIECES,
    LEVELS,
    trace,
    isFree,
    pieceFromTrayId,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PrismLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
