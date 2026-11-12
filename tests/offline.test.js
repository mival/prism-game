"use strict";

/* The installable, offline app: service worker, manifest and offline play. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { serve, watchErrors, ROOT } = require("./helpers.js");

let server, browser;
before(async () => {
  server = await serve();
  browser = await chromium.launch();
});
after(async () => {
  await browser.close();
  await server.close();
});

test("every file the service worker caches exists", () => {
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  const list = JSON.parse(
    "[" +
      /const FILES = \[([\s\S]*?)\];/.exec(sw)[1].replace(/,\s*$/, "") +
      "]",
  );
  for (const f of list)
    if (f !== "./")
      assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} missing`);
  // Every script a page loads is cached for offline use.
  for (const page of ["index.html", "help.html", "settings.html"]) {
    const html = fs.readFileSync(path.join(ROOT, page), "utf8");
    for (const [, src] of html.matchAll(/<script src="([^"]+)"/g))
      assert.ok(list.includes(src), `${src} not cached`);
  }
});

test("installable, and playable offline after one visit", async () => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const errors = watchErrors(p);
  await p.goto(server.url);
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload();
  assert.ok(
    await p.evaluate(() => !!navigator.serviceWorker.controller),
    "service worker in control",
  );
  const cdp = await ctx.newCDPSession(p);
  const { installabilityErrors } = await cdp.send(
    "Page.getInstallabilityErrors",
  );
  assert.deepEqual(installabilityErrors, []);

  await ctx.setOffline(true);
  for (const page of ["", "help.html", "settings.html"]) {
    const res = await p.goto(server.url + page);
    assert.equal(res.status(), 200, page || "/");
  }
  await p.goto(server.url + "index.html");
  await p.waitForFunction(() => window.__prism && window.__prism.state.result);
  await p.evaluate(() => window.__prism.playEndless("easy"));
  assert.ok(
    await p.evaluate(() => !!window.__prism.state.endless),
    "Endless works offline",
  );
  await ctx.setOffline(false);
  assert.deepEqual(errors, []);
  await ctx.close();
});
