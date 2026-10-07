/**
 * iSHARP DBMS 2.0 — Progressive Web App Service Worker
 * Provides offline caching for application shell, static assets, and font files.
 * Network-first policy for Supabase API requests to preserve live accuracy.
 */

const CACHE_NAME = "isharp-field-ops-v2.1";

// Critical static assets to cache immediately on service worker install
const PRECACHE_ASSETS = [
    "/",
    "/index.html",
    "/style.css",
    "/src/styles/tokens.css",
    "/src/styles/base.css",
    "/src/styles/components.css",
    "/src/styles/command-os.css",
    "/src/styles/landing.css",
    "/src/styles/field-ops-mobile.css",
    "/assets/blue-archipelago-logo.png",
    "/assets/icon-192.png",
    "/assets/icon-512.png",
    "/assets/field_ops_seagrass_bg.jpg",
    "/manifest.json"
];

// Install Event: Precaches the application shell
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("[ServiceWorker] Precaching App Shell");
            return cache.addAll(PRECACHE_ASSETS).catch((err) => {
                console.warn("[ServiceWorker] Precache warning:", err);
            });
        }).then(() => self.skipWaiting())
    );
});

// Activate Event: Purges outdated previous caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(
                keyList.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log("[ServiceWorker] Removing old cache:", key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event: Cache-First for static assets, Network-First for API calls
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // Skip caching for non-GET requests or Supabase REST queries (handled by OfflineSync outbox)
    if (event.request.method !== "GET" || url.pathname.includes("/rest/v1/")) {
        return;
    }

    // Cache-First strategy for static assets, scripts, stylesheets, and fonts
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Fetch fresh copy in the background (stale-while-revalidate pattern)
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
                    }
                }).catch(() => {});
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            }).catch(() => {
                // Fallback for navigation requests
                if (event.request.mode === "navigate") {
                    return caches.match("/index.html");
                }
            });
        })
    );
});
