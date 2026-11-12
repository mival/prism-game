"use strict";

/* The campaign levels: rules, order and stored solutions. */
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../src/js/logic.js");
const P = require("../src/js/progress.js");

const DIFFS = ["easy", "medium", "hard"];

test("level ids are unique and all have a place in save codes", () => {
  const ids = L.LEVELS.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids)
    assert.ok(P.SAVE_IDS.includes(id), `${id} missing from SAVE_IDS`);
  assert.equal(new Set(P.SAVE_IDS).size, P.SAVE_IDS.length);
});

test("levels run easy, medium, hard", () => {
  const order = L.LEVELS.map((l) => DIFFS.indexOf(l.difficulty));
  assert.ok(
    order.every((d) => d >= 0),
    "every level has a difficulty",
  );
  for (let i = 1; i < order.length; i++)
    assert.ok(order[i] >= order[i - 1], `level ${i + 1} out of order`);
});

test("each mechanic first appears in the level that teaches it", () => {
  const first = {};
  const mark = (k, lv) => (first[k] ??= lv.id);
  for (const lv of L.LEVELS) {
    if ((lv.doors || []).length) mark("door", lv);
    if ((lv.portals || []).length) mark("portal", lv);
    if ((lv.sensors || []).length) mark("sensor", lv);
    if ((lv.fixed || []).length) mark("fixed", lv);
    if (lv.sources.length > 1) mark("lasers", lv);
  }
  assert.deepEqual(first, {
    door: "glass-doors",
    lasers: "two-lasers",
    portal: "wormhole",
    sensor: "lights-out",
    fixed: "fixed-point",
  });
});

test("every level starts unsolved and its stored solution solves it", () => {
  for (const lv of L.LEVELS) {
    assert.equal(
      L.trace(lv, L.fixedPieces(lv)).solved,
      false,
      `${lv.id} solved at start`,
    );
    const s = lv.solution;
    const fixed = L.fixedPieces(lv).map((f, i) => ({ ...f, k: s.fixed[i] }));
    const placed = s.placed.map((p) => ({
      ...L.pieceFromTrayId(p.id, p.x, p.y),
      k: p.k,
    }));
    assert.ok(
      L.trace(lv, fixed.concat(placed)).solved,
      `${lv.id} stored solution fails`,
    );
    const need = {};
    for (const p of s.placed) need[p.id] = (need[p.id] || 0) + 1;
    for (const [id, n] of Object.entries(need))
      assert.ok((lv.tray[id] || 0) >= n, `${lv.id}: tray lacks ${id}`);
  }
});

test("every level has a Czech name and hint", () => {
  require("../src/js/levels-cs.js");
  const cs = globalThis.PrismLevelsCs;
  for (const lv of L.LEVELS) {
    assert.ok(cs[lv.id], `${lv.id} has no Czech text`);
    assert.ok(cs[lv.id][0] && cs[lv.id][1], `${lv.id} Czech text incomplete`);
  }
});
