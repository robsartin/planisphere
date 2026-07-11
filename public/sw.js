/* SPDX-License-Identifier: Apache-2.0 */
/* Service worker for Planisphere (#379).
 *
 * Routing (see `classifyRequest`):
 *
 *   - Non-GET                  → passthrough (no respondWith)
 *   - /api/*                   → passthrough — API responses may carry
 *                                per-user auth state; never cache them
 *   - TLE origin (celestrak)   → network-first with cache fallback
 *   - /cesium/*  /assets/*     → cache-first (content-hashed, safe forever)
 *   - Everything else          → network-first with cache fallback
 *                                so a redeploy reaches users on their
 *                                next navigation
 *
 * Behavior is exercised by a Node vm-based test (scripts/sw-routing.test.mjs)
 * that loads this file's `classifyRequest` and asserts each branch.
 */

const CACHE_VERSION = "planisphere-v2";
const TLE_ORIGIN = "https://celestrak.org";

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
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * Pure routing classifier — exported via `self.__testExports` in test
 * builds. Returns one of:
 *   - "passthrough"
 *   - "cache-first"
 *   - "network-first"
 */
function classifyRequest(url, method) {
  if (method !== "GET") return "passthrough";
  // API responses may carry per-user auth state (notebooks, plans list,
  // /me). Never cache them — sharing them across sessions would be a
  // real correctness / privacy bug.
  if (url.pathname.startsWith("/api/")) return "passthrough";
  // Short-URL redirects have no useful cache; the redirect is fast and
  // the target is often the current origin. Skip caching.
  if (url.pathname.startsWith("/s/")) return "passthrough";
  if (url.origin === TLE_ORIGIN) return "network-first";
  if (url.pathname.startsWith("/assets/")) return "cache-first";
  if (url.pathname.startsWith("/cesium/")) return "cache-first";
  return "network-first";
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const strategy = classifyRequest(url, request.method);
  if (strategy === "passthrough") return;
  if (strategy === "cache-first") {
    event.respondWith(cacheFirstWithNetworkFallback(request));
    return;
  }
  event.respondWith(networkFirstWithCacheFallback(request));
});

async function cacheFirstWithNetworkFallback(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
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
    if (cached) return cached;
    return new Response("Offline", { status: 503 });
  }
}

// Exported for the Node vm-based unit test. Guarded behind a `self`
// property that's never referenced by production callers.
self.__swExports = { classifyRequest };
