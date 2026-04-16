# ADR 005 — vite-plugin-cesium

**Date:** 2026-04-16
**Status:** Accepted

## Context

CesiumJS ships web workers and static assets that must be copied to the
build output. Vite does not handle this automatically.

## Decision

Use `vite-plugin-cesium` (MIT, dev-only) to copy Cesium's static assets
into `dist/` at build time and set `CESIUM_BASE_URL` correctly.

## Consequences

- Dev-only dependency; does not ship in the bundle.
- If the plugin becomes unmaintained, replace with `vite-plugin-static-copy`
  and manual `CESIUM_BASE_URL` configuration.

## Alternatives considered

- Manual copy scripts: rejected — fragile, plugin handles it cleanly.
- vite-plugin-static-copy: viable fallback but less Cesium-specific.
