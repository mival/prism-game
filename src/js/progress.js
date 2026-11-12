"use strict";

/* Save codes: progress packed into a short code a player can carry to
   another device, as text, a file or a link.

   This is obfuscation, not security: the game runs in the browser, so any
   key would ship with the page. The code is scrambled so it can't be read or
   edited by hand, and a checksum rejects typos and tampered codes.

   Layout (bytes): version, level count n, n bits of solved levels,
   Endless wins (easy, medium, hard; 2 bytes each), last level played,
   [version 2: the hint count of each solved level, bit-packed], then a
   2-byte checksum. Everything after the version byte is XORed with a fixed
   keystream, and the result is written in Crockford base32 (no I, L, O or
   U, so the code survives being read aloud or retyped).

   Hint counts use exp-Golomb codes, so the common case is tiny: a level
   solved without hints takes 1 bit, unknown (solved before counts were
   kept) or 1 hint take 3 bits, 2-5 hints take 5 bits. A leading flag bit
   marks progress with no hint data at all. Version 1 codes (without hint
   counts) are still read. */
(function (root) {
  const VERSION = 2;

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
    "tunnels",
    "lighthouse",
    "crossfire",
    "afterglow",
    "kaleidoscope",
    "color-wheel",
    "double-prism",
    "interference",
    "labyrinth",
    "big-bang",
    "warp-drive",
    "hall-of-mirrors",
    "filter-bank",
    "tricolor",
    "switchback",
    "eclipse",
    "periscope",
    "mirage",
    "wavelength",
    "binary-star",
    "gatekeeper",
    "refraction",
    "overdrive",
    "event-horizon",
    "finale",
    "ricochet",
    "lantern",
    "pinhole",
    "glass-house",
    "aurora",
    "dual-core",
    "spectral-lock",
    "night-shift",
    "zenith",
    "quasar",
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

  /* Hint count of one solved level as a symbol: 0 = no hints, 1 = unknown,
     h + 1 = h hints (h >= 1). */
  const toSymbol = (h) =>
    h === undefined || h === null ? 1 : h === 0 ? 0 : Math.min(h, 200) + 1;
  const fromSymbol = (s) => (s === 0 ? 0 : s === 1 ? undefined : s - 1);

  /* A leading flag bit: 0 = no hint data at all (every solve predates hint
     counts, the common case for older progress), 1 = one code per solve. */
  function packHints(symbols) {
    if (!symbols.length) return [];
    const bits = [];
    if (symbols.every((s) => s === 1)) bits.push(0);
    else bits.push(1);
    for (const s of bits[0] ? symbols : []) {
      const v = (s + 1).toString(2);
      for (let i = 1; i < v.length; i++) bits.push(0);
      for (const c of v) bits.push(+c);
    }
    const bytes = new Array(Math.ceil(bits.length / 8)).fill(0);
    bits.forEach((b, i) => (bytes[i >> 3] |= b << (7 - (i & 7))));
    return bytes;
  }
  function unpackHints(bytes, count) {
    let i = 0;
    const bit = () => {
      if (i >= bytes.length * 8) throw new Error("short");
      const b = (bytes[i >> 3] >> (7 - (i & 7))) & 1;
      i++;
      return b;
    };
    const out = [];
    if (!count) return out;
    if (!bit()) return new Array(count).fill(1);
    for (let k = 0; k < count; k++) {
      let zeros = 0;
      while (bit() === 0) if (++zeros > 16) throw new Error("bad");
      let v = 1;
      for (let z = 0; z < zeros; z++) v = (v << 1) | bit();
      out.push(v - 1);
    }
    return out;
  }

  /* progress = { done: [level ids], endless: { easy, medium, hard }, level,
     hints: { id: fewest hints } } */
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
      ...packHints(
        SAVE_IDS.filter((id) => done.has(id)).map((id) =>
          toSymbol((progress.hints || {})[id]),
        ),
      ),
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
    if (!bytes || bytes.length < 4) return null;
    const version = bytes[0];
    if (version !== 1 && version !== 2) return null;
    const rest = bytes.slice(1);
    const key = keystream(rest.length);
    const plain = rest.map((b, i) => b ^ key[i]);
    const n = plain[0];
    const maskLen = Math.ceil(n / 8);
    const fixedLen = 1 + maskLen + 6 + 1;
    if (plain.length < fixedLen + 2 || n > SAVE_IDS.length) return null;
    // Version 1 ends right after the fixed part; version 2 adds hint bits.
    const bodyLen = version === 1 ? fixedLen : plain.length - 2;
    const body = plain.slice(0, bodyLen);
    const [a, b] = checksum([version, ...body]);
    if (plain[bodyLen] !== a || plain[bodyLen + 1] !== b) return null;
    if (version === 1 && plain.length !== bodyLen + 2) return null;
    const mask = body.slice(1, 1 + maskLen);
    const done = SAVE_IDS.slice(0, n).filter(
      (id, i) => mask[i >> 3] & (1 << (i & 7)),
    );
    const at = 1 + maskLen;
    const num = (i) => (body[at + i] << 8) | body[at + i + 1];
    const hints = {};
    if (version === 2) {
      let symbols;
      try {
        symbols = unpackHints(body.slice(fixedLen), done.length);
      } catch (e) {
        return null;
      }
      done.forEach((id, i) => {
        const h = fromSymbol(symbols[i]);
        if (h !== undefined) hints[id] = h;
      });
    }
    return {
      done,
      endless: { easy: num(0), medium: num(2), hard: num(4) },
      level: body[at + 6],
      hints,
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

  /* The level being played, by id. Older versions stored its position in
     the level list (prism.level), which then matched SAVE_IDS order. */
  function currentLevelId() {
    const id = read("prism.levelId", null);
    if (SAVE_IDS.includes(id)) return id;
    return SAVE_IDS[Number(read("prism.level", 0)) || 0] || SAVE_IDS[0];
  }

  /* Progress saved in this browser. `level` is a position in SAVE_IDS,
     which never changes, so codes keep pointing at the same level even if
     the game reorders its levels. */
  function readLocal() {
    return {
      done: read("prism.done", []),
      endless: { easy: 0, medium: 0, hard: 0, ...read("prism.endless", {}) },
      level: SAVE_IDS.indexOf(currentLevelId()),
      // Fewest hints per solved level. Kept on this device only; save
      // codes don't carry it, to keep them short.
      hints: read("prism.hints", {}),
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
    const hints = { ...here.hints };
    for (const [id, h] of Object.entries(p.hints || {}))
      if (hints[id] === undefined || h < hints[id]) hints[id] = h;
    write("prism.done", [...done]);
    write("prism.endless", endless);
    write("prism.levelId", SAVE_IDS[p.level] || currentLevelId());
    write("prism.hints", hints);
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
    write("prism.levelId", SAVE_IDS[0]);
    write("prism.hints", {});
    write("prism.stats", {});
    write("prism.attempt", { id: null, hints: 0 });
  }

  const api = {
    encode,
    decode,
    findCode,
    readLocal,
    mergeLocal,
    describeRestore,
    resetLocal,
    currentLevelId,
    SAVE_IDS,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PrismProgress = api;
})(typeof window !== "undefined" ? window : globalThis);
