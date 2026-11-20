"use strict";

/* The game in a real browser (Chromium via Playwright), played by touch. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium, devices } = require("playwright");
const {
  serve,
  watchErrors,
  tapCell,
  solveByTaps,
  launchOptions,
} = require("./helpers.js");

let server, browser;
before(async () => {
  server = await serve();
  browser = await chromium.launch(launchOptions());
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
    i < 30 &&
    !(await a.page.evaluate(() => window.__prism.state.result.solved));
    i++
  )
    await a.page.evaluate(() => window.__prism.giveHint());
  await a.page.waitForFunction(() => window.__prism.state.confirmed, null, {
    timeout: 5000,
  });
  const daily = await a.page.evaluate(() =>
    JSON.parse(localStorage.getItem("prism.daily")),
  );
  assert.equal(daily.last, "2026-11-12");
  assert.equal(daily.streak, 1);
  assert.ok(daily.result.hints > 0, "hints used are kept for sharing");
  assert.equal(
    await a.page.evaluate(() => localStorage.getItem("prism.endless")),
    null,
    "not an Endless win",
  );
  assert.deepEqual(a.errors.concat(b.errors), []);
  await a.ctx.close();
  await b.ctx.close();
});

test("an earlier daily level can be played, without a change to the streak", async () => {
  const { ctx, page, errors } = await phone();
  await page.clock.setFixedTime(new Date("2026-11-16T10:00:00"));
  await page.tap("#levelsBtn");
  await page.tap("#dailyPastBtn");
  const days = await page.$$eval(".past-day", (list) =>
    list.map((b) => b.dataset.day),
  );
  assert.equal(days.length, 28);
  assert.equal(days[0], "2026-10-20");
  assert.equal(days[27], "2026-11-16");
  // Friday 13 November: a medium day.
  assert.match(
    await page.getAttribute('[data-day="2026-11-13"]', "class"),
    /medium/,
  );
  await page.tap('[data-day="2026-11-13"]');
  await page.waitForFunction(() => window.__prism.state.endless?.past, null, {
    timeout: 30000,
  });
  assert.match(await page.textContent("#levelNo"), /13/);
  for (
    let i = 0;
    i < 30 && !(await page.evaluate(() => window.__prism.state.result.solved));
    i++
  )
    await page.evaluate(() => window.__prism.giveHint());
  await page.waitForFunction(() => window.__prism.state.confirmed, null, {
    timeout: 5000,
  });
  assert.deepEqual(
    await page.evaluate(() => ({
      days: JSON.parse(localStorage.getItem("prism.dailyDays")),
      daily: localStorage.getItem("prism.daily"),
      endless: localStorage.getItem("prism.endless"),
    })),
    { days: ["2026-11-13"], daily: null, endless: null },
  );
  await page.tap("#levelsBtn");
  assert.match(
    await page.getAttribute('[data-day="2026-11-13"]', "class"),
    /solved/,
  );
  assert.deepEqual(errors, []);
  await ctx.close();
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

test("a hint first marks the tile, then places the piece; both count once", async () => {
  const { ctx, page, errors } = await phone();
  const placed = () =>
    page.evaluate(
      () => window.__prism.state.pieces.filter((q) => !q.fixed).length,
    );
  await page.tap("#hint");
  assert.equal(await placed(), 0, "first tap only marks");
  assert.ok(await page.evaluate(() => !!window.__prism.state.hintAt));
  assert.match(await page.textContent("#statusText"), /marked tile/);
  await page.tap("#hint");
  assert.equal(await placed(), 1, "second tap places");
  assert.equal(await page.evaluate(() => window.__prism.state.hintAt), null);
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("prism.attempt")).hints,
    ),
    1,
  );
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("a WebGL start that does not complete falls back to Canvas 2D", async () => {
  // Opens the game after an init script, and reports how it draws.
  const open = async (init) => {
    const ctx = await browser.newContext({ ...devices["iPhone 13"] });
    await ctx.addInitScript(init);
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    await page.goto(server.url + "index.html");
    await page.waitForFunction(() => window.__prism?.drawing, null, {
      timeout: 5000,
    });
    const out = await page.evaluate(() => ({
      accelerated: window.__prism.accelerated,
      record: JSON.parse(localStorage.getItem("prism.gl") || "{}").s,
    }));
    assert.deepEqual(errors, []);
    await ctx.close();
    return out;
  };
  // The check worker never answers: the time limit ends the wait.
  const stuck = await open(() => {
    localStorage.clear();
    window.Worker = class {
      terminate() {}
    };
  });
  assert.deepEqual(stuck, { accelerated: false, record: "bad" });
  // The last page load did not complete its WebGL start.
  const crashed = await open(() => {
    localStorage.setItem(
      "prism.gl",
      JSON.stringify({ s: "starting", t: Date.now() }),
    );
  });
  assert.deepEqual(crashed, { accelerated: false, record: "starting" });
  // An old "bad" record is checked again, and the board still draws.
  const old = await open(() => {
    localStorage.setItem("prism.gl", JSON.stringify({ s: "bad", t: 1 }));
  });
  assert.notEqual(old.record, "starting");
});

test("a first-run hand teaches tap, place and turn", async () => {
  const { ctx, page, errors } = await phone();
  const tip = () =>
    page.evaluate(() => {
      const c = document.getElementById("coach");
      return c && !c.hidden ? c.querySelector("p").textContent : null;
    });
  // Level 1: the hand points at the tray, then at the correct tile.
  assert.match(await tip(), /piece in the tray/);
  await page.tap("#tray .chip");
  assert.match(await tip(), /tap the tile/);
  const goal = await page.evaluate(
    () => window.__prism.L.LEVELS[0].solution.placed[0],
  );
  // A piece on the wrong tile: the hand shows the drag to the right one.
  await tapCell(page, goal.x - 1, goal.y + 1);
  assert.match(await tip(), /Drag the piece/);
  await page.evaluate(() => window.__prism.loadLevel(0));
  await page.tap("#tray .chip");
  await tapCell(page, goal.x, goal.y);
  assert.equal(await tip(), null, "solved: nothing to show");
  await page.waitForFunction(() => window.__prism.state.confirmed, null, {
    timeout: 5000,
  });
  // Then the hand points at the Next level button, without a tip.
  assert.deepEqual(
    await page.evaluate(() => {
      const box = (q) => document.querySelector(q).getBoundingClientRect();
      const hand = box(".coach-hand"),
        next = box("#next");
      return {
        shown: !document.getElementById("coach").hidden,
        tip: !document.querySelector(".coach-tip").hidden,
        onNext:
          hand.left > next.left &&
          hand.left < next.right &&
          hand.top > next.top &&
          hand.top < next.bottom,
      };
    }),
    { shown: true, tip: false, onNext: true },
  );
  // Level 2: turning is taught on the piece just placed.
  await page.evaluate(() => window.__prism.loadLevel(1));
  assert.equal(await tip(), null);
  await page.tap("#tray .chip");
  await tapCell(page, 3, 3);
  assert.match(await tip(), /turn it/);
  await tapCell(page, 3, 3);
  assert.equal(await tip(), null);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("prism.coach")),
    "true",
    "all three gestures done",
  );
  await page.reload();
  await page.waitForFunction(() => window.__prism?.state.result);
  assert.equal(await page.$("#coach"), null, "not shown after a reload");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("the first-run hand can be skipped and skips returning players", async () => {
  const { ctx, page, errors } = await phone({ locale: "cs-CZ" });
  assert.match(await page.textContent("#coach p"), /zásobníku/);
  await page.tap(".coach-skip");
  assert.equal(await page.isHidden("#coach"), true);
  await page.reload();
  await page.waitForFunction(() => window.__prism?.state.result);
  assert.equal(await page.$("#coach"), null);
  // A player with progress from before never sees it.
  await page.evaluate(() => {
    localStorage.removeItem("prism.coach");
    localStorage.setItem("prism.done", JSON.stringify(["first-light"]));
  });
  await page.reload();
  await page.waitForFunction(() => window.__prism?.state.result);
  assert.equal(await page.$("#coach"), null);
  // Settings starts it again, on the first level, also with progress.
  await page.goto(server.url + "settings.html");
  await page.tap("#coachAgain");
  await page.waitForFunction(() => window.__prism?.state.result);
  assert.equal(await page.evaluate(() => window.__prism.state.level), 0);
  assert.match(await page.textContent("#coach p"), /^Ťukni na dílek/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("the first-run hand says Click to a mouse", async () => {
  const ctx = await browser.newContext({ locale: "en-US" });
  const page = await ctx.newPage();
  await page.goto(server.url + "index.html");
  await page.waitForFunction(() => window.__prism?.state.result);
  assert.match(await page.textContent("#coach p"), /^Click the piece/);
  await ctx.close();
});

test("a solved daily level can be shared as text with a link", async () => {
  const { ctx, page, errors } = await phone();
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.clock.setFixedTime(new Date("2026-11-16T10:00:00"));
  await page.evaluate(() => {
    navigator.share = undefined; // use the clipboard path
    return window.__prism.playEndless(null, null, true);
  });
  for (
    let i = 0;
    i < 30 && !(await page.evaluate(() => window.__prism.state.result.solved));
    i++
  )
    await page.evaluate(() => window.__prism.giveHint());
  await page.waitForFunction(() => window.__prism.state.confirmed, null, {
    timeout: 5000,
  });
  assert.equal((await page.textContent("#next")).trim(), "Share");
  await page.tap("#next");
  await page.waitForFunction(
    () => document.getElementById("next").textContent.trim() === "Copied",
  );
  const text = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(text, /^Prism · daily level /);
  assert.match(text, /💡 \d+ hints? · \d+ moves? · \d+:\d\d/);
  assert.match(text, /#daily$/);
  // The link opens today's level.
  const other = await phone();
  await other.page.clock.setFixedTime(new Date("2026-11-16T12:00:00"));
  await other.page.goto("about:blank");
  await other.page.goto(server.url + "index.html#daily");
  await other.page.waitForFunction(
    () =>
      window.__prism &&
      window.__prism.state.endless &&
      window.__prism.state.endless.daily,
    null,
    { timeout: 60000 },
  );
  assert.deepEqual(errors.concat(other.errors), []);
  await ctx.close();
  await other.ctx.close();
});

test("color letters can be turned on in Settings", async () => {
  const { ctx, page, errors } = await phone();
  const lettersOn = () =>
    page.evaluate(() => !!window.PrismRender.theme.letters);
  assert.equal(await lettersOn(), false);
  await page.goto(server.url + "settings.html");
  await page.check("#letters");
  await page.goto(server.url + "index.html");
  await page.waitForFunction(
    () => window.__prism && window.__prism.state.result,
  );
  assert.equal(await lettersOn(), true);
  assert.equal(
    await page.evaluate(() => window.PrismRender.theme.letters[4]),
    "R",
  );
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("the board stops drawing when idle and wakes on a touch", async () => {
  const { ctx, page, errors } = await phone();
  const sleeping = () => page.evaluate(() => window.__prism.state.sleeping);
  assert.equal(await sleeping(), false);
  await page.waitForFunction(() => window.__prism.state.sleeping, null, {
    timeout: 15000,
  });
  await page.waitForTimeout(500); // and stays asleep
  assert.equal(await sleeping(), true);
  await tapCell(page, 0, 0);
  assert.equal(await sleeping(), false);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("the Settings link also carries best results and the streak", async () => {
  const a = await phone();
  await a.ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  await a.page.evaluate(() => {
    localStorage.setItem("prism.done", JSON.stringify(["first-light"]));
    localStorage.setItem(
      "prism.stats",
      JSON.stringify({ "first-light": { moves: 3, ms: 12000 } }),
    );
    localStorage.setItem(
      "prism.daily",
      JSON.stringify({ last: "2026-11-16", streak: 4 }),
    );
  });
  await a.page.goto(server.url + "settings.html");
  await a.page.click("#copyLink");
  const link = await a.page.evaluate(() => navigator.clipboard.readText());
  const b = await phone();
  await b.page.goto("about:blank");
  await b.page.goto(link.replace(/^.*?#/, server.url + "index.html#"));
  await b.page.waitForFunction(() =>
    document.getElementById("statusText").textContent.includes("Restored"),
  );
  const saved = await b.page.evaluate(() => [
    JSON.parse(localStorage.getItem("prism.stats")),
    JSON.parse(localStorage.getItem("prism.daily")),
  ]);
  assert.deepEqual(saved[0], { "first-light": { moves: 3, ms: 12000 } });
  assert.equal(saved[1].streak, 4);
  assert.equal(saved[1].last, "2026-11-16");
  assert.deepEqual(a.errors.concat(b.errors), []);
  await a.ctx.close();
  await b.ctx.close();
});
