"use strict";

/* Builds Endless levels off the main thread so the game keeps animating.
   While searching it reports how many layouts it has tried, a few times a
   second, so the page can show progress. */
importScripts("logic.js", "generator.js");

self.onmessage = (e) => {
  const { difficulty, seed, step, code } = e.data;
  let level = null;
  let last = 0;
  const onTry = (tried) => {
    const now = Date.now();
    if (now - last < 200) return;
    last = now;
    self.postMessage({ tried });
  };
  try {
    level = code
      ? self.PrismGen.fromCode(code)
      : self.PrismGen.makeLevel(difficulty, seed, 120000, step || 1, onTry);
  } catch (err) {
    level = null;
  }
  self.postMessage({ level });
};
