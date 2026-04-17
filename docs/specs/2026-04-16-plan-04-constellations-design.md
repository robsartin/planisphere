# Plan 04 — Constellations Design Spec

**Date:** 2026-04-16
**Status:** Approved
**Depends on:** Plan 02 (Astro Core) — complete

## 1. Purpose

Render 88 IAU constellations as stick-figure lines connecting bright stars, with constellation name labels at each figure's centroid. Lines are thin, semi-transparent white. Labels are small white text. Only lines with both endpoints above the horizon are drawn.

## 2. Scope

### In scope

- Constellation data: pre-built static JSON with IAU abbreviation, full name, and line segments as HIP ID pairs.
- Data generation script to produce `data/constellations.json` from a public-domain source (e.g., Stellarium's `constellationship.fab`).
- Parsing and validation of constellation data.
- Filtering: only draw line segments where both endpoint stars are above the horizon.
- CesiumJS rendering: `PolylineCollection` for stick-figure lines, `LabelCollection` for constellation names.
- Label placement at the centroid of each constellation's visible star positions.
- Integration with existing tooltip (optional: hover on label shows constellation name).

### Out of scope

- IAU constellation boundary polygons.
- Constellation fill/shading.
- Artistic mythology illustrations.
- i18n/locale for constellation names (deferred per v1 spec open questions).
- Satellite overlays (Plan 05).
- UI controls for toggling constellations (Plan 06).

## 3. Dependencies

No new dependencies. CesiumJS (already installed) provides `PolylineCollection` and `LabelCollection`.

## 4. Data format

`data/constellations.json`:

```ts
type ConstellationRecord = {
  id: string; // IAU 3-letter abbreviation (e.g., "Ori")
  name: string; // Full name (e.g., "Orion")
  lines: [number, number][]; // Pairs of HIP IDs for each line segment
};
```

~88 entries. Each `lines` array contains pairs like `[27366, 26311]` meaning "draw a line from HIP 27366 to HIP 26311." Stars are referenced by HIP ID from the existing `data/stars.json` catalog.

Source: Stellarium's `constellationship.fab` (public domain) or equivalent open dataset. Generated once via a build script, committed as static JSON.

## 5. Module structure

### New files

```
data/
  constellations.json                 88 constellations with line segments

scripts/
  build-constellations.mjs            One-time generator from source data

src/astro/
  constellations.ts                   parseConstellations(), filterVisibleLines()
  constellations.test.ts              TDD tests

src/scene/
  constellations.ts                   ConstellationLayer: lines + labels
  constellations.test.ts              Mocked Cesium tests
```

### Modified files

```
src/astro/index.ts                    Export new types and functions
src/scene/index.ts                    Export ConstellationLayer
src/app.ts                            Wire constellation layer after bodies
src/app.test.ts                       Update mock
NOTICE                                Add constellation data attribution
```

## 6. Key types

### ConstellationRecord (from JSON, immutable)

```ts
type ConstellationRecord = {
  readonly id: string;
  readonly name: string;
  readonly lines: readonly (readonly [number, number])[];
};
```

### VisibleConstellation (computed, ephemeral)

```ts
type VisibleLine = {
  readonly start: { alt: number; az: number };
  readonly end: { alt: number; az: number };
};

type VisibleConstellation = {
  readonly id: string;
  readonly name: string;
  readonly lines: readonly VisibleLine[];
  readonly centroid: { alt: number; az: number };
};
```

## 7. Data flow

1. `astro/constellations.ts` loads and parses `data/constellations.json` → `ConstellationRecord[]`.
2. Cross-references each HIP ID in the line segments with the already-computed `AltAzStar[]` (from the star visibility pipeline) by building a `Map<number, AltAzStar>`.
3. For each constellation, filters to line segments where BOTH endpoint stars are in the visible set (alt > 0). Computes centroid from the mean Alt/Az of all visible endpoints.
4. Returns `VisibleConstellation[]` — only constellations with at least one visible line.
5. `scene/constellations.ts` receives `VisibleConstellation[]` and renders:
   - Lines via `PolylineCollection` using `altAzToCartesian` for endpoint positions.
   - Labels via `LabelCollection` at centroid positions.

## 8. Visual properties

### Lines

- Color: white, alpha 0.25 (semi-transparent).
- Width: 1px.
- No depth test (same `disableDepthTestDistance: Infinity` pattern as billboards).

### Labels

- Color: white, alpha 0.6.
- Font: 12px sans-serif.
- Positioned at the centroid of each constellation's visible star endpoints.
- Horizontal/vertical origin: CENTER.
- `disableDepthTestDistance: Infinity`.

## 9. Testing strategy

### `src/astro/constellations.ts` — TDD, ≥ 90% coverage

- Parse valid constellation array → correct output.
- Parse empty/invalid input → Result error.
- Filter: constellation with all stars visible → all lines included.
- Filter: constellation with one star below horizon → that line excluded.
- Filter: constellation with no stars visible → excluded entirely.
- Centroid computation: mean of visible endpoint Alt/Az values.

### `src/scene/constellations.ts` — mocked Cesium, ≥ 80% coverage

- N constellations with M total lines → M polylines + N labels created.
- Empty input → no polylines, no labels.
- Update clears previous primitives.

## 10. Error handling

- `parseConstellations(raw)` returns `Result<ConstellationRecord[], ConstellationLoadError>` — same pattern as `parseCatalog`.
- Missing HIP IDs in the star map are silently skipped (the star may be below mag 6 threshold or excluded from the catalog).
- No new runtime error types beyond the load error.

## 11. NOTICE update

Add attribution for the constellation data source (Stellarium or equivalent, public domain).
