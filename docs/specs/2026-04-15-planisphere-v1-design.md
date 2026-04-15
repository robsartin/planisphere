# Planisphere v1 — Design Spec

**Date:** 2026-04-15
**Status:** Approved (post-brainstorm)
**License:** Apache 2.0

## 1. Purpose

A web-based planisphere: an interactive star chart that shows the sky visible from a chosen location at a chosen time, overlaid with artificial-satellite passes. Replaces the paper rotating-disk planisphere with a 3D celestial sphere the user can pan, zoom, and scrub through time.

## 2. Goals (v1)

- Render the celestial sphere from an observer's lat/lon at a chosen UTC instant.
- Plot stars to magnitude ~6, named constellations with lines and labels, the Sun, Moon, and naked-eye planets.
- Overlay artificial-satellite positions and short-horizon ground tracks from TLE data.
- Provide time scrubbing (minute, hour, day) and location input (lat/lon, or preset cities).
- Ship as a single static web app — no backend, no user accounts, no persistence beyond URL state.

### Non-goals (v1)

- Deep-sky objects, variable stars, eclipse/occultation prediction.
- Offline/PWA mode.
- Mobile-native apps.
- Telescope control, push-to hardware, imaging.
- User-authored observation logs.

## 3. Approach

**Approach A** (selected during brainstorm): **CesiumJS SPA + satellite.js**, static web, deployed to Cloudflare Pages.

### 3.1 Rationale

- CesiumJS gives a production-grade 3D globe and camera system; we reuse its scene graph for the celestial sphere by placing stars/bodies on a large-radius sphere centered on the observer.
- satellite.js is the de-facto TLE propagator in JavaScript (SGP4), well-tested and small.
- A static SPA eliminates backend cost, simplifies deployment, and keeps the app auditable and forkable under Apache 2.0.

### 3.2 Tech stack

| Layer | Choice |
|---|---|
| Language | TypeScript (strict) |
| Rendering | CesiumJS |
| Orbital math | satellite.js (SGP4 / TLE) |
| Astronomy math | Astronomy Engine (ecliptic/equatorial transforms, Sun/Moon/planet ephemerides) |
| Build | Vite |
| Test runner | Vitest |
| Lint/format | ESLint + Prettier |
| Package manager | pnpm |
| Hosting | Cloudflare Pages (static) |
| CI | GitHub Actions |

Dependency additions require ADR-lite justification in `docs/adr/`.

## 4. Architecture

Single-page app, organized as pure-ish modules with a thin UI layer:

```
src/
  astro/          pure functions: time, coords, catalogs, ephemerides
  sat/            TLE loading, SGP4 propagation wrappers
  scene/          CesiumJS viewer bootstrap, entity construction, camera
  ui/             React (or lit-html) controls: time, location, layers
  state/          URL-synced app state (time, observer, visible layers)
  result/         Result<T, E> type + helpers
  app.ts          composition root
data/
  stars.json      precomputed Hipparcos subset (mag ≤ 6)
  constellations.json  IAU boundaries + stick-figure lines
  tle/            bundled TLE snapshot (refreshed at build time)
```

### 4.1 Module boundaries

- `astro/` and `sat/` are pure and framework-free — they take inputs, return `Result` values, and own the unit-test-heavy surface.
- `scene/` owns all CesiumJS-specific code. UI and astro modules never import Cesium types directly; they produce plain data (positions, labels, styles) that `scene/` maps onto entities.
- `ui/` only reads state and dispatches intents; it does not compute positions.

This keeps the coverage gate achievable: pure modules can hit 90%+ easily; the Cesium-bound scene layer gets the lower 80% target.

### 4.2 Data flow (per frame / per state change)

1. User changes time or location → state updates.
2. `astro/` recomputes body positions and star-visibility flags.
3. `sat/` propagates active TLEs at the new time.
4. `scene/` diffs and updates Cesium entities.
5. Cesium renders.

Heavy work (star culling, TLE propagation for large catalogs) runs in a Web Worker; the main thread stays at 60 fps for camera interactions.

## 5. Error handling — Result type

All fallible operations return `Result<T, E>` rather than throwing. Exceptions are reserved for programmer errors (invariant violations).

```ts
type Ok<T>  = { ok: true;  value: T };
type Err<E> = { ok: false; error: E };
type Result<T, E> = Ok<T> | Err<E>;
```

Errors are typed, domain-specific discriminated unions — e.g. `TleParseError`, `EphemerisDomainError`, `ObserverInputError`. No stringly-typed errors. A helper module in `src/result/` provides `map`, `flatMap`, `unwrapOr`, and a test-only `expectOk` assertion.

## 6. Quality bar

### 6.1 Test-driven development

Every new behavior starts with a failing test. No implementation code is written without a test that fails for the right reason first. TDD applies to astro/sat/result/state modules without exception. For `scene/` and `ui/` we write component/integration tests where practical; visual correctness is verified by snapshot + manual review.

### 6.2 Coverage gates

Enforced in CI (Vitest + v8 coverage):

- **Pure modules** (`astro/`, `sat/`, `result/`, `state/`): **≥ 90%** line coverage, ≥ 85% branch.
- **Integration modules** (`scene/`, `ui/`, `app.ts`): **≥ 80%** line coverage.
- Overall project floor: **≥ 85%** line.

A PR that drops coverage below any threshold fails CI. Coverage exclusions require a comment explaining why.

### 6.3 Other gates

- `tsc --noEmit` clean, strict mode.
- ESLint clean (no warnings allowed on CI).
- `pnpm build` produces a deployable artifact.
- Lighthouse performance ≥ 80 on the deployed preview.

## 7. Deployment

- **Cloudflare Pages**, connected to the GitHub repo.
- `main` branch → production (`planisphere.<domain>`).
- Every PR gets a Cloudflare preview URL for review.
- Build command: `pnpm build`. Output dir: `dist/`.
- No server-side environment; all config is baked at build time or read from URL.

## 8. Licensing & attribution

- Repo license: **Apache 2.0** (`LICENSE`, SPDX headers on source files).
- Third-party notices in `NOTICE`:
  - CesiumJS (Apache 2.0)
  - satellite.js (MIT)
  - Astronomy Engine (MIT)
  - Hipparcos catalog (public domain, cite ESA)
  - IAU constellation data (public domain)
  - TLE data (public, CelesTrak attribution)

## 9. Open questions (tracked, not blocking v1)

- Refresh cadence for bundled TLE data (build-time vs. runtime fetch with CORS).
- Whether to ship a light/dark theme toggle in v1 or defer.
- Locale/i18n scope for constellation names.

## 10. Out of scope for this spec

The implementation plan (task breakdown, ordering, verification steps per task) is tracked separately in `docs/plans/` and will be authored next via the `writing-plans` workflow.
