# Plan 03 — Solar-System Bodies Design Spec

**Date:** 2026-04-16
**Status:** Approved
**Depends on:** Plan 02 (Astro Core) — complete

## 1. Purpose

Render the Sun, Moon, and five naked-eye planets (Mercury, Venus, Mars, Jupiter, Saturn) at correct positions on the sky dome. The Sun has a yellow glow+corona sprite. The Moon has a phase-aware crescent sprite that updates with the current illumination. Planets are colored dots sized by brightness. All bodies show identity and position on hover via the existing tooltip.

## 2. Scope

### In scope

- Astronomy Engine ephemeris wrappers for 7 solar-system bodies.
- Moon illumination fraction and phase angle computation.
- Alt/Az positioning using the existing `raDecToAltAz` pipeline.
- Billboard rendering with custom sprites: Sun (yellow glow + soft corona), Moon (phase-aware crescent via canvas), planets (colored circles).
- Integration with existing tooltip (hover shows body name, magnitude, Alt/Az, RA/Dec).
- Bodies below the horizon are excluded (same as stars).

### Out of scope (later plans)

- Constellation lines and labels (Plan 04).
- Satellite overlays (Plan 05).
- UI controls for toggling body visibility (Plan 06).
- Moon libration, planetary ring rendering, eclipse prediction.
- Rise/set time calculations or almanac features.

## 3. Dependencies

No new dependencies. Astronomy Engine (already installed) provides all required ephemeris functions: `Equator`, `Horizon`, `Illumination`, and the `Body` enum.

## 4. Module structure

### New files

```
src/astro/
  bodies.ts           computeBodyPositions(): CelestialBody[] for 7 bodies
  bodies.test.ts      TDD: known-answer tests for Sun/Moon/planet positions
  moon-phase.ts       getMoonIllumination(): fraction + phase angle
  moon-phase.test.ts  TDD: full/new moon on known dates

src/scene/
  bodies.ts           BodyLayer: BillboardCollection for solar-system bodies
  bodies.test.ts      Mocked Cesium tests
```

### Modified files

```
src/astro/index.ts    Export new types and functions
src/scene/index.ts    Export BodyLayer
src/app.ts            Compute body positions, create body layer
src/app.test.ts       Updated Cesium mock for body layer
```

## 5. Key types

### CelestialBody (computed per frame, ephemeral)

```ts
type CelestialBody = {
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
```

### MoonIllumination

```ts
type MoonIllumination = {
  readonly fraction: number;
  readonly phaseAngle: number;
};
```

## 6. Body visual properties

| Body    | Color   | Base size (px) | Notes                            |
| ------- | ------- | -------------- | -------------------------------- |
| Sun     | #FDB813 | 24             | Yellow glow + soft corona sprite |
| Moon    | #E8E8E0 | 20             | Phase-aware crescent; size fixed |
| Mercury | #B5A7A7 | 6              | Faint, grey                      |
| Venus   | #FFFFCC | 10             | Brightest planet, pale yellow    |
| Mars    | #CC4422 | 8              | Reddish                          |
| Jupiter | #D4A96A | 9              | Cream/tan                        |
| Saturn  | #C8B07A | 7              | Pale gold                        |

## 7. Data flow

1. `state/` provides `{ observer, timeUtc }` (unchanged).
2. `astro/bodies.ts` calls Astronomy Engine's `Equator` for each body to get RA/Dec, then `raDecToAltAz` for Alt/Az. Computes apparent magnitude. For Moon, also calls `getMoonIllumination`.
3. Filters to bodies above the horizon (`alt > 0`).
4. `scene/bodies.ts` receives `CelestialBody[]` and renders billboards with per-body custom sprites.
5. Existing tooltip picks bodies the same way it picks stars (billboard `id` carries metadata). The `isAltAzStar` type guard needs broadening or a parallel `isCelestialBody` guard.

## 8. Sprite generation

### Sun sprite

Canvas-based: inner bright yellow circle (#FDB813) with a radial gradient fading to transparent. Outer soft corona halo extending to the canvas edge. Size: 48x48 canvas, rendered at the body's `size` via billboard scale.

### Moon crescent sprite

Canvas-based:

1. Draw a full circle in moon color (#E8E8E0).
2. Compute shadow arc from the illumination fraction and phase angle.
3. Overlay a dark (#000) arc covering the unilluminated portion. The shadow boundary is an ellipse whose semi-minor axis is `cos(phase_angle) * radius`, producing a realistic crescent shape.
4. The crescent orientation (which side is lit) is determined by the phase angle sign: waxing = right side lit (northern hemisphere convention).

`Astronomy.Illumination("Moon", time)` provides `phase_fraction` (0–1) and the position angle. Size: 48x48 canvas.

### Planet sprites

Canvas-based: filled circle in the body's color with a soft radial gradient edge. Size: 32x32 canvas, rendered at varied scales via `size / 16`.

## 9. Tooltip integration

The existing `tooltip.ts` uses `isAltAzStar` to type-guard picked billboard IDs. For bodies, the billboard `id` will be a `CelestialBody` object. The tooltip needs to handle both types:

- Add an `isCelestialBody` type guard.
- Update the tooltip's pick handler to check for either type and format accordingly.
- Bodies show: name, magnitude, Alt/Az, RA/Dec. Moon additionally shows illumination percentage.

## 10. Testing strategy

### `src/astro/bodies.ts` — TDD, ≥ 90% coverage

Known-answer tests:

- Sun below horizon at midnight UTC for a mid-latitude observer, above at noon.
- Moon position against a known date (e.g., full moon on 2026-04-14).
- Venus visible as "evening star" after sunset on a known date.
- All 7 bodies returned with required fields.
- Bodies below horizon excluded from output.

### `src/astro/moon-phase.ts` — TDD, ≥ 90% coverage

- Full moon date (e.g., 2026-04-14) → illumination ≈ 1.0.
- New moon date (e.g., 2026-04-28) → illumination ≈ 0.0.
- First quarter → illumination ≈ 0.5.
- Phase angle within expected range.

### `src/scene/bodies.ts` — mocked Cesium, ≥ 80% coverage

- 7 bodies in → 7 billboards created (when all above horizon).
- Sun billboard is largest (scale check).
- Moon billboard has custom sprite (canvas check).
- Empty input → no billboards.
- Update clears previous billboards.

## 11. Error handling

No new error types. Astronomy Engine body calculations are infallible for valid observer/time inputs (already validated by `state/`). If any body computation throws unexpectedly (programmer error), it propagates as an unhandled exception — same policy as the rest of the codebase.
