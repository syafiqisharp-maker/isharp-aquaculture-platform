/**
 * iSHARP DBMS 2.0 — Progressive Web App Service Worker
 * Provides offline caching for application shell, static assets, and font files.
 * Network-first policy for page navigation and live Supabase queries to guarantee immediate updates.
 */

const CACHE_NAME = "isharp-platform-v2.4";

// Core static assets to precache immediately on service worker install
const PRECACHE_ASSETS = [
    "/",
    "/index.html",
    "/assets/blue-archipelago-logo.png",
    "/assets/icon-192.png",
    "/assets/icon-512.png",
    "/assets/field_ops_seagrass_bg.jpg",
    "/manifest.json"
];

// Install Event: Precaches the application shell and skips waiting
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log("[ServiceWorker] Precaching App Shell");
            await Promise.allSettled(
                PRECACHE_ASSETS.map((url) =>
                    fetch(url).then((res) => {
                        if (res.ok) return cache.put(url, res);
                    }).catch((err) => console.warn(`[ServiceWorker] Precache deferred for ${url}:`, err))
                )
            );
        }).then(() => self.skipWaiting())
    );
});

// Activate Event: Purges outdated previous caches & claims control immediately
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(
                keyList.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log("[ServiceWorker] Purging legacy cache:", key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Message Event: Allows clients to trigger immediate lifecycle transitions
self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

// Fetch Event:
// 1. Pass-through for mutations & Supabase REST requests
// 2. Network-First for HTML navigation (ensures online desktop/mobile always loads latest UI)
// 3. Cache-First for content-hashed immutable bundles (/assets/)
// 4. Stale-While-Revalidate for other static assets
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests or Supabase REST queries (handled by client offline sync outbox)
    if (event.request.method !== "GET" || url.pathname.includes("/rest/v1/")) {
        return;
    }

    // 1. Navigation requests (HTML documents) -> Network-First with Cache Fallback
    if (event.request.mode === "navigate" || event.request.destination === "document") {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy));
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    // Fallback to cached shell when offline in the field
                    const cached = await caches.match("/index.html");
                    return cached || caches.match("/");
                })
        );
        return;
    }

    // 2. Content-hashed static bundles (/assets/*) -> Cache-First
    if (url.pathname.startsWith("/assets/")) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                    }
                    return networkResponse;
                });
            })
        );
        return;
    }

    // 3. All other static resources (fonts, manifest, images) -> Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const copy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                }
                return networkResponse;
            }).catch(() => null);

            return cachedResponse || fetchPromise;
        })
    );
});
