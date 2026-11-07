"use strict";

/* Sound effects, synthesized with the Web Audio API: no audio files, so
   nothing to download, license or cache for offline play.

   The sounds follow the light. Each colour has a note (red C, green E,
   blue G), so a receiver lighting up plays its own note, mixed colours play
   theirs together, and a finished board sounds as a resolved chord.

   Browsers only allow sound after the first tap or key press, so the audio
   context starts then. It stops while the page is hidden. Settings are
   stored as prism.sound = { on, volume }. */
(function (root) {
  const KEY = "prism.sound";
  const NOTES = { 4: 523.25, 2: 659.25, 1: 783.99 }; // red C5, green E5, blue G5
  const MAX_GAIN = 1; // master level at volume 1

  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && typeof s.on === "boolean")
        return { on: s.on, volume: Math.min(1, Math.max(0, +s.volume || 0)) };
    } catch (e) {
      /* defaults below */
    }
    return { on: true, volume: 0.6 };
  }
  let settings = loadSettings();

  let ctx = null;
  let master = null;
  let noise = null;

  function setup() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    // Mix with the player's own music and follow the iPhone mute switch.
    try {
      if (navigator.audioSession) navigator.audioSession.type = "ambient";
    } catch (e) {
      /* not supported */
    }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = level();
    master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.2);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  const level = () => (settings.on ? settings.volume * MAX_GAIN : 0);

  /* Start (or wake) the audio on the first gesture. */
  function unlock() {
    if (!settings.on) return;
    if (!setup()) return;
    if (ctx.state === "suspended" && !document.hidden)
      ctx.resume().catch(() => {});
  }
  ["pointerdown", "keydown", "touchend"].forEach((t) =>
    root.addEventListener(t, unlock, { capture: true, passive: true }),
  );
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else if (settings.on) ctx.resume().catch(() => {});
  });

  /* Rapid taps shouldn't turn into noise: each sound has a minimum gap. */
  const lastPlayed = {};
  function allow(name, gapMs) {
    const now = performance.now();
    if (now - (lastPlayed[name] || 0) < gapMs) return false;
    lastPlayed[name] = now;
    return true;
  }

  /* One enveloped oscillator. `at` is seconds from now. */
  function tone(freq, opts = {}) {
    const {
      type = "sine",
      at = 0,
      attack = 0.004,
      decay = 0.25,
      gain = 0.3,
      to = null,
      out = master,
    } = opts;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + decay);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  /* A short burst of filtered noise: the "click" part of taps and ticks. */
  function click(freq, opts = {}) {
    const { at = 0, decay = 0.03, gain = 0.2, q = 1.5 } = opts;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + decay + 0.02);
  }

  /* A bell: the note plus a quieter, faster-fading overtone. */
  function bell(freq, at = 0, gain = 0.22) {
    tone(freq, { at, decay: 0.9, gain });
    tone(freq * 2.01, { at, decay: 0.35, gain: gain * 0.35 });
  }

  const notesOf = (c) => [4, 2, 1].filter((m) => c & m).map((m) => NOTES[m]);

  /* The chord that swells while the rings fill; stopped by any change. */
  let swell = null;
  function stopSwell() {
    if (!swell) return;
    const { g, oscs } = swell;
    swell = null;
    const t = ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    oscs.forEach((o) => o.stop(t + 0.2));
  }

  const play = {
    place() {
      if (!allow("place", 40)) return;
      click(2200, { gain: 0.12 });
      tone(420, { type: "triangle", decay: 0.09, gain: 0.22, to: 300 });
    },
    pickup() {
      if (!allow("pickup", 40)) return;
      tone(520, { type: "triangle", decay: 0.07, gain: 0.16, to: 680 });
    },
    remove() {
      if (!allow("remove", 40)) return;
      tone(560, { type: "triangle", decay: 0.14, gain: 0.18, to: 280 });
    },
    rotate() {
      if (!allow("rotate", 35)) return;
      click(3200, { decay: 0.025, gain: 0.16, q: 4 });
      tone(1250, { decay: 0.03, gain: 0.06 });
    },
    flip() {
      if (!allow("flip", 50)) return;
      tone(1568, { decay: 0.12, gain: 0.09 });
      tone(2349, { at: 0.035, decay: 0.16, gain: 0.07 });
    },
    /* A receiver lit up: its colour's notes. `at` staggers several. */
    lit(c, at = 0) {
      notesOf(c).forEach((f) => bell(f, at, 0.16));
    },
    sensor() {
      if (!allow("sensor", 250)) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(110, t);
      o.frequency.linearRampToValueAtTime(92, t + 0.22);
      f.type = "lowpass";
      f.frequency.value = 520;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      o.connect(f).connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.3);
    },
    /* Every receiver lit: a quiet chord swells for `ms` while the rings
       fill. Any change stops it. */
    holdStart(ms) {
      stopSwell();
      const t = ctx.currentTime;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + ms / 1000);
      g.connect(master);
      const oscs = [NOTES[4] / 2, NOTES[2] / 2, NOTES[1] / 2].map((f, i) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        o.detune.value = (i - 1) * 4;
        o.connect(g);
        o.start(t);
        return o;
      });
      swell = { g, oscs };
    },
    holdStop: stopSwell,
    solved() {
      stopSwell();
      [NOTES[4], NOTES[2], NOTES[1], NOTES[4] * 2].forEach((f, i) =>
        bell(f, i * 0.08, 0.15),
      );
      [NOTES[4], NOTES[2], NOTES[1]].forEach((f) =>
        tone(f, { at: 0.34, attack: 0.02, decay: 1.4, gain: 0.07 }),
      );
    },
    hint() {
      if (!allow("hint", 200)) return;
      bell(783.99, 0, 0.12);
      bell(1174.66, 0.09, 0.1);
    },
  };

  /* Each call is safe at any time: it does nothing while sound is off or
     before the first gesture, and waits for the audio to wake if the
     browser is still starting it (so the very first tap is heard). */
  const api = {};
  for (const [name, fn] of Object.entries(play))
    api[name] = (...args) => {
      if (!settings.on || settings.volume <= 0 || !ctx) return;
      const run = () => {
        try {
          fn(...args);
        } catch (e) {
          /* sound is never worth an error */
        }
      };
      if (ctx.state === "running") run();
      else if (ctx.state === "suspended" && !document.hidden)
        ctx.resume().then(run, () => {});
    };

  api.settings = () => ({ ...settings });
  api.set = (next) => {
    settings = { ...settings, ...next };
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch (e) {
      /* won't persist */
    }
    if (settings.on) unlock();
    if (master) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.02);
    if (!settings.on) stopSwell();
  };

  root.PrismSound = api;
})(window);
