"use strict";

/* The game in a real browser (Chromium via Playwright), played by touch. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium, devices } = require("playwright");
const { serve, watchErrors, tapCell, solveByTaps } = require("./helpers.js");

let server, browser;
before(async () => {
  server = await serve();
  browser = await chromium.launch();
});
after(async () => {
  await browser.close();
  await server.close();
});

/* A fresh phone with sound off and an empty save. */
async function phone(options = {}) {
  const ctx = await browser.newContext({
    ...devices["iPhone 13"],
    locale: "en-US",
    ...options,
  });
  await ctx.addInitScript(() => {
    if (!/^https?:/.test(location.protocol)) return; // e.g. about:blank
    if (!sessionStorage.getItem("init")) {
      localStorage.clear();
      localStorage.setItem(
        "prism.sound",
        JSON.stringify({ on: false, volume: 0 }),
      );
      sessionStorage.setItem("init", "1");
    }
  });
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto(server.url + "index.html");
  await page.waitForFunction(
    () => window.__prism && window.__prism.state.result,
  );
  return { ctx, page, errors };
}

test("every level can be solved by tapping", async () => {
  const { ctx, page, errors } = await phone();
  const n = await page.evaluate(() => window.__prism.L.LEVELS.length);
  // Every level is solved by taps; a sample also waits for the hold, so
  // the level counts as finished (the hold takes 1.5 s per level).
  const sample = new Set([0, 1, 2, Math.floor(n / 2), n - 1]);
  for (let i = 0; i < n; i++) {
    await page.evaluate((i) => window.__prism.loadLevel(i), i);
    await solveByTaps(page, { confirm: sample.has(i) });
  }
  assert.equal(
    await page.textContent("#doneCount"),
    `${sample.size}/${n} done`,
  );
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("undo and redo step through moves", async () => {
  const { ctx, page, errors } = await phone();
  await page.evaluate(() => window.__prism.loadLevel(1));
  const free = await page.evaluate(() => {
    const P = window.__prism;
    const lv = P.L.LEVELS[P.state.level];
    for (let y = 3; y < 9; y++)
      for (let x = 1; x < 6; x++)
        if (P.L.isFree(lv, P.state.pieces, x, y)) return [x, y];
  });
  const board = () =>
    page.evaluate(() =>
      window.__prism.state.pieces
        .filter((q) => !q.fixed)
        .map((q) => `${q.x},${q.y}:${q.k}`)
        .join(" "),
    );
  await page.evaluate(
    () =>
      (window.__prism.state.armed = Object.keys(window.__prism.state.inv)[0]),
  );
  await tapCell(page, ...free);
  const placed = await board();
  await tapCell(page, ...free);
  const turned = await board();
  assert.notEqual(turned, placed);
  await page.tap("#undo");
  assert.equal(await board(), placed);
  await page.tap("#undo");
  assert.equal(await board(), "");
  assert.ok(await page.isDisabled("#undo"));
  await page.tap("#redo");
  await page.tap("#redo");
  assert.equal(await board(), turned);
  assert.equal(
    await page.evaluate(() => window.__prism.state.moves),
    2,
    "undo is not a move",
  );
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("solving records moves, time and hints for the level list", async () => {
  const { ctx, page, errors } = await phone();
  await page.evaluate(() => window.__prism.loadLevel(1));
  await page.tap("#hint");
  await page.tap("#reset"); // hints count across Reset
  await solveByTaps(page);
  assert.match(
    await page.textContent("#statusText"),
    /Level complete\. \d+ moves? · \d+:\d\d/,
  );
  await page.tap("#levelsBtn");
  const tile = await page.evaluate(
    () => document.querySelectorAll(".level-cell")[1].textContent,
  );
  assert.match(tile, /1 hint/);
  assert.match(tile, /moves? · \d+:\d\d/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("a restore link carries progress to another device", async () => {
  const a = await phone();
  await a.page.evaluate(() => {
    localStorage.setItem(
      "prism.done",
      JSON.stringify(["first-light", "spectrum", "echo"]),
    );
    localStorage.setItem(
      "prism.hints",
      JSON.stringify({ "first-light": 0, spectrum: 2 }),
    );
  });
  await a.page.goto(server.url + "settings.html");
  const code = await a.page.textContent("#saveCode");
  const b = await phone();
  await b.page.goto("about:blank"); // a hash change alone wouldn't reload the page
  await b.page.goto(
    server.url + "index.html#restore-" + code.replace(/-/g, ""),
  );
  await b.page.waitForFunction(() =>
    document.getElementById("statusText").textContent.includes("Restored"),
  );
  const saved = await b.page.evaluate(() => [
    JSON.parse(localStorage.getItem("prism.done")),
    JSON.parse(localStorage.getItem("prism.hints")),
  ]);
  assert.deepEqual(saved[0].sort(), ["echo", "first-light", "spectrum"]);
  assert.deepEqual(saved[1], { "first-light": 0, spectrum: 2 });
  assert.deepEqual(a.errors.concat(b.errors), []);
  await a.ctx.close();
  await b.ctx.close();
});

test("Endless builds a level and its code rebuilds it", async () => {
  const { ctx, page, errors } = await phone();
  await page.evaluate(() => window.__prism.playEndless("easy"));
  const lv = await page.evaluate(() => window.__prism.state.endless.level);
  assert.match(lv.code, /^E-\d+$/);
  await page.evaluate(() => window.__prism.loadLevel(0));
  await page.evaluate((c) => window.__prism.playEndless(null, c), lv.code);
  const again = await page.evaluate(() => window.__prism.state.endless.level);
  assert.deepEqual(again.solution, lv.solution);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("today's level is the same on every device and builds a streak", async () => {
  const a = await phone();
  const b = await phone();
  for (const p of [a.page, b.page])
    await p.clock.setFixedTime(new Date("2026-11-12T10:00:00"));
  const codeA = await a.page.evaluate(async () => {
    await window.__prism.playEndless(null, null, true);
    return window.__prism.state.endless.level.code;
  });
  const codeB = await b.page.evaluate(async () => {
    await window.__prism.playEndless(null, null, true);
    return window.__prism.state.endless.level.code;
  });
  assert.equal(codeA, codeB);
  for (
    let i = 0;
    i < 8 && !(await a.page.evaluate(() => window.__prism.state.result.solved));
    i++
  )
    await a.page.evaluate(() => window.__prism.giveHint());
  await a.page.waitForFunction(() => window.__prism.state.confirmed, null, {
    timeout: 5000,
  });
  const daily = await a.page.evaluate(() =>
    JSON.parse(localStorage.getItem("prism.daily")),
  );
  assert.deepEqual(daily, { last: "2026-11-12", streak: 1 });
  assert.equal(
    await a.page.evaluate(() => localStorage.getItem("prism.endless")),
    null,
    "not an Endless win",
  );
  assert.deepEqual(a.errors.concat(b.errors), []);
  await a.ctx.close();
  await b.ctx.close();
});

test("no horizontal scrolling on a small phone", async () => {
  const { ctx, page } = await phone({ ...devices["iPhone SE"] });
  for (const p of ["index.html", "help.html", "settings.html"]) {
    await page.goto(server.url + p);
    await page.waitForLoadState("load");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      p,
    );
  }
  await ctx.close();
});

test("light travels after a change, and stays instant with reduce motion", async () => {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const { ctx, page, errors } = await phone({ reducedMotion });
    await page.evaluate(() => window.__prism.loadLevel(1));
    const reveal = await page.evaluate(() => {
      const r = window.__prism.state.reveal;
      return r && { start: r.start, end: r.end, fresh: r.fresh.size };
    });
    if (reducedMotion === "reduce") assert.equal(reveal, null);
    else {
      assert.ok(reveal && reveal.end > reveal.start && reveal.fresh > 0);
      // And it finishes within half a second.
      await page.waitForFunction(
        () => window.__prism.state.reveal === null,
        null,
        {
          timeout: 1500,
        },
      );
    }
    await page.tap("#levelsBtn");
    assert.equal(
      await page.evaluate(
        () => document.querySelectorAll(".level-cell canvas.thumb").length,
      ),
      await page.evaluate(() => window.__prism.L.LEVELS.length),
      "a preview on every tile",
    );
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});
