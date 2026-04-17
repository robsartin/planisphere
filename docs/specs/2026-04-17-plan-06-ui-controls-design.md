# Plan 06 — UI Controls Design Spec

**Date:** 2026-04-17
**Status:** Approved
**Depends on:** Plans 01–05 — all complete

## 1. Purpose

Add a collapsible floating control panel with time controls, location input, layer toggles (on/off for stars, planets, satellites, constellation lines, constellation boundaries, compass), and opacity sliders for drawn-line layers. Also add constellation boundary data as a new toggleable layer.

## 2. Scope

### In scope

- Collapsible floating panel (top-right, semi-transparent dark overlay, gear icon to toggle).
- Time controls: date/time input, step buttons (±1min, ±1hr, ±1day), "Now" button.
- Location controls: lat/lon inputs, preset cities dropdown.
- Layer toggles (on/off): Stars, Planets, Satellites, Constellation Lines, Constellation Boundaries, Compass.
- Opacity sliders (0–100%) for: Constellation Lines, Constellation Boundaries, Satellite Trails.
- Constellation boundary data: IAU boundary polygons as faint polylines, toggleable and dimmable.
- Build script to generate `data/boundaries.json` from public IAU boundary data.
- State changes update the sky view immediately.
- Layer state persisted in URL where practical.
- Vanilla HTML/CSS/TypeScript — no UI framework.

### Out of scope

- Light/dark theme toggle (deferred).
- Animation / continuous time playback.
- Multiple TLE group selection.
- Keyboard shortcuts.
- Mobile-responsive layout.
- i18n / localization.

## 3. Dependencies

No new npm dependencies. Vanilla DOM API for all UI elements.

## 4. Module structure

### New files

```
data/
  boundaries.json                       IAU constellation boundary polygons

scripts/
  build-boundaries.mjs                  One-time boundary data generator

src/astro/
  boundaries.ts                         parseBoundaries(), filterVisibleBoundaries()
  boundaries.test.ts                    TDD tests

src/scene/
  boundaries.ts                         BoundaryLayer: PolylineCollection
  boundaries.test.ts                    Mocked Cesium tests

src/ui/
  panel.ts                              Floating panel container + collapse toggle
  panel.test.ts
  time-controls.ts                      Date/time input + step buttons + Now
  time-controls.test.ts
  location-controls.ts                  Lat/lon inputs + preset cities
  location-controls.test.ts
  layer-controls.ts                     Toggle switches + opacity sliders
  layer-controls.test.ts
  styles.ts                             CSS-in-JS styles for the panel
  index.ts                              Barrel export
```

### Modified files

```
src/state/state.ts                      Add LayerVisibility + LayerOpacity to AppState
src/state/state.test.ts                 Extended tests
src/astro/index.ts                      Export boundary types and functions
src/scene/index.ts                      Export BoundaryLayer
src/app.ts                              Wire UI panel, handle state changes, re-render
src/app.test.ts                         Updated tests
index.html                              Add panel container div
NOTICE                                  Add boundary data attribution
```

## 5. Key types

### LayerVisibility

```ts
type LayerVisibility = {
  readonly stars: boolean;
  readonly planets: boolean;
  readonly satellites: boolean;
  readonly constellationLines: boolean;
  readonly constellationBoundaries: boolean;
  readonly compass: boolean;
};
```

### LayerOpacity

```ts
type LayerOpacity = {
  readonly constellationLines: number; // 0–1
  readonly constellationBoundaries: number; // 0–1
  readonly satelliteTrails: number; // 0–1
};
```

### Extended AppState

```ts
type AppState = {
  readonly observer: Observer;
  readonly timeUtc: Date;
  readonly layers: LayerVisibility;
  readonly opacity: LayerOpacity;
};
```

Defaults: all layers visible (`true`), all opacities `1.0`.

### BoundaryRecord

```ts
type BoundaryRecord = {
  readonly id: string; // IAU abbreviation
  readonly vertices: readonly { readonly ra: number; readonly dec: number }[];
};
```

### UI Intent (dispatched by controls)

```ts
type UIIntent =
  | { type: "set-time"; time: Date }
  | { type: "set-observer"; lat: number; lon: number }
  | { type: "toggle-layer"; layer: keyof LayerVisibility }
  | { type: "set-opacity"; layer: keyof LayerOpacity; value: number };
```

## 6. Control panel layout

### Container

- Position: fixed, top-right corner, 16px margin.
- Background: rgba(0, 0, 0, 0.85), border-radius 8px, 1px border rgba(255,255,255,0.2).
- Width: 280px. Max-height: 80vh with overflow-y auto.
- Collapsed: only the gear icon visible (32x32).

### Sections (top to bottom)

1. **Header** — "Planisphere" title + collapse button (gear icon or ×).
2. **Time** — `<input type="datetime-local">` pre-filled from state. Step buttons: ‹‹ (−1d), ‹ (−1h), minute−, minute+, › (+1h), ›› (+1d). "Now" button sets to current system time.
3. **Location** — Lat/Lon number inputs (step 0.01). Preset dropdown: select a city → populates lat/lon. Preset list: New York, London, Tokyo, Sydney, São Paulo, Cape Town, Los Angeles, Mumbai.
4. **Layers** — For each layer: label + toggle switch (checkbox styled as toggle). Grouped:
   - Stars ☆
   - Planets ☾
   - Satellites 🛰
   - Constellation Lines ╱
   - Constellation Boundaries ⬡
   - Compass ◎
5. **Opacity** — For each dimmable layer: label + range slider (0–100%). Only shown when the parent layer toggle is on.
   - Constellation Lines opacity
   - Constellation Boundaries opacity
   - Satellite Trails opacity

### Visual style

All text: white, 12-13px, sans-serif. Toggle switches: styled checkboxes with green (#00FF88) active state. Sliders: thin track, white thumb. Buttons: small, dark bg with light border, hover highlight. Consistent 8px padding/gaps.

## 7. State flow

1. User interacts with a control → UI creates a `UIIntent`.
2. `app.ts` receives the intent via a callback.
3. For time/location changes: update `AppState`, recompute all positions (stars, bodies, constellations, satellites), re-render all visible layers.
4. For layer toggles: show/hide the corresponding Cesium primitive (billboard collection, polyline collection, label collection). No recomputation needed.
5. For opacity changes: update the material alpha on the affected polylines. No recomputation needed.
6. URL updated to reflect current state.

### URL persistence

Extend URL params:

- `t` — time (existing)
- `lat`, `lon` — location (existing)
- `layers` — comma-separated list of visible layer keys (e.g., `layers=stars,planets,compass`). Absent = all visible.
- `op_cl`, `op_cb`, `op_st` — opacity values 0–100 for constellation lines, boundaries, satellite trails. Absent = 100.

## 8. Boundary data

### Source

IAU constellation boundary data from the Catalogue of Constellation Boundary Data (Davenhall & Leggett, 1989). Available from CDS VizieR or various public repositories. Format: RA/Dec vertex lists for each constellation polygon.

### Generation

`scripts/build-boundaries.mjs` fetches the boundary data, parses it into `BoundaryRecord[]`, outputs `data/boundaries.json`. ~88 polygons, ~1500 vertices total, ~50KB.

### Rendering

- Polylines connecting boundary vertices, same pattern as constellation lines.
- Color: white, alpha 0.15 (fainter than stick-figure lines at 0.25).
- Width: 1px.
- Rendered via `PolylineCollection` in `src/scene/boundaries.ts`.
- Filtered to visible sky (same horizon filtering as constellations).

## 9. Layer show/hide mechanics

Each scene layer (StarLayer, BodyLayer, ConstellationLayer, BoundaryLayer, SatelliteLayer, CompassLayer) needs a `show(visible: boolean)` method or the app directly sets the Cesium primitive's `.show` property. The simplest approach: each layer returns its primitive collections, and the toggle sets `.show` on each.

Extend the layer return types:

```ts
type StarLayer = {
  update: (...) => void;
  setVisible: (visible: boolean) => void;
};
```

Same pattern for all layers. `setVisible` sets `.show` on the underlying `BillboardCollection`, `PolylineCollection`, `LabelCollection`.

## 10. Opacity mechanics

For polyline-based layers (constellation lines, boundaries, satellite trails), opacity changes require updating the material color alpha on each polyline. Two approaches:

- **Recreate polylines** with new alpha — simple but potentially flickery.
- **Iterate and update material** — `polyline.material.uniforms.color.alpha = newAlpha` on each.

Use the iterate approach for smooth dimming. The opacity slider dispatches `set-opacity` intents; the app calls `layer.setOpacity(value)` which iterates the polyline collection.

## 11. Testing strategy

### `src/astro/boundaries.ts` — TDD, ≥ 90% coverage

- Parse valid boundary array.
- Reject empty/invalid input.
- Filter: boundary with vertices above horizon → included.
- Filter: boundary entirely below horizon → excluded.

### `src/scene/boundaries.ts` — mocked Cesium, ≥ 80% coverage

- N boundaries → N polylines created.
- Empty input → nothing rendered.
- `setVisible(false)` hides primitives.
- `setOpacity(0.5)` updates material alpha.

### `src/ui/` — DOM tests, ≥ 80% coverage

- Panel creates container div with correct structure.
- Collapse button toggles panel visibility.
- Time step buttons dispatch correct intents (+1h, −1h, etc.).
- "Now" button dispatches current system time.
- Location preset populates lat/lon fields.
- Layer toggle fires callback with correct layer key.
- Opacity slider fires callback with correct value.
- Slider hidden when parent layer is off.

### `src/state/` — extended tests

- Parse layer visibility from URL params.
- Parse opacity from URL params.
- Defaults when params absent.
- Serialize round-trip with new fields.

## 12. Error handling

- Boundary data load failure: non-fatal (same as constellations — log warning, skip boundaries).
- Invalid UI input (non-numeric lat/lon, bad date): validate and reject silently, keep previous value.
- No new error types beyond `BoundaryLoadError`.
