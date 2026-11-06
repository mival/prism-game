"use strict";

/* Save codes: progress packed into a short code a player can carry to
   another device, as text, a file or a link.

   This is obfuscation, not security: the game runs in the browser, so any
   key would ship with the page. The code is scrambled so it can't be read or
   edited by hand, and a checksum rejects typos and tampered codes.

   Layout (bytes): version, level count n, n bits of solved levels,
   Endless wins (easy, medium, hard; 2 bytes each), last level played,
   then a 2-byte checksum. Everything after the version byte is XORed with a
   fixed keystream, and the result is written in Crockford base32 (no I, L, O
   or U, so the code survives being read aloud or retyped). */
(function (root) {
  const VERSION = 1;

  /* Append-only: each level's place here is its bit in the code, so levels
     can be reordered or added in the game without breaking old codes. New
     levels go at the end. */
  const SAVE_IDS = [
    "first-light",
    "spectrum",
    "glass-doors",
    "recombine",
    "echo",
    "three-ways",
    "magenta",
    "detour",
    "two-lasers",
    "mirror-image",
    "crossroads",
    "rainbow",
    "daybreak",
    "wormhole",
    "lights-out",
    "fixed-point",
    "minefield",
    "stained-glass",
    "far-side",
    "gearbox",
    "relay",
    "twin-beams",
    "clockwork",
    "sieve",
    "supernova",
  ];

  const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

  function keystream(n) {
    let s = 0x5eed1e55;
    const out = [];
    for (let i = 0; i < n; i++) {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      out.push(s & 0xff);
    }
    return out;
  }

  function checksum(bytes) {
    let h = 0x811c9dc5;
    for (const b of bytes) h = Math.imul(h ^ b, 0x01000193) >>> 0;
    return [(h >>> 8) & 0xff, h & 0xff];
  }

  function toBase32(bytes) {
    let bits = 0,
      value = 0,
      out = "";
    for (const b of bytes) {
      value = (value << 8) | b;
      bits += 8;
      while (bits >= 5) {
        out += ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
      value &= (1 << bits) - 1;
    }
    if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
    return out;
  }

  function fromBase32(text) {
    const clean = text
      .toUpperCase()
      .replace(/[\s-]/g, "")
      .replace(/O/g, "0")
      .replace(/[IL]/g, "1");
    let bits = 0,
      value = 0;
    const out = [];
    for (const ch of clean) {
      const v = ALPHABET.indexOf(ch);
      if (v < 0) return null;
      value = (value << 5) | v;
      bits += 5;
      if (bits >= 8) {
        out.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
        value &= (1 << bits) - 1;
      }
    }
    return out;
  }

  const u16 = (n) => {
    const v = Math.max(0, Math.min(65535, Math.floor(n) || 0));
    return [v >> 8, v & 0xff];
  };

  /* progress = { done: [level ids], endless: { easy, medium, hard }, level } */
  function encode(progress) {
    const n = SAVE_IDS.length;
    const mask = new Array(Math.ceil(n / 8)).fill(0);
    const done = new Set(progress.done || []);
    SAVE_IDS.forEach((id, i) => {
      if (done.has(id)) mask[i >> 3] |= 1 << (i & 7);
    });
    const e = progress.endless || {};
    const body = [
      n,
      ...mask,
      ...u16(e.easy),
      ...u16(e.medium),
      ...u16(e.hard),
      Math.max(0, Math.min(255, progress.level | 0)),
    ];
    const sum = checksum([VERSION, ...body]);
    const key = keystream(body.length + 2);
    const scrambled = [...body, ...sum].map((b, i) => b ^ key[i]);
    const code = toBase32([VERSION, ...scrambled]);
    return code.match(/.{1,4}/g).join("-");
  }

  /* Returns the progress a code holds, or null if it isn't a valid code. */
  function decode(code) {
    const bytes = fromBase32(String(code || ""));
    if (!bytes || bytes.length < 4 || bytes[0] !== VERSION) return null;
    const rest = bytes.slice(1);
    const key = keystream(rest.length);
    const plain = rest.map((b, i) => b ^ key[i]);
    const n = plain[0];
    const maskLen = Math.ceil(n / 8);
    const bodyLen = 1 + maskLen + 6 + 1;
    if (plain.length < bodyLen + 2 || n > SAVE_IDS.length) return null;
    const body = plain.slice(0, bodyLen);
    const [a, b] = checksum([VERSION, ...body]);
    if (plain[bodyLen] !== a || plain[bodyLen + 1] !== b) return null;
    const mask = body.slice(1, 1 + maskLen);
    const done = SAVE_IDS.slice(0, n).filter(
      (id, i) => mask[i >> 3] & (1 << (i & 7)),
    );
    const at = 1 + maskLen;
    const num = (i) => (body[at + i] << 8) | body[at + i + 1];
    return {
      done,
      endless: { easy: num(0), medium: num(2), hard: num(4) },
      level: body[at + 6],
    };
  }

  /* Finds a save code inside any text, e.g. a downloaded file. */
  function findCode(text) {
    const m = /[0-9A-Za-z]{4}(?:-[0-9A-Za-z]{1,4}){3,}/.exec(
      String(text || ""),
    );
    return m ? m[0] : null;
  }

  /* ------------------------------ this browser ------------------------------ */

  function storage() {
    try {
      return root.localStorage || null;
    } catch (e) {
      return null;
    }
  }
  function read(key, fallback) {
    try {
      const v = storage().getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      storage().setItem(key, JSON.stringify(value));
    } catch (e) {
      /* progress just won't persist */
    }
  }

  /* Progress saved in this browser. */
  function readLocal() {
    return {
      done: read("prism.done", []),
      endless: { easy: 0, medium: 0, hard: 0, ...read("prism.endless", {}) },
      level: Number(read("prism.level", 0)) || 0,
    };
  }

  /* Adds restored progress to this browser's: solved levels are joined and
     Endless counts keep the higher number, so nothing is ever lost. */
  function mergeLocal(p) {
    const here = readLocal();
    const done = new Set(here.done);
    const before = done.size;
    p.done.forEach((id) => done.add(id));
    const endless = {};
    for (const d of ["easy", "medium", "hard"])
      endless[d] = Math.max(here.endless[d] || 0, p.endless[d] || 0);
    write("prism.done", [...done]);
    write("prism.endless", endless);
    write("prism.level", p.level);
    return {
      added: done.size - before,
      solved: p.done.length,
      wins: p.endless.easy + p.endless.medium + p.endless.hard,
    };
  }

  /* One sentence about a restore, for the page to show. */
  function describeRestore(r) {
    return (
      `Restored ${r.solved} solved level${r.solved === 1 ? "" : "s"}` +
      (r.added < r.solved ? ` (${r.added} new here)` : "") +
      (r.wins ? ` and ${r.wins} Endless win${r.wins === 1 ? "" : "s"}` : "") +
      "."
    );
  }

  function resetLocal() {
    write("prism.done", []);
    write("prism.endless", { easy: 0, medium: 0, hard: 0 });
    write("prism.level", 0);
  }

  const api = {
    encode,
    decode,
    findCode,
    readLocal,
    mergeLocal,
    describeRestore,
    resetLocal,
    SAVE_IDS,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PrismProgress = api;
})(typeof window !== "undefined" ? window : globalThis);
