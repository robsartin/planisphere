/* SPDX-License-Identifier: Apache-2.0 */
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, it, expect } from "vitest";

/**
 * Load `public/sw.js` into a sandboxed vm with a stub `self`, then pull
 * `self.__swExports.classifyRequest` out to exercise every branch (#379).
 *
 * The classifier is the correctness surface — a regression that starts
 * caching `/api/*` responses is a real auth-leak risk.
 */

const SW_SOURCE = readFileSync("public/sw.js", "utf8");

function loadClassifier() {
  const stubSelf = {
    addEventListener: () => {},
    skipWaiting: () => {},
    clients: { claim: () => {} },
  };
  const context = {
    self: stubSelf,
    caches: {
      open: () => Promise.resolve({ addAll: () => Promise.resolve(), put: () => {} }),
      keys: () => Promise.resolve([]),
      delete: () => Promise.resolve(),
      match: () => Promise.resolve(undefined),
    },
    fetch: () => Promise.reject(new Error("no net in test")),
    URL,
    Response,
    console,
  };
  vm.createContext(context);
  vm.runInContext(SW_SOURCE, context);
  return stubSelf.__swExports.classifyRequest;
}

const classifyRequest = loadClassifier();

const TLE_ORIGIN = "https://celestrak.org";

describe("sw.js — classifyRequest", () => {
  it("passthrough for non-GET methods", () => {
    expect(classifyRequest(new URL("http://localhost/"), "POST")).toBe("passthrough");
    expect(classifyRequest(new URL("http://localhost/assets/x.js"), "PUT")).toBe("passthrough");
    expect(classifyRequest(new URL("http://localhost/assets/x.js"), "DELETE")).toBe("passthrough");
  });

  it("passthrough for /api/* — API responses can carry per-user auth state", () => {
    expect(classifyRequest(new URL("http://localhost/api/notebooks"), "GET")).toBe("passthrough");
    expect(classifyRequest(new URL("http://localhost/api/notebooks/42"), "GET")).toBe(
      "passthrough",
    );
    expect(classifyRequest(new URL("http://localhost/api/auth/me"), "GET")).toBe("passthrough");
    expect(classifyRequest(new URL("http://localhost/api/plans/2026-04"), "GET")).toBe(
      "passthrough",
    );
    expect(classifyRequest(new URL("http://localhost/api/share"), "GET")).toBe("passthrough");
  });

  it("passthrough for /s/<code> shortlinks — the target may change and the redirect is fast", () => {
    expect(classifyRequest(new URL("http://localhost/s/abc123"), "GET")).toBe("passthrough");
  });

  it("network-first for TLE origin — data changes, offline fallback is fine", () => {
    expect(classifyRequest(new URL(`${TLE_ORIGIN}/NORAD/elements/visual.txt`), "GET")).toBe(
      "network-first",
    );
  });

  it("cache-first for content-hashed /assets/*", () => {
    expect(classifyRequest(new URL("http://localhost/assets/index-abc.js"), "GET")).toBe(
      "cache-first",
    );
    expect(classifyRequest(new URL("http://localhost/assets/notebook-xyz.js"), "GET")).toBe(
      "cache-first",
    );
  });

  it("cache-first for /cesium/* — Cesium's own build hashes each file", () => {
    expect(classifyRequest(new URL("http://localhost/cesium/Cesium.js"), "GET")).toBe(
      "cache-first",
    );
    expect(classifyRequest(new URL("http://localhost/cesium/Workers/main.js"), "GET")).toBe(
      "cache-first",
    );
    expect(classifyRequest(new URL("http://localhost/cesium/Assets/starMap.jpg"), "GET")).toBe(
      "cache-first",
    );
  });

  it("network-first for /index.html and root — redeploys must reach visitors", () => {
    expect(classifyRequest(new URL("http://localhost/"), "GET")).toBe("network-first");
    expect(classifyRequest(new URL("http://localhost/index.html"), "GET")).toBe("network-first");
    expect(classifyRequest(new URL("http://localhost/favicon.svg"), "GET")).toBe("network-first");
    expect(classifyRequest(new URL("http://localhost/manifest.json"), "GET")).toBe("network-first");
  });
});
