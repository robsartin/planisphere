# Plan 02 — Astro Core Design Spec

**Date:** 2026-04-16
**Status:** Approved
**Depends on:** Plan 01 (Foundation) — complete

## 1. Purpose

Render a dark sky dome with ~9,100 correctly-positioned stars from the observer's lat/lon at the URL-specified time. Stars scale by magnitude (bright stars are larger and more opaque). Camera pans freely around the sky. This is the first visual output of the planisphere.

## 2. Scope

### In scope

- Astronomy Engine integration for coordinate math (sidereal time, RA/Dec → Alt/Az, precession).
- Hipparcos star catalog subset (mag ≤ 6, ~9,100 stars) bundled as static JSON.
- Star visibility filtering (above horizon for a given observer/time).
- Magnitude-to-visual-properties mapping (billboard size + opacity).
- CesiumJS viewer bootstrap: no terrain, no imagery, dark void, camera at observer looking up.
- Star rendering via CesiumJS BillboardCollection with a soft-glow sprite.
- `app.ts` updated to boot the Cesium viewer instead of placeholder text.
- ADRs for Astronomy Engine, CesiumJS, and vite-plugin-cesium.

### Out of scope (later plans)

- Sun, Moon, naked-eye planets (Plan 03).
- Constellation lines and labels (Plan 04).
- Satellite overlays (Plan 05).
- UI controls for time/location/layers (Plan 06).
- Web Worker offload for star culling.
- Horizon line / cardinal direction labels.

## 3. Dependencies

| Package | Version | License | Purpose |
|---|---|---|---|
| `astronomy-engine` | latest stable | MIT | Sidereal time, equatorial→horizontal transforms, precession/nutation |
| `cesium` | latest stable | Apache 2.0 | 3D rendering engine for the sky dome |
| `vite-plugin-cesium` | latest stable | MIT | Copies Cesium static assets (workers, etc.) into `dist/` at build time |

Each dependency gets a short ADR in `docs/adr/` per project rules (CLAUDE.md).

## 4. Module structure

### `src/astro/` — pure, framework-free, ≥ 90% coverage

```
src/astro/
  catalog.ts        StarRecord type, loadCatalog(), parse stars.json
  coords.ts         Astronomy Engine wrappers: makeObserver, raDecToAltAz
  visibility.ts     filterVisibleStars(): above-horizon filter + alt/az output
  magnitude.ts      magToVisual(): magnitude → { size, opacity }
  index.ts          barrel export
```

No Cesium imports. No DOM. Takes typed inputs, returns plain data + `Result`.

### `src/scene/` — CesiumJS-specific, ≥ 80% coverage

```
src/scene/
  viewer.ts         createViewer(): dark sky, no terrain/imagery, returns Result<Viewer, SceneInitError>
  stars.ts          StarLayer: BillboardCollection lifecycle — create, update from AltAzStar[]
  camera.ts         initCamera(): position at observer, look at zenith, lock translation
  index.ts          barrel export
```

Only module that imports Cesium types. Consumes plain data arrays from `astro/`.

### Data files

```
data/
  stars.json        Hipparcos subset: StarRecord[] (~9,100 entries, ~250KB)

public/
  sprites/
    star.png        32×32 white Gaussian-glow billboard texture
```

## 5. Key types

### StarRecord (catalog entry, immutable)

```ts
type StarRecord = {
  hip: number;       // Hipparcos ID
  ra: number;        // Right Ascension, degrees, J2000
  dec: number;       // Declination, degrees, J2000
  mag: number;       // Visual magnitude
  name?: string;     // Common name for ~300 brightest (Sirius, Vega, etc.)
};
```

### AltAzStar (computed per frame, ephemeral)

```ts
type AltAzStar = {
  hip: number;
  alt: number;       // Altitude in degrees (0 = horizon, 90 = zenith)
  az: number;        // Azimuth in degrees (0 = north, clockwise)
  mag: number;
  name?: string;
  size: number;      // Billboard pixel size (from magToVisual)
  opacity: number;   // Billboard opacity 0–1 (from magToVisual)
};
```

### Error types

```ts
type CatalogLoadError = { kind: "catalog-load-failed"; message: string };
type SceneInitError = { kind: "scene-init-failed"; message: string };
```

## 6. Data flow

1. `state/` provides `{ observer: { lat, lon }, timeUtc }` (exists from Plan 01).
2. `astro/catalog.ts` loads `data/stars.json` once (static import). Returns `Result<StarRecord[], CatalogLoadError>`.
3. `astro/coords.ts` builds an Astronomy Engine `Observer` from lat/lon and computes transforms for the given time.
4. `astro/visibility.ts` transforms each star's RA/Dec → Alt/Az for the observer/time. Filters to `alt > 0` (above horizon). Attaches visual properties from `magnitude.ts`. Returns `AltAzStar[]`.
5. `scene/stars.ts` receives `AltAzStar[]` and creates/updates billboards in CesiumJS. Alt/Az → Cartesian3 on a large-radius sphere (~1e7 m) centered on the observer.
6. `scene/viewer.ts` renders. Camera starts at zenith.

## 7. CesiumJS sky-dome approach

CesiumJS is designed for Earth/globe visualization. We repurpose it for a sky-dome view:

- **Viewer options:** No terrain provider (`terrainProvider: undefined`), no base imagery layer, no skyBox, no skyAtmosphere, no sun, no moon. Background is black.
- **Camera position:** Fixed at the observer's lat/lon on Earth's surface. Camera can rotate freely (pan the sky) but cannot translate — the observer doesn't move.
- **Star placement:** Each visible star's Alt/Az is converted to a Cartesian3 position on a sphere of radius ~1e7 meters centered on the camera. This places stars far enough away that parallax is irrelevant but within Cesium's rendering range.
- **Initial view:** Camera looks straight up (zenith). Horizon ring is visible at the edges.

## 8. Magnitude-to-visual mapping

The human eye perceives a ~2.5× brightness difference per magnitude step. For billboards:

- **Size:** Bright stars (mag ≤ 1) get the largest billboard (~16px); faint stars (mag ~6) get the smallest (~3px). Linear interpolation in the range, clamped.
- **Opacity:** Bright stars are fully opaque (1.0); faint stars fade (down to ~0.4). This avoids faint stars disappearing entirely while maintaining visual hierarchy.
- **Color:** All stars are white in Plan 02. Color (spectral class B-V index) could be added later but is out of scope.

The exact mapping function is tuned during implementation; the numbers above are starting points.

## 9. Testing strategy

### `src/astro/` — full TDD, ≥ 90% coverage

Pure functions with known-answer tests:

- **coords.ts:** Polaris (RA ~37.95°, Dec ~89.26°) from the North Pole at any time → Alt ≈ 89.26°, Az ≈ 0° (essentially at zenith). Sirius from 33°N in January evening → Alt > 0 (visible). Sirius from 33°N in July noon → Alt < 0 (not visible).
- **catalog.ts:** Parse a minimal 3-star JSON fixture. Verify field extraction. Verify Result error on malformed input.
- **visibility.ts:** Given a catalog + observer/time, verify correct stars appear/disappear at horizon boundary. Edge case: star exactly at Alt = 0.
- **magnitude.ts:** Verify size/opacity scaling across the full mag range. Boundary values: mag -1.46 (Sirius), mag 0, mag 6.

### `src/scene/` — ≥ 80% coverage

Mock Cesium's Viewer, BillboardCollection, and related types in tests:

- **viewer.ts:** Verify viewer is created with correct options (no terrain, no imagery, etc.). Verify Result error when container element is missing.
- **stars.ts:** Given N `AltAzStar` entries, verify N billboards created. Verify positions are Cartesian3 with correct magnitude. Verify size/opacity passed through.
- **camera.ts:** Verify camera is positioned at the observer's lat/lon. Verify initial heading/pitch point at zenith.

### Integration

- `app.ts` test: verify the Cesium viewer container div is created in the DOM.
- Manual verification: run `pnpm dev`, open browser, confirm stars visible and positioned correctly. Rotate camera to verify horizon ring.

## 10. Error handling

- **Catalog load failure:** `loadCatalog()` returns `Result<StarRecord[], CatalogLoadError>`. `app.ts` renders an error message in the DOM (same pattern as Plan 01's state-error rendering).
- **Scene init failure:** `createViewer()` returns `Result<Viewer, SceneInitError>`. `app.ts` renders an error message.
- **Astronomy Engine errors:** The library doesn't throw for valid observer/time inputs. Since `state/` already validates lat/lon/time ranges, we don't need additional error handling for the astro module's computations. Invalid catalog data (e.g., RA out of range) is caught at parse time.

## 11. State integration

Plan 01's `AppState` already has `{ observer: { lat, lon }, timeUtc }`. Plan 02 consumes this directly. No state schema changes needed. When Plan 06 (UI) lands, time/location changes will trigger re-computation of the star field via the same data flow.

For Plan 02, the app boots once from the URL state and renders. Live time-scrubbing is Plan 06.

## 12. Build integration

- `vite-plugin-cesium` added to `vite.config.ts` to handle Cesium's static worker/asset files.
- `data/stars.json` imported via Vite's JSON import (`import stars from '../data/stars.json'`).
- `public/sprites/star.png` served as a static asset via Vite's `public/` directory.
- `pnpm build` must still produce a working `dist/` that deploys to Cloudflare Pages.

## 13. Licensing

- Astronomy Engine: MIT — add to `NOTICE`.
- CesiumJS: Apache 2.0 — add to `NOTICE`.
- vite-plugin-cesium: MIT — dev-only, note in ADR.
- Hipparcos catalog: public domain (ESA) — add attribution to `NOTICE` and `data/stars.json` header comment.
- Star sprite: generated asset, Apache 2.0 (ours).
