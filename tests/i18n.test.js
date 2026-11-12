"use strict";

/* Czech: every piece of English text on each page is translated. The
   English is read from the page itself with scripts off, so new text
   without a translation fails this test. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium, devices } = require("playwright");
const { serve, watchErrors } = require("./helpers.js");

let server, browser;
before(async () => {
  server = await serve();
  browser = await chromium.launch();
});
after(async () => {
  await browser.close();
  await server.close();
});

const TEXT = () => {
  const out = new Set();
  const add = (s) => {
    s = (s || "").replace(/\s+/g, " ").trim();
    if (/[A-Za-z]{2}/.test(s)) out.add(s);
  };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const el = w.currentNode.parentElement;
    if (el && !el.closest("script,style,svg")) add(w.currentNode.nodeValue);
  }
  for (const el of document.body.querySelectorAll(
    "[aria-label],[title],[placeholder],[alt]",
  ))
    for (const a of ["aria-label", "title", "placeholder", "alt"])
      add(el.getAttribute(a));
  return [...out];
};
// Not translated on purpose: names, codes, and the language names.
const KEEP = new Set([
  "Prism",
  "M-48213",
  "English",
  "Čeština",
  "LEVEL 01 / 60",
  "First Light",
]);

for (const page of ["index.html", "help.html", "settings.html"]) {
  test(`${page}: no English left in Czech`, async () => {
    const en = await browser.newContext({ javaScriptEnabled: false });
    const ep = await en.newPage();
    await ep.goto(server.url + page);
    const english = (await ep.evaluate(TEXT)).filter((s) => !KEEP.has(s));
    await en.close();

    const cs = await browser.newContext({
      ...devices["iPhone 13"],
      locale: "cs-CZ",
    });
    const cp = await cs.newPage();
    const errors = watchErrors(cp);
    await cp.goto(server.url + page);
    await cp.waitForLoadState("load");
    await cp.waitForTimeout(300);
    assert.equal(await cp.evaluate(() => document.documentElement.lang), "cs");
    const shown = new Set(await cp.evaluate(TEXT));
    const left = english.filter((s) => shown.has(s));
    assert.deepEqual(left, [], "untranslated");
    assert.deepEqual(errors, []);
    await cs.close();
  });
}

test("game text built in code is Czech too", async () => {
  const cs = await browser.newContext({
    ...devices["iPhone 13"],
    locale: "cs-CZ",
  });
  const p = await cs.newPage();
  await p.goto(server.url + "index.html");
  await p.waitForFunction(() => window.__prism && window.__prism.state.result);
  assert.equal(await p.textContent("#levelName"), "První světlo");
  assert.match(await p.textContent("#levelNo"), /^ÚROVEŇ /);
  assert.match(await p.textContent("#doneCount"), /hotovo/);
  await p.evaluate(() => window.__prism.playEndless("easy"));
  assert.equal(await p.textContent("#levelNo"), "NEKONEČNO");
  assert.doesNotMatch(
    await p.textContent("#levelName"),
    /^[A-Z][a-z]+ [A-Z][a-z]+$/,
    "Endless name in Czech",
  );
  await cs.close();
});

test("the language can be chosen in Settings", async () => {
  const ctx = await browser.newContext({ locale: "en-US" });
  const p = await ctx.newPage();
  await p.goto(server.url + "settings.html");
  await Promise.all([
    p.waitForNavigation(),
    p.check('input[name="lang"][value="cs"]'),
  ]);
  assert.equal(await p.textContent("h1"), "Nastavení");
  await Promise.all([
    p.waitForNavigation(),
    p.check('input[name="lang"][value="auto"]'),
  ]);
  assert.equal(await p.textContent("h1"), "Settings");
  await ctx.close();
});
