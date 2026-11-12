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
  /* Ordered easy to hard; within each difficulty, the order levels were
     made in, so each mechanic is introduced by the level that teaches it. */
  const LEVELS = [
    {
      id: "first-light",
      name: "First Light",
      difficulty: "easy",
      hint: "Place the mirror where it turns the beam down into the receiver. Tap a placed piece to rotate it.",
      sources: [
        {
          x: 0,
          y: 2,
          d: 0,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 4,
          y: 6,
          c: 7,
        },
      ],
      walls: [
        [5, 2],
        [2, 4],
        [1, 6],
        [6, 7],
      ],
      tray: {
        mirror: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "mirror",
            x: 4,
            y: 2,
            k: 2,
          },
        ],
      },
    },
    {
      id: "spectrum",
      name: "Spectrum",
      difficulty: "easy",
      hint: "A prism splits white light into red, green and blue. Each receiver lights only for its own color.",
      sources: [
        {
          x: 0,
          y: 2,
          d: 0,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 5,
          y: 0,
          c: 4,
        },
        {
          x: 6,
          y: 7,
          c: 2,
        },
        {
          x: 2,
          y: 7,
          c: 1,
        },
      ],
      walls: [
        [3, 5],
        [1, 4],
        [1, 5],
        [0, 8],
        [4, 8],
      ],
      tray: {
        prism: 1,
        mirror: 2,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "mirror",
            x: 1,
            y: 2,
            k: 1,
          },
          {
            id: "prism",
            x: 2,
            y: 3,
            k: 0,
          },
          {
            id: "mirror",
            x: 5,
            y: 3,
            k: 6,
          },
        ],
      },
    },
    {
      id: "glass-doors",
      name: "Glass Doors",
      difficulty: "easy",
      hint: "Colored glass walls let only their own color through. A splitter sends the beam two ways at once. From here on, not every piece in the tray is needed.",
      sources: [
        {
          x: 0,
          y: 4,
          d: 0,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 6,
          y: 4,
          c: 4,
        },
        {
          x: 5,
          y: 0,
          c: 2,
        },
      ],
      walls: [
        [1, 1],
        [4, 6],
        [1, 7],
        [5, 8],
      ],
      doors: [
        [4, 4, 4],
        [2, 2, 2],
      ],
      tray: {
        splitter: 1,
        mirror: 3,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "splitter",
            x: 2,
            y: 4,
            k: 6,
          },
          {
            id: "mirror",
            x: 2,
            y: 0,
            k: 6,
          },
        ],
      },
    },
    {
      id: "recombine",
      name: "Recombine",
      difficulty: "easy",
      hint: "Filters are glass you can place. They pass only the colors they show.",
      sources: [
        {
          x: 0,
          y: 6,
          d: 0,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 3,
          y: 0,
          c: 6,
        },
        {
          x: 6,
          y: 3,
          c: 3,
        },
      ],
      walls: [
        [0, 0],
        [1, 3],
        [5, 1],
        [2, 8],
        [4, 4],
        [5, 7],
      ],
      tray: {
        splitter: 1,
        mirror: 1,
        prism: 2,
        "filter:6": 1,
        "filter:3": 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "splitter",
            x: 3,
            y: 6,
            k: 6,
          },
          {
            id: "filter:3",
            x: 4,
            y: 6,
            k: 0,
          },
          {
            id: "filter:6",
            x: 3,
            y: 5,
            k: 0,
          },
          {
            id: "mirror",
            x: 6,
            y: 6,
            k: 6,
          },
        ],
      },
    },
    {
      id: "echo",
      name: "Echo",
      difficulty: "easy",
      hint: "A mirror hit head-on sends light straight back. Watch the arrows: returning light can take a new path.",
      sources: [
        {
          x: 0,
          y: 4,
          d: 0,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 3,
          y: 0,
          c: 7,
        },
        {
          x: 3,
          y: 8,
          c: 4,
        },
      ],
      walls: [
        [5, 4],
        [1, 2],
        [5, 2],
        [1, 6],
        [5, 6],
      ],
      doors: [[3, 6, 4]],
      tray: {
        splitter: 1,
        mirror: 2,
        prism: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "splitter",
            x: 3,
            y: 4,
            k: 2,
          },
          {
            id: "mirror",
            x: 4,
            y: 4,
            k: 4,
          },
        ],
      },
    },
    {
      id: "three-ways",
      name: "Three Ways",
      difficulty: "easy",
      hint: "Three receivers, one beam. Each splitter sends part of the light off at an angle and lets the rest through.",
      sources: [
        {
          x: 0,
          y: 4,
          d: 0,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 2,
          y: 0,
          c: 7,
        },
        {
          x: 4,
          y: 8,
          c: 7,
        },
        {
          x: 6,
          y: 4,
          c: 7,
        },
      ],
      walls: [
        [0, 0],
        [6, 0],
        [0, 8],
        [6, 8],
        [1, 2],
        [5, 6],
      ],
      tray: {
        splitter: 3,
        mirror: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "splitter",
            x: 2,
            y: 4,
            k: 6,
          },
          {
            id: "splitter",
            x: 4,
            y: 4,
            k: 2,
          },
        ],
      },
    },
    {
      id: "detour",
      name: "Detour",
      difficulty: "easy",
      hint: "A mirror turned one step less than square bends light by 45°. Find the way through the gap in the barrier.",
      sources: [
        {
          x: 0,
          y: 1,
          d: 0,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 6,
          y: 7,
          c: 7,
        },
      ],
      walls: [
        [0, 5],
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
      tray: {
        mirror: 4,
        prism: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "mirror",
            x: 3,
            y: 1,
            k: 3,
          },
          {
            id: "mirror",
            x: 0,
            y: 4,
            k: 4,
          },
          {
            id: "mirror",
            x: 3,
            y: 7,
            k: 1,
          },
        ],
      },
    },
    {
      id: "two-lasers",
      name: "Two Lasers",
      difficulty: "easy",
      hint: "Two lasers, one receiver. A splitter also lets light through, so beams can share a path.",
      sources: [
        {
          x: 0,
          y: 2,
          d: 0,
          c: 4,
        },
        {
          x: 6,
          y: 6,
          d: 4,
          c: 1,
        },
      ],
      receivers: [
        {
          x: 3,
          y: 0,
          c: 5,
        },
      ],
      walls: [
        [2, 2],
        [1, 0],
        [5, 0],
        [0, 4],
        [6, 4],
        [2, 8],
        [4, 8],
      ],
      tray: {
        splitter: 1,
        mirror: 1,
        "filter:5": 1,
        "filter:4": 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "splitter",
            x: 1,
            y: 2,
            k: 7,
          },
          {
            id: "mirror",
            x: 3,
            y: 6,
            k: 2,
          },
        ],
      },
    },
    {
      id: "mirror-image",
      name: "Mirror Image",
      difficulty: "easy",
      hint: "Tap a prism to flip which side red and blue leave from.",
      sources: [
        {
          x: 0,
          y: 0,
          d: 2,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 6,
          y: 1,
          c: 1,
        },
        {
          x: 6,
          y: 4,
          c: 2,
        },
        {
          x: 6,
          y: 7,
          c: 4,
        },
      ],
      walls: [
        [2, 1],
        [2, 7],
        [4, 0],
        [4, 8],
        [1, 6],
      ],
      tray: {
        prism: 2,
        mirror: 2,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "mirror",
            x: 0,
            y: 4,
            k: 2,
          },
          {
            id: "prism",
            x: 3,
            y: 4,
            k: 1,
          },
        ],
      },
    },
    {
      id: "crossroads",
      name: "Crossroads",
      difficulty: "easy",
      hint: "Red and green make yellow. Bring both lasers to the same receiver.",
      sources: [
        {
          x: 0,
          y: 2,
          d: 0,
          c: 4,
        },
        {
          x: 3,
          y: 8,
          d: 6,
          c: 2,
        },
      ],
      receivers: [
        {
          x: 6,
          y: 0,
          c: 6,
        },
      ],
      walls: [
        [4, 2],
        [0, 5],
        [6, 5],
        [1, 7],
        [5, 7],
        [1, 0],
      ],
      tray: {
        splitter: 1,
        mirror: 2,
        prism: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "splitter",
            x: 3,
            y: 2,
            k: 6,
          },
          {
            id: "mirror",
            x: 3,
            y: 0,
            k: 6,
          },
        ],
      },
    },
    {
      id: "daybreak",
      name: "Daybreak",
      difficulty: "easy",
      hint: "Red, green and blue together make white. Send each one through its own glass door.",
      sources: [
        {
          x: 0,
          y: 8,
          d: 0,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 3,
          y: 0,
          c: 7,
        },
      ],
      walls: [
        [2, 0],
        [4, 0],
        [1, 6],
        [5, 6],
        [0, 5],
        [6, 5],
      ],
      doors: [
        [2, 1, 4],
        [3, 1, 2],
        [4, 1, 1],
      ],
      tray: {
        prism: 2,
        mirror: 4,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "mirror",
            x: 3,
            y: 8,
            k: 6,
          },
          {
            id: "prism",
            x: 3,
            y: 6,
            k: 0,
          },
          {
            id: "mirror",
            x: 0,
            y: 3,
            k: 4,
          },
          {
            id: "mirror",
            x: 6,
            y: 3,
            k: 4,
          },
        ],
      },
    },
    {
      id: "wormhole",
      name: "Wormhole",
      difficulty: "easy",
      hint: "Light that enters a portal leaves its twin, the other ring of the same color, still heading the same way.",
      sources: [
        {
          x: 0,
          y: 5,
          d: 0,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 4,
          y: 8,
          c: 7,
        },
      ],
      walls: [
        [5, 2],
        [3, 0],
        [3, 1],
        [1, 8],
        [2, 6],
      ],
      portals: [[2, 5, 5, 6]],
      tray: {
        mirror: 2,
        prism: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "mirror",
            x: 6,
            y: 6,
            k: 3,
          },
        ],
      },
    },
    {
      id: "lights-out",
      name: "Lights Out",
      difficulty: "easy",
      hint: "The octagons are dark sensors. Light the receiver without letting any light reach a sensor.",
      sources: [
        {
          x: 0,
          y: 2,
          d: 0,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 0,
          y: 5,
          c: 7,
        },
      ],
      walls: [
        [1, 4],
        [6, 5],
        [0, 8],
        [2, 2],
        [0, 3],
      ],
      sensors: [
        [0, 6],
        [2, 7],
        [5, 3],
      ],
      tray: {
        mirror: 3,
        prism: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "mirror",
            x: 1,
            y: 2,
            k: 1,
          },
          {
            id: "mirror",
            x: 4,
            y: 5,
            k: 5,
          },
        ],
      },
    },
    {
      id: "fixed-point",
      name: "Fixed Point",
      difficulty: "easy",
      hint: "Pieces with bolts in the corners are fixed: tap to turn them, but they cannot be moved.",
      sources: [
        {
          x: 1,
          y: 0,
          d: 2,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 0,
          y: 8,
          c: 7,
        },
      ],
      walls: [
        [2, 6],
        [5, 2],
        [0, 2],
        [2, 5],
        [1, 7],
        [0, 4],
      ],
      fixed: [
        {
          type: "mirror",
          x: 1,
          y: 3,
          k: 5,
        },
        {
          type: "mirror",
          x: 5,
          y: 7,
          k: 4,
        },
      ],
      tray: {
        mirror: 2,
        prism: 1,
      },
      solution: {
        fixed: [3, 2],
        placed: [
          {
            id: "mirror",
            x: 6,
            y: 8,
            k: 5,
          },
        ],
      },
    },
    {
      id: "stained-glass",
      name: "Stained Glass",
      difficulty: "easy",
      hint: "Each glass door decides which color carries on. Follow the light to see which receiver it can reach.",
      sources: [
        {
          x: 2,
          y: 8,
          d: 6,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 0,
          y: 5,
          c: 4,
        },
        {
          x: 4,
          y: 8,
          c: 2,
        },
      ],
      walls: [
        [6, 7],
        [0, 3],
        [4, 3],
        [5, 2],
      ],
      doors: [
        [3, 7, 2],
        [2, 5, 4],
      ],
      tray: {
        splitter: 1,
        mirror: 3,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "splitter",
            x: 2,
            y: 6,
            k: 7,
          },
          {
            id: "mirror",
            x: 2,
            y: 3,
            k: 1,
          },
        ],
      },
    },
    {
      id: "far-side",
      name: "Far Side",
      difficulty: "easy",
      hint: "Not every color has to take the portal. Watch where each one goes after the prism.",
      sources: [
        {
          x: 0,
          y: 2,
          d: 0,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 6,
          y: 0,
          c: 2,
        },
        {
          x: 3,
          y: 0,
          c: 5,
        },
      ],
      walls: [
        [4, 3],
        [0, 0],
        [3, 7],
        [4, 4],
      ],
      portals: [[2, 2, 5, 0]],
      tray: {
        prism: 2,
        mirror: 2,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "prism",
            x: 1,
            y: 2,
            k: 0,
          },
          {
            id: "mirror",
            x: 3,
            y: 4,
            k: 7,
          },
        ],
      },
    },
    {
      id: "relay",
      name: "Relay",
      difficulty: "easy",
      hint: "Two pairs of portals. The color of the ring tells you which twin the light comes out of.",
      sources: [
        {
          x: 0,
          y: 3,
          d: 0,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 2,
          y: 0,
          c: 7,
        },
        {
          x: 0,
          y: 2,
          c: 7,
        },
      ],
      walls: [
        [3, 2],
        [4, 4],
        [6, 2],
      ],
      sensors: [[2, 4]],
      portals: [
        [2, 3, 0, 5],
        [5, 4, 2, 1],
      ],
      tray: {
        mirror: 2,
        splitter: 1,
        prism: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "splitter",
            x: 1,
            y: 3,
            k: 5,
          },
          {
            id: "mirror",
            x: 5,
            y: 5,
            k: 6,
          },
        ],
      },
    },
    {
      id: "tunnels",
      name: "Tunnels",
      difficulty: "easy",
      hint: "Two pairs of portals. One receiver is closer than it looks.",
      sources: [
        {
          x: 0,
          y: 7,
          d: 0,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 0,
          y: 8,
          c: 7,
        },
        {
          x: 6,
          y: 0,
          c: 7,
        },
      ],
      walls: [
        [2, 4],
        [4, 1],
        [1, 1],
        [2, 6],
      ],
      sensors: [
        [2, 8],
        [3, 7],
      ],
      portals: [
        [2, 7, 4, 3],
        [5, 3, 3, 5],
      ],
      tray: {
        splitter: 1,
        mirror: 2,
        prism: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "splitter",
            x: 1,
            y: 7,
            k: 3,
          },
          {
            id: "mirror",
            x: 6,
            y: 5,
            k: 6,
          },
        ],
      },
    },
    {
      id: "warp-drive",
      name: "Warp Drive",
      difficulty: "easy",
      hint: "Two portal pairs and a prism. Red and blue each find their own way out.",
      sources: [
        {
          x: 1,
          y: 8,
          d: 6,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 0,
          y: 0,
          c: 4,
        },
        {
          x: 6,
          y: 8,
          c: 1,
        },
      ],
      walls: [
        [0, 1],
        [3, 1],
        [3, 8],
        [1, 5],
      ],
      sensors: [
        [4, 2],
        [1, 3],
      ],
      portals: [
        [1, 6, 1, 0],
        [0, 6, 4, 4],
      ],
      tray: {
        prism: 2,
        mirror: 2,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "prism",
            x: 1,
            y: 7,
            k: 0,
          },
          {
            id: "mirror",
            x: 3,
            y: 5,
            k: 0,
          },
        ],
      },
    },
    {
      id: "ricochet",
      name: "Ricochet",
      difficulty: "easy",
      hint: "One splitter and two receivers. The light that passes straight through is only half the job.",
      sources: [
        {
          x: 5,
          y: 0,
          d: 2,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 6,
          y: 0,
          c: 7,
        },
        {
          x: 0,
          y: 8,
          c: 7,
        },
      ],
      walls: [
        [3, 4],
        [0, 0],
        [4, 5],
        [2, 8],
      ],
      tray: {
        splitter: 1,
        mirror: 2,
        prism: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "splitter",
            x: 5,
            y: 1,
            k: 1,
          },
          {
            id: "mirror",
            x: 5,
            y: 3,
            k: 5,
          },
        ],
      },
    },
    {
      id: "lantern",
      name: "Lantern",
      difficulty: "easy",
      hint: "Two mirrors and one dark sensor. Go around it, not through it.",
      sources: [
        {
          x: 6,
          y: 7,
          d: 4,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 0,
          y: 5,
          c: 7,
        },
      ],
      walls: [
        [6, 1],
        [0, 1],
        [1, 4],
        [5, 1],
        [1, 5],
      ],
      sensors: [[4, 7]],
      tray: {
        mirror: 3,
        prism: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "mirror",
            x: 5,
            y: 7,
            k: 1,
          },
          {
            id: "mirror",
            x: 0,
            y: 2,
            k: 7,
          },
        ],
      },
    },
    {
      id: "pinhole",
      name: "Pinhole",
      difficulty: "easy",
      hint: "A portal pair and two mirrors. Find out where the light comes out first.",
      sources: [
        {
          x: 5,
          y: 8,
          d: 6,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 0,
          y: 1,
          c: 7,
        },
      ],
      walls: [
        [2, 5],
        [2, 2],
        [0, 2],
        [3, 2],
        [3, 0],
      ],
      sensors: [[4, 8]],
      portals: [[5, 6, 3, 1]],
      tray: {
        mirror: 3,
        prism: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "mirror",
            x: 5,
            y: 7,
            k: 5,
          },
          {
            id: "mirror",
            x: 6,
            y: 6,
            k: 3,
          },
        ],
      },
    },
    {
      id: "glass-house",
      name: "Glass House",
      difficulty: "easy",
      hint: "A green door and a red door. Split the white beam and let each door pick its color.",
      sources: [
        {
          x: 2,
          y: 8,
          d: 6,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 6,
          y: 0,
          c: 4,
        },
        {
          x: 0,
          y: 8,
          c: 2,
        },
      ],
      walls: [
        [5, 3],
        [1, 5],
        [6, 8],
      ],
      doors: [
        [1, 7, 2],
        [4, 0, 4],
      ],
      sensors: [
        [1, 1],
        [3, 1],
      ],
      tray: {
        splitter: 1,
        mirror: 3,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "splitter",
            x: 2,
            y: 6,
            k: 1,
          },
          {
            id: "mirror",
            x: 2,
            y: 0,
            k: 6,
          },
        ],
      },
    },
    {
      id: "magenta",
      name: "Magenta",
      difficulty: "medium",
      hint: "Colors add up. Red and blue arriving at the same receiver make magenta.",
      sources: [
        {
          x: 0,
          y: 4,
          d: 0,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 5,
          y: 4,
          c: 2,
        },
        {
          x: 6,
          y: 4,
          c: 5,
        },
      ],
      walls: [
        [5, 3],
        [0, 0],
        [6, 0],
        [0, 8],
        [6, 8],
        [2, 1],
        [2, 7],
      ],
      tray: {
        prism: 2,
        mirror: 3,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "prism",
            x: 3,
            y: 4,
            k: 0,
          },
          {
            id: "mirror",
            x: 6,
            y: 1,
            k: 1,
          },
          {
            id: "mirror",
            x: 6,
            y: 7,
            k: 7,
          },
        ],
      },
    },
    {
      id: "rainbow",
      name: "Rainbow",
      difficulty: "medium",
      hint: "Keep some white light and split the rest into its colors.",
      sources: [
        {
          x: 0,
          y: 4,
          d: 0,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 6,
          y: 1,
          c: 4,
        },
        {
          x: 6,
          y: 4,
          c: 2,
        },
        {
          x: 6,
          y: 7,
          c: 1,
        },
        {
          x: 5,
          y: 8,
          c: 7,
        },
      ],
      walls: [
        [5, 7],
        [1, 5],
        [0, 0],
        [3, 0],
        [0, 8],
        [3, 6],
        [4, 2],
      ],
      tray: {
        splitter: 1,
        prism: 2,
        mirror: 2,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "splitter",
            x: 2,
            y: 4,
            k: 2,
          },
          {
            id: "prism",
            x: 3,
            y: 4,
            k: 0,
          },
          {
            id: "mirror",
            x: 2,
            y: 8,
            k: 2,
          },
        ],
      },
    },
    {
      id: "minefield",
      name: "Minefield",
      difficulty: "medium",
      hint: "A splitter's second beam has to go somewhere too. Keep every sensor dark.",
      sources: [
        {
          x: 5,
          y: 0,
          d: 2,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 6,
          y: 4,
          c: 7,
        },
        {
          x: 2,
          y: 8,
          c: 7,
        },
      ],
      walls: [
        [3, 2],
        [0, 6],
        [2, 0],
        [5, 6],
      ],
      sensors: [
        [4, 4],
        [4, 5],
        [4, 8],
        [6, 7],
      ],
      tray: {
        splitter: 1,
        mirror: 2,
        prism: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "splitter",
            x: 5,
            y: 3,
            k: 3,
          },
          {
            id: "mirror",
            x: 5,
            y: 5,
            k: 5,
          },
        ],
      },
    },
    {
      id: "sieve",
      name: "Sieve",
      difficulty: "medium",
      hint: "Filters subtract colors. Split the beam, then let each part keep only what its receiver needs.",
      sources: [
        {
          x: 6,
          y: 3,
          d: 4,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 2,
          y: 0,
          c: 7,
        },
        {
          x: 0,
          y: 4,
          c: 5,
        },
      ],
      walls: [
        [1, 0],
        [6, 4],
        [0, 3],
        [3, 1],
      ],
      sensors: [
        [5, 1],
        [2, 4],
      ],
      tray: {
        splitter: 1,
        "filter:5": 1,
        mirror: 2,
        prism: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "mirror",
            x: 2,
            y: 3,
            k: 2,
          },
          {
            id: "splitter",
            x: 2,
            y: 2,
            k: 1,
          },
          {
            id: "filter:5",
            x: 1,
            y: 3,
            k: 0,
          },
        ],
      },
    },
    {
      id: "afterglow",
      name: "Afterglow",
      difficulty: "medium",
      hint: "Both receivers want white light. A splitter makes two white beams, and three sensors wait for any stray light.",
      sources: [
        {
          x: 4,
          y: 8,
          d: 6,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 6,
          y: 0,
          c: 7,
        },
        {
          x: 0,
          y: 4,
          c: 7,
        },
      ],
      walls: [
        [5, 8],
        [2, 5],
        [6, 6],
        [4, 5],
      ],
      sensors: [
        [5, 1],
        [3, 7],
        [5, 0],
      ],
      tray: {
        splitter: 1,
        mirror: 3,
        prism: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "mirror",
            x: 4,
            y: 7,
            k: 5,
          },
          {
            id: "mirror",
            x: 6,
            y: 5,
            k: 5,
          },
          {
            id: "splitter",
            x: 6,
            y: 4,
            k: 2,
          },
        ],
      },
    },
    {
      id: "double-prism",
      name: "Double Prism",
      difficulty: "medium",
      hint: "A prism also bends a single color: red and blue turn 45°, green goes straight on.",
      sources: [
        {
          x: 1,
          y: 8,
          d: 6,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 5,
          y: 8,
          c: 2,
        },
        {
          x: 5,
          y: 0,
          c: 1,
        },
        {
          x: 0,
          y: 4,
          c: 4,
        },
      ],
      walls: [
        [5, 2],
        [0, 3],
        [4, 8],
      ],
      sensors: [[6, 2]],
      tray: {
        prism: 4,
        mirror: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "prism",
            x: 1,
            y: 5,
            k: 0,
          },
          {
            id: "mirror",
            x: 1,
            y: 4,
            k: 7,
          },
          {
            id: "prism",
            x: 5,
            y: 1,
            k: 1,
          },
        ],
      },
    },
    {
      id: "labyrinth",
      name: "Labyrinth",
      difficulty: "medium",
      hint: "One beam, one receiver, four mirrors and three sensors. The long way round is the only way.",
      sources: [
        {
          x: 6,
          y: 6,
          d: 4,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 6,
          y: 1,
          c: 7,
        },
      ],
      walls: [
        [2, 7],
        [6, 2],
        [4, 7],
        [5, 1],
        [5, 4],
        [5, 2],
      ],
      sensors: [
        [6, 4],
        [4, 6],
        [4, 5],
      ],
      tray: {
        mirror: 5,
        prism: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "mirror",
            x: 5,
            y: 6,
            k: 2,
          },
          {
            id: "mirror",
            x: 5,
            y: 5,
            k: 3,
          },
          {
            id: "mirror",
            x: 0,
            y: 0,
            k: 5,
          },
          {
            id: "mirror",
            x: 5,
            y: 0,
            k: 1,
          },
        ],
      },
    },
    {
      id: "hall-of-mirrors",
      name: "Hall of Mirrors",
      difficulty: "medium",
      hint: "Two fixed mirrors and two of your own. Sensors line the way.",
      sources: [
        {
          x: 1,
          y: 8,
          d: 6,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 0,
          y: 1,
          c: 7,
        },
      ],
      walls: [
        [0, 4],
        [4, 3],
        [0, 8],
        [2, 6],
      ],
      sensors: [
        [2, 7],
        [1, 6],
        [2, 5],
      ],
      fixed: [
        {
          type: "mirror",
          x: 1,
          y: 1,
          k: 5,
        },
        {
          type: "mirror",
          x: 1,
          y: 5,
          k: 0,
        },
      ],
      tray: {
        mirror: 3,
        prism: 1,
      },
      solution: {
        fixed: [2, 5],
        placed: [
          {
            id: "mirror",
            x: 1,
            y: 7,
            k: 3,
          },
          {
            id: "mirror",
            x: 0,
            y: 6,
            k: 4,
          },
        ],
      },
    },
    {
      id: "filter-bank",
      name: "Filter Bank",
      difficulty: "medium",
      hint: "Both receivers want blue. Filters take colors away; a splitter makes a second beam.",
      sources: [
        {
          x: 2,
          y: 0,
          d: 2,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 5,
          y: 0,
          c: 1,
        },
        {
          x: 2,
          y: 8,
          c: 1,
        },
      ],
      walls: [
        [0, 8],
        [1, 5],
        [3, 2],
        [5, 2],
      ],
      sensors: [
        [3, 3],
        [6, 6],
      ],
      tray: {
        "filter:1": 1,
        splitter: 1,
        mirror: 3,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "filter:1",
            x: 2,
            y: 1,
            k: 0,
          },
          {
            id: "splitter",
            x: 2,
            y: 2,
            k: 1,
          },
          {
            id: "mirror",
            x: 4,
            y: 0,
            k: 7,
          },
        ],
      },
    },
    {
      id: "eclipse",
      name: "Eclipse",
      difficulty: "medium",
      hint: "Five dark sensors and three mirrors. Every turn has to miss them.",
      sources: [
        {
          x: 0,
          y: 2,
          d: 0,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 0,
          y: 7,
          c: 7,
        },
      ],
      walls: [
        [2, 7],
        [0, 1],
        [6, 1],
        [3, 2],
      ],
      sensors: [
        [2, 0],
        [2, 3],
        [0, 3],
        [1, 3],
        [2, 2],
      ],
      tray: {
        mirror: 4,
        prism: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "mirror",
            x: 1,
            y: 2,
            k: 7,
          },
          {
            id: "mirror",
            x: 3,
            y: 0,
            k: 0,
          },
          {
            id: "mirror",
            x: 5,
            y: 2,
            k: 4,
          },
        ],
      },
    },
    {
      id: "periscope",
      name: "Periscope",
      difficulty: "medium",
      hint: "One portal pair and two white receivers. Split the light where both halves can still get home.",
      sources: [
        {
          x: 0,
          y: 3,
          d: 0,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 6,
          y: 6,
          c: 7,
        },
        {
          x: 0,
          y: 0,
          c: 7,
        },
      ],
      walls: [
        [2, 6],
        [2, 4],
        [4, 0],
        [3, 3],
      ],
      sensors: [
        [6, 3],
        [5, 1],
        [2, 3],
      ],
      portals: [[3, 1, 3, 5]],
      tray: {
        mirror: 3,
        splitter: 1,
        prism: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "mirror",
            x: 1,
            y: 3,
            k: 7,
          },
          {
            id: "splitter",
            x: 2,
            y: 2,
            k: 4,
          },
          {
            id: "mirror",
            x: 4,
            y: 4,
            k: 0,
          },
        ],
      },
    },
    {
      id: "mirage",
      name: "Mirage",
      difficulty: "medium",
      hint: "Two portal pairs, three mirrors, one receiver. Light leaves a portal where you least expect it.",
      sources: [
        {
          x: 6,
          y: 5,
          d: 4,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 3,
          y: 8,
          c: 7,
        },
      ],
      walls: [
        [3, 4],
        [6, 7],
        [6, 6],
        [3, 6],
      ],
      sensors: [
        [1, 4],
        [0, 4],
        [1, 6],
      ],
      portals: [
        [5, 5, 1, 5],
        [0, 6, 6, 1],
      ],
      tray: {
        mirror: 4,
        prism: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "mirror",
            x: 0,
            y: 5,
            k: 6,
          },
          {
            id: "mirror",
            x: 6,
            y: 2,
            k: 5,
          },
          {
            id: "mirror",
            x: 0,
            y: 8,
            k: 3,
          },
        ],
      },
    },
    {
      id: "gatekeeper",
      name: "Gatekeeper",
      difficulty: "medium",
      hint: "Two glass doors and two splitters. Each door decides which color gets through.",
      sources: [
        {
          x: 4,
          y: 8,
          d: 6,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 0,
          y: 2,
          c: 2,
        },
        {
          x: 6,
          y: 3,
          c: 4,
        },
        {
          x: 3,
          y: 8,
          c: 7,
        },
      ],
      walls: [
        [0, 7],
        [1, 4],
        [0, 6],
      ],
      doors: [
        [4, 2, 4],
        [2, 4, 2],
      ],
      sensors: [[3, 6]],
      tray: {
        splitter: 2,
        mirror: 3,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "splitter",
            x: 4,
            y: 7,
            k: 1,
          },
          {
            id: "splitter",
            x: 4,
            y: 6,
            k: 3,
          },
          {
            id: "mirror",
            x: 4,
            y: 1,
            k: 7,
          },
        ],
      },
    },
    {
      id: "aurora",
      name: "Aurora",
      difficulty: "medium",
      hint: "A prism and two mirrors. Two receivers, two colors, and two sensors to steer around.",
      sources: [
        {
          x: 6,
          y: 6,
          d: 4,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 1,
          y: 0,
          c: 1,
        },
        {
          x: 0,
          y: 6,
          c: 4,
        },
      ],
      walls: [
        [0, 7],
        [4, 2],
        [2, 3],
        [1, 5],
      ],
      sensors: [
        [1, 7],
        [3, 5],
      ],
      tray: {
        prism: 2,
        mirror: 3,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "mirror",
            x: 3,
            y: 6,
            k: 1,
          },
          {
            id: "prism",
            x: 1,
            y: 4,
            k: 0,
          },
          {
            id: "mirror",
            x: 0,
            y: 4,
            k: 6,
          },
        ],
      },
    },
    {
      id: "dual-core",
      name: "Dual Core",
      difficulty: "medium",
      hint: "A white laser and a red one. Only the white laser can light the green receiver.",
      sources: [
        {
          x: 2,
          y: 8,
          d: 6,
          c: 7,
        },
        {
          x: 2,
          y: 0,
          d: 2,
          c: 4,
        },
      ],
      receivers: [
        {
          x: 0,
          y: 6,
          c: 4,
        },
        {
          x: 6,
          y: 4,
          c: 2,
        },
      ],
      walls: [
        [4, 3],
        [5, 6],
        [5, 2],
        [2, 5],
      ],
      sensors: [[5, 3]],
      tray: {
        prism: 2,
        mirror: 3,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "mirror",
            x: 2,
            y: 6,
            k: 3,
          },
          {
            id: "prism",
            x: 2,
            y: 4,
            k: 1,
          },
          {
            id: "mirror",
            x: 0,
            y: 4,
            k: 5,
          },
        ],
      },
    },
    {
      id: "gearbox",
      name: "Gearbox",
      difficulty: "hard",
      hint: "Start by turning the fixed splitter, then see where the prism belongs.",
      sources: [
        {
          x: 2,
          y: 8,
          d: 6,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 1,
          y: 0,
          c: 4,
        },
        {
          x: 6,
          y: 0,
          c: 1,
        },
        {
          x: 6,
          y: 8,
          c: 7,
        },
      ],
      walls: [
        [6, 6],
        [5, 5],
        [5, 2],
      ],
      sensors: [[3, 3]],
      fixed: [
        {
          type: "splitter",
          x: 2,
          y: 4,
          k: 6,
        },
      ],
      tray: {
        prism: 1,
        mirror: 3,
      },
      solution: {
        fixed: [7],
        placed: [
          {
            id: "prism",
            x: 2,
            y: 1,
            k: 0,
          },
          {
            id: "mirror",
            x: 3,
            y: 0,
            k: 7,
          },
        ],
      },
    },
    {
      id: "twin-beams",
      name: "Twin Beams",
      difficulty: "hard",
      hint: "Two lasers, each with its own color. Some receivers want both.",
      sources: [
        {
          x: 2,
          y: 0,
          d: 2,
          c: 4,
        },
        {
          x: 6,
          y: 4,
          d: 4,
          c: 1,
        },
      ],
      receivers: [
        {
          x: 0,
          y: 0,
          c: 5,
        },
        {
          x: 6,
          y: 2,
          c: 5,
        },
      ],
      walls: [
        [4, 0],
        [6, 0],
        [3, 0],
      ],
      sensors: [
        [3, 7],
        [1, 3],
      ],
      tray: {
        splitter: 1,
        mirror: 4,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "splitter",
            x: 2,
            y: 4,
            k: 6,
          },
          {
            id: "mirror",
            x: 2,
            y: 6,
            k: 1,
          },
          {
            id: "mirror",
            x: 0,
            y: 4,
            k: 2,
          },
        ],
      },
    },
    {
      id: "clockwork",
      name: "Clockwork",
      difficulty: "hard",
      hint: "One fixed mirror, one portal pair, a prism and a splitter all have to work together.",
      sources: [
        {
          x: 5,
          y: 0,
          d: 2,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 3,
          y: 0,
          c: 4,
        },
        {
          x: 0,
          y: 5,
          c: 1,
        },
        {
          x: 3,
          y: 8,
          c: 2,
        },
      ],
      walls: [
        [0, 7],
        [0, 0],
        [1, 5],
      ],
      sensors: [
        [6, 1],
        [2, 0],
      ],
      portals: [[2, 1, 4, 3]],
      fixed: [
        {
          type: "mirror",
          x: 5,
          y: 1,
          k: 1,
        },
      ],
      tray: {
        prism: 2,
        splitter: 2,
      },
      solution: {
        fixed: [6],
        placed: [
          {
            id: "prism",
            x: 4,
            y: 1,
            k: 1,
          },
          {
            id: "splitter",
            x: 3,
            y: 1,
            k: 6,
          },
        ],
      },
    },
    {
      id: "supernova",
      name: "Supernova",
      difficulty: "hard",
      hint: "Everything you have learned, in one level. Mind the sensors.",
      sources: [
        {
          x: 4,
          y: 0,
          d: 2,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 0,
          y: 1,
          c: 1,
        },
        {
          x: 0,
          y: 8,
          c: 1,
        },
        {
          x: 4,
          y: 8,
          c: 2,
        },
      ],
      walls: [
        [5, 4],
        [3, 8],
        [3, 2],
        [0, 2],
        [1, 1],
      ],
      doors: [[5, 2, 1]],
      sensors: [
        [3, 3],
        [3, 4],
      ],
      tray: {
        splitter: 1,
        prism: 1,
        mirror: 3,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "prism",
            x: 4,
            y: 4,
            k: 0,
          },
          {
            id: "splitter",
            x: 2,
            y: 6,
            k: 1,
          },
          {
            id: "mirror",
            x: 2,
            y: 3,
            k: 3,
          },
        ],
      },
    },
    {
      id: "lighthouse",
      name: "Lighthouse",
      difficulty: "hard",
      hint: "Two fixed pieces to turn and two mirrors to place. Turn the fixed ones first and watch where the light goes.",
      sources: [
        {
          x: 6,
          y: 6,
          d: 4,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 6,
          y: 5,
          c: 7,
        },
        {
          x: 0,
          y: 0,
          c: 7,
        },
      ],
      walls: [
        [4, 1],
        [1, 2],
        [4, 2],
      ],
      sensors: [
        [2, 7],
        [1, 8],
      ],
      fixed: [
        {
          type: "mirror",
          x: 2,
          y: 6,
          k: 4,
        },
        {
          type: "splitter",
          x: 1,
          y: 7,
          k: 4,
        },
      ],
      tray: {
        mirror: 3,
        prism: 1,
      },
      solution: {
        fixed: [7, 1],
        placed: [
          {
            id: "mirror",
            x: 0,
            y: 8,
            k: 1,
          },
          {
            id: "mirror",
            x: 1,
            y: 5,
            k: 6,
          },
        ],
      },
    },
    {
      id: "crossfire",
      name: "Crossfire",
      difficulty: "hard",
      hint: "Three lasers: red, green and blue. The cyan receiver needs two of them to meet.",
      sources: [
        {
          x: 6,
          y: 5,
          d: 4,
          c: 4,
        },
        {
          x: 1,
          y: 0,
          d: 2,
          c: 2,
        },
        {
          x: 0,
          y: 5,
          d: 0,
          c: 1,
        },
      ],
      receivers: [
        {
          x: 0,
          y: 0,
          c: 3,
        },
        {
          x: 6,
          y: 6,
          c: 4,
        },
      ],
      walls: [
        [3, 0],
        [6, 7],
        [0, 7],
      ],
      sensors: [
        [0, 3],
        [0, 2],
      ],
      tray: {
        mirror: 4,
        prism: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "mirror",
            x: 5,
            y: 5,
            k: 5,
          },
          {
            id: "mirror",
            x: 1,
            y: 2,
            k: 7,
          },
          {
            id: "mirror",
            x: 0,
            y: 1,
            k: 3,
          },
        ],
      },
    },
    {
      id: "kaleidoscope",
      name: "Kaleidoscope",
      difficulty: "hard",
      hint: "Magenta, green and blue. A splitter passes every color; a prism sorts them.",
      sources: [
        {
          x: 4,
          y: 0,
          d: 2,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 6,
          y: 7,
          c: 5,
        },
        {
          x: 0,
          y: 2,
          c: 2,
        },
        {
          x: 1,
          y: 8,
          c: 1,
        },
      ],
      walls: [
        [3, 4],
        [2, 1],
        [5, 2],
      ],
      sensors: [[3, 8]],
      tray: {
        prism: 2,
        splitter: 1,
        mirror: 2,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "prism",
            x: 4,
            y: 5,
            k: 0,
          },
          {
            id: "mirror",
            x: 4,
            y: 6,
            k: 7,
          },
          {
            id: "splitter",
            x: 2,
            y: 7,
            k: 3,
          },
        ],
      },
    },
    {
      id: "color-wheel",
      name: "Color Wheel",
      difficulty: "hard",
      hint: "A blue glass door guards one receiver. Split the white beam before you break it into colors.",
      sources: [
        {
          x: 3,
          y: 0,
          d: 2,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 3,
          y: 8,
          c: 1,
        },
        {
          x: 6,
          y: 3,
          c: 2,
        },
        {
          x: 0,
          y: 4,
          c: 4,
        },
      ],
      walls: [
        [5, 1],
        [6, 2],
        [4, 5],
        [1, 4],
      ],
      doors: [[3, 7, 1]],
      sensors: [[2, 7]],
      tray: {
        splitter: 1,
        prism: 2,
        mirror: 2,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "splitter",
            x: 3,
            y: 3,
            k: 6,
          },
          {
            id: "prism",
            x: 1,
            y: 3,
            k: 0,
          },
          {
            id: "mirror",
            x: 0,
            y: 3,
            k: 4,
          },
        ],
      },
    },
    {
      id: "interference",
      name: "Interference",
      difficulty: "hard",
      hint: "Each laser has its own color, and there are two red receivers. One splitter is not enough.",
      sources: [
        {
          x: 2,
          y: 0,
          d: 2,
          c: 4,
        },
        {
          x: 2,
          y: 8,
          d: 6,
          c: 1,
        },
      ],
      receivers: [
        {
          x: 1,
          y: 0,
          c: 4,
        },
        {
          x: 1,
          y: 8,
          c: 1,
        },
        {
          x: 6,
          y: 0,
          c: 4,
        },
      ],
      walls: [
        [6, 8],
        [1, 5],
        [4, 0],
        [3, 3],
      ],
      sensors: [
        [3, 2],
        [3, 0],
      ],
      tray: {
        splitter: 4,
        mirror: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "splitter",
            x: 2,
            y: 1,
            k: 7,
          },
          {
            id: "mirror",
            x: 2,
            y: 7,
            k: 1,
          },
          {
            id: "splitter",
            x: 6,
            y: 3,
            k: 5,
          },
        ],
      },
    },
    {
      id: "big-bang",
      name: "Big Bang",
      difficulty: "hard",
      hint: "Everything at once: a fixed mirror, a portal pair, a splitter and a prism. Start with the fixed mirror.",
      sources: [
        {
          x: 0,
          y: 6,
          d: 0,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 6,
          y: 0,
          c: 1,
        },
        {
          x: 0,
          y: 2,
          c: 7,
        },
        {
          x: 1,
          y: 0,
          c: 4,
        },
      ],
      walls: [
        [2, 8],
        [0, 7],
        [1, 8],
      ],
      sensors: [
        [2, 7],
        [3, 5],
      ],
      portals: [[4, 0, 1, 4]],
      fixed: [
        {
          type: "mirror",
          x: 4,
          y: 6,
          k: 7,
        },
      ],
      tray: {
        splitter: 1,
        prism: 2,
        mirror: 2,
      },
      solution: {
        fixed: [6],
        placed: [
          {
            id: "splitter",
            x: 2,
            y: 6,
            k: 6,
          },
          {
            id: "prism",
            x: 2,
            y: 4,
            k: 0,
          },
          {
            id: "mirror",
            x: 1,
            y: 3,
            k: 3,
          },
        ],
      },
    },
    {
      id: "tricolor",
      name: "Tricolor",
      difficulty: "hard",
      hint: "Red, green and blue lasers, but no receiver wants green. Keep it out of the way.",
      sources: [
        {
          x: 6,
          y: 3,
          d: 4,
          c: 4,
        },
        {
          x: 1,
          y: 8,
          d: 6,
          c: 2,
        },
        {
          x: 0,
          y: 2,
          d: 0,
          c: 1,
        },
      ],
      receivers: [
        {
          x: 0,
          y: 3,
          c: 4,
        },
        {
          x: 6,
          y: 0,
          c: 1,
        },
        {
          x: 6,
          y: 7,
          c: 1,
        },
      ],
      walls: [
        [1, 1],
        [4, 7],
        [0, 6],
        [3, 2],
      ],
      sensors: [[2, 4]],
      tray: {
        splitter: 1,
        mirror: 4,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "splitter",
            x: 3,
            y: 3,
            k: 0,
          },
          {
            id: "mirror",
            x: 2,
            y: 2,
            k: 1,
          },
          {
            id: "mirror",
            x: 6,
            y: 6,
            k: 3,
          },
        ],
      },
    },
    {
      id: "switchback",
      name: "Switchback",
      difficulty: "hard",
      hint: "Two red receivers, and a blue laser that must not spoil either of them.",
      sources: [
        {
          x: 0,
          y: 1,
          d: 0,
          c: 4,
        },
        {
          x: 5,
          y: 8,
          d: 6,
          c: 1,
        },
      ],
      receivers: [
        {
          x: 1,
          y: 8,
          c: 4,
        },
        {
          x: 1,
          y: 0,
          c: 4,
        },
      ],
      walls: [
        [6, 1],
        [3, 8],
        [4, 0],
        [1, 5],
      ],
      sensors: [
        [5, 0],
        [3, 0],
      ],
      tray: {
        mirror: 3,
        splitter: 1,
        prism: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "splitter",
            x: 1,
            y: 1,
            k: 6,
          },
          {
            id: "mirror",
            x: 5,
            y: 4,
            k: 5,
          },
          {
            id: "mirror",
            x: 5,
            y: 1,
            k: 2,
          },
        ],
      },
    },
    {
      id: "wavelength",
      name: "Wavelength",
      difficulty: "hard",
      hint: "Blue, green and yellow. Yellow is red and green arriving together.",
      sources: [
        {
          x: 6,
          y: 7,
          d: 4,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 3,
          y: 8,
          c: 1,
        },
        {
          x: 3,
          y: 0,
          c: 2,
        },
        {
          x: 0,
          y: 3,
          c: 6,
        },
      ],
      walls: [
        [4, 5],
        [6, 5],
        [1, 8],
        [0, 4],
      ],
      sensors: [
        [4, 3],
        [4, 4],
        [4, 8],
      ],
      tray: {
        prism: 2,
        mirror: 2,
        splitter: 1,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "prism",
            x: 4,
            y: 7,
            k: 1,
          },
          {
            id: "mirror",
            x: 3,
            y: 7,
            k: 2,
          },
          {
            id: "splitter",
            x: 3,
            y: 3,
            k: 2,
          },
        ],
      },
    },
    {
      id: "binary-star",
      name: "Binary Star",
      difficulty: "hard",
      hint: "Two lasers and three receivers. One of them is easier than it looks.",
      sources: [
        {
          x: 3,
          y: 8,
          d: 6,
          c: 7,
        },
        {
          x: 4,
          y: 8,
          d: 6,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 4,
          y: 0,
          c: 7,
        },
        {
          x: 6,
          y: 3,
          c: 2,
        },
        {
          x: 5,
          y: 8,
          c: 2,
        },
      ],
      walls: [
        [0, 1],
        [2, 2],
        [6, 1],
        [3, 3],
      ],
      sensors: [
        [2, 5],
        [2, 3],
      ],
      tray: {
        splitter: 1,
        mirror: 2,
        prism: 2,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "prism",
            x: 3,
            y: 7,
            k: 0,
          },
          {
            id: "mirror",
            x: 3,
            y: 6,
            k: 5,
          },
          {
            id: "splitter",
            x: 5,
            y: 4,
            k: 1,
          },
        ],
      },
    },
    {
      id: "refraction",
      name: "Refraction",
      difficulty: "hard",
      hint: "Two prisms and two mirrors. Every receiver wants a single color.",
      sources: [
        {
          x: 6,
          y: 3,
          d: 4,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 3,
          y: 0,
          c: 4,
        },
        {
          x: 0,
          y: 5,
          c: 2,
        },
        {
          x: 2,
          y: 8,
          c: 1,
        },
      ],
      walls: [
        [4, 0],
        [5, 0],
        [1, 1],
        [2, 3],
      ],
      sensors: [[2, 1]],
      tray: {
        prism: 4,
        mirror: 2,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "mirror",
            x: 4,
            y: 3,
            k: 5,
          },
          {
            id: "mirror",
            x: 6,
            y: 5,
            k: 5,
          },
          {
            id: "prism",
            x: 5,
            y: 5,
            k: 1,
          },
          {
            id: "prism",
            x: 3,
            y: 3,
            k: 1,
          },
        ],
      },
    },
    {
      id: "overdrive",
      name: "Overdrive",
      difficulty: "hard",
      hint: "A fixed splitter feeds everything. The yellow receiver needs red and green to meet.",
      sources: [
        {
          x: 6,
          y: 6,
          d: 4,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 0,
          y: 5,
          c: 1,
        },
        {
          x: 5,
          y: 8,
          c: 7,
        },
        {
          x: 6,
          y: 1,
          c: 6,
        },
      ],
      walls: [
        [4, 8],
        [2, 0],
        [3, 5],
      ],
      sensors: [
        [1, 7],
        [6, 5],
      ],
      fixed: [
        {
          type: "splitter",
          x: 5,
          y: 6,
          k: 2,
        },
      ],
      tray: {
        prism: 2,
        mirror: 3,
      },
      solution: {
        fixed: [6],
        placed: [
          {
            id: "prism",
            x: 1,
            y: 6,
            k: 0,
          },
          {
            id: "mirror",
            x: 0,
            y: 7,
            k: 1,
          },
          {
            id: "mirror",
            x: 0,
            y: 6,
            k: 6,
          },
        ],
      },
    },
    {
      id: "event-horizon",
      name: "Event Horizon",
      difficulty: "hard",
      hint: "A portal pair, a splitter and a prism. Two receivers want green, and they are far apart.",
      sources: [
        {
          x: 0,
          y: 6,
          d: 0,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 6,
          y: 4,
          c: 2,
        },
        {
          x: 0,
          y: 8,
          c: 2,
        },
        {
          x: 5,
          y: 8,
          c: 1,
        },
      ],
      walls: [
        [1, 3],
        [3, 5],
        [0, 1],
        [1, 7],
      ],
      sensors: [
        [2, 8],
        [2, 3],
      ],
      portals: [[4, 6, 1, 4]],
      tray: {
        splitter: 1,
        prism: 2,
        mirror: 2,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "prism",
            x: 3,
            y: 6,
            k: 0,
          },
          {
            id: "splitter",
            x: 3,
            y: 4,
            k: 3,
          },
          {
            id: "mirror",
            x: 0,
            y: 7,
            k: 5,
          },
        ],
      },
    },
    {
      id: "finale",
      name: "Finale",
      difficulty: "hard",
      hint: "A fixed mirror, a portal pair, a glass door, a splitter and a prism, all in one level.",
      sources: [
        {
          x: 2,
          y: 8,
          d: 6,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 0,
          y: 1,
          c: 4,
        },
        {
          x: 3,
          y: 0,
          c: 1,
        },
        {
          x: 3,
          y: 8,
          c: 7,
        },
      ],
      walls: [
        [6, 2],
        [2, 1],
        [0, 8],
        [1, 2],
      ],
      doors: [[3, 1, 2]],
      sensors: [
        [3, 3],
        [4, 2],
        [5, 2],
      ],
      portals: [[4, 0, 6, 6]],
      fixed: [
        {
          type: "mirror",
          x: 2,
          y: 2,
          k: 7,
        },
      ],
      tray: {
        splitter: 1,
        prism: 2,
        mirror: 2,
      },
      solution: {
        fixed: [3],
        placed: [
          {
            id: "splitter",
            x: 2,
            y: 7,
            k: 7,
          },
          {
            id: "prism",
            x: 1,
            y: 1,
            k: 0,
          },
          {
            id: "mirror",
            x: 1,
            y: 0,
            k: 6,
          },
        ],
      },
    },
    {
      id: "spectral-lock",
      name: "Spectral Lock",
      difficulty: "hard",
      hint: "Red, green and blue lasers. Two receivers want green, and one splitter can make two green beams.",
      sources: [
        {
          x: 3,
          y: 8,
          d: 6,
          c: 4,
        },
        {
          x: 0,
          y: 3,
          d: 0,
          c: 2,
        },
        {
          x: 3,
          y: 0,
          d: 2,
          c: 1,
        },
      ],
      receivers: [
        {
          x: 0,
          y: 6,
          c: 1,
        },
        {
          x: 6,
          y: 0,
          c: 2,
        },
        {
          x: 6,
          y: 3,
          c: 2,
        },
      ],
      walls: [
        [2, 5],
        [2, 1],
        [5, 2],
        [4, 2],
      ],
      sensors: [
        [4, 5],
        [4, 6],
      ],
      tray: {
        splitter: 1,
        mirror: 4,
      },
      solution: {
        fixed: [],
        placed: [
          {
            id: "splitter",
            x: 3,
            y: 3,
            k: 5,
          },
          {
            id: "mirror",
            x: 2,
            y: 2,
            k: 4,
          },
          {
            id: "mirror",
            x: 4,
            y: 0,
            k: 7,
          },
        ],
      },
    },
    {
      id: "night-shift",
      name: "Night Shift",
      difficulty: "hard",
      hint: "The fixed mirror starts turned the wrong way. Both receivers want white.",
      sources: [
        {
          x: 0,
          y: 1,
          d: 0,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 0,
          y: 0,
          c: 7,
        },
        {
          x: 4,
          y: 0,
          c: 7,
        },
      ],
      walls: [
        [6, 6],
        [0, 4],
        [5, 7],
        [2, 1],
      ],
      sensors: [
        [1, 0],
        [3, 1],
      ],
      fixed: [
        {
          type: "mirror",
          x: 5,
          y: 1,
          k: 7,
        },
      ],
      tray: {
        splitter: 1,
        mirror: 3,
        prism: 1,
      },
      solution: {
        fixed: [4],
        placed: [
          {
            id: "mirror",
            x: 1,
            y: 1,
            k: 2,
          },
          {
            id: "mirror",
            x: 1,
            y: 5,
            k: 1,
          },
          {
            id: "splitter",
            x: 3,
            y: 3,
            k: 4,
          },
        ],
      },
    },
    {
      id: "zenith",
      name: "Zenith",
      difficulty: "hard",
      hint: "A fixed prism and a green glass door. Turn the prism so every color reaches its own receiver.",
      sources: [
        {
          x: 4,
          y: 8,
          d: 6,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 6,
          y: 3,
          c: 7,
        },
        {
          x: 1,
          y: 0,
          c: 1,
        },
        {
          x: 1,
          y: 8,
          c: 4,
        },
      ],
      walls: [
        [0, 0],
        [4, 3],
        [0, 5],
      ],
      doors: [[0, 7, 2]],
      sensors: [
        [5, 6],
        [2, 6],
      ],
      fixed: [
        {
          type: "prism",
          x: 2,
          y: 7,
          k: 1,
        },
      ],
      tray: {
        splitter: 1,
        mirror: 4,
      },
      solution: {
        fixed: [0],
        placed: [
          {
            id: "splitter",
            x: 4,
            y: 7,
            k: 2,
          },
          {
            id: "mirror",
            x: 4,
            y: 5,
            k: 5,
          },
          {
            id: "mirror",
            x: 1,
            y: 6,
            k: 3,
          },
        ],
      },
    },
    {
      id: "quasar",
      name: "Quasar",
      difficulty: "hard",
      hint: "A fixed splitter, a portal pair and a prism, with three receivers and three sensors.",
      sources: [
        {
          x: 2,
          y: 0,
          d: 2,
          c: 7,
        },
      ],
      receivers: [
        {
          x: 3,
          y: 8,
          c: 2,
        },
        {
          x: 6,
          y: 5,
          c: 1,
        },
        {
          x: 0,
          y: 0,
          c: 4,
        },
      ],
      walls: [
        [1, 8],
        [4, 7],
        [0, 4],
        [0, 1],
      ],
      sensors: [
        [5, 4],
        [1, 5],
        [5, 6],
      ],
      portals: [[2, 3, 3, 0]],
      fixed: [
        {
          type: "splitter",
          x: 2,
          y: 5,
          k: 5,
        },
      ],
      tray: {
        prism: 1,
        mirror: 4,
      },
      solution: {
        fixed: [2],
        placed: [
          {
            id: "prism",
            x: 3,
            y: 4,
            k: 1,
          },
          {
            id: "mirror",
            x: 4,
            y: 5,
            k: 1,
          },
          {
            id: "mirror",
            x: 4,
            y: 4,
            k: 5,
          },
        ],
      },
    },
  ];

  const key = (x, y) => x + "," + y;

  const sizeOf = (level) => [level.cols || COLS, level.rows || ROWS];

  /* Level cells: walls [x, y]; glass doors [x, y, c] that let only colour c
     through; dark sensors [x, y] that must not receive any light; portal pairs
     [ax, ay, bx, by], where light entering one leaves the other unchanged. */
  function levelCells(level) {
    const cells = new Map();
    level.walls.forEach(([x, y]) => cells.set(key(x, y), { kind: "wall" }));
    (level.doors || []).forEach(([x, y, c]) =>
      cells.set(key(x, y), { kind: "door", c }),
    );
    (level.sensors || []).forEach(([x, y], i) =>
      cells.set(key(x, y), { kind: "sensor", i }),
    );
    (level.portals || []).forEach(([ax, ay, bx, by], i) => {
      cells.set(key(ax, ay), { kind: "portal", i, to: [bx, by] });
      cells.set(key(bx, by), { kind: "portal", i, to: [ax, ay] });
    });
    level.receivers.forEach((r, i) =>
      cells.set(key(r.x, r.y), { kind: "receiver", i }),
    );
    level.sources.forEach((s) => cells.set(key(s.x, s.y), { kind: "source" }));
    return cells;
  }

  /* Pieces that come with the level: they can be rotated but not moved. */
  const fixedPieces = (level) =>
    (level.fixed || []).map((f) => ({ ...f, fixed: true }));

  /* Follows every beam from every source through the given pieces (fixed and
     placed). Each run is one straight stretch of light, from where it starts
     to where it stops or turns, with its colour and direction; a beam sent
     back the way it came shows up as a second run on the same line with the
     opposite direction. */
  function trace(level, pieces) {
    const [cols, rows] = sizeOf(level);
    const cells = levelCells(level);
    pieces.forEach((p) => cells.set(key(p.x, p.y), { kind: "piece", p }));

    const hits = level.receivers.map(() => 0);
    const sensorHits = (level.sensors || []).map(() => 0);
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
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) {
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
        if (cell.kind === "sensor") sensorHits[cell.i] |= b.c;
        if (cell.kind === "door")
          queue.push({ x: nx, y: ny, d: b.d, c: b.c & cell.c });
        if (cell.kind === "portal")
          queue.push({ x: cell.to[0], y: cell.to[1], d: b.d, c: b.c });
        if (cell.kind === "piece") {
          PIECES[cell.p.type]
            .out(cell.p, b.d, b.c)
            .forEach((o) => queue.push({ x: nx, y: ny, d: o.d, c: o.c }));
        }
        break;
      }
    }

    const lit = level.receivers.map((r, i) => hits[i] === r.c);
    const dark = sensorHits.map((h) => h === 0);
    return {
      runs,
      hits,
      lit,
      sensorHits,
      dark,
      solved: lit.every(Boolean) && dark.every(Boolean),
    };
  }

  function isFree(level, pieces, x, y) {
    const [cols, rows] = sizeOf(level);
    if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
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
    fixedPieces,
    sizeOf,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PrismLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
