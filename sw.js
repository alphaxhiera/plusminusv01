/* ============================================================
 * Service Worker — offline-first cache for Math Plus Minus
 * Strategy: cache-first with network fallback.
 * Bump CACHE_VERSION whenever app files change to force refresh.
 * ============================================================ */
const CACHE_VERSION = "math-plus-minus-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./math-engine.js",
  "./manifest.json",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg",
];

// Install: precache the whole app shell, activate immediately.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: delete caches from older versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: serve from cache first; fall back to network and cache the result.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request)
          .then((response) => {
            // Cache same-origin responses so the app grows offline-safe over time.
            if (response.ok && new URL(event.request.url).origin === self.location.origin) {
              const copy = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
            }
            return response;
          })
          .catch(() => caches.match("./index.html")) // offline fallback
    )
  );
});
