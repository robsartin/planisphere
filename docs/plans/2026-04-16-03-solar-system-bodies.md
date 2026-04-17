# Plan 03 — Solar-System Bodies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the Sun, Moon, and five naked-eye planets at correct Alt/Az positions with custom sprites (Sun glow+corona, Moon phase-aware crescent, planets as colored dots), integrated with the existing hover tooltip.

**Architecture:** `src/astro/moon-phase.ts` wraps Astronomy Engine's `Illumination` for Moon phase data. `src/astro/bodies.ts` computes positions and visual properties for all 7 bodies using existing `raDecToAltAz`. `src/scene/bodies.ts` renders them as a `BillboardCollection` with per-body canvas-generated sprites. Tooltip updated to handle both star and body picks.

**Tech Stack:** Astronomy Engine (existing), CesiumJS BillboardCollection (existing pattern from stars.ts), Canvas 2D API for sprite generation.

---

## File structure created by this plan

```
src/astro/
  moon-phase.ts         getMoonIllumination(): fraction + phaseAngle
  moon-phase.test.ts    TDD: known dates for full/new/quarter moon
  bodies.ts             computeBodyPositions(): CelestialBody[]
  bodies.test.ts        TDD: Sun/Moon/planet position + filtering
  index.ts              (modified) add new exports

src/scene/
  bodies.ts             BodyLayer: BillboardCollection with custom sprites
  bodies.test.ts        Mocked Cesium tests
  tooltip.ts            (modified) add isCelestialBody guard + body formatting
  tooltip.test.ts       (modified) add body tooltip tests
  index.ts              (modified) add BodyLayer export

src/
  app.ts                (modified) compute + render bodies after stars
  app.test.ts           (modified) update mock for body layer
```

---

## Task 1: Moon illumination (TDD)

**Files:**

- Create: `src/astro/moon-phase.ts`
- Create: `src/astro/moon-phase.test.ts`

- [ ] **Step 1: Write failing tests**

`src/astro/moon-phase.test.ts`:

```ts
/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { getMoonIllumination } from "./moon-phase";

describe("getMoonIllumination", () => {
  it("returns near-full illumination on a known full moon date", () => {
    // Full moon: 2026-03-29
    const result = getMoonIllumination(new Date("2026-03-29T12:00:00Z"));
    expect(result.fraction).toBeGreaterThan(0.95);
  });

  it("returns near-zero illumination on a known new moon date", () => {
    // New moon: 2026-04-12
    const result = getMoonIllumination(new Date("2026-04-12T12:00:00Z"));
    expect(result.fraction).toBeLessThan(0.05);
  });

  it("returns approximately half illumination near first quarter", () => {
    // First quarter: ~2026-04-20
    const result = getMoonIllumination(new Date("2026-04-20T12:00:00Z"));
    expect(result.fraction).toBeGreaterThan(0.35);
    expect(result.fraction).toBeLessThan(0.65);
  });

  it("phase angle is between 0 and 360", () => {
    const result = getMoonIllumination(new Date("2026-06-15T00:00:00Z"));
    expect(result.phaseAngle).toBeGreaterThanOrEqual(0);
    expect(result.phaseAngle).toBeLessThanOrEqual(360);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm vitest run src/astro/moon-phase.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `moon-phase.ts`**

`src/astro/moon-phase.ts`:

```ts
/* SPDX-License-Identifier: Apache-2.0 */
import { Body, Illumination, MakeTime } from "astronomy-engine";

export type MoonIllumination = {
  readonly fraction: number;
  readonly phaseAngle: number;
};

export function getMoonIllumination(time: Date): MoonIllumination {
  const astroTime = MakeTime(time);
  const illum = Illumination(Body.Moon, astroTime);
  return {
    fraction: illum.phase_fraction,
    phaseAngle: illum.phase_angle,
  };
}
```

Note: Astronomy Engine's `Illumination` returns an object with `phase_fraction` (0–1) and `phase_angle` (degrees). If the property names differ in the installed version, check with `console.log(Object.keys(Illumination(Body.Moon, MakeTime(new Date()))))` and adjust.

- [ ] **Step 4: Run — expect pass**

Run: `pnpm vitest run src/astro/moon-phase.test.ts`
Expected: 4 tests pass. If the moon dates don't match expected ranges, adjust the test dates — lunar calendars shift slightly. Use Astronomy Engine's `SearchMoonPhase` to find exact dates if needed.

- [ ] **Step 5: Commit**

```bash
git add src/astro/moon-phase.ts src/astro/moon-phase.test.ts
git commit -m "feat(astro): add getMoonIllumination via Astronomy Engine"
```

---

## Task 2: Body positions (TDD)

**Files:**

- Create: `src/astro/bodies.ts`
- Create: `src/astro/bodies.test.ts`

- [ ] **Step 1: Write failing tests**

`src/astro/bodies.test.ts`:

```ts
/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { computeBodyPositions } from "./bodies";
import type { CelestialBody } from "./bodies";

describe("computeBodyPositions", () => {
  it("returns 7 bodies total (some may be below horizon)", () => {
    const all = computeBodyPositions(33, -117, new Date("2026-06-15T12:00:00Z"), false);
    expect(all).toHaveLength(7);
  });

  it("filters to above-horizon when requested", () => {
    const visible = computeBodyPositions(33, -117, new Date("2026-06-15T12:00:00Z"), true);
    for (const body of visible) {
      expect(body.alt).toBeGreaterThan(0);
    }
  });

  it("Sun is above horizon at local noon", () => {
    // Noon UTC for lon=-117 is roughly 19:00 UTC
    const all = computeBodyPositions(33, -117, new Date("2026-06-15T19:00:00Z"), false);
    const sun = all.find((b) => b.id === "Sun");
    expect(sun).toBeDefined();
    expect(sun!.alt).toBeGreaterThan(0);
  });

  it("Sun is below horizon at local midnight", () => {
    // Midnight for lon=-117 is roughly 07:00 UTC
    const all = computeBodyPositions(33, -117, new Date("2026-06-15T07:00:00Z"), false);
    const sun = all.find((b) => b.id === "Sun");
    expect(sun).toBeDefined();
    expect(sun!.alt).toBeLessThan(0);
  });

  it("every body has required fields", () => {
    const all = computeBodyPositions(40, -74, new Date("2026-03-15T22:00:00Z"), false);
    for (const body of all) {
      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("alt");
      expect(body).toHaveProperty("az");
      expect(body).toHaveProperty("ra");
      expect(body).toHaveProperty("dec");
      expect(body).toHaveProperty("mag");
      expect(body).toHaveProperty("size");
      expect(body).toHaveProperty("color");
    }
  });

  it("Moon has illumination and phaseAngle", () => {
    const all = computeBodyPositions(33, -117, new Date("2026-03-29T02:00:00Z"), false);
    const moon = all.find((b) => b.id === "Moon");
    expect(moon).toBeDefined();
    expect(moon!.illumination).toBeDefined();
    expect(moon!.phaseAngle).toBeDefined();
  });

  it("Sun has the largest size", () => {
    const all = computeBodyPositions(33, -117, new Date("2026-06-15T19:00:00Z"), false);
    const sun = all.find((b) => b.id === "Sun")!;
    for (const body of all) {
      expect(sun.size).toBeGreaterThanOrEqual(body.size);
    }
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm vitest run src/astro/bodies.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `bodies.ts`**

`src/astro/bodies.ts`:

```ts
/* SPDX-License-Identifier: Apache-2.0 */
import { Body, Equator, MakeTime, Observer } from "astronomy-engine";
import { raDecToAltAz } from "./coords";
import { getMoonIllumination } from "./moon-phase";

export type CelestialBody = {
  readonly id: string;
  readonly alt: number;
  readonly az: number;
  readonly ra: number;
  readonly dec: number;
  readonly mag: number;
  readonly size: number;
  readonly color: string;
  readonly illumination?: number;
  readonly phaseAngle?: number;
};

type BodyConfig = {
  body: Body;
  id: string;
  color: string;
  size: number;
  mag: number;
};

const BODY_CONFIGS: BodyConfig[] = [
  { body: Body.Sun, id: "Sun", color: "#FDB813", size: 24, mag: -26.74 },
  { body: Body.Moon, id: "Moon", color: "#E8E8E0", size: 20, mag: -12.7 },
  { body: Body.Mercury, id: "Mercury", color: "#B5A7A7", size: 6, mag: 0.0 },
  { body: Body.Venus, id: "Venus", color: "#FFFFCC", size: 10, mag: -4.0 },
  { body: Body.Mars, id: "Mars", color: "#CC4422", size: 8, mag: 1.0 },
  { body: Body.Jupiter, id: "Jupiter", color: "#D4A96A", size: 9, mag: -2.0 },
  { body: Body.Saturn, id: "Saturn", color: "#C8B07A", size: 7, mag: 0.5 },
];

export function computeBodyPositions(
  lat: number,
  lon: number,
  time: Date,
  filterVisible: boolean,
): CelestialBody[] {
  const astroTime = MakeTime(time);
  const observer = new Observer(lat, lon, 0);
  const result: CelestialBody[] = [];

  for (const config of BODY_CONFIGS) {
    const eq = Equator(config.body, astroTime, observer, true, true);
    const raDeg = eq.ra * 15;
    const decDeg = eq.dec;
    const { alt, az } = raDecToAltAz(raDeg, decDeg, lat, lon, time);

    if (filterVisible && alt <= 0) continue;

    const entry: CelestialBody = {
      id: config.id,
      alt,
      az,
      ra: raDeg,
      dec: decDeg,
      mag: config.mag,
      size: config.size,
      color: config.color,
    };

    if (config.id === "Moon") {
      const moonIllum = getMoonIllumination(time);
      const withMoon: CelestialBody = {
        ...entry,
        illumination: moonIllum.fraction,
        phaseAngle: moonIllum.phaseAngle,
      };
      result.push(withMoon);
    } else {
      result.push(entry);
    }
  }

  return result;
}
```

Note: We use fixed approximate magnitudes for simplicity. Astronomy Engine can compute time-varying magnitudes for planets, but the visual size in our billboard is fixed per config — magnitude here is for tooltip display. If the `Equator` function signature differs from the installed version, check: `Equator(body, date, observer, ofdate: boolean, aberration: boolean)`.

- [ ] **Step 4: Run — expect pass**

Run: `pnpm vitest run src/astro/bodies.test.ts`
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/astro/bodies.ts src/astro/bodies.test.ts
git commit -m "feat(astro): add computeBodyPositions for Sun/Moon/planets"
```

---

## Task 3: Astro barrel export update

**Files:**

- Modify: `src/astro/index.ts`

- [ ] **Step 1: Update barrel**

Add to `src/astro/index.ts`:

```ts
export { type MoonIllumination, getMoonIllumination } from "./moon-phase";
export { type CelestialBody, computeBodyPositions } from "./bodies";
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
git commit -m "feat(astro): export moon-phase and bodies modules"
```

---

## Task 4: Body billboard layer with custom sprites

**Files:**

- Create: `src/scene/bodies.ts`
- Create: `src/scene/bodies.test.ts`

- [ ] **Step 1: Write failing tests**

`src/scene/bodies.test.ts`:

```ts
/* SPDX-License-Identifier: Apache-2.0 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createBodyLayer } from "./bodies";
import type { CelestialBody } from "../astro";

const mockGetContext = vi.fn().mockReturnValue(null);
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext =
    mockGetContext as typeof HTMLCanvasElement.prototype.getContext;
});

const mockAdd = vi.fn().mockReturnValue({ show: true });
const mockRemoveAll = vi.fn();

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
    BillboardCollection: vi.fn().mockImplementation(() => ({
      add: mockAdd,
      removeAll: mockRemoveAll,
      length: 0,
    })),
    Cartesian3: MockCartesian3,
    Color: {
      fromCssColorString: vi.fn().mockReturnValue({
        withAlpha: (a: number) => ({ alpha: a }),
      }),
    },
    HorizontalOrigin: { CENTER: 0 },
    VerticalOrigin: { CENTER: 0 },
    Math: { toRadians: (d: number) => (d * Math.PI) / 180 },
    Transforms: {
      eastNorthUpToFixedFrame: vi
        .fn()
        .mockReturnValue([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    },
    Matrix4: {
      multiplyByPoint: vi.fn().mockReturnValue({ x: 10, y: 20, z: 30 }),
    },
  };
});

function makeMockScene() {
  return { primitives: { add: vi.fn() } };
}

const BODIES: CelestialBody[] = [
  { id: "Sun", alt: 45, az: 180, ra: 80, dec: 20, mag: -26.74, size: 24, color: "#FDB813" },
  {
    id: "Moon",
    alt: 60,
    az: 120,
    ra: 100,
    dec: -5,
    mag: -12.7,
    size: 20,
    color: "#E8E8E0",
    illumination: 0.75,
    phaseAngle: 90,
  },
  { id: "Venus", alt: 20, az: 260, ra: 300, dec: -20, mag: -4.0, size: 10, color: "#FFFFCC" },
];

beforeEach(() => {
  mockAdd.mockClear();
  mockRemoveAll.mockClear();
});

describe("createBodyLayer", () => {
  it("returns an object with an update method", () => {
    const layer = createBodyLayer(makeMockScene() as never);
    expect(layer).toHaveProperty("update");
  });

  it("registers a BillboardCollection with scene.primitives", () => {
    const scene = makeMockScene();
    createBodyLayer(scene as never);
    expect(scene.primitives.add).toHaveBeenCalledOnce();
  });
});

describe("BodyLayer.update", () => {
  it("adds a billboard for each body", () => {
    const layer = createBodyLayer(makeMockScene() as never);
    layer.update(BODIES, 33, -117);
    expect(mockRemoveAll).toHaveBeenCalledOnce();
    expect(mockAdd).toHaveBeenCalledTimes(3);
  });

  it("Sun billboard has the largest scale", () => {
    const layer = createBodyLayer(makeMockScene() as never);
    layer.update(BODIES, 33, -117);
    const sunCall = mockAdd.mock.calls[0]![0] as { scale: number };
    const venusCall = mockAdd.mock.calls[2]![0] as { scale: number };
    expect(sunCall.scale).toBeGreaterThan(venusCall.scale);
  });

  it("works with empty body list", () => {
    const layer = createBodyLayer(makeMockScene() as never);
    layer.update([], 0, 0);
    expect(mockRemoveAll).toHaveBeenCalledOnce();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("clears previous billboards before adding new ones", () => {
    const layer = createBodyLayer(makeMockScene() as never);
    layer.update(BODIES, 33, -117);
    mockAdd.mockClear();
    mockRemoveAll.mockClear();
    layer.update(BODIES.slice(0, 1), 33, -117);
    expect(mockRemoveAll).toHaveBeenCalledOnce();
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm vitest run src/scene/bodies.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `bodies.ts`**

`src/scene/bodies.ts`:

```ts
/* SPDX-License-Identifier: Apache-2.0 */
import { BillboardCollection, Color, HorizontalOrigin, VerticalOrigin } from "cesium";
import type { Scene } from "cesium";
import type { CelestialBody } from "../astro";
import { altAzToCartesian } from "./stars";

export type BodyLayer = {
  update: (bodies: CelestialBody[], lat: number, lon: number) => void;
};

function generateSunSprite(): HTMLCanvasElement {
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, "rgba(253, 184, 19, 1)");
  gradient.addColorStop(0.2, "rgba(253, 184, 19, 0.8)");
  gradient.addColorStop(0.5, "rgba(253, 150, 19, 0.3)");
  gradient.addColorStop(1, "rgba(253, 150, 19, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function generateMoonSprite(illumination: number, phaseAngle: number): HTMLCanvasElement {
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const center = size / 2;
  const radius = center - 2;

  ctx.fillStyle = "#E8E8E0";
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgba(0,0,0,1)";
  ctx.beginPath();

  const shadowWidth = radius * (1 - illumination * 2);
  const waxing = phaseAngle < 180;

  ctx.beginPath();
  if (waxing) {
    ctx.ellipse(center, center, Math.abs(shadowWidth), radius, 0, -Math.PI / 2, Math.PI / 2);
    ctx.arc(center, center, radius, Math.PI / 2, -Math.PI / 2, false);
  } else {
    ctx.ellipse(center, center, Math.abs(shadowWidth), radius, 0, Math.PI / 2, -Math.PI / 2);
    ctx.arc(center, center, radius, -Math.PI / 2, Math.PI / 2, false);
  }
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  return canvas;
}

function generatePlanetSprite(color: string): HTMLCanvasElement {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function spriteForBody(body: CelestialBody): HTMLCanvasElement {
  if (body.id === "Sun") return generateSunSprite();
  if (body.id === "Moon") return generateMoonSprite(body.illumination ?? 0.5, body.phaseAngle ?? 0);
  return generatePlanetSprite(body.color);
}

export function createBodyLayer(scene: Scene): BodyLayer {
  const billboards = new BillboardCollection({ scene });
  scene.primitives.add(billboards);

  function update(bodies: CelestialBody[], lat: number, lon: number): void {
    billboards.removeAll();
    for (const body of bodies) {
      billboards.add({
        position: altAzToCartesian(body.alt, body.az, lat, lon),
        image: spriteForBody(body),
        scale: body.size / 16,
        color: Color.fromCssColorString(body.color).withAlpha(1.0),
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        id: body,
      });
    }
  }

  return { update };
}
```

Note: This imports `altAzToCartesian` from `./stars` — that function is already exported. If it's not currently exported, add `export` to its declaration in `stars.ts`.

- [ ] **Step 4: Run — expect pass**

Run: `pnpm vitest run src/scene/bodies.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Verify `altAzToCartesian` is exported from stars.ts**

Check `src/scene/stars.ts` — the function should have `export function altAzToCartesian(...)`. If it's not exported, add `export` before `function`.

- [ ] **Step 6: Commit**

```bash
git add src/scene/bodies.ts src/scene/bodies.test.ts
git commit -m "feat(scene): add BodyLayer with Sun/Moon/planet sprites"
```

---

## Task 5: Update tooltip for body support

**Files:**

- Modify: `src/scene/tooltip.ts`
- Modify: `src/scene/tooltip.test.ts`

- [ ] **Step 1: Write failing test for body tooltip**

Add to `src/scene/tooltip.test.ts` inside the `describe("createTooltip")` block:

```ts
it("shows tooltip with body info when a CelestialBody billboard is picked", () => {
  const container = document.createElement("div");
  const viewer = makeMockViewer();
  createTooltip(viewer as never, container);

  const moveCallback = mockSetInputAction.mock.calls[0]![0] as (movement: {
    endPosition: { x: number; y: number };
  }) => void;

  mockPick.mockReturnValueOnce({
    id: {
      id: "Moon",
      alt: 55.3,
      az: 120.1,
      ra: 100.5,
      dec: -5.2,
      mag: -12.7,
      size: 20,
      color: "#E8E8E0",
      illumination: 0.75,
      phaseAngle: 90,
    },
  });
  moveCallback({ endPosition: { x: 150, y: 250 } });

  const tooltipDiv = container.querySelector("div")!;
  expect(tooltipDiv.style.display).toBe("block");
  expect(tooltipDiv.innerHTML).toContain("Moon");
  expect(tooltipDiv.innerHTML).toContain("-12.7");
  expect(tooltipDiv.innerHTML).toContain("75%");
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm vitest run src/scene/tooltip.test.ts`
Expected: FAIL — Moon not recognized by tooltip (only `isAltAzStar` matches, which requires `hip`).

- [ ] **Step 3: Update `tooltip.ts`**

Replace the `isAltAzStar` check with a dual type guard. Full updated `tooltip.ts`:

```ts
/* SPDX-License-Identifier: Apache-2.0 */
import { ScreenSpaceEventHandler, ScreenSpaceEventType, defined } from "cesium";
import type { Cartesian2, Viewer } from "cesium";
import type { AltAzStar } from "../astro";
import type { CelestialBody } from "../astro";

export type Tooltip = {
  destroy: () => void;
};

function formatRa(raDeg: number): string {
  const hours = raDeg / 15;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h)}h ${String(m)}m`;
}

function formatDec(dec: number): string {
  const sign = dec >= 0 ? "+" : "-";
  const abs = Math.abs(dec);
  const d = Math.floor(abs);
  const m = Math.round((abs - d) * 60);
  return `${sign}${String(d)}\u00B0 ${String(m)}\u2032`;
}

function isAltAzStar(obj: unknown): obj is AltAzStar {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "hip" in obj &&
    "alt" in obj &&
    "az" in obj &&
    "mag" in obj
  );
}

function isCelestialBody(obj: unknown): obj is CelestialBody {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    typeof (obj as Record<string, unknown>).id === "string" &&
    "alt" in obj &&
    "az" in obj &&
    "mag" in obj
  );
}

function formatStar(star: AltAzStar): string {
  const label = star.name ?? `HIP ${String(star.hip)}`;
  return (
    `<strong>${label}</strong><br>` +
    `mag ${star.mag.toFixed(2)}<br>` +
    `Alt ${star.alt.toFixed(1)}\u00B0 Az ${star.az.toFixed(1)}\u00B0<br>` +
    `RA ${formatRa(star.ra)} Dec ${formatDec(star.dec)}`
  );
}

function formatBody(body: CelestialBody): string {
  let html =
    `<strong>${body.id}</strong><br>` +
    `mag ${body.mag.toFixed(2)}<br>` +
    `Alt ${body.alt.toFixed(1)}\u00B0 Az ${body.az.toFixed(1)}\u00B0<br>` +
    `RA ${formatRa(body.ra)} Dec ${formatDec(body.dec)}`;
  if (body.illumination !== undefined) {
    html += `<br>${Math.round(body.illumination * 100)}% illuminated`;
  }
  return html;
}

export function createTooltip(viewer: Viewer, container: HTMLElement): Tooltip {
  const el = document.createElement("div");
  el.style.cssText =
    "position:absolute;pointer-events:none;display:none;background:rgba(0,0,0,0.85);" +
    "color:#fff;font:12px/1.4 monospace;padding:6px 10px;border-radius:4px;" +
    "border:1px solid rgba(255,255,255,0.2);white-space:nowrap;z-index:10";
  container.appendChild(el);

  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

  handler.setInputAction((movement: { endPosition: Cartesian2 }) => {
    const picked: { id?: unknown } | undefined = viewer.scene.pick(movement.endPosition) as
      | { id?: unknown }
      | undefined;

    let html: string | null = null;
    if (defined(picked) && picked !== undefined) {
      if (isAltAzStar(picked.id)) {
        html = formatStar(picked.id);
      } else if (isCelestialBody(picked.id)) {
        html = formatBody(picked.id);
      }
    }

    if (html !== null) {
      el.innerHTML = html;
      el.style.display = "block";
      el.style.left = `${String(movement.endPosition.x + 14)}px`;
      el.style.top = `${String(movement.endPosition.y + 14)}px`;
    } else {
      el.style.display = "none";
    }
  }, ScreenSpaceEventType.MOUSE_MOVE);

  function destroy(): void {
    handler.destroy();
    el.remove();
  }

  return { destroy };
}
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm vitest run src/scene/tooltip.test.ts`
Expected: all tests pass (existing 5 + new 1 = 6).

- [ ] **Step 5: Commit**

```bash
git add src/scene/tooltip.ts src/scene/tooltip.test.ts
git commit -m "feat(scene): update tooltip to support CelestialBody with illumination"
```

---

## Task 6: Scene barrel export update

**Files:**

- Modify: `src/scene/index.ts`

- [ ] **Step 1: Update barrel**

Add to `src/scene/index.ts`:

```ts
export { type BodyLayer, createBodyLayer } from "./bodies";
```

- [ ] **Step 2: Run checks**

```bash
pnpm typecheck
pnpm lint
```

Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add src/scene/index.ts
git commit -m "feat(scene): export BodyLayer"
```

---

## Task 7: Wire into app.ts

**Files:**

- Modify: `src/app.ts`
- Modify: `src/app.test.ts`

- [ ] **Step 1: Update `src/app.ts`**

Add body computation and rendering after the star layer. Updated `src/app.ts`:

```ts
/* SPDX-License-Identifier: Apache-2.0 */
import { parseStateFromSearchParams } from "./state";
import { parseCatalog, filterVisibleStars, computeBodyPositions } from "./astro";
import { createViewer, initCamera, createStarLayer, createBodyLayer, createTooltip } from "./scene";
import rawStars from "../data/stars.json";

export function bootstrap(
  root: HTMLElement | null,
  params: URLSearchParams = new URLSearchParams(globalThis.location?.search ?? ""),
): void {
  if (!root) return;

  const errorDiv = root.querySelector<HTMLElement>("#error");

  const stateResult = parseStateFromSearchParams(params);
  if (!stateResult.ok) {
    showError(errorDiv, `State error: ${stateResult.error.kind}`);
    return;
  }
  const { observer, timeUtc } = stateResult.value;

  const catalogResult = parseCatalog(rawStars);
  if (!catalogResult.ok) {
    showError(errorDiv, `Catalog error: ${catalogResult.error.message}`);
    return;
  }

  const viewerResult = createViewer("cesium-container");
  if (!viewerResult.ok) {
    showError(errorDiv, `Scene error: ${viewerResult.error.message}`);
    return;
  }
  const viewer = viewerResult.value;

  initCamera(viewer.camera, observer.lat, observer.lon);

  const visibleStars = filterVisibleStars(catalogResult.value, observer.lat, observer.lon, timeUtc);
  const starLayer = createStarLayer(viewer.scene);
  starLayer.update(visibleStars, observer.lat, observer.lon);

  const bodies = computeBodyPositions(observer.lat, observer.lon, timeUtc, true);
  const bodyLayer = createBodyLayer(viewer.scene);
  bodyLayer.update(bodies, observer.lat, observer.lon);

  const cesiumContainer = document.getElementById("cesium-container");
  if (cesiumContainer) {
    createTooltip(viewer, cesiumContainer);
  }
}

function showError(el: HTMLElement | null, message: string): void {
  if (!el) return;
  el.textContent = message;
  el.style.display = "block";
}
```

- [ ] **Step 2: Update `src/app.test.ts`**

The existing Cesium mock in `app.test.ts` already has `BillboardCollection`, `Cartesian3`, `Transforms`, `Matrix4`, etc. No changes needed to the mock unless imports fail. Run the tests to verify.

- [ ] **Step 3: Run full gate**

```bash
pnpm typecheck
pnpm format:check
pnpm lint
pnpm test:cov
pnpm build
```

All must pass. If coverage drops below thresholds on `app.ts`, add a test that exercises the body-rendering path.

- [ ] **Step 4: Commit**

```bash
git add src/app.ts src/app.test.ts
git commit -m "feat(app): render solar-system bodies alongside stars"
```

---

## Task 8: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run dev server**

```bash
pnpm dev
```

Open: `http://localhost:5173/?lat=33&lon=-117&t=2026-06-15T19:00:00Z` (daytime — Sun visible)

- [ ] **Step 2: Visual checklist**

- [ ] Sun visible as a yellow glow (if above horizon at this time).
- [ ] Change to nighttime: `?lat=33&lon=-117&t=2026-06-15T04:00:00Z`. Sun gone, Moon + planets may be visible.
- [ ] Moon shows a crescent shape (not a full circle).
- [ ] Planets appear as colored dots, smaller than Sun/Moon.
- [ ] Hover over any body — tooltip shows name, magnitude, Alt/Az, RA/Dec.
- [ ] Hover over Moon — tooltip shows illumination percentage.
- [ ] Stars still render correctly alongside bodies.

- [ ] **Step 3: Run full gate**

```bash
pnpm typecheck && pnpm format:check && pnpm lint && pnpm test:cov && pnpm build
```

- [ ] **Step 4: Close issue with verification notes**

---

## Self-review notes

- **Spec coverage:** Moon illumination (Task 1), body positions (Task 2), barrel export (Task 3), body billboard rendering with custom sprites (Task 4), tooltip update for bodies (Task 5), scene barrel (Task 6), app wiring (Task 7), visual verification (Task 8). All 11 spec sections covered.
- **Type consistency:** `CelestialBody` used consistently across Tasks 2, 4, 5, 7. `MoonIllumination` in Tasks 1, 2. `BodyLayer` in Tasks 4, 6, 7. `altAzToCartesian` imported from `./stars` in Task 4.
- **Placeholder scan:** Task 2 Step 3 notes that fixed magnitudes are used — this is a deliberate simplification documented in the note, not a placeholder. Moon sprite math in Task 4 is complete (crescent rendering via ellipse + arc).
