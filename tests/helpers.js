"use strict";

/* Shared test helpers: a tiny static server for the site and a few
   browser actions. */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

/* Serves the repository root on a free port. */
function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, p);
    if (
      !file.startsWith(ROOT) ||
      !fs.existsSync(file) ||
      fs.statSync(file).isDirectory()
    ) {
      res.writeHead(404);
      return res.end("not found");
    }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({
        url: `http://127.0.0.1:${server.address().port}/`,
        close: () => new Promise((r) => server.close(r)),
      }),
    ),
  );
}

/* Collects page errors and console errors (ignoring blocked web fonts). */
function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      !/fonts\.(googleapis|gstatic)/.test(m.location().url || "")
    )
      if (!/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

/* Taps a board tile by its grid position. */
async function tapCell(page, x, y) {
  const pt = await page.evaluate(
    ([x, y]) => {
      const b = document.getElementById("board").getBoundingClientRect();
      const c = b.width / 7;
      return { x: b.left + (x + 0.5) * c, y: b.top + (y + 0.5) * c };
    },
    [x, y],
  );
  await page.touchscreen.tap(pt.x, pt.y);
}

/* Solves the current level with taps, following its stored solution:
   turn the fixed pieces, then place and turn each tray piece. */
async function solveByTaps(page, { confirm = true } = {}) {
  const info = await page.evaluate(() => {
    const P = window.__prism;
    const lv = P.L.LEVELS[P.state.level];
    return {
      sol: lv.solution,
      fixed: P.state.pieces
        .filter((q) => q.fixed)
        .map((q) => ({ x: q.x, y: q.y, k: q.k, n: P.L.PIECES[q.type].states })),
    };
  });
  for (let i = 0; i < info.fixed.length; i++) {
    const f = info.fixed[i];
    for (let j = 0; j < (info.sol.fixed[i] - f.k + f.n) % f.n; j++)
      await tapCell(page, f.x, f.y);
  }
  for (const s of info.sol.placed) {
    await page.evaluate((id) => (window.__prism.state.armed = id), s.id);
    await tapCell(page, s.x, s.y);
    const q = await page.evaluate(
      ([x, y]) => {
        const q = window.__prism.state.pieces.find(
          (q) => q.x === x && q.y === y,
        );
        return { k: q.k, n: window.__prism.L.PIECES[q.type].states };
      },
      [s.x, s.y],
    );
    for (let j = 0; j < (s.k - q.k + q.n) % q.n; j++)
      await tapCell(page, s.x, s.y);
  }
  // Solved now; "confirmed" also waits out the hold before it counts.
  await page.waitForFunction(
    (confirm) =>
      confirm
        ? window.__prism.state.confirmed
        : window.__prism.state.result.solved,
    confirm,
    { timeout: 5000 },
  );
}

module.exports = { serve, watchErrors, tapCell, solveByTaps, ROOT };
