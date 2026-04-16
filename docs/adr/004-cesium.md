# ADR 004 — CesiumJS

**Date:** 2026-04-16
**Status:** Accepted

## Context

Plan 02 renders a 3D sky dome with ~9,100 star billboards. We need a
WebGL rendering engine with camera controls and efficient primitive
batching.

## Decision

Use `cesium` (Apache 2.0). CesiumJS provides BillboardCollection for
batched rendering, a flexible camera system, and handles WebGL context
management. We use it in terrain-free sky-dome mode.

## Consequences

- Large npm package (~40MB). Tree-shaking and Vite's build reduce the
  shipped bundle. Static assets (workers) need a Vite plugin to copy.
- `src/scene/` is the only module that imports Cesium types.
- No Earth terrain, imagery, or globe features used — just the 3D engine.

## Alternatives considered

- Three.js: rejected — CesiumJS was chosen in the v1 design spec for its
  built-in geospatial camera and entity system.
- Raw WebGL: rejected — too much boilerplate for camera + billboards.
