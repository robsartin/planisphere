# Architecture

Planisphere is a static single-page application with no backend. All computation runs in the browser. This document describes the module structure, data flow, layer model, and TLE loading strategy.

## Module dependency graph

Each module has a strict boundary. Arrows point from importer to dependency.

```mermaid
graph TD
    app["app.ts<br/>(composition root)"]
    state["state/<br/>URL-synced app state"]
    astro["astro/<br/>pure astro math"]
    sat["sat/<br/>TLE loading + SGP4"]
    scene["scene/<br/>CesiumJS rendering"]
    ui["ui/<br/>controls + intents"]
    result["result/<br/>Result&lt;T,E&gt; helpers"]

    app --> state
    app --> astro
    app --> sat
    app --> scene
    app --> ui

    state --> result
    astro --> result
    sat --> result

    scene --> astro
    sat --> astro

    ui --> state
```

**Boundary rules enforced at review:**

- `astro/` and `sat/` are pure and framework-free — no CesiumJS imports, no DOM.
- `scene/` is the only module permitted to import CesiumJS types.
- `ui/` reads `state/` types and emits `UIIntent` values; it does not compute positions.
- `result/` has no dependencies within the project.

## Data flow

The application follows a unidirectional flow: state drives computation, computation drives rendering, and user actions produce intents that update state.

```mermaid
flowchart LR
    URL["URL search params"]
    State["AppState\n(observer, time, layers, opacity)"]
    Astro["astro/\nfilterVisibleStars\ncomputeBodyPositions\nfilterVisibleConstellations\nfilterVisibleBoundaries"]
    Sat["sat/\npropagateSatellites"]
    Scene["scene/\nLayer.update()"]
    UI["ui/\npanel + controls"]
    Intent["UIIntent\n(set-time | set-observer\n| toggle-layer | set-opacity\n| set-view)"]

    URL -->|parseStateFromSearchParams| State
    State -->|observer + timeUtc| Astro
    State -->|observer + timeUtc| Sat
    Astro -->|AltAzStar[], CelestialBody[]\nVisibleConstellation[]\nVisibleBoundary[]| Scene
    Sat -->|VisibleSatellite[]| Scene
    Scene -->|primitives rendered| Browser["Browser / CesiumJS"]
    UI -->|user interaction| Intent
    Intent -->|handleIntent mutates state| State
    State -->|serializeStateToSearchParams| URL
```

On startup `bootstrap()` in `app.ts`:

1. Parses `AppState` from URL search params (defaults used when params are absent).
2. Parses the bundled star catalog (`data/stars.json`).
3. Initialises the CesiumJS viewer and camera.
4. Calls `rerender()` to populate all layers from the initial state.
5. Fetches TLE data asynchronously (see TLE flow below).
6. Mounts the UI panel; each control fires a `UIIntent` that `handleIntent` dispatches.

## Layer architecture

Each visual layer is an opaque object returned by a `create*Layer` factory in `scene/`. Layers own their Cesium primitives directly and expose a minimal interface. `app.ts` calls these methods; no other module does.

```mermaid
classDiagram
    class StarLayer {
        +update(stars: AltAzStar[], lat, lon)
        +setVisible(visible: boolean)
    }

    class BodyLayer {
        +update(bodies: CelestialBody[], lat, lon)
        +setVisible(visible: boolean)
    }

    class ConstellationLayer {
        +update(constellations: VisibleConstellation[], lat, lon)
        +setVisible(visible: boolean)
        +setOpacity(opacity: number)
    }

    class BoundaryLayer {
        +update(boundaries: VisibleBoundary[], lat, lon)
        +setVisible(visible: boolean)
        +setOpacity(opacity: number)
    }

    class SatelliteLayer {
        +update(satellites: VisibleSatellite[], lat, lon)
        +setVisible(visible: boolean)
        +setOpacity(opacity: number)
    }

    class CompassLayer {
        +update(lat, lon)
        +setVisible(visible: boolean)
    }

    class CesiumPrimitive {
        <<CesiumJS>>
    }

    StarLayer --> CesiumPrimitive : BillboardCollection
    BodyLayer --> CesiumPrimitive : BillboardCollection
    ConstellationLayer --> CesiumPrimitive : PolylineCollection\nLabelCollection
    BoundaryLayer --> CesiumPrimitive : PolylineCollection
    SatelliteLayer --> CesiumPrimitive : BillboardCollection\nPolylineCollection
    CompassLayer --> CesiumPrimitive : LabelCollection
```

`setOpacity` is only present on layers that have a variable-alpha component (constellation lines, constellation boundaries, satellite trails). `StarLayer`, `BodyLayer`, and `CompassLayer` have no opacity slider.

## TLE fetch and fallback flow

Satellite TLE data is fetched at runtime from CelesTrak. If the network request fails or returns empty content the application transparently falls back to a bundled snapshot (`data/tle/visual.txt`) so that satellites are always shown without requiring connectivity.

```mermaid
flowchart TD
    Start([bootstrap starts])
    Fetch["fetch CelesTrak\ngp.php?GROUP=visual&FORMAT=tle"]
    NetOk{response.ok\n&& body non-empty?}
    UseRemote["use remote TLE text"]
    UseBundled["use bundled TLE snapshot\ndata/tle/visual.txt"]
    Parse["parseTle → Result&lt;SatelliteRecord[], TleParseError&gt;"]
    ParseOk{parse ok?}
    Propagate["propagateSatellites\n→ VisibleSatellite[]"]
    CreateLayer["createSatelliteLayer\n→ SatelliteLayer"]
    WarnParse["console.warn TLE parse warning\n(satellite layer stays null)"]

    Start --> Fetch
    Fetch --> NetOk
    NetOk -->|yes| UseRemote
    NetOk -->|no / throws| UseBundled
    UseRemote --> Parse
    UseBundled --> Parse
    Parse --> ParseOk
    ParseOk -->|ok| Propagate
    ParseOk -->|err| WarnParse
    Propagate --> CreateLayer
```

`fetchTle` always returns `Result<string, never>` (it never propagates errors to the caller — network failures silently fall back). The `TleFetchError` type exists for future use if callers need to distinguish the source.

## Running in development

Prerequisites: Node 20.11.1 (pinned in `.nvmrc`; use `nvm use`), pnpm ≥ 9.12.0 (via Corepack or `brew install corepack`).

```bash
pnpm install          # install dependencies
pnpm dev              # start Vite dev server on http://localhost:5173
```

Open `http://localhost:5173/?lat=30.27&lon=-97.74&t=2026-04-17T04:00:00Z` (Austin, pre-dawn — good for satellites).

The dev server uses Vite with hot module replacement. Changes to `src/` files reload instantly. CesiumJS static assets (workers, imagery) are served by `vite-plugin-cesium`. satellite.js is excluded from Vite's dependency optimizer (`optimizeDeps.exclude`) because its WASM pthreads build uses top-level await that esbuild rejects; a custom Vite plugin (`stubSatelliteJsWasm`) stubs the unused WASM module for production builds.

### Quality gates (run before every commit)

```bash
pnpm typecheck        # tsc --noEmit (strict mode)
pnpm lint             # ESLint (zero warnings) + SPDX header check
pnpm format:check     # Prettier conformance
pnpm test:cov         # Vitest with v8 coverage thresholds
pnpm build            # production build to dist/
```

All five must pass. Claude Code hooks enforce `typecheck + format:check + lint + test:cov` before every `git commit`, and the full gate (including `build`) before `git push` and `gh pr create`.

Coverage thresholds (enforced in `vitest.config.ts`):

| Module                                                        | Lines | Branches |
| ------------------------------------------------------------- | ----- | -------- |
| `src/result/**`, `src/state/**`, `src/astro/**`, `src/sat/**` | ≥ 90% | ≥ 85%    |
| `src/scene/**`, `src/ui/**`, `src/app.ts`                     | ≥ 80% | ≥ 70%    |
| Project floor                                                 | ≥ 85% | ≥ 80%    |

### Regenerating data files

The three data files in `data/` are pre-built from external sources. To refresh them:

```bash
node scripts/build-star-catalog.mjs     # Hipparcos mag≤6 from HYG database → data/stars.json
node scripts/build-constellations.mjs   # Stellarium stick figures → data/constellations.json
node scripts/build-tle.mjs              # CelesTrak visual satellites → data/tle/visual.txt
node scripts/build-boundaries.mjs       # IAU boundaries from d3-celestial → data/boundaries.json
```

Each script fetches from an external URL and writes a committed data file. Internet access required. TLE data goes stale in days; star/constellation/boundary data is effectively permanent.

## Deployment

The app deploys to **Cloudflare Pages** via the Cloudflare Git integration (not a GitHub Actions workflow).

### How it works

1. Cloudflare Pages is connected to the `robsartin/planisphere` GitHub repo.
2. On every push to `main` or PR branch, Cloudflare runs the build:
   - Build command: `pnpm build` (inferred from `package.json`)
   - Output directory: `dist/` (configured in `wrangler.jsonc`)
   - Node version: reads `.nvmrc` (20.11.1)
3. `main` pushes → production deploy.
4. PR pushes → preview deploy (URL posted as the "Workers Builds" check on the PR).

### Configuration files

- `wrangler.jsonc` — tells Cloudflare to serve `./dist` as the asset directory.
- `.nvmrc` — pins Node 20.11.1 for both local dev and Cloudflare builds.
- No `deploy.yml` workflow — Cloudflare's native Git integration handles everything.

### CI (GitHub Actions)

`.github/workflows/ci.yml` runs four parallel jobs on every push to `main` and every PR:

| Job         | What it runs                                   |
| ----------- | ---------------------------------------------- |
| `typecheck` | `pnpm typecheck`                               |
| `lint`      | `pnpm lint` + `pnpm format:check`              |
| `test`      | `pnpm test:cov` (coverage thresholds enforced) |
| `build`     | `pnpm build` (uploads `dist/` as artifact)     |

Branch protection on `main` requires all four CI jobs to pass before merge. Reviews are not required (single-developer project).

### Required secrets

| Secret                  | Where               | Purpose                       |
| ----------------------- | ------------------- | ----------------------------- |
| `CLOUDFLARE_API_TOKEN`  | GitHub repo secrets | Cloudflare Pages API access   |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub repo secrets | Cloudflare account identifier |

These are used by the Cloudflare Git integration, not by a GitHub Actions workflow.
