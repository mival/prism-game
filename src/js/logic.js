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
  const E = 0,
    S = 2,
    W = 4,
    N = 6;

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

  /* Level cells: sources {x, y, d, c}, receivers {x, y, c}, walls [x, y],
     and glass doors [x, y, c]: walls that let only colour c through. */
  const LEVELS = [
    {
      id: "first-light",
      name: "First Light",
      hint: "Place the mirror where it turns the beam down into the receiver. Tap a placed piece to rotate it.",
      sources: [{ x: 0, y: 2, d: E, c: WHITE }],
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
      sources: [{ x: 0, y: 2, d: E, c: WHITE }],
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
      id: "glass-doors",
      name: "Glass Doors",
      hint: "Colored glass walls let only their own color through. A splitter sends the beam two ways at once.",
      sources: [{ x: 0, y: 4, d: E, c: WHITE }],
      receivers: [
        { x: 6, y: 4, c: R },
        { x: 5, y: 0, c: G },
      ],
      walls: [
        [1, 1],
        [4, 6],
        [1, 7],
        [5, 8],
      ],
      doors: [
        [4, 4, R],
        [2, 2, G],
      ],
      tray: { splitter: 1, mirror: 1 },
    },
    {
      id: "recombine",
      name: "Recombine",
      hint: "Filters are glass you can place. They pass only the colors they show.",
      sources: [{ x: 0, y: 6, d: E, c: WHITE }],
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
    {
      id: "echo",
      name: "Echo",
      hint: "A mirror hit head-on sends light straight back. Watch the arrows: returning light can take a new path.",
      sources: [{ x: 0, y: 4, d: E, c: WHITE }],
      receivers: [
        { x: 3, y: 0, c: WHITE },
        { x: 3, y: 8, c: R },
      ],
      walls: [
        [1, 2],
        [5, 2],
        [1, 6],
        [5, 6],
      ],
      doors: [[3, 6, R]],
      tray: { splitter: 1, mirror: 1 },
    },
    {
      id: "three-ways",
      name: "Three Ways",
      hint: "Three receivers, one beam. Each splitter sends part of the light off at an angle and lets the rest through.",
      sources: [{ x: 0, y: 4, d: E, c: WHITE }],
      receivers: [
        { x: 2, y: 0, c: WHITE },
        { x: 4, y: 8, c: WHITE },
        { x: 6, y: 4, c: WHITE },
      ],
      walls: [
        [0, 0],
        [6, 0],
        [0, 8],
        [6, 8],
        [1, 2],
        [5, 6],
      ],
      tray: { splitter: 2 },
    },
    {
      id: "magenta",
      name: "Magenta",
      hint: "Colors add up. Red and blue arriving at the same receiver make magenta.",
      sources: [{ x: 0, y: 4, d: E, c: WHITE }],
      receivers: [
        { x: 5, y: 4, c: G },
        { x: 6, y: 4, c: R | B },
      ],
      walls: [
        [0, 0],
        [6, 0],
        [0, 8],
        [6, 8],
        [2, 1],
        [2, 7],
      ],
      tray: { prism: 1, mirror: 2 },
    },
    {
      id: "detour",
      name: "Detour",
      hint: "A mirror turned one step less than square bends light by 45°. Find the way through the gap in the barrier.",
      sources: [{ x: 0, y: 1, d: E, c: WHITE }],
      receivers: [{ x: 6, y: 7, c: WHITE }],
      walls: [
        [1, 4],
        [2, 4],
        [3, 4],
        [4, 4],
        [5, 4],
        [6, 4],
        [5, 0],
        [3, 6],
        [5, 8],
      ],
      tray: { mirror: 3 },
    },
    {
      id: "two-lasers",
      name: "Two Lasers",
      hint: "Two lasers, one receiver. A splitter also lets light through, so beams can share a path.",
      sources: [
        { x: 0, y: 2, d: E, c: R },
        { x: 6, y: 6, d: W, c: B },
      ],
      receivers: [{ x: 3, y: 0, c: R | B }],
      walls: [
        [1, 0],
        [5, 0],
        [0, 4],
        [6, 4],
        [2, 8],
        [4, 8],
      ],
      tray: { splitter: 1, mirror: 1 },
    },
    {
      id: "mirror-image",
      name: "Mirror Image",
      hint: "Tap a prism to flip which side red and blue leave from.",
      sources: [{ x: 0, y: 0, d: S, c: WHITE }],
      receivers: [
        { x: 6, y: 1, c: B },
        { x: 6, y: 4, c: G },
        { x: 6, y: 7, c: R },
      ],
      walls: [
        [2, 1],
        [2, 7],
        [4, 0],
        [4, 8],
        [1, 6],
      ],
      tray: { prism: 1, mirror: 1 },
    },
    {
      id: "crossroads",
      name: "Crossroads",
      hint: "Red and green make yellow. Bring both lasers to the same receiver.",
      sources: [
        { x: 0, y: 2, d: E, c: R },
        { x: 3, y: 8, d: N, c: G },
      ],
      receivers: [{ x: 6, y: 0, c: R | G }],
      walls: [
        [0, 5],
        [6, 5],
        [1, 7],
        [5, 7],
        [1, 0],
      ],
      tray: { splitter: 1, mirror: 1 },
    },
    {
      id: "rainbow",
      name: "Rainbow",
      hint: "Keep some white light and split the rest into its colors.",
      sources: [{ x: 0, y: 4, d: E, c: WHITE }],
      receivers: [
        { x: 6, y: 1, c: R },
        { x: 6, y: 4, c: G },
        { x: 6, y: 7, c: B },
        { x: 5, y: 8, c: WHITE },
      ],
      walls: [
        [0, 0],
        [3, 0],
        [0, 8],
        [3, 6],
        [4, 2],
      ],
      tray: { splitter: 1, prism: 1, mirror: 1 },
    },
    {
      id: "daybreak",
      name: "Daybreak",
      hint: "Red, green and blue together make white. Send each one through its own glass door.",
      sources: [{ x: 0, y: 8, d: E, c: WHITE }],
      receivers: [{ x: 3, y: 0, c: WHITE }],
      walls: [
        [2, 0],
        [4, 0],
        [1, 6],
        [5, 6],
        [0, 5],
        [6, 5],
      ],
      doors: [
        [2, 1, R],
        [3, 1, G],
        [4, 1, B],
      ],
      tray: { prism: 1, mirror: 3 },
    },
  ];

  const key = (x, y) => x + "," + y;

  function levelCells(level) {
    const cells = new Map();
    level.walls.forEach(([x, y]) => cells.set(key(x, y), { kind: "wall" }));
    (level.doors || []).forEach(([x, y, c]) =>
      cells.set(key(x, y), { kind: "door", c }),
    );
    level.receivers.forEach((r, i) =>
      cells.set(key(r.x, r.y), { kind: "receiver", i }),
    );
    level.sources.forEach((s) => cells.set(key(s.x, s.y), { kind: "source" }));
    return cells;
  }

  /* Follows every beam from every source. Each run is one straight stretch of
     light, from where it starts to where it stops or turns, with its colour and
     direction; a beam sent back the way it came shows up as a second run on the
     same line with the opposite direction. */
  function trace(level, pieces) {
    const cells = levelCells(level);
    pieces.forEach((p) => cells.set(key(p.x, p.y), { kind: "piece", p }));

    const hits = level.receivers.map(() => 0);
    const runs = [];
    const seen = new Set();
    const queue = level.sources.map((s) => ({
      x: s.x,
      y: s.y,
      d: s.d,
      c: s.c,
    }));
    let guard = 0;

    while (queue.length && guard++ < 800) {
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
        const stopAtEdge = () =>
          runs.push({
            x0: b.x,
            y0: b.y,
            x1: x + dx / 2,
            y1: y + dy / 2,
            c: b.c,
            d: b.d,
          });
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
          stopAtEdge();
          break;
        }
        const cell = cells.get(key(nx, ny));
        if (!cell) {
          x = nx;
          y = ny;
          continue;
        }
        if (cell.kind === "wall" || (cell.kind === "door" && !(b.c & cell.c))) {
          stopAtEdge();
          break;
        }
        runs.push({ x0: b.x, y0: b.y, x1: nx, y1: ny, c: b.c, d: b.d });
        if (cell.kind === "receiver") hits[cell.i] |= b.c;
        if (cell.kind === "door")
          queue.push({ x: nx, y: ny, d: b.d, c: b.c & cell.c });
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
    if (levelCells(level).has(key(x, y))) return false;
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
