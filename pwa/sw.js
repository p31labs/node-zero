/**
 * P31 Service Worker
 *
 * Strategy:
 *   App shell (HTML, JS, CSS, icons)  → Cache-first, network fallback
 *   API / data requests               → Network-first, cache fallback
 *   CDN fonts/scripts                 → Stale-while-revalidate
 *   Everything else                   → Network-first
 *
 * Offline: If network fails and no cache, show the offline page.
 * The offline page is precached on install so it's always available.
 */

const CACHE_NAME = "p31-shell-v1";
const DATA_CACHE = "p31-data-v1";
const CDN_CACHE = "p31-cdn-v1";

// App shell — precached on install
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

// ─── Install ────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[P31 SW] Precaching app shell");
      return cache.addAll(SHELL_ASSETS);
    })
  );
  // Activate immediately — don't wait for tabs to close
  self.skipWaiting();
});

// ─── Activate ───────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== DATA_CACHE && k !== CDN_CACHE)
          .map((k) => {
            console.log("[P31 SW] Removing old cache:", k);
            return caches.delete(k);
          })
      )
    )
  );
  // Take control of all tabs immediately
  self.clients.claim();
});

// ─── Fetch ──────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Skip chrome-extension and other non-http
  if (!url.protocol.startsWith("http")) return;

  // CDN resources (fonts, external scripts) → stale-while-revalidate
  if (isCdnRequest(url)) {
    event.respondWith(staleWhileRevalidate(event.request, CDN_CACHE));
    return;
  }

  // API / data requests → network-first
  if (isDataRequest(url)) {
    event.respondWith(networkFirst(event.request, DATA_CACHE));
    return;
  }

  // App shell → cache-first
  event.respondWith(cacheFirst(event.request, CACHE_NAME));
});

// ─── Strategies ─────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Offline fallback
    return caches.match("/offline.html") || new Response("Offline", { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match("/offline.html") || new Response("Offline", { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Revalidate in background
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  // Return cached immediately if available, otherwise wait for network
  return cached || fetchPromise;
}

// ─── Classifiers ────────────────────────────────────────────────────

function isCdnRequest(url) {
  return (
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com") ||
    url.hostname.includes("cdnjs.cloudflare.com") ||
    url.hostname.includes("cdn.jsdelivr.net") ||
    url.hostname.includes("unpkg.com")
  );
}

function isDataRequest(url) {
  return (
    url.pathname.startsWith("/api/") ||
    (url.pathname.endsWith(".json") && !url.pathname.includes("manifest"))
  );
}
