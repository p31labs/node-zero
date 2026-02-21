/**
 * P31 Service Worker — cache-first shell, network-first data, offline fallback
 */
const CACHE_NAME = "p31-shell-v2";
const DATA_CACHE = "p31-data-v1";
const CDN_CACHE = "p31-cdn-v1";

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.json",
  "/icons/p31-192.png",
  "/icons/p31-512.png",
  "/icons/p31-maskable-192.png",
  "/icons/p31-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== DATA_CACHE && k !== CDN_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith("http")) return;

  if (url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com") || url.hostname.includes("cdnjs.cloudflare.com") || url.hostname.includes("unpkg.com")) {
    event.respondWith(staleWhileRevalidate(event.request, CDN_CACHE));
    return;
  }
  if (url.pathname.startsWith("/api/") || (url.pathname.endsWith(".json") && !url.pathname.includes("manifest"))) {
    event.respondWith(networkFirst(event.request, DATA_CACHE));
    return;
  }
  event.respondWith(cacheFirst(event.request, CACHE_NAME));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok) (await caches.open(cacheName)).put(request, res.clone());
    return res;
  } catch {
    return caches.match("/offline.html") || new Response("Offline", { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const res = await fetch(request);
    if (res.ok) (await caches.open(cacheName)).put(request, res.clone());
    return res;
  } catch {
    return caches.match(request) || caches.match("/offline.html") || new Response("Offline", { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const p = fetch(request).then((r) => { if (r.ok) cache.put(request, r.clone()); return r; }).catch(() => cached);
  return cached || p;
}
