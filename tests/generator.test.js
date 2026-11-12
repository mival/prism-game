"use strict";

/* The Endless level generator (src/js/generator.js). */
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../src/js/logic.js");
const G = require("../src/js/generator.js");

test("a code always rebuilds the same level", () => {
  const a = G.makeLevel("easy", 4242, 30000);
  assert.ok(a, "found a level");
  const b = G.fromCode(a.code);
  assert.deepEqual(b, a);
});

test("generated levels start unsolved and their solution works", () => {
  for (const [d, seed] of [
    ["easy", 11],
    ["medium", 222],
  ]) {
    const lv = G.makeLevel(d, seed, 60000);
    assert.ok(lv, `${d} level found`);
    assert.equal(L.trace(lv, L.fixedPieces(lv)).solved, false);
    const s = lv.solution;
    const fixed = L.fixedPieces(lv).map((f, i) => ({ ...f, k: s.fixed[i] }));
    const placed = s.placed.map((p) => ({
      ...L.pieceFromTrayId(p.id, p.x, p.y),
      k: p.k,
    }));
    assert.ok(L.trace(lv, fixed.concat(placed)).solved);
    // No shortcut: nothing solves it with fewer pieces.
    for (let n = 0; n < s.placed.length; n++)
      assert.equal(G.search(lv, n, 1).length, 0);
  }
});

test("bad codes make no level", () => {
  assert.equal(G.fromCode("X-1"), null);
  assert.equal(G.fromCode("hello"), null);
});
