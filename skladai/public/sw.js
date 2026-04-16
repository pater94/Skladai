// Minimal pass-through service worker.
//
// History: earlier versions of this SW ran cache-first for .js/.css with
// cache.put() on every fetch. Combined with iOS Capacitor WKWebView's
// own aggressive caching, stale Next.js chunks sometimes stuck around
// after a deploy, and on re-opening the native app the old cached JS
// would crash against the fresh server-rendered HTML — black screen.
//
// This version does the minimum:
//   - Skip waiting + claim clients, so a new SW takes over immediately.
//   - On activate, wipe every cache bucket so no stale chunk survives.
//   - HTML navigations are ALWAYS fetched from network (no cache read,
//     no cache write).
//   - Everything else reads from cache if present, otherwise network —
//     but we never write anything back, so the caches stay empty after
//     activate and effectively become a pass-through.
//
// Net effect: the SW stays registered (so the browser tracks updates
// via sw.js byte changes), but functionally acts like "no service
// worker" — nothing is cached, nothing can go stale, nothing can
// poison a future reload.

const CACHE_VERSION = "skladai-v74";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Allow the SWUpdateBanner "Odśwież" button to force-activate a
// waiting worker via postMessage.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isHTMLNavigation(request) {
  if (request.mode === "navigate") return true;
  if (request.method !== "GET") return false;
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // HTML: always fresh from the network. No cache read, no cache put.
  // This guarantees the first thing the app parses on reopen is the
  // live Vercel HTML, which references only current chunk hashes.
  if (isHTMLNavigation(event.request)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Anything else: read from cache if something is there (pass-through
  // in steady state because activate wiped everything), otherwise go
  // to the network. We DO NOT cache.put() — nothing sticks, nothing
  // goes stale.
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});

// Expose the version so "curl /sw.js | grep CACHE_VERSION" can confirm
// the current deploy without needing to scan the bundle.
void CACHE_VERSION;
