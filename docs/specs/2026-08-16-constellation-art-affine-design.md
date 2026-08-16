# Constellation Art — Exact Affine Placement + Asset Emission Fix

**Date:** 2026-08-16
**Issue:** #366 (assets slice, PR #404)
**Supersedes:** the zoom/rotation deferral in [ADR 018](../adr/018-constellation-art-assets.md)

## Context

PR #404 bundles 85 Stellarium `modern` skyculture illustrations and positions
them via Stellarium's 3-anchor scheme. Review of that branch found two
problems that this spec addresses.

### The overlay does not render in production

`constellation-art.ts` builds asset URLs by concatenating a dynamic basename
onto a literal directory base:

```ts
const ASSET_BASE = new URL("../../data/art/western/", import.meta.url).href;
```

A comment claims this is what makes Vite's asset rewrite fire. It is not.
Vite's asset plugin only rewrites `new URL()` when the **entire** path is a
static literal — given only a directory base it cannot know which files to
emit. Verified against a local production build of the branch:

- the built bundle keeps the URL untransformed (`` `…data/art/western/` + import.meta.url).href ``)
- `dist/` contains **zero** constellation art PNGs, and no `dist/data/` at all

At runtime `import.meta.url` resolves to `/assets/index-<hash>.js`, so every
art fetch requests `/assets/data/art/western/<IAU>.png` and 404s. Cesium
renders a billboard holding an incomplete `HTMLImageElement` as empty pixels,
so the overlay silently draws nothing.

All six CI checks pass regardless, because `playwright.config.ts` boots
`pnpm dev:client` — the Vite **dev** server, where the relative path happens
to resolve against the source tree. Nothing in the repo exercises the
production build, so no existing test can catch this class of bug.

These are the first runtime-_fetched_ binary assets under `data/`. Every other
bundled dataset is a JSON `import` that Vite inlines, which is why this path
had no prior coverage.

### The anchors are used for position only

Stellarium's three anchors define a full affine transform — position, scale,
rotation, and shear. `anchoredPositionAndScale()` interpolates only the image
centre and returns a hardcoded `BASE_ANCHORED_SCALE = 0.5`; the billboard sets
no `rotation`. Each illustration is therefore drawn screen-axis-aligned at a
constant size: it does not turn as the sky turns, and it does not match its
constellation's angular extent.

ADR 018 declares the fixed-scale limitation but is silent on rotation, and
justifies deferring both on the grounds that zoom-correct rendering "would
require moving to a `Primitive` with a textured world-space polygon."

## Decision

Fix asset emission with a build-time glob, guard it with a test that can
actually fail, and place the art with the **exact** affine — including shear —
by drawing each illustration as a textured world-space quad.

### 1. Asset emission

Replace the concatenated `new URL()` with:

```ts
const ART_URLS = import.meta.glob("../../data/art/western/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
```

Vite resolves each match to a hashed emitted asset at build time. `eager`
resolves URLs only — it does not fetch image data — so the existing lazy
per-constellation `loadImage` + `imageCache` behaviour is unchanged. The
misleading comment about literal bases is removed.

### 2. Guard test

Add a unit test asserting that every non-null `file` in the manifest resolves
to an entry in `ART_URLS`.

Vitest runs through Vite, so this test exercises the same resolution machinery
the production build uses — unlike the e2e suite, which cannot. It also
catches manifest↔file drift: a manifest entry naming a PNG that is not on
disk fails the assertion.

### 3. Exact affine placement

#### `src/scene/constellation-art-affine.ts` (new, pure)

Exports a single function mapping a unit quad to world space:

```ts
export function anchorModelMatrix(
  anchors: readonly ConstellationArtAnchor[],
  world: readonly Cartesian3[],
  size: readonly [number, number],
): Matrix4 | null;
```

The mapping from image pixels to world positions is affine, so it is exactly
representable as a 4×4 matrix. Columns:

| Column | Value                                            |
| ------ | ------------------------------------------------ |
| 0      | world displacement across the image's full width |
| 1      | world displacement across its full height        |
| 2      | normalized cross product of columns 0 and 1      |
| 3      | world position of the image's `(0, 0)` corner    |

Column 2 carries no geometric meaning — the quad is flat — but keeps the
matrix non-singular. Returns `null` when the three anchor pixels are collinear
(degenerate triangle), reusing the existing `barycentric2D` determinant guard.

This is the same barycentric relation already in `constellation-art.ts`,
applied to the image corners instead of its centre. Because it derives the
basis vectors directly rather than approximating them, shear is preserved.

Tested in its own file **without** the `vi.mock("cesium")` the existing suite
installs, so the assertions run against real `Cartesian3` / `Matrix4` math.
These are pure JS math classes with no WebGL dependency, so they work under
jsdom. Pure-module coverage gate applies: ≥90% line, ≥85% branch.

#### `src/scene/constellation-art.ts` (hybrid layer)

- A `PrimitiveCollection` holds one unit-quad `Primitive` per anchored
  constellation, each a `GeometryInstance` + `MaterialAppearance` with an
  `Image` material.
- `id: constellation` is preserved on the geometry instance so the hover/click
  pick contract — and the #305 / #308 regression tests — keep holding.
- The existing `BillboardCollection` is retained, but **only** for the
  placeholder fallback: `Pup` / `Ser` / `Vel` (no upstream illustration),
  anchor stars below the horizon, and degenerate anchor triangles.
- `setOpacity` drives the material's alpha uniform.

**Per-rerender update mutates `modelMatrix`, it does not rebuild geometry.**
`Primitive.modelMatrix` is mutable, transforms all geometry instances from
model to world coordinates, and is supported in 3D mode — which is the only
mode this app runs. Primitives are cached by constellation id and created or
destroyed only when the visible set changes.

This matters because camera moves dispatch state through a 50 ms-debounced
`scheduleRerender`. Rebuilding ~30 primitives at that cadence would
compile-churn badly; assigning ~30 matrices does not. It is also why this
design uses world-space placement rather than screen-space billboard
`rotation` and FOV-derived `scale`, which would recompute on every drag and
lag it visibly.

### 4. Reproducibility and docs

- **`scripts/build-art.mjs`** — joins the existing `build-asterisms`,
  `build-constellations`, `build-star-catalog` family. Covers the rename from
  Stellarium's Latin filenames to IAU 3-letter codes, the RGBA/luminance
  re-encode, and the manifest extraction from Stellarium's `index.json`. None
  of that is currently reproducible.
- **ADR 018 corrections** — the zoom/rotation deferral rested on the claim
  that a `Primitive` rewrite was required for zoom-correct rendering; that
  section is rewritten to record the affine decision instead. The bundle-size
  contradiction is fixed: the Assets section says ~3.0 MB, Consequences says
  ~2.1 MB, and the actual on-disk total is 3.1 MB.

## What is explicitly not changing

- The manifest v2 schema. Anchors already carry everything needed.
- Licensing and `NOTICE`. Verified against Stellarium's upstream
  `modern/description.md`: it credits "Stellarium's team" with no named
  illustrator, and states Free Art License for illustrations, CC BY-SA 4.0 for
  text and data — exactly what `NOTICE` and ADR 018 already claim.
- The placeholder sprite and its fallback conditions.

## Testing

| Unit                          | Approach                                                                                                                                                                     | Gate                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `constellation-art-affine.ts` | Real Cesium math, no module mock. Known anchor triples → expected corner world positions; collinear anchors → `null`; a deliberately sheared triple to prove shear survives. | ≥90% line, ≥85% branch |
| `constellation-art.ts`        | Mock-based at the Cesium boundary, as today. Both branches covered explicitly: anchored → primitive with a model matrix; unanchored → placeholder billboard.                 | ≥80% line, ≥70% branch |
| Asset emission                | Manifest↔`ART_URLS` coverage assertion.                                                                                                                                      | —                      |
| e2e                           | Existing differential-pixel spec.                                                                                                                                            | —                      |

TDD throughout, per the repo's non-negotiable: each behaviour change starts
with a test that fails for the right reason.

## Risks

- **No WebGL under jsdom.** The layer's own tests stay mock-based at the
  Cesium boundary; this is precisely why the affine math is extracted into a
  pure module where it can be tested against real math.
- **e2e floor may need retuning.** The differential-pixel threshold was tuned
  against placeholder halos and fixed-scale art. Correct size and rotation
  changes the pixel delta; the floor is re-derived from an observed run rather
  than guessed.
- **`scene/` coverage.** The hybrid layer adds an anchored-vs-placeholder
  branch that needs explicit tests to hold the ≥70% branch gate.
- **Shear magnitude is unmeasured.** This design preserves it exactly, so the
  question is moot for correctness — but it does mean the `Primitive` path is
  carrying complexity whose visible benefit over a billboard approximation has
  not been quantified.
