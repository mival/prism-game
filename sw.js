"use strict";

/* Service worker: makes Prism work offline and installable.

   Every file the game needs is cached on install. The game's own files are
   fetched network-first, so a new version shows up as soon as the player is
   online, with the cache as the fallback when offline or after 3 seconds
   without an answer. Fonts never change, so they come from the cache first.

   Bump VERSION when this list changes to replace the old cache. */
const VERSION = "prism-v2";
const FILES = [
  "./",
  "index.html",
  "help.html",
  "settings.html",
  "manifest.webmanifest",
  "src/css/theme.css",
  "src/css/style.css",
  "src/css/page.css",
  "src/js/logic.js",
  "src/js/render.js",
  "src/js/generator.js",
  "src/js/endless-worker.js",
  "src/js/main.js",
  "src/js/progress.js",
  "src/js/settings.js",
  "src/js/help.js",
  "src/js/pwa.js",
  "src/js/sound.js",
  "src/vendor/qrcode.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/icon.svg",
];
const FONTS = "prism-fonts";
const NETWORK_WAIT_MS = 3000;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

/* "refresh" from the page: download every file again (bypassing the HTTP
   cache), so an update is complete before the page reloads. */
self.addEventListener("message", (e) => {
  if (e.data !== "refresh") return;
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) =>
        c.addAll(FILES.map((f) => new Request(f, { cache: "reload" }))),
      )
      .catch(() => {})
      .then(() => e.source && e.source.postMessage("refreshed")),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== VERSION && k !== FONTS)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/* Network first; the cached copy if the network fails or is too slow. */
async function fresh(request) {
  const cache = await caches.open(VERSION);
  const network = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  });
  network.catch(() => {}); // handled below; avoids an unhandled rejection
  const timeout = new Promise((resolve) =>
    setTimeout(resolve, NETWORK_WAIT_MS),
  );
  try {
    const res = await Promise.race([network, timeout]);
    if (res) return res;
  } catch (err) {
    /* offline: fall through to the cache */
  }
  // Links like index.html#M-48213 or ?x match the cached page.
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  if (request.mode === "navigate") {
    const page = await cache.match("index.html");
    if (page) return page;
  }
  return network;
}

/* Cache first, for files that never change (fonts). */
async function stored(request) {
  const cache = await caches.open(FONTS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === "opaque") cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // version.json says what is newest, so it must never come from a cache.
  if (url.pathname.endsWith("/version.json")) return;
  if (url.origin === location.origin) e.respondWith(fresh(req));
  else if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  )
    e.respondWith(stored(req));
});
