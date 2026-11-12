"use strict";

/* Save codes (src/js/progress.js). */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../src/js/progress.js");

const ids = P.SAVE_IDS;

test("random progress round-trips exactly", () => {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
  for (let t = 0; t < 500; t++) {
    const done = ids.filter(() => rnd() < 0.5);
    const hints = {};
    for (const id of done) if (rnd() < 0.7) hints[id] = Math.floor(rnd() * 8);
    const p = {
      done,
      endless: { easy: t % 9, medium: t * 7, hard: t % 2 ? 65535 : 0 },
      level: t % ids.length,
      hints,
    };
    const d = P.decode(P.encode(p));
    assert.ok(d, "decodes");
    assert.deepEqual(
      d.done,
      ids.filter((id) => done.includes(id)),
    );
    assert.deepEqual(d.endless, p.endless);
    assert.equal(d.level, p.level);
    assert.deepEqual(d.hints, hints);
  }
});

test("older codes still decode", () => {
  // Version 1, 60 levels, last level 59 (the old order, which is SAVE_IDS order).
  const d = P.decode("04XB-DAB6-4GSW-50H8-J19W-5TBH-35FH-9WG");
  assert.equal(d.done.length, 60);
  assert.equal(ids[d.level], "quasar");
  assert.deepEqual(d.hints, {});
});

test("typed input is lenient, typos are rejected", () => {
  const code = P.encode({
    done: ids.slice(0, 5),
    endless: {},
    level: 3,
    hints: { [ids[0]]: 0 },
  });
  assert.ok(
    P.decode(code.toLowerCase().replace(/-/g, " ")),
    "lowercase with spaces",
  );
  const raw = code.replace(/-/g, "");
  assert.equal(
    P.decode(raw.slice(0, 5) + raw.slice(6)),
    null,
    "missing character",
  );
  const swapped = raw.slice(0, 4) + (raw[4] === "A" ? "B" : "A") + raw.slice(5);
  assert.equal(P.decode(swapped), null, "wrong character");
  assert.equal(P.decode("hello"), null);
  assert.equal(P.decode(""), null);
});

test("a code is found inside a saved file", () => {
  const code = P.encode({ done: ids.slice(0, 2), endless: {}, level: 0 });
  assert.equal(P.findCode(`Prism save code\n\n${code}\n\nmore text`), code);
});
