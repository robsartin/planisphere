/* SPDX-License-Identifier: Apache-2.0 */
/* Service worker for Planisphere — cache-first with network-first for TLE data */

const CACHE_VERSION = "planisphere-v1";
const TLE_ORIGIN = "https://celestrak.org";

// App shell resources to pre-cache on install
const APP_SHELL = ["/", "/index.html", "/favicon.svg", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-first for TLE requests (external data that changes frequently)
  if (url.origin === TLE_ORIGIN) {
    event.respondWith(networkFirstWithCacheFallback(request));
    return;
  }

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Cache-first for everything else (app shell, Cesium assets, static files)
  event.respondWith(cacheFirstWithNetworkFallback(request));
});

async function cacheFirstWithNetworkFallback(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

async function networkFirstWithCacheFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response("Offline — TLE data unavailable", { status: 503 });
  }
}
