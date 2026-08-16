# Constellation Art — Exact Affine Placement + Asset Emission Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the constellation-art overlay actually render in production, and place each illustration with the exact affine transform Stellarium's three anchors define — position, scale, rotation, and shear.

**Architecture:** Asset URLs move from runtime string concatenation to a build-time `import.meta.glob`, so Vite emits the 85 PNGs as hashed assets. Anchored constellations move from screen-aligned `Billboard`s to textured world-space quad `Primitive`s whose `modelMatrix` carries the full affine; the existing `BillboardCollection` is kept solely for the placeholder fallback. The affine math is extracted into a pure module tested against real Cesium math.

**Tech Stack:** TypeScript (strict), Vite, CesiumJS 1.144, Vitest (jsdom, v8 coverage), Playwright.

**Spec:** [docs/specs/2026-08-16-constellation-art-affine-design.md](../specs/2026-08-16-constellation-art-affine-design.md)

## Global Constraints

- **TDD is non-negotiable.** Every behaviour change starts with a test that fails for the right reason. No implementation code before a red test.
- **SPDX header on every new file.** `.ts` → `/* SPDX-License-Identifier: Apache-2.0 */` as line 1. `.mjs` → `// SPDX-License-Identifier: Apache-2.0` as line 2 (after the shebang). Enforced by `pnpm lint` via `scripts/check-spdx.mjs`.
- **Cesium imports are confined to `src/scene/`.** No Cesium in `astro/`, `sat/`, `result/`, `state/`, or `worker/`. Violating a module boundary is review-blocking.
- **Never lower a coverage threshold.** Adding a stricter one is fine.
- **Canonical pre-push gate**, run in this exact order, all passing, before any push:
  ```
  pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:cov && pnpm build
  ```
  `pnpm test` is NOT a substitute for `pnpm test:cov` — the former skips the coverage thresholds CI enforces.
- **Branch:** `claude/planisphere-open-issues-QFuWY` (draft PR #404). Do not merge; this work stops at the PR.
- **Node:** repo pins 22.12.0 (`.nvmrc`). On other majors a large batch of pre-existing tests fails identically on `main` — that is environmental, not a regression.

---

### Task 1: Asset emission — build-time glob + coverage guard

The blocker. `new URL("../../data/art/western/", import.meta.url).href + file` is not rewritten by Vite, no PNGs are emitted to `dist/`, and every art fetch 404s in production.

**Files:**

- Modify: `src/scene/constellation-art.ts:113-121` (replace `ASSET_BASE` / `resolveAssetUrl`)
- Test: `src/scene/constellation-art.test.ts` (add a new `describe` block at the end)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `export function artAssetUrl(file: string): string | null` — returns the Vite-emitted hashed URL for a manifest basename (e.g. `"Ori.png"`), or `null` when no such asset was emitted. Task 3 calls this instead of the old `resolveAssetUrl`.

- [ ] **Step 1: Write the failing test**

Append to `src/scene/constellation-art.test.ts`. Note this block needs the real manifest, so import it at the top of the file alongside the existing imports:

```ts
import bundledManifest from "../../data/art/western/manifest.json";
```

and add `artAssetUrl` to the existing import from `./constellation-art`.

```ts
describe("artAssetUrl", () => {
  it("returns null for a file that was never emitted as an asset", () => {
    // The old concatenating implementation returned a plausible-looking
    // string for ANY input, which is exactly why a missing asset could not
    // be detected. A resolver backed by Vite's emitted-asset map knows the
    // difference between a real file and a typo.
    expect(artAssetUrl("NotAConstellation.png")).toBeNull();
  });

  it("resolves every non-null file in the bundled manifest", () => {
    const files = Object.values(bundledManifest.constellations)
      .map((entry) => (entry as { file: string | null }).file)
      .filter((file): file is string => file !== null);

    // Guards two failure modes at once: assets Vite never emitted (the #404
    // production bug), and manifest entries naming a PNG that is not on disk.
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(artAssetUrl(file), `no emitted asset for ${file}`).not.toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/scene/constellation-art.test.ts -t "artAssetUrl"`

Expected: FAIL. The first case fails because `artAssetUrl` is not exported yet (`TypeError: artAssetUrl is not a function`).

- [ ] **Step 3: Write minimal implementation**

In `src/scene/constellation-art.ts`, delete the `ASSET_BASE` constant, the `resolveAssetUrl` function, and the misleading comment above them (lines 113-121). Replace with:

```ts
// Vite resolves this glob to a map of source path → hashed emitted asset URL
// at build time. `eager` resolves URLs only — it does not fetch image data —
// so the per-constellation lazy loading in `loadedImage` is unaffected.
//
// The previous implementation concatenated a dynamic basename onto a literal
// directory base. Vite's asset plugin only rewrites `new URL()` when the
// ENTIRE path is a static literal, so that emitted nothing and every art
// fetch 404'd in production (#404 review).
const ART_URLS = import.meta.glob("../../data/art/western/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const ART_URL_BY_BASENAME: ReadonlyMap<string, string> = new Map(
  Object.entries(ART_URLS).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1), url]),
);

/**
 * Resolve a manifest basename (e.g. `"Ori.png"`) to its Vite-emitted asset
 * URL. Returns null when no such asset exists, which is what makes a missing
 * or misnamed file detectable instead of silently 404-ing at runtime.
 */
export function artAssetUrl(file: string): string | null {
  return ART_URL_BY_BASENAME.get(file) ?? null;
}
```

Then update the single call site inside `loadedImage` (currently `loadImage(resolveAssetUrl(file))`) to skip files with no asset:

```ts
function loadedImage(file: string): ArtImage | null {
  const cached = imageCache.get(file);
  if (cached !== undefined) return cached;
  const url = artAssetUrl(file);
  if (url === null) return null;
  const loaded = loadImage(url);
  imageCache.set(file, loaded);
  return loaded;
}
```

And in `update`, fall back to the placeholder when `loadedImage` returns null:

```ts
const resolved = anchored !== null && entry.file !== null ? loadedImage(entry.file) : null;
const image = resolved ?? placeholder;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/scene/constellation-art.test.ts`

Expected: PASS, including the pre-existing cases. If `caches loadImage calls per file across multiple constellations` now fails, it is because its stub filename is not a real emitted asset — change that test's manifest entry to use a real basename such as `"Ori.png"`.

- [ ] **Step 5: Verify the assets actually reach `dist/`**

Run:

```bash
pnpm build && find dist -path "*art*" -name "*.png" | wc -l
```

Expected: `85`. Before this task it was `0`. This is the check that proves the production bug is fixed — the unit test guards the resolution mechanism, this confirms the emission.

- [ ] **Step 6: Commit**

```bash
git add src/scene/constellation-art.ts src/scene/constellation-art.test.ts
git commit -m "fix(#366): emit art PNGs via import.meta.glob so they reach dist

new URL(<literal base> + dynamic, import.meta.url) is not rewritten by Vite —
no assets were emitted and every art fetch 404'd in production. The e2e suite
runs the Vite dev server, where the relative path resolves, so no existing
test could catch it.

artAssetUrl() is backed by Vite's emitted-asset map and returns null for
unknown files, making a missing asset detectable. Guarded by a test asserting
every non-null manifest file resolves.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Pure affine module

Extract the image-space → world-space mapping as a `Matrix4`, preserving shear.

**Files:**

- Create: `src/scene/constellation-art-affine.ts`
- Create: `src/scene/constellation-art-affine.test.ts`
- Modify: `vitest.config.ts` (add a stricter threshold entry)

**Interfaces:**

- Consumes: `ConstellationArtAnchor` from `./constellation-art` (already exported: `{ readonly pos: readonly [number, number]; readonly hip: number }`).
- Produces:

  ```ts
  export function anchorModelMatrix(
    anchors: readonly ConstellationArtAnchor[],
    world: readonly Cartesian3[],
    size: readonly [number, number],
  ): Matrix4 | null;
  ```

  Maps the unit quad `(s, t) ∈ [0,1]²` to world space, where `(0,0)` is the image's top-left pixel `(0,0)` and `(1,1)` is its bottom-right pixel `(w,h)`. Returns `null` when `anchors.length < 3`, `world.length < 3`, or the three anchor pixels are collinear. Task 3 consumes this.

- [ ] **Step 1: Write the failing test**

Create `src/scene/constellation-art-affine.test.ts`. Critically, this file must NOT call `vi.mock("cesium")` — the whole point is to assert against real `Cartesian3` / `Matrix4` math, which is pure JS with no WebGL dependency and works under jsdom.

```ts
/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { Cartesian3, Matrix4 } from "cesium";
import { anchorModelMatrix } from "./constellation-art-affine";
import type { ConstellationArtAnchor } from "./constellation-art";

const SIZE: readonly [number, number] = [512, 512];

function anchor(x: number, y: number, hip: number): ConstellationArtAnchor {
  return { pos: [x, y], hip };
}

/** Map a unit-quad corner through the matrix. */
function corner(m: Matrix4, s: number, t: number): Cartesian3 {
  return Matrix4.multiplyByPoint(m, new Cartesian3(s, t, 0), new Cartesian3());
}

function expectClose(actual: Cartesian3, x: number, y: number, z: number): void {
  expect(actual.x).toBeCloseTo(x, 6);
  expect(actual.y).toBeCloseTo(y, 6);
  expect(actual.z).toBeCloseTo(z, 6);
}

describe("anchorModelMatrix", () => {
  it("maps the unit quad onto an axis-aligned world rectangle", () => {
    // Anchor pixels at the image's top-left, top-right, and bottom-left,
    // mapped to a 10x20 rectangle in the world XY plane. The unit quad's
    // corners must land exactly on that rectangle's corners.
    const anchors = [anchor(0, 0, 1), anchor(512, 0, 2), anchor(0, 512, 3)];
    const world = [new Cartesian3(0, 0, 0), new Cartesian3(10, 0, 0), new Cartesian3(0, 20, 0)];

    const m = anchorModelMatrix(anchors, world, SIZE);
    expect(m).not.toBeNull();
    if (m === null) return;

    expectClose(corner(m, 0, 0), 0, 0, 0);
    expectClose(corner(m, 1, 0), 10, 0, 0);
    expectClose(corner(m, 0, 1), 0, 20, 0);
    expectClose(corner(m, 1, 1), 10, 20, 0);
  });

  it("preserves shear — the reason this is a Primitive and not a billboard", () => {
    // Same anchor pixels, but the world triangle is sheared: the "down" edge
    // leans +5 in x. A similarity transform cannot express this; the affine
    // must carry it through to the far corner.
    const anchors = [anchor(0, 0, 1), anchor(512, 0, 2), anchor(0, 512, 3)];
    const world = [new Cartesian3(0, 0, 0), new Cartesian3(10, 0, 0), new Cartesian3(5, 20, 0)];

    const m = anchorModelMatrix(anchors, world, SIZE);
    expect(m).not.toBeNull();
    if (m === null) return;

    expectClose(corner(m, 0, 1), 5, 20, 0);
    expectClose(corner(m, 1, 1), 15, 20, 0);
  });

  it("handles anchors that are not at the image corners", () => {
    // Real Stellarium anchors sit on stars, anywhere in the image. Anchors at
    // pixel (128,128) and (384,128) span half the width, so the full-width
    // world displacement must be twice their world separation.
    const anchors = [anchor(128, 128, 1), anchor(384, 128, 2), anchor(128, 384, 3)];
    const world = [new Cartesian3(1, 1, 0), new Cartesian3(3, 1, 0), new Cartesian3(1, 5, 0)];

    const m = anchorModelMatrix(anchors, world, SIZE);
    expect(m).not.toBeNull();
    if (m === null) return;

    // Pixel (128,128) is at unit-quad (0.25, 0.25) and must map to its world anchor.
    expectClose(corner(m, 0.25, 0.25), 1, 1, 0);
    expectClose(corner(m, 0.75, 0.25), 3, 1, 0);
    expectClose(corner(m, 0.25, 0.75), 1, 5, 0);
  });

  it("returns null when the three anchor pixels are collinear", () => {
    const anchors = [anchor(0, 0, 1), anchor(256, 256, 2), anchor(512, 512, 3)];
    const world = [new Cartesian3(0, 0, 0), new Cartesian3(1, 1, 0), new Cartesian3(2, 2, 0)];
    expect(anchorModelMatrix(anchors, world, SIZE)).toBeNull();
  });

  it("returns null when fewer than three anchors are supplied", () => {
    const anchors = [anchor(0, 0, 1), anchor(512, 0, 2)];
    const world = [new Cartesian3(0, 0, 0), new Cartesian3(10, 0, 0)];
    expect(anchorModelMatrix(anchors, world, SIZE)).toBeNull();
  });

  it("returns null when fewer than three world positions are supplied", () => {
    const anchors = [anchor(0, 0, 1), anchor(512, 0, 2), anchor(0, 512, 3)];
    const world = [new Cartesian3(0, 0, 0), new Cartesian3(10, 0, 0)];
    expect(anchorModelMatrix(anchors, world, SIZE)).toBeNull();
  });

  it("produces a non-singular matrix (third column is a real normal)", () => {
    const anchors = [anchor(0, 0, 1), anchor(512, 0, 2), anchor(0, 512, 3)];
    const world = [new Cartesian3(0, 0, 0), new Cartesian3(10, 0, 0), new Cartesian3(0, 20, 0)];
    const m = anchorModelMatrix(anchors, world, SIZE);
    expect(m).not.toBeNull();
    if (m === null) return;
    // A singular model matrix collapses the quad; guard against it explicitly.
    expect(Math.abs(Matrix4.getMaximumScale(m))).toBeGreaterThan(0);
    const normal = Matrix4.getColumn(m, 2, []);
    expect(Cartesian3.magnitude(new Cartesian3(normal[0], normal[1], normal[2]))).toBeCloseTo(1, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/scene/constellation-art-affine.test.ts`

Expected: FAIL — `Failed to resolve import "./constellation-art-affine"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/scene/constellation-art-affine.ts`:

```ts
/* SPDX-License-Identifier: Apache-2.0 */
import { Cartesian3, Matrix4 } from "cesium";
import type { ConstellationArtAnchor } from "./constellation-art";

/**
 * Build the model matrix mapping a unit quad to the world-space parallelogram
 * that Stellarium's three anchors define for a constellation illustration.
 *
 * The image-pixel → world mapping is affine, so it is exactly representable
 * as a 4x4 matrix — position, scale, rotation AND shear. That exactness is
 * why the art is drawn as a textured Primitive rather than a screen-aligned
 * billboard, which can express none of the last three. See ADR 018.
 *
 * Unit-quad convention: (0,0) is the image's top-left pixel (0,0) and (1,1)
 * is its bottom-right pixel (w,h).
 *
 * Returns null when the transform is undefined — fewer than three anchors,
 * fewer than three resolved world positions, or three collinear anchor pixels
 * (a degenerate triangle). Callers fall back to the placeholder sprite.
 */
export function anchorModelMatrix(
  anchors: readonly ConstellationArtAnchor[],
  world: readonly Cartesian3[],
  size: readonly [number, number],
): Matrix4 | null {
  if (anchors.length < 3 || world.length < 3) return null;

  const [a0, a1, a2] = anchors;
  const [w0, w1, w2] = world;
  if (a0 === undefined || a1 === undefined || a2 === undefined) return null;
  if (w0 === undefined || w1 === undefined || w2 === undefined) return null;

  const [width, height] = size;

  // Pixel-space basis rooted at anchor 0.
  const e1x = a1.pos[0] - a0.pos[0];
  const e1y = a1.pos[1] - a0.pos[1];
  const e2x = a2.pos[0] - a0.pos[0];
  const e2y = a2.pos[1] - a0.pos[1];

  const det = e1x * e2y - e2x * e1y;
  if (Math.abs(det) < 1e-9) return null;

  // World-space basis for the same two pixel directions.
  const d1 = Cartesian3.subtract(w1, w0, new Cartesian3());
  const d2 = Cartesian3.subtract(w2, w0, new Cartesian3());

  // Solve for the world displacement of one pixel step along x and along y.
  // [px, py] in pixel space decomposes as α·e1 + β·e2, so the world
  // displacement is α·d1 + β·d2. Applying that to the unit vectors (1,0) and
  // (0,1) gives the per-pixel world basis.
  const perPixel = (px: number, py: number): Cartesian3 => {
    const alpha = (px * e2y - e2x * py) / det;
    const beta = (e1x * py - px * e1y) / det;
    const a = Cartesian3.multiplyByScalar(d1, alpha, new Cartesian3());
    const b = Cartesian3.multiplyByScalar(d2, beta, new Cartesian3());
    return Cartesian3.add(a, b, new Cartesian3());
  };

  // Columns 0 and 1: world displacement across the image's full width/height.
  const colX = perPixel(width, 0);
  const colY = perPixel(0, height);

  // Column 3: world position of the image's (0,0) corner — anchor 0 walked
  // back by its own pixel offset.
  const originOffset = perPixel(-a0.pos[0], -a0.pos[1]);
  const origin = Cartesian3.add(w0, originOffset, new Cartesian3());

  // Column 2 carries no geometric meaning — the quad is flat — but a zero
  // column would make the matrix singular, so use the unit normal.
  const normal = Cartesian3.cross(colX, colY, new Cartesian3());
  const normalMag = Cartesian3.magnitude(normal);
  if (normalMag < 1e-12) return null;
  Cartesian3.divideByScalar(normal, normalMag, normal);

  // Matrix4.fromColumnMajorArray takes columns in order: X, Y, Z, translation.
  return Matrix4.fromColumnMajorArray([
    colX.x,
    colX.y,
    colX.z,
    0,
    colY.x,
    colY.y,
    colY.z,
    0,
    normal.x,
    normal.y,
    normal.z,
    0,
    origin.x,
    origin.y,
    origin.z,
    1,
  ]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/scene/constellation-art-affine.test.ts`

Expected: PASS, all 7 cases.

- [ ] **Step 5: Hold the new module to the pure-module coverage bar**

This file sits under `src/scene/**`, which the config gates at 80% lines / 70% branches. It is pure math with no rendering, so it earns the stricter bar. In `vitest.config.ts`, add this entry immediately after the `"src/sat/**"` block and before the `// Integration modules` comment:

```ts
        // Pure affine math, despite living in scene/ (Cesium Matrix4 types).
        "src/scene/constellation-art-affine.ts": {
          lines: 90,
          statements: 90,
          functions: 90,
          branches: 85,
        },
```

- [ ] **Step 6: Verify the threshold holds**

Run: `pnpm test:cov 2>&1 | grep -A2 "constellation-art-affine"`

Expected: the file reports ≥90% lines and ≥85% branches, and `test:cov` does not fail on a threshold line naming it. If branches fall short, the uncovered ones are the `undefined` element guards — add a case passing a sparse array.

- [ ] **Step 7: Commit**

```bash
git add src/scene/constellation-art-affine.ts src/scene/constellation-art-affine.test.ts vitest.config.ts
git commit -m "feat(#366): pure affine module mapping image pixels to world space

Stellarium's three anchors define a full affine transform. anchorModelMatrix
returns it as a Matrix4 mapping the unit quad to world space, preserving
shear — which a screen-aligned billboard cannot express at all.

Tested against real Cesium math (no vi.mock) and held to the pure-module
coverage bar rather than scene/'s looser integration gate.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Render anchored art as textured world-space quads

Anchored constellations move from `Billboard` to `Primitive`. The `BillboardCollection` stays for the placeholder fallback only.

**Files:**

- Modify: `src/scene/constellation-art.ts` (the `createConstellationArtLayer` body and `anchoredPositionAndScale`)
- Modify: `src/scene/constellation-art.test.ts` (expand the Cesium mock; update billboard-centric assertions)

**Interfaces:**

- Consumes: `anchorModelMatrix` from Task 2; `artAssetUrl` from Task 1.
- Produces: the `ConstellationArtLayer` public shape is UNCHANGED — `update(constellations, lookup, lat, lon)`, `setVisible(visible)`, `setOpacity(opacity)`. `src/app.ts` needs no edit. Task 4 refines the internals.

- [ ] **Step 1: Expand the Cesium mock**

The existing mock in `src/scene/constellation-art.test.ts` covers only billboards. Add these to the object returned by `vi.mock("cesium", …)`, and add the module-scope mock fns next to the existing `mockAdd` / `mockRemoveAll` declarations:

```ts
const mockPrimitiveAdd = vi.fn();
const mockPrimitiveRemoveAll = vi.fn();
let mockPrimitiveCollectionShow = true;
```

Inside the mock factory's returned object:

```ts
    PrimitiveCollection: vi.fn(function () {
      return {
        add: mockPrimitiveAdd,
        removeAll: mockPrimitiveRemoveAll,
        get show() {
          return mockPrimitiveCollectionShow;
        },
        set show(v: boolean) {
          mockPrimitiveCollectionShow = v;
        },
      };
    }),
    Primitive: vi.fn(function (opts: unknown) {
      return { ...(opts as object), isPrimitive: true };
    }),
    GeometryInstance: vi.fn(function (opts: unknown) {
      return { ...(opts as object) };
    }),
    Geometry: vi.fn(function (opts: unknown) {
      return { ...(opts as object) };
    }),
    GeometryAttribute: vi.fn(function (opts: unknown) {
      return { ...(opts as object) };
    }),
    MaterialAppearance: vi.fn(function (opts: unknown) {
      return { ...(opts as object) };
    }),
    Material: vi.fn(function (opts: unknown) {
      return { ...(opts as object), uniforms: { alpha: 1 } };
    }),
    ComponentDatatype: { DOUBLE: 0, FLOAT: 1 },
    PrimitiveType: { TRIANGLES: 4 },
    BoundingSphere: { fromVertices: vi.fn().mockReturnValue({ radius: 1 }) },
```

Extend the existing `Matrix4` mock entry to also expose what the affine module needs. Since `constellation-art-affine.ts` is imported by the layer under test, and this file mocks Cesium, the affine module will receive the mock too — so stub its usage rather than asserting real math here (real math is Task 2's job):

```ts
    Matrix4: {
      multiplyByPoint: vi.fn().mockReturnValue({ x: 10, y: 20, z: 30 }),
      fromColumnMajorArray: vi.fn().mockReturnValue({ isMatrix4: true }),
      IDENTITY: { isIdentity: true },
    },
```

and extend the `MockCartesian3` static surface with the operations `anchorModelMatrix` calls:

```ts
(MockCartesian3 as unknown as Record<string, unknown>).subtract = vi
  .fn()
  .mockReturnValue({ x: 1, y: 0, z: 0 });
(MockCartesian3 as unknown as Record<string, unknown>).add = vi
  .fn()
  .mockReturnValue({ x: 1, y: 1, z: 0 });
(MockCartesian3 as unknown as Record<string, unknown>).multiplyByScalar = vi
  .fn()
  .mockReturnValue({ x: 1, y: 0, z: 0 });
(MockCartesian3 as unknown as Record<string, unknown>).cross = vi
  .fn()
  .mockReturnValue({ x: 0, y: 0, z: 1 });
(MockCartesian3 as unknown as Record<string, unknown>).magnitude = vi.fn().mockReturnValue(1);
(MockCartesian3 as unknown as Record<string, unknown>).divideByScalar = vi
  .fn()
  .mockReturnValue({ x: 0, y: 0, z: 1 });
```

Add to the existing `beforeEach` reset block:

```ts
mockPrimitiveAdd.mockClear();
mockPrimitiveRemoveAll.mockClear();
mockPrimitiveCollectionShow = true;
```

- [ ] **Step 2: Write the failing test**

Add a new `describe` block to `src/scene/constellation-art.test.ts`:

```ts
describe("ConstellationArtLayer anchored primitives", () => {
  const ANCHORED = makeManifest({
    Ori: {
      file: "Ori.png",
      size: [512, 512],
      anchors: [
        { pos: [59, 11], hip: 27913 },
        { pos: [329, 477], hip: 27366 },
        { pos: [421, 91], hip: 22449 },
      ],
    },
  });

  const ALL_VISIBLE = stubLookup({
    27913: { alt: 40, az: 180 },
    27366: { alt: 30, az: 175 },
    22449: { alt: 45, az: 185 },
  });

  it("registers a PrimitiveCollection with scene.primitives", () => {
    const scene = makeMockScene();
    createConstellationArtLayer(scene as never, { manifest: ANCHORED });
    // One BillboardCollection (placeholders) + one PrimitiveCollection (art).
    expect(mockPrimitivesAdd).toHaveBeenCalledTimes(2);
  });

  it("adds a primitive, not a billboard, when all anchors resolve", () => {
    const scene = makeMockScene();
    const layer = createConstellationArtLayer(scene as never, { manifest: ANCHORED });
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);

    expect(mockPrimitiveAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("adds a placeholder billboard, not a primitive, when anchors do not resolve", () => {
    const scene = makeMockScene();
    const layer = createConstellationArtLayer(scene as never, { manifest: ANCHORED });
    layer.update([CONSTELLATIONS[0]!], NEVER_LOOKUP, 61, -149);

    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockPrimitiveAdd).not.toHaveBeenCalled();
  });

  it("attaches the VisibleConstellation as the geometry instance id (pickable)", () => {
    const scene = makeMockScene();
    const layer = createConstellationArtLayer(scene as never, { manifest: ANCHORED });
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);

    // Preserves the pick contract the constellation-line layer established
    // (#305 / #308) — hovering the art must resolve to a typed payload.
    const primitive = mockPrimitiveAdd.mock.calls[0]?.[0] as {
      geometryInstances: { id: unknown };
    };
    expect(primitive.geometryInstances.id).toBe(CONSTELLATIONS[0]);
  });

  it("clears both collections before adding new content", () => {
    const scene = makeMockScene();
    const layer = createConstellationArtLayer(scene as never, { manifest: ANCHORED });
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);

    expect(mockRemoveAll).toHaveBeenCalled();
    expect(mockPrimitiveRemoveAll).toHaveBeenCalled();
  });

  it("falls back to a placeholder billboard when the art asset was not emitted", () => {
    const scene = makeMockScene();
    const missing = makeManifest({
      Ori: {
        file: "DoesNotExist.png",
        size: [512, 512],
        anchors: [
          { pos: [0, 0], hip: 27913 },
          { pos: [512, 0], hip: 27366 },
          { pos: [0, 512], hip: 22449 },
        ],
      },
    });
    const layer = createConstellationArtLayer(scene as never, { manifest: missing });
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);

    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockPrimitiveAdd).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run src/scene/constellation-art.test.ts -t "anchored primitives"`

Expected: FAIL — `expect(mockPrimitivesAdd).toHaveBeenCalledTimes(2)` receives 1, because no `PrimitiveCollection` exists yet.

- [ ] **Step 4: Write the implementation**

In `src/scene/constellation-art.ts`:

Extend the Cesium import:

```ts
import {
  BillboardCollection,
  BoundingSphere,
  Cartesian3,
  Color,
  ComponentDatatype,
  Geometry,
  GeometryAttribute,
  GeometryInstance,
  HorizontalOrigin,
  Material,
  MaterialAppearance,
  Primitive,
  PrimitiveCollection,
  PrimitiveType,
  VerticalOrigin,
} from "cesium";
import type { Matrix4, Scene } from "cesium";
import { anchorModelMatrix } from "./constellation-art-affine";
```

Delete `anchoredPositionAndScale`, `barycentric2D`, and `BASE_ANCHORED_SCALE` — the affine module supersedes all three. Replace with a resolver returning the model matrix:

```ts
/**
 * Resolve the world-space affine for an anchored illustration, given the live
 * alt/az of each anchor star. Returns null when the entry cannot be anchored:
 * no `file` (placeholder-only entry, e.g. Pup / Ser / Vel), missing anchors or
 * size, any anchor star below the horizon, or a degenerate anchor triangle.
 */
function anchoredMatrix(
  entry: ConstellationArtEntry,
  lookup: AnchorStarLookup,
  lat: number,
  lon: number,
): Matrix4 | null {
  if (entry.file === null) return null;
  if (entry.size === undefined || entry.anchors === undefined) return null;
  if (entry.anchors.length < 3) return null;

  const world: Cartesian3[] = [];
  for (const a of entry.anchors.slice(0, 3)) {
    const s = lookup(a.hip);
    if (s === undefined) return null;
    world.push(altAzToCartesian(s.alt, s.az, lat, lon));
  }

  return anchorModelMatrix(entry.anchors, world, entry.size);
}
```

Add the quad geometry builder. The unit quad's vertices are ordered image top-left, top-right, bottom-right, bottom-left, with `st` set so the texture renders upright:

```ts
// Unit quad in model space. The modelMatrix maps it onto the sky; see
// constellation-art-affine.ts for the mapping convention.
const QUAD_POSITIONS = new Float64Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
// Image space runs y-down, texture space runs t-up, so t is flipped.
const QUAD_ST = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]);
const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3]);

function buildQuad(constellation: VisibleConstellation): GeometryInstance {
  return new GeometryInstance({
    geometry: new Geometry({
      attributes: {
        position: new GeometryAttribute({
          componentDatatype: ComponentDatatype.DOUBLE,
          componentsPerAttribute: 3,
          values: QUAD_POSITIONS.slice(),
        }),
        st: new GeometryAttribute({
          componentDatatype: ComponentDatatype.FLOAT,
          componentsPerAttribute: 2,
          values: QUAD_ST.slice(),
        }),
      },
      indices: QUAD_INDICES.slice(),
      primitiveType: PrimitiveType.TRIANGLES,
      boundingSphere: BoundingSphere.fromVertices(Array.from(QUAD_POSITIONS)),
    }),
    // Matches the ConstellationLayer polyline pick contract so hover / click
    // over the art resolves back to a typed constellation payload.
    id: constellation,
  });
}
```

Add the material builder. A custom fabric is used rather than `Material.fromType("Image")` because the latter exposes no alpha uniform, and `setOpacity` needs one:

```ts
function buildMaterial(image: string, alpha: number): Material {
  return new Material({
    fabric: {
      type: "ConstellationArt",
      uniforms: { image, alpha },
      components: {
        diffuse: "texture(image, materialInput.st).rgb",
        alpha: "texture(image, materialInput.st).a * alpha",
      },
    },
    translucent: true,
  });
}
```

In `createConstellationArtLayer`, add the collection next to the existing one:

```ts
const billboards = new BillboardCollection({ scene });
scene.primitives.add(billboards);
const primitives = new PrimitiveCollection();
scene.primitives.add(primitives);
```

Rewrite `update`:

```ts
function update(
  constellations: VisibleConstellation[],
  lookup: AnchorStarLookup,
  lat: number,
  lon: number,
): void {
  billboards.removeAll();
  primitives.removeAll();

  for (const constellation of constellations) {
    const entry: ConstellationArtEntry = manifest.constellations[constellation.id] ?? {
      file: null,
    };
    const modelMatrix = anchoredMatrix(entry, lookup, lat, lon);
    const url = entry.file !== null ? artAssetUrl(entry.file) : null;

    if (modelMatrix !== null && url !== null) {
      primitives.add(
        new Primitive({
          geometryInstances: buildQuad(constellation),
          appearance: new MaterialAppearance({
            material: buildMaterial(url, currentOpacity),
            translucent: true,
            flat: true,
          }),
          asynchronous: false,
          modelMatrix,
        }),
      );
      continue;
    }

    billboards.add({
      position: altAzToCartesian(constellation.centroid.alt, constellation.centroid.az, lat, lon),
      image: placeholder,
      scale: 1.0,
      color: Color.WHITE.withAlpha(currentOpacity),
      horizontalOrigin: HorizontalOrigin.CENTER,
      verticalOrigin: VerticalOrigin.CENTER,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      id: constellation,
    });
  }
}
```

The `loadImage` / `loadedImage` / `imageCache` machinery is no longer used — the material takes a URL string and Cesium handles texture loading. Delete `loadedImage`, `imageCache`, `defaultLoadImage`, the `ArtImage` type, and the `loadImage` option from `CreateConstellationArtLayerOptions`. Update `setVisible` and `setOpacity` to span both collections:

```ts
function setVisible(visible: boolean): void {
  setCollectionVisible(billboards, visible);
  primitives.show = visible;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/scene/constellation-art.test.ts`

Expected: PASS. Pre-existing cases that assert billboard behaviour for anchored constellations will now fail legitimately — `loads the file and applies the anchored scale when all anchors resolve` and `caches loadImage calls per file across multiple constellations` both describe behaviour this task deliberately removes. Delete those two cases; the new `anchored primitives` block covers their intent. Cases asserting placeholder fallback stay as-is and must still pass.

- [ ] **Step 6: Commit**

```bash
git add src/scene/constellation-art.ts src/scene/constellation-art.test.ts
git commit -m "feat(#366): draw anchored art as textured world-space quads

Anchored constellations render as Primitives carrying the full affine from
Stellarium's three anchors — position, scale, rotation and shear — instead of
screen-aligned billboards fixed at scale 0.5 with no rotation. Art now turns
with the sky and holds its angular extent through zoom.

BillboardCollection is retained for the placeholder fallback only: Pup/Ser/Vel,
off-horizon anchor stars, degenerate triangles, and unemitted assets. The
geometry instance id preserves the hover/click pick contract.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Cache primitives, mutate `modelMatrix` on rerender

Task 3 rebuilds every primitive on every `update()`. Camera moves dispatch state through a 50 ms-debounced `scheduleRerender`, so that recompiles ~30 primitives several times a second. `Primitive.modelMatrix` is mutable and transforms all geometry instances model→world, so a rerender should assign matrices, not rebuild geometry.

**Files:**

- Modify: `src/scene/constellation-art.ts` (`createConstellationArtLayer` internals)
- Modify: `src/scene/constellation-art.test.ts` (add a caching `describe` block)

**Interfaces:**

- Consumes: everything from Task 3.
- Produces: no public API change. Purely an internal performance refactor.

- [ ] **Step 1: Write the failing test**

Add to `src/scene/constellation-art.test.ts`, inside the `anchored primitives` describe block:

```ts
it("reuses the cached primitive across rerenders of the same constellation", () => {
  const scene = makeMockScene();
  const layer = createConstellationArtLayer(scene as never, { manifest: ANCHORED });

  layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);
  layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);

  // Rebuilding geometry every rerender would recompile ~30 primitives at the
  // 50ms scheduleRerender cadence. The second pass must reassign the matrix,
  // not construct a second Primitive.
  const { Primitive: MockPrimitive } = await import("cesium");
  expect(vi.mocked(MockPrimitive)).toHaveBeenCalledTimes(1);
});

it("drops the cached primitive when the constellation stops being visible", () => {
  const scene = makeMockScene();
  const layer = createConstellationArtLayer(scene as never, { manifest: ANCHORED });

  layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);
  layer.update([], ALL_VISIBLE, 61, -149);
  layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);

  const { Primitive: MockPrimitive } = await import("cesium");
  expect(vi.mocked(MockPrimitive)).toHaveBeenCalledTimes(2);
});
```

Make both `it` callbacks `async` so the dynamic `import("cesium")` resolves.

These two cases count constructor calls, so the `Primitive` mock must be reset between them — otherwise the second case inherits the first case's count and passes or fails for the wrong reason. Add to the existing `beforeEach`:

```ts
vi.mocked((await import("cesium")).Primitive).mockClear();
```

which requires making the `beforeEach` callback `async`. If that proves awkward, the equivalent is `vi.clearAllMocks()` at the top of `beforeEach` followed by the existing per-mock resets — but prefer the targeted clear, since `clearAllMocks` would also wipe the `MockCartesian3` static return values the affine module depends on.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/scene/constellation-art.test.ts -t "reuses the cached primitive"`

Expected: FAIL — `Primitive` constructed 2 times, expected 1.

- [ ] **Step 3: Write the implementation**

In `createConstellationArtLayer`, add a cache alongside the collections:

```ts
// Primitive construction compiles shaders and uploads vertex buffers, so it
// must not happen on every rerender. Cached by constellation id; a rerender
// only reassigns modelMatrix, which is mutable and cheap.
const primitiveCache = new Map<string, Primitive>();
```

Rewrite `update`'s anchored branch to reuse the cache, and reconcile the collection against the visible set rather than clearing it wholesale:

```ts
function update(
  constellations: VisibleConstellation[],
  lookup: AnchorStarLookup,
  lat: number,
  lon: number,
): void {
  billboards.removeAll();
  const stillAnchored = new Set<string>();

  for (const constellation of constellations) {
    const entry: ConstellationArtEntry = manifest.constellations[constellation.id] ?? {
      file: null,
    };
    const modelMatrix = anchoredMatrix(entry, lookup, lat, lon);
    const url = entry.file !== null ? artAssetUrl(entry.file) : null;

    if (modelMatrix !== null && url !== null) {
      stillAnchored.add(constellation.id);
      const cached = primitiveCache.get(constellation.id);
      if (cached !== undefined) {
        cached.modelMatrix = modelMatrix;
        continue;
      }
      const created = new Primitive({
        geometryInstances: buildQuad(constellation),
        appearance: new MaterialAppearance({
          material: buildMaterial(url, currentOpacity),
          translucent: true,
          flat: true,
        }),
        asynchronous: false,
        modelMatrix,
      });
      primitiveCache.set(constellation.id, created);
      primitives.add(created);
      continue;
    }

    billboards.add({
      position: altAzToCartesian(constellation.centroid.alt, constellation.centroid.az, lat, lon),
      image: placeholder,
      scale: 1.0,
      color: Color.WHITE.withAlpha(currentOpacity),
      horizontalOrigin: HorizontalOrigin.CENTER,
      verticalOrigin: VerticalOrigin.CENTER,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      id: constellation,
    });
  }

  // Evict primitives for constellations that are no longer anchored-visible.
  for (const [id, primitive] of primitiveCache) {
    if (stillAnchored.has(id)) continue;
    primitives.remove(primitive);
    primitiveCache.delete(id);
  }
}
```

Add `remove` to the `PrimitiveCollection` mock in the test file:

```ts
const mockPrimitiveRemove = vi.fn();
```

wired into the mock's returned object as `remove: mockPrimitiveRemove`, and cleared in `beforeEach`. The `clears both collections before adding new content` test from Task 3 asserts `mockPrimitiveRemoveAll` was called — that is no longer true for the primitive collection, which now reconciles instead. Update that test to assert only `mockRemoveAll` (billboards) and rename it to `clears placeholder billboards before adding new content`.

Update `setOpacity` to drive the material uniform on cached primitives:

```ts
function setOpacity(opacity: number): void {
  currentOpacity = opacity;
  const count = collectionLength(billboards);
  for (let i = 0; i < count; i++) {
    const bb = collectionAt<{ color: { alpha: number } }>(billboards, i);
    if (bb?.color !== undefined) {
      bb.color.alpha = opacity;
    }
  }
  for (const primitive of primitiveCache.values()) {
    const appearance = primitive.appearance as { material?: { uniforms?: { alpha?: number } } };
    if (appearance.material?.uniforms !== undefined) {
      appearance.material.uniforms.alpha = opacity;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/scene/constellation-art.test.ts`

Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/scene/constellation-art.ts src/scene/constellation-art.test.ts
git commit -m "perf(#366): cache art primitives, mutate modelMatrix on rerender

Camera moves dispatch state through a 50ms-debounced scheduleRerender.
Rebuilding ~30 primitives at that cadence recompiles shaders and re-uploads
vertex buffers several times a second. Primitive.modelMatrix is mutable, so a
rerender now reassigns matrices and the collection reconciles against the
visible set instead of clearing wholesale.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Reproducible asset pipeline

The 85 PNGs, their IAU renaming, the RGBA re-encode, and the manifest were produced by an undocumented ad-hoc process. Every other bundled dataset in this repo has a `scripts/build-*.mjs`.

**Files:**

- Create: `scripts/build-art.mjs`
- Create: `scripts/build-art.test.mjs`
- Modify: `package.json` (add a `build:art` script)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `export function latinToIau(latinName: string): string | null` — maps a Stellarium illustration basename without extension (e.g. `"canis-major"`) to its IAU 3-letter code (e.g. `"CMa"`), or `null` when unmapped. Exported solely so the test can exercise it; nothing in `src/` imports it.

- [ ] **Step 1: Write the failing test**

Create `scripts/build-art.test.mjs`. Follow the existing `scripts/seed-plans.test.mjs` pattern — `vitest.config.ts` already includes `scripts/**/*.test.mjs`.

```js
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { latinToIau } from "./build-art.mjs";

describe("latinToIau", () => {
  it("maps a single-word Latin name to its IAU code", () => {
    expect(latinToIau("andromeda")).toBe("And");
    expect(latinToIau("orion")).toBe("Ori");
  });

  it("maps a hyphenated Latin name to its IAU code", () => {
    // The renaming is the error-prone half of the pipeline: Stellarium ships
    // canis-major and canis-minor, whose codes differ only in one letter.
    expect(latinToIau("canis-major")).toBe("CMa");
    expect(latinToIau("canis-minor")).toBe("CMi");
    expect(latinToIau("ursa-major")).toBe("UMa");
    expect(latinToIau("ursa-minor")).toBe("UMi");
  });

  it("returns null for a name with no IAU counterpart", () => {
    // Argo Navis is not an IAU 88 constellation; Stellarium assigns its single
    // illustration to Carina, which is why Pup and Vel have no art.
    expect(latinToIau("argo-navis")).toBeNull();
    expect(latinToIau("not-a-constellation")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/build-art.test.mjs`

Expected: FAIL — cannot resolve `./build-art.mjs`.

- [ ] **Step 3: Write the implementation**

Create `scripts/build-art.mjs`. Match the header style of `scripts/build-asterisms.mjs`:

```js
#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Build the constellation art assets + manifest for the planisphere.
//
// Source: Stellarium/stellarium@master:skycultures/modern/
//   - illustrations/*.png  Free Art License 1.3
//   - index.json           CC-BY-SA 4.0
// Attributions are in NOTICE and ADR 018.
//
// Three steps, none of which were reproducible before this script existed:
//   1. Rename from Stellarium's Latin lowercase basenames to IAU 3-letter
//      codes, so the manifest key equals the file basename.
//   2. Re-encode each PNG to RGBA with luminance remapped into the alpha
//      channel. Stellarium ships opaque images with a "black = transparent"
//      convention baked into its own shader; Cesium uses standard alpha
//      blending, so the convention has to be materialised into real alpha.
//   3. Extract {file, size, anchors} per constellation from index.json.
//
// Usage:
//   node scripts/build-art.mjs
//   pnpm prettier --write data/art/western/manifest.json
//
// Coverage note: 85 of the IAU 88. Pup, Ser and Vel have no upstream
// illustration (Argo Navis is one image assigned to Carina; Serpens is
// historically split into Caput/Cauda). Those three get file: null and the
// layer draws its placeholder sprite.

const IAU_BY_LATIN = {
  andromeda: "And",
  antlia: "Ant",
  apus: "Aps",
  aquarius: "Aqr",
  aquila: "Aql",
  ara: "Ara",
  aries: "Ari",
  auriga: "Aur",
  bootes: "Boo",
  caelum: "Cae",
  camelopardalis: "Cam",
  cancer: "Cnc",
  "canes-venatici": "CVn",
  "canis-major": "CMa",
  "canis-minor": "CMi",
  capricornus: "Cap",
  carina: "Car",
  cassiopeia: "Cas",
  centaurus: "Cen",
  cepheus: "Cep",
  cetus: "Cet",
  chamaeleon: "Cha",
  circinus: "Cir",
  columba: "Col",
  "coma-berenices": "Com",
  "corona-australis": "CrA",
  "corona-borealis": "CrB",
  corvus: "Crv",
  crater: "Crt",
  crux: "Cru",
  cygnus: "Cyg",
  delphinus: "Del",
  dorado: "Dor",
  draco: "Dra",
  equuleus: "Equ",
  eridanus: "Eri",
  fornax: "For",
  gemini: "Gem",
  grus: "Gru",
  hercules: "Her",
  horologium: "Hor",
  hydra: "Hya",
  hydrus: "Hyi",
  indus: "Ind",
  lacerta: "Lac",
  leo: "Leo",
  "leo-minor": "LMi",
  lepus: "Lep",
  libra: "Lib",
  lupus: "Lup",
  lynx: "Lyn",
  lyra: "Lyr",
  mensa: "Men",
  microscopium: "Mic",
  monoceros: "Mon",
  musca: "Mus",
  norma: "Nor",
  octans: "Oct",
  ophiuchus: "Oph",
  orion: "Ori",
  pavo: "Pav",
  pegasus: "Peg",
  perseus: "Per",
  phoenix: "Phe",
  pictor: "Pic",
  pisces: "Psc",
  "piscis-austrinus": "PsA",
  puppis: "Pup",
  pyxis: "Pyx",
  reticulum: "Ret",
  sagitta: "Sge",
  sagittarius: "Sgr",
  scorpius: "Sco",
  sculptor: "Scl",
  scutum: "Sct",
  serpens: "Ser",
  sextans: "Sex",
  taurus: "Tau",
  telescopium: "Tel",
  triangulum: "Tri",
  "triangulum-australe": "TrA",
  tucana: "Tuc",
  "ursa-major": "UMa",
  "ursa-minor": "UMi",
  vela: "Vel",
  virgo: "Vir",
  volans: "Vol",
  vulpecula: "Vul",
};

/**
 * Map a Stellarium illustration basename (no extension) to its IAU 3-letter
 * code, or null when there is no IAU counterpart.
 */
export function latinToIau(latinName) {
  return IAU_BY_LATIN[latinName] ?? null;
}
```

Then add the pipeline body below, guarded so importing the module for tests does not execute it:

```js
import { fileURLToPath } from "node:url";

const UPSTREAM =
  "https://raw.githubusercontent.com/Stellarium/stellarium/master/skycultures/modern";
const OUT_DIR = new URL("../data/art/western/", import.meta.url);

async function main() {
  console.log(`Fetching ${UPSTREAM}/index.json`);
  const index = await (await fetch(`${UPSTREAM}/index.json`)).json();

  const constellations = {};
  for (const entry of index.constellations ?? []) {
    const latin = (entry.image?.file ?? "").replace(/\.png$/i, "");
    const iau = latinToIau(latin);
    if (iau === null) {
      console.warn(`  skip: no IAU code for "${latin}"`);
      continue;
    }
    constellations[iau] = {
      file: `${iau}.png`,
      size: entry.image.size,
      anchors: entry.image.anchors.map((a) => ({ pos: a.pos, hip: a.hip })),
    };
  }

  // Fill the IAU 88 so every constellation has an entry; the three with no
  // upstream illustration get file: null and fall back to the placeholder.
  for (const iau of Object.values(IAU_BY_LATIN)) {
    constellations[iau] ??= { file: null };
  }

  console.log(`Writing manifest with ${Object.keys(constellations).length} entries`);
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    new URL("manifest.json", OUT_DIR),
    `${JSON.stringify(
      {
        culture: "western",
        version: 2,
        source: `${UPSTREAM}/index.json`,
        notes:
          "Generated by scripts/build-art.mjs. Illustrations FAL 1.3, metadata CC-BY-SA 4.0. See NOTICE and ADR 018.",
        constellations,
      },
      null,
      2,
    )}\n`,
  );
  console.log("Done. Run: pnpm prettier --write data/art/western/manifest.json");
}

// Only run the pipeline when invoked directly, not when imported by tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
```

Note: the PNG download and RGBA re-encode are deliberately NOT automated here — they need an image-encoding dependency, and CLAUDE.md requires an ADR for every new dependency. The header documents the transform precisely enough to reproduce by hand. If a future task wants it automated, that needs its own ADR.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/build-art.test.mjs`

Expected: PASS, all 3 cases.

- [ ] **Step 5: Add the npm script**

In `package.json`, add after the `"seed-plans"` entry:

```json
    "build:art": "node scripts/build-art.mjs",
```

- [ ] **Step 6: Commit**

```bash
git add scripts/build-art.mjs scripts/build-art.test.mjs package.json
git commit -m "chore(#366): reproducible art manifest pipeline

Every other bundled dataset has a scripts/build-*.mjs; the 85 art PNGs, their
IAU renaming and the manifest were produced ad hoc and could not be
regenerated. This covers the rename and the manifest extraction, and documents
the RGBA/luminance re-encode precisely (automating that needs an image
dependency, which needs its own ADR).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Correct ADR 018, retune the e2e floor, verify in a real browser

**Files:**

- Modify: `docs/adr/018-constellation-art-assets.md`
- Modify: `e2e/constellation-art-overlay.spec.ts` (threshold only, if the observed delta warrants it)

**Interfaces:**

- Consumes: everything. This is the closing task.

- [ ] **Step 1: Verify the art actually renders**

No unit test can confirm this — jsdom has no WebGL, and the custom material's GLSL is only compiled by a real GPU. In particular the fabric uses `texture(...)`; if Cesium 1.144 rejects that in favour of `texture2D(...)`, the shader fails to compile and the overlay renders nothing.

Run:

```bash
pnpm build && pnpm preview
```

Open the preview URL with `?art=on&lat=61.2&lon=-149.9` and confirm:

- illustrations appear over their constellations (not blank, not solid rectangles)
- the browser console shows no shader-compile error and no 404s for `/assets/*.png`
- illustrations rotate with the sky when the view is panned
- illustrations keep their angular size relative to the stars when zooming — this is the behaviour ADR 018 claimed a Primitive rewrite was needed for

If the shader fails to compile, swap `texture(` for `texture2D(` in `buildMaterial` and rebuild. Record which one worked in the ADR.

- [ ] **Step 2: Re-derive the e2e threshold from an observed run**

The existing spec asserts `differing > 500`, a floor tuned against placeholder halos and fixed-scale art. Correct size and rotation change the delta.

Run: `pnpm e2e`

If it passes, leave the threshold alone — do not tighten a passing test speculatively. If it fails, print the observed value, set the floor to roughly half of it, and record the observed number in the code comment so the next person knows what it was tuned against.

- [ ] **Step 3: Rewrite ADR 018's superseded sections**

In `docs/adr/018-constellation-art-assets.md`:

- **Consequences → "Scale is fixed, not zoom-aware"**: replace. The claim that zoom-correct rendering "would require moving to a `Primitive` with a textured world-space polygon" was the deferral's whole basis. Record instead that anchored art is drawn as a textured world-space quad carrying the exact affine, so position, scale, rotation and shear are all correct and zoom-correct by construction.
- **Alternatives considered → "Move to `Primitive` + textured polygon now"**: this was rejected as "larger Cesium API surface... Deferred". It is now the accepted approach. Move it into the Decision section and note that `Billboard.alignedAxis` and `Billboard.sizeInMeters` would have solved rotation and zoom-correctness while leaving shear unexpressible — which is why the Primitive path was taken.
- **Consequences → "Per-constellation override still open"**: unchanged, still true.
- **Assets → "Weight"**: the section says ~3.0 MB while Consequences says ~2.1 MB. The on-disk total is 3.1 MB. Make both say 3.1 MB.
- Add a new Consequences bullet recording the production-emission bug: the art was not emitted to `dist/` at all, no test could catch it because the e2e suite runs the Vite dev server, and `artAssetUrl` plus its manifest-coverage test now guard it.
- Update the Status line to note it is amended by [the affine design spec](../specs/2026-08-16-constellation-art-affine-design.md).

- [ ] **Step 4: Run the full canonical gate**

Run:

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:cov && pnpm build
```

Expected: all pass. `test:cov` must not report a threshold failure for `src/scene/**` or `src/scene/constellation-art-affine.ts`. If `src/scene/**` branch coverage dropped below 70%, the uncovered branches are the new anchored-vs-placeholder paths — add cases rather than lowering the gate.

- [ ] **Step 5: Confirm the assets are in the build**

Run: `find dist -path "*art*" -name "*.png" | wc -l`

Expected: `85`.

- [ ] **Step 6: Commit and push**

```bash
git add docs/adr/018-constellation-art-assets.md e2e/constellation-art-overlay.spec.ts
git commit -m "docs(#366): correct ADR 018 — affine placement supersedes the deferral

ADR 018 deferred zoom-aware scale and was silent on rotation, on the premise
that a Primitive rewrite would be required. That premise did not hold:
alignedAxis and sizeInMeters would have solved both on a billboard. The
Primitive path was taken because it is the only one that also expresses shear.

Also records the production asset-emission bug, and reconciles the bundle-size
figures (Assets said 3.0 MB, Consequences said 2.1 MB; actual is 3.1 MB).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push
```

- [ ] **Step 7: Stop at the PR**

PR #404 stays a draft until a human reviews it. Do not mark it ready, and do not merge.

---

## Self-Review

**Spec coverage:**

| Spec section                                               | Task          |
| ---------------------------------------------------------- | ------------- |
| 1. Asset emission (`import.meta.glob`)                     | 1             |
| 2. Guard test (manifest↔`ART_URLS`)                        | 1             |
| 3. `constellation-art-affine.ts` (pure)                    | 2             |
| 3. Hybrid layer, pick id, placeholder fallback             | 3             |
| 3. `modelMatrix` mutation, primitive caching, `setOpacity` | 4             |
| 4. `scripts/build-art.mjs`                                 | 5             |
| 4. ADR 018 corrections                                     | 6             |
| Testing table                                              | 1, 2, 3, 4, 5 |
| Risk: e2e floor retune                                     | 6             |
| Risk: `scene/` coverage                                    | 6 Step 4      |

**Deviations from the spec, deliberate:**

- The spec said the affine module inherits the pure-module gate. It does not — it sits under `src/scene/**` (80/70). Task 2 Step 5 adds an explicit stricter per-file threshold instead.
- The spec kept `loadImage` / `imageCache`. Task 3 removes them: a Cesium `Material` takes a URL and loads its own texture, so the layer's hand-rolled image cache became dead weight. `artAssetUrl` still gates on emission.
- Task 5 does not automate the PNG download and RGBA re-encode. That needs an image-encoding dependency, and CLAUDE.md requires an ADR per dependency. The transform is documented precisely enough to redo by hand.

**Known uncertainty:** the custom material's GLSL (`texture` vs `texture2D`) cannot be verified under jsdom. Task 6 Step 1 is an explicit browser check with a stated fallback, rather than an assumption buried in Task 3.
