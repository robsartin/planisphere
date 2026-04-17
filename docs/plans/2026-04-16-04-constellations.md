# Plan 04 — Constellations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render 88 IAU constellations as stick-figure lines connecting stars (by HIP ID) with name labels at each figure's centroid, filtered to the visible sky.

**Architecture:** `src/astro/constellations.ts` parses constellation data and cross-references with the visible-star map to produce `VisibleConstellation[]`. `src/scene/constellations.ts` renders lines via CesiumJS `PolylineCollection` and labels via `LabelCollection`. Data comes from a pre-built `data/constellations.json` generated from Stellarium's constellation data.

**Tech Stack:** CesiumJS PolylineCollection + LabelCollection (existing), Stellarium constellationship data (public domain).

---

## File structure created by this plan

```
data/
  constellations.json                   88 constellations with line segments

scripts/
  build-constellations.mjs              One-time generator

src/astro/
  constellations.ts                     parseConstellations(), filterVisibleConstellations()
  constellations.test.ts                TDD tests
  index.ts                              (modified) add exports

src/scene/
  constellations.ts                     ConstellationLayer: lines + labels
  constellations.test.ts                Mocked Cesium tests
  index.ts                              (modified) add export

src/
  app.ts                                (modified) wire constellation layer
  app.test.ts                           (modified) update mock

NOTICE                                  (modified) add attribution
```

---

## Task 1: Generate constellation data

**Files:**

- Create: `scripts/build-constellations.mjs`
- Create: `data/constellations.json`

- [ ] **Step 1: Write the generation script**

`scripts/build-constellations.mjs`:

```js
#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
import { writeFileSync, mkdirSync } from "node:fs";

const STELLARIUM_URL =
  "https://raw.githubusercontent.com/Stellarium/stellarium/master/skycultures/modern_st/constellationship.fab";

const NAMES_URL =
  "https://raw.githubusercontent.com/Stellarium/stellarium/master/skycultures/modern_st/constellation_names.eng.fab";

console.log("Fetching Stellarium constellation data...");
const [shipResp, namesResp] = await Promise.all([fetch(STELLARIUM_URL), fetch(NAMES_URL)]);

if (!shipResp.ok) {
  console.error(`Failed to fetch constellationship: ${shipResp.status}`);
  process.exit(1);
}
if (!namesResp.ok) {
  console.error(`Failed to fetch names: ${namesResp.status}`);
  process.exit(1);
}

const shipText = await shipResp.text();
const namesText = await namesResp.text();

// Parse names: lines like 'And	"Andromeda"'
const nameMap = new Map();
for (const line of namesText.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const match = trimmed.match(/^(\S+)\s+"([^"]+)"/);
  if (match) nameMap.set(match[1], match[2]);
}

// Parse constellationship: lines like 'And 3 677 919 919 1067 ...'
// Format: <abbr> <numSegments> <hip1> <hip2> <hip3> <hip4> ...
const constellations = [];
for (const line of shipText.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const parts = trimmed.split(/\s+/);
  if (parts.length < 3) continue;
  const id = parts[0];
  const numSegments = parseInt(parts[1], 10);
  if (isNaN(numSegments) || numSegments <= 0) continue;

  const hipIds = parts.slice(2).map((s) => parseInt(s, 10));
  const lines = [];
  for (let i = 0; i + 1 < hipIds.length; i += 2) {
    const a = hipIds[i];
    const b = hipIds[i + 1];
    if (!isNaN(a) && !isNaN(b) && a > 0 && b > 0) {
      lines.push([a, b]);
    }
  }

  if (lines.length > 0) {
    const name = nameMap.get(id) || id;
    constellations.push({ id, name, lines });
  }
}

constellations.sort((a, b) => a.id.localeCompare(b.id));

mkdirSync("data", { recursive: true });
writeFileSync("data/constellations.json", JSON.stringify(constellations));
console.log(`Wrote ${constellations.length} constellations to data/constellations.json`);
```

- [ ] **Step 2: Run the script**

```bash
node scripts/build-constellations.mjs
```

Expected: `Wrote ~88 constellations to data/constellations.json`. If fetch fails, report BLOCKED.

- [ ] **Step 3: Verify output**

```bash
node -e "const c=JSON.parse(require('fs').readFileSync('data/constellations.json','utf8')); console.log('Count:', c.length, 'First:', c[0].id, c[0].name, 'Lines:', c[0].lines.length)"
```

Expected: ~88 constellations. First should be something like `And Andromeda` with several line segments.

- [ ] **Step 4: Commit**

```bash
git add scripts/build-constellations.mjs data/constellations.json
git commit -m "data: add constellation stick-figure data from Stellarium"
```

---

## Task 2: Constellation parser + visibility filter (TDD)

**Files:**

- Create: `src/astro/constellations.ts`
- Create: `src/astro/constellations.test.ts`

- [ ] **Step 1: Write failing tests**

`src/astro/constellations.test.ts`:

```ts
/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { isErr, isOk, expectOk } from "../result";
import { parseConstellations, filterVisibleConstellations } from "./constellations";
import type { AltAzStar } from "./visibility";

const VALID_DATA = [
  {
    id: "Ori",
    name: "Orion",
    lines: [
      [27366, 26311],
      [26311, 25336],
      [25336, 25930],
    ],
  },
  {
    id: "UMa",
    name: "Ursa Major",
    lines: [
      [54061, 53910],
      [53910, 58001],
    ],
  },
];

describe("parseConstellations", () => {
  it("parses valid constellation array", () => {
    const r = parseConstellations(VALID_DATA);
    expect(isOk(r)).toBe(true);
    const data = expectOk(r);
    expect(data).toHaveLength(2);
    expect(data[0]!.id).toBe("Ori");
    expect(data[0]!.lines).toHaveLength(3);
  });

  it("returns Err for non-array input", () => {
    const r = parseConstellations("not an array");
    expect(isErr(r)).toBe(true);
  });

  it("returns Err for empty array", () => {
    const r = parseConstellations([]);
    expect(isErr(r)).toBe(true);
  });

  it("skips entries with missing id or name", () => {
    const data = [
      { id: "Ori", name: "Orion", lines: [[1, 2]] },
      { name: "Bad", lines: [[3, 4]] },
    ];
    const result = expectOk(parseConstellations(data));
    expect(result).toHaveLength(1);
  });
});

describe("filterVisibleConstellations", () => {
  const starMap: AltAzStar[] = [
    { hip: 27366, ra: 88.79, dec: 7.41, alt: 45, az: 180, mag: 0.5, size: 14, opacity: 0.95 },
    { hip: 26311, ra: 81.28, dec: 6.35, alt: 30, az: 170, mag: 1.7, size: 10, opacity: 0.8 },
    { hip: 25336, ra: 78.63, dec: -8.2, alt: -5, az: 160, mag: 2.1, size: 9, opacity: 0.75 },
    { hip: 25930, ra: 80.0, dec: -1.0, alt: 20, az: 165, mag: 1.9, size: 9, opacity: 0.78 },
    { hip: 54061, ra: 166.45, dec: 61.75, alt: 60, az: 350, mag: 1.8, size: 10, opacity: 0.8 },
    { hip: 53910, ra: 165.93, dec: 61.45, alt: 58, az: 348, mag: 2.4, size: 8, opacity: 0.7 },
    { hip: 58001, ra: 178.46, dec: 53.69, alt: 55, az: 340, mag: 2.4, size: 8, opacity: 0.7 },
  ];

  const constellations = expectOk(parseConstellations(VALID_DATA));

  it("includes lines where both stars are visible", () => {
    const result = filterVisibleConstellations(constellations, starMap);
    const uma = result.find((c) => c.id === "UMa");
    expect(uma).toBeDefined();
    expect(uma!.lines).toHaveLength(2);
  });

  it("excludes lines where one star is below horizon", () => {
    const result = filterVisibleConstellations(constellations, starMap);
    const ori = result.find((c) => c.id === "Ori");
    expect(ori).toBeDefined();
    // star 25336 is at alt=-5, so lines involving it are excluded
    // Line [27366,26311] both visible, [26311,25336] one below, [25336,25930] one below
    expect(ori!.lines).toHaveLength(1);
  });

  it("excludes constellations with no visible lines", () => {
    const noStars: AltAzStar[] = [];
    const result = filterVisibleConstellations(constellations, noStars);
    expect(result).toHaveLength(0);
  });

  it("computes centroid from visible endpoints", () => {
    const result = filterVisibleConstellations(constellations, starMap);
    const uma = result.find((c) => c.id === "UMa");
    expect(uma).toBeDefined();
    expect(uma!.centroid.alt).toBeGreaterThan(0);
    expect(uma!.centroid.az).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm vitest run src/astro/constellations.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `constellations.ts`**

`src/astro/constellations.ts`:

```ts
/* SPDX-License-Identifier: Apache-2.0 */
import { err, ok, type Result } from "../result";
import type { AltAzStar } from "./visibility";

export type ConstellationRecord = {
  readonly id: string;
  readonly name: string;
  readonly lines: readonly (readonly [number, number])[];
};

export type ConstellationLoadError = { kind: "constellation-load-failed"; message: string };

export type VisibleLine = {
  readonly start: { readonly alt: number; readonly az: number };
  readonly end: { readonly alt: number; readonly az: number };
};

export type VisibleConstellation = {
  readonly id: string;
  readonly name: string;
  readonly lines: readonly VisibleLine[];
  readonly centroid: { readonly alt: number; readonly az: number };
};

export function parseConstellations(
  raw: unknown,
): Result<ConstellationRecord[], ConstellationLoadError> {
  if (!Array.isArray(raw)) {
    return err({
      kind: "constellation-load-failed",
      message: "Constellation data is not an array",
    });
  }
  if (raw.length === 0) {
    return err({ kind: "constellation-load-failed", message: "Constellation data is empty" });
  }

  const result: ConstellationRecord[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== "string" || typeof e.name !== "string") continue;
    if (!Array.isArray(e.lines)) continue;

    const lines: [number, number][] = [];
    for (const pair of e.lines) {
      if (Array.isArray(pair) && pair.length >= 2) {
        const a = Number(pair[0]);
        const b = Number(pair[1]);
        if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) {
          lines.push([a, b]);
        }
      }
    }
    if (lines.length > 0) {
      result.push({ id: e.id, name: e.name, lines });
    }
  }

  if (result.length === 0) {
    return err({
      kind: "constellation-load-failed",
      message: "No valid constellations after parsing",
    });
  }
  return ok(result);
}

export function filterVisibleConstellations(
  constellations: ConstellationRecord[],
  visibleStars: AltAzStar[],
): VisibleConstellation[] {
  const starMap = new Map<number, AltAzStar>();
  for (const star of visibleStars) {
    starMap.set(star.hip, star);
  }

  const result: VisibleConstellation[] = [];
  for (const constellation of constellations) {
    const visibleLines: VisibleLine[] = [];
    let altSum = 0;
    let azSum = 0;
    let pointCount = 0;

    for (const [hipA, hipB] of constellation.lines) {
      const starA = starMap.get(hipA);
      const starB = starMap.get(hipB);
      if (starA && starB) {
        visibleLines.push({
          start: { alt: starA.alt, az: starA.az },
          end: { alt: starB.alt, az: starB.az },
        });
        altSum += starA.alt + starB.alt;
        azSum += starA.az + starB.az;
        pointCount += 2;
      }
    }

    if (visibleLines.length > 0 && pointCount > 0) {
      result.push({
        id: constellation.id,
        name: constellation.name,
        lines: visibleLines,
        centroid: { alt: altSum / pointCount, az: azSum / pointCount },
      });
    }
  }

  return result;
}
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm vitest run src/astro/constellations.test.ts`
Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/astro/constellations.ts src/astro/constellations.test.ts
git commit -m "feat(astro): add parseConstellations and filterVisibleConstellations"
```

---

## Task 3: Astro barrel export update

**Files:**

- Modify: `src/astro/index.ts`

- [ ] **Step 1: Update barrel**

Add to `src/astro/index.ts`:

```ts
export {
  type ConstellationRecord,
  type ConstellationLoadError,
  type VisibleLine,
  type VisibleConstellation,
  parseConstellations,
  filterVisibleConstellations,
} from "./constellations";
```

- [ ] **Step 2: Run checks**

```bash
pnpm typecheck
pnpm lint
pnpm vitest run src/astro/
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/astro/index.ts
git commit -m "feat(astro): export constellation types and functions"
```

---

## Task 4: Constellation scene layer

**Files:**

- Create: `src/scene/constellations.ts`
- Create: `src/scene/constellations.test.ts`

- [ ] **Step 1: Write failing tests**

`src/scene/constellations.test.ts`:

```ts
/* SPDX-License-Identifier: Apache-2.0 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createConstellationLayer } from "./constellations";
import type { VisibleConstellation } from "../astro";

const mockPolylineAdd = vi.fn();
const mockPolylineRemoveAll = vi.fn();
const mockLabelAdd = vi.fn();
const mockLabelRemoveAll = vi.fn();

vi.mock("cesium", () => {
  const MockCartesian3 = vi.fn().mockImplementation((x: number, y: number, z: number) => ({
    x,
    y,
    z,
  }));
  (MockCartesian3 as unknown as { fromDegrees: ReturnType<typeof vi.fn> }).fromDegrees = vi
    .fn()
    .mockReturnValue({ x: 1, y: 2, z: 3 });

  return {
    PolylineCollection: vi.fn().mockImplementation(() => ({
      add: mockPolylineAdd,
      removeAll: mockPolylineRemoveAll,
    })),
    LabelCollection: vi.fn().mockImplementation(() => ({
      add: mockLabelAdd,
      removeAll: mockLabelRemoveAll,
    })),
    Cartesian3: MockCartesian3,
    Color: {
      WHITE: { withAlpha: (a: number) => ({ alpha: a }) },
    },
    HorizontalOrigin: { CENTER: 0 },
    VerticalOrigin: { CENTER: 0 },
    LabelStyle: { FILL: 0 },
    Math: { toRadians: (d: number) => (d * Math.PI) / 180 },
    Transforms: {
      eastNorthUpToFixedFrame: vi
        .fn()
        .mockReturnValue([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    },
    Matrix4: {
      multiplyByPoint: vi.fn().mockReturnValue({ x: 10, y: 20, z: 30 }),
    },
    Material: {
      fromType: vi.fn().mockReturnValue({}),
    },
  };
});

function makeMockScene() {
  return { primitives: { add: vi.fn() } };
}

const CONSTELLATIONS: VisibleConstellation[] = [
  {
    id: "Ori",
    name: "Orion",
    lines: [
      { start: { alt: 45, az: 180 }, end: { alt: 30, az: 170 } },
      { start: { alt: 30, az: 170 }, end: { alt: 20, az: 165 } },
    ],
    centroid: { alt: 31.7, az: 171.7 },
  },
  {
    id: "UMa",
    name: "Ursa Major",
    lines: [{ start: { alt: 60, az: 350 }, end: { alt: 58, az: 348 } }],
    centroid: { alt: 59, az: 349 },
  },
];

beforeEach(() => {
  mockPolylineAdd.mockClear();
  mockPolylineRemoveAll.mockClear();
  mockLabelAdd.mockClear();
  mockLabelRemoveAll.mockClear();
});

describe("createConstellationLayer", () => {
  it("returns an object with an update method", () => {
    const layer = createConstellationLayer(makeMockScene() as never);
    expect(layer).toHaveProperty("update");
  });

  it("registers collections with scene.primitives", () => {
    const scene = makeMockScene();
    createConstellationLayer(scene as never);
    expect(scene.primitives.add).toHaveBeenCalledTimes(2);
  });
});

describe("ConstellationLayer.update", () => {
  it("adds a polyline for each visible line segment", () => {
    const layer = createConstellationLayer(makeMockScene() as never);
    layer.update(CONSTELLATIONS, 33, -117);
    expect(mockPolylineRemoveAll).toHaveBeenCalledOnce();
    expect(mockPolylineAdd).toHaveBeenCalledTimes(3);
  });

  it("adds a label for each visible constellation", () => {
    const layer = createConstellationLayer(makeMockScene() as never);
    layer.update(CONSTELLATIONS, 33, -117);
    expect(mockLabelRemoveAll).toHaveBeenCalledOnce();
    expect(mockLabelAdd).toHaveBeenCalledTimes(2);
  });

  it("works with empty input", () => {
    const layer = createConstellationLayer(makeMockScene() as never);
    layer.update([], 0, 0);
    expect(mockPolylineRemoveAll).toHaveBeenCalledOnce();
    expect(mockLabelRemoveAll).toHaveBeenCalledOnce();
    expect(mockPolylineAdd).not.toHaveBeenCalled();
    expect(mockLabelAdd).not.toHaveBeenCalled();
  });

  it("clears previous primitives before adding", () => {
    const layer = createConstellationLayer(makeMockScene() as never);
    layer.update(CONSTELLATIONS, 33, -117);
    mockPolylineAdd.mockClear();
    mockLabelAdd.mockClear();
    mockPolylineRemoveAll.mockClear();
    mockLabelRemoveAll.mockClear();
    layer.update(CONSTELLATIONS.slice(0, 1), 33, -117);
    expect(mockPolylineRemoveAll).toHaveBeenCalledOnce();
    expect(mockLabelRemoveAll).toHaveBeenCalledOnce();
    expect(mockPolylineAdd).toHaveBeenCalledTimes(2);
    expect(mockLabelAdd).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm vitest run src/scene/constellations.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `constellations.ts`**

`src/scene/constellations.ts`:

```ts
/* SPDX-License-Identifier: Apache-2.0 */
import {
  PolylineCollection,
  LabelCollection,
  Color,
  HorizontalOrigin,
  VerticalOrigin,
  LabelStyle,
  Material,
} from "cesium";
import type { Scene } from "cesium";
import type { VisibleConstellation } from "../astro";
import { altAzToCartesian } from "./stars";

export type ConstellationLayer = {
  update: (constellations: VisibleConstellation[], lat: number, lon: number) => void;
};

export function createConstellationLayer(scene: Scene): ConstellationLayer {
  const polylines = new PolylineCollection();
  const labels = new LabelCollection({ scene });
  scene.primitives.add(polylines);
  scene.primitives.add(labels);

  function update(constellations: VisibleConstellation[], lat: number, lon: number): void {
    polylines.removeAll();
    labels.removeAll();

    for (const constellation of constellations) {
      for (const line of constellation.lines) {
        const startPos = altAzToCartesian(line.start.alt, line.start.az, lat, lon);
        const endPos = altAzToCartesian(line.end.alt, line.end.az, lat, lon);
        polylines.add({
          positions: [startPos, endPos],
          width: 1,
          material: Material.fromType("Color", {
            color: Color.WHITE.withAlpha(0.25),
          }),
        });
      }

      const centroidPos = altAzToCartesian(
        constellation.centroid.alt,
        constellation.centroid.az,
        lat,
        lon,
      );
      labels.add({
        position: centroidPos,
        text: constellation.name,
        font: "12px sans-serif",
        fillColor: Color.WHITE.withAlpha(0.6),
        style: LabelStyle.FILL,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });
    }
  }

  return { update };
}
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm vitest run src/scene/constellations.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/scene/constellations.ts src/scene/constellations.test.ts
git commit -m "feat(scene): add ConstellationLayer with lines + labels"
```

---

## Task 5: Barrel exports + NOTICE update

**Files:**

- Modify: `src/scene/index.ts`
- Modify: `NOTICE`

- [ ] **Step 1: Update scene barrel**

Add to `src/scene/index.ts`:

```ts
export { type ConstellationLayer, createConstellationLayer } from "./constellations";
```

- [ ] **Step 2: Update NOTICE**

Add after the Hipparcos attribution:

```
Constellation stick-figure data derived from Stellarium
(https://github.com/Stellarium/stellarium).
Stellarium is licensed under GPL-2.0; the constellation line data
(skycultures/modern_st/) is in the public domain.
```

- [ ] **Step 3: Run checks**

```bash
pnpm typecheck
pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add src/scene/index.ts NOTICE
git commit -m "feat(scene): export ConstellationLayer; update NOTICE"
```

---

## Task 6: Wire into app.ts

**Files:**

- Modify: `src/app.ts`
- Modify: `src/app.test.ts`

- [ ] **Step 1: Update `app.ts`**

Add imports and wiring. After the body layer block, add:

```ts
import { parseConstellations, filterVisibleConstellations } from "./astro";
import { createConstellationLayer } from "./scene";
import rawConstellations from "../data/constellations.json";
```

After `bodyLayer.update(...)`:

```ts
const constellationResult = parseConstellations(rawConstellations);
if (constellationResult.ok) {
  const visibleConstellations = filterVisibleConstellations(
    constellationResult.value,
    visibleStars,
  );
  const constellationLayer = createConstellationLayer(viewer.scene);
  constellationLayer.update(visibleConstellations, observer.lat, observer.lon);
}
```

Note: constellation load failure is non-fatal — stars and bodies still render. Log the error but don't show it in the UI error div.

- [ ] **Step 2: Update app.test.ts mock**

Add to the cesium mock:

```ts
  PolylineCollection: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    removeAll: vi.fn(),
  })),
  LabelCollection: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    removeAll: vi.fn(),
  })),
  LabelStyle: { FILL: 0 },
  Material: { fromType: vi.fn().mockReturnValue({}) },
```

Add a constellation data mock:

```ts
vi.mock("../data/constellations.json", () => ({
  default: [{ id: "Ori", name: "Orion", lines: [[27366, 26311]] }],
}));
```

- [ ] **Step 3: Run full gate**

```bash
pnpm typecheck
pnpm format:check
pnpm lint
pnpm test:cov
pnpm build
```

All must pass.

- [ ] **Step 4: Commit**

```bash
git add src/app.ts src/app.test.ts
git commit -m "feat(app): render constellation lines and labels"
```

---

## Task 7: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run dev server**

```bash
pnpm dev
```

Open: `http://localhost:5173/?lat=33&lon=-117&t=2026-01-15T04:00:00Z`

- [ ] **Step 2: Visual checklist**

- [ ] Thin white lines connecting stars in familiar patterns (Orion's belt, Big Dipper, etc.).
- [ ] Constellation names visible as small text labels.
- [ ] Lines stop at the horizon (no lines to below-horizon stars).
- [ ] Stars, bodies, and constellations all render together.
- [ ] Camera rotation works — constellation lines stay attached to stars.
- [ ] Different lat/lon/time params change which constellations are visible.

- [ ] **Step 3: Run full gate**

```bash
pnpm typecheck && pnpm format:check && pnpm lint && pnpm test:cov && pnpm build
```

- [ ] **Step 4: Close issue with verification notes**

---

## Self-review notes

- **Spec coverage:** Data generation (Task 1), parsing + visibility filter (Task 2), barrel export (Task 3), scene layer with lines + labels (Task 4), NOTICE update (Task 5), app wiring (Task 6), visual verification (Task 7). All 11 spec sections covered.
- **Type consistency:** `ConstellationRecord` in Tasks 2, 3, 6. `VisibleConstellation`/`VisibleLine` in Tasks 2, 3, 4, 6. `ConstellationLayer` in Tasks 4, 5, 6. `altAzToCartesian` imported from `./stars` in Task 4 (same as bodies.ts pattern).
- **Placeholder scan:** Clean. All code blocks complete.
