"use strict";

/* Builds Endless levels off the main thread so the game keeps animating. */
importScripts("logic.js", "generator.js");

self.onmessage = (e) => {
  const { id, difficulty, seed, code } = e.data;
  let level = null;
  try {
    level = code
      ? self.PrismGen.fromCode(code)
      : self.PrismGen.makeLevel(difficulty, seed, 120000);
  } catch (err) {
    level = null;
  }
  self.postMessage({ id, level });
};
