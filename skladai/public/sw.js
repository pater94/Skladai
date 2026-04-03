const CACHE_NAME = "skladai-v43";
const PRECACHE_URLS = ["/manifest.json"];

// Static asset extensions for cache-first strategy
const STATIC_EXTENSIONS = [
  ".js", ".css", ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".avif",
];

function isStaticAsset(url) {
  const pathname = new URL(url).pathname;
  return STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext))
    || pathname.startsWith("/icons/");
}

function isApiCall(url) {
  return new URL(url).pathname.startsWith("/api/");
}

function isHTMLNavigation(request) {
  return request.mode === "navigate"
    || (request.method === "GET" && request.headers.get("accept")?.includes("text/html"));
}

// === Install: precache + skipWaiting ===
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// === Activate: clean old caches + claim clients ===
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// === Message handler for SKIP_WAITING ===
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// === Fetch strategies ===
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = event.request.url;

  // Network-first for API calls
  if (isApiCall(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Network-first for HTML pages
  if (isHTMLNavigation(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Default: network-first
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
