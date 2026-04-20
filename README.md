# Planisphere

Interactive web planisphere with satellite overlays. Static SPA built with CesiumJS and satellite.js. Apache 2.0 licensed.

See [`docs/architecture.md`](docs/architecture.md) for the current code architecture and Mermaid diagrams, [`docs/user-guide.md`](docs/user-guide.md) for the end-user manual, `docs/specs/2026-04-15-planisphere-v1-design.md` for the frozen v1 design, and `CLAUDE.md` for working conventions.

## Features

- **Sky-first chrome** — an **ambient bottom HUD** carries time, location, and compass without covering the sky; everything else lives behind a four-icon drawer rail (events / settings / tonight's sky / help) that opens one surface at a time.
- **Stars** — ~5000 HYG-catalog stars, colored by B-V index (blue-white O stars through orange-red M stars).
- **Solar system bodies** — Sun, Moon (with phase), Mercury, Venus, Mars, Jupiter, Saturn. Ephemerides from Astronomy Engine.
- **Artificial satellites** — live TLE feed from CelesTrak with a bundled fallback; SGP4 propagation via satellite.js.
- **Deep-sky objects** — Messier catalog with per-type symbols (open cluster, globular, nebula, galaxy).
- **Constellations** — IAU stick figures and official boundary polygons. Constellation names in Latin, English, Chinese, Arabic, or Greek.
- **Skycultures** — pick an alternate asterism set (Western/IAU, Chinese Xingguan, Indian Vedic, Norse Edda, Hawaiian starlines, or Māori) in place of the Western stick figures. Data normalized from Stellarium under CC-BY-SA 4.0 / CC-BY 4.0 — see [`docs/adr/007-stellarium-skyculture-data.md`](docs/adr/007-stellarium-skyculture-data.md).
- **Upcoming events** — planet-planet / planet-Sun / planet-Moon conjunctions, lunar eclipses, meteor-shower peaks, and ISS passes (with a cylindrical-umbra shadow check and an approximate magnitude). Each event's "Go to" button jumps the time cursor and aims the camera at the subject. Lives in the 📅 drawer.
- **Tonight's sky drawer** — rise/set and current Alt/Az for every bright body, with a trail toggle per row.
- **Milky Way** — a soft additive billboard glow band tracing the galactic plane.
- **Reference lines** — RA/Dec equatorial grid and the ecliptic, both with independent opacity sliders.
- **Object trails** — show a dashed 4-hour future path for any solar-system body from the tonight drawer.
- **Telescope FOV reticle** — overlay an on-screen circle sized for naked eye, binoculars, small scope, or large scope.
- **Object cards** — click a star, planet, satellite, deep-sky object, or constellation to pin a floating info card next to it. Multiple cards stay open; they follow their object as time advances. Click empty sky to drop a small reticle popover with the direction readout and a "Look here" action.
- **Command palette (⌘K)** — a single search box over objects, upcoming events, cities, and settings. Fuzzy-matched, ranked, keyboard-navigated; last 10 selections are remembered.
- **Interactive controls** — free-look trackball camera with pinch / scroll-wheel zoom, drag inertia, and double-tap to reset / center. View-direction presets and explicit Az/Alt inputs, layer toggles, magnitude filter, night-vision mode, "📍 Now" button (sets time and requests geolocation), Copy link button.
- **Search** — type an object name to jump the view to stars, constellations, planets, or satellites above the horizon.
- **Location picker** — fullscreen overlay with "Use my location", lat/lon inputs, and a 24-city quick-pick grid.
- **URL-is-state** — every interesting setting is reflected in the URL, so any view is a shareable link.
- **PWA / offline** — installable web app with a service worker that caches the shell and falls back to cached TLE when offline.

Under the hood:

- **Web Worker** runs the hot alt/az math for ~5000 stars off the main thread using zero-copy transferable `Float64Array`s.
- **Fast RA/Dec transform** (hand-rolled GMST) is ~50× faster than astronomy-engine's full pipeline and used everywhere ±0.5° accuracy is acceptable (stars, grid, ecliptic, milky way, deep-sky, search).

## Architecture

Planisphere is composed of eight modules with strict boundaries:

| Module         | Role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/astro/`   | Pure astronomy math — star catalog, ephemerides, coordinate transforms, constellation/boundary/Messier/Milky Way filtering, grid/ecliptic geometry, trails, search index, FOV presets, constellation-name translations, alternate skycultures (`skycultures`), upcoming-events composition (`events`)                                                                                                                                                                                   |
| `src/sat/`     | TLE loading (with bundled fallback), SGP4 propagation via satellite.js, pass detection (`passes`) and cylindrical-umbra + magnitude illumination model (`illumination`)                                                                                                                                                                                                                                                                                                                 |
| `src/scene/`   | CesiumJS rendering — one factory per layer (`Star`, `Body`, `Constellation`, `Boundary`, `Satellite`, `Compass`, `Grid`, `Ecliptic`, `Messier`, `MilkyWay`, `Trail`, `Reticle`), camera setup + gestures (pinch / scroll zoom, drag inertia, double-tap reset), hover tooltip, and the `project` sky↔screen bridge (`animation-math.ts` is pure and framework-free).                                                                                                                   |
| `src/workers/` | Astro computation Web Worker: `astro-worker` (entry), `astro-worker-client`, `worker-math` (pure GMST math extracted for tests), `star-builder` (typed-array packing helpers)                                                                                                                                                                                                                                                                                                           |
| `src/ui/`      | DOM chrome + controls that emit typed `UIIntent` values. Sky-first surfaces (`bottom-hud`, `drawer`, `events-drawer`, `settings-drawer`, `tonight-drawer`, `help-modal`, `command-palette`, `object-card` + `object-cards-manager`, `empty-sky-popover`, `location-picker-overlay`); plus the legacy side-panel controls (`panel`, `time-controls`, `location-controls`, `view-controls`, `layer-controls`, `planet-info`, `search`, `fov-controls`, `events-panel`). No position math. |
| `src/state/`   | `AppState` type, URL serialisation/deserialisation (`lat`, `lon`, `t`, `layers`, `op_*`, `vaz`, `valt`, `nv`, `mag`, `lang`, `fov`, `sky`)                                                                                                                                                                                                                                                                                                                                              |
| `src/result/`  | `Result<T, E>` discriminated union and helpers                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/app.ts`   | Composition root — wires state → computation → rendering → UI, debounces rerenders, dispatches intents, keeps the URL in sync                                                                                                                                                                                                                                                                                                                                                           |

`src/main.ts` is the browser entrypoint; it also registers the service worker (`public/sw.js`) when the app is served from a production build.

See [`docs/architecture.md`](docs/architecture.md) for Mermaid diagrams covering the module dependency graph, data flow, layer interface model, worker sequence, `AppState` schema, URL parameter set, TLE fetch/fallback flow, and a short section per post-v1 subsystem.

## Prerequisites

- Node 20.11.1 (see `.nvmrc`)
- pnpm ≥ 9.12.0

## Commands

    pnpm install       # install deps
    pnpm dev           # local dev: vite + wrangler dev in parallel
    pnpm dev:client    # just the SPA (Vite) on http://localhost:5173
    pnpm dev:worker    # just the Worker (wrangler dev)
    pnpm typecheck     # tsc --noEmit for SPA + Worker
    pnpm lint          # ESLint + SPDX header check
    pnpm format:check  # Prettier check
    pnpm test          # Vitest (SPA tests under jsdom)
    pnpm test:cov      # Vitest with coverage (enforces thresholds)
    pnpm test:worker   # Vitest for worker/ under the Cloudflare Workers pool
    pnpm build         # typecheck + production build to dist/

A change is not "done" until `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:cov && pnpm build` all pass locally.

### Worker / D1 local setup

Phase 2 introduces a Worker + D1 backend. See [`worker/README.md`](worker/README.md)
and [ADR 009](docs/adr/009-backend-selection.md). First-time setup:

    wrangler d1 create planisphere-dev --local
    wrangler d1 migrations apply planisphere-dev --local --config wrangler.worker.jsonc

`pnpm dev` then runs Vite and `wrangler dev` in parallel. The magic-link
email is stubbed to a `console.log` line on the Worker console — grep for
`[auth] magic link for`.

## Quality gates

Coverage thresholds are enforced in `vitest.config.ts`:

- `src/result/**`, `src/state/**`, `src/astro/**`, `src/sat/**`: ≥ 90% lines, ≥ 85% branches.
- `src/scene/**`, `src/ui/**`, `src/app.ts`: ≥ 80% lines.
- Project-wide floor: ≥ 85% lines.

Do not lower thresholds to make a PR pass — add tests or narrow the change.

## Deployment

`main` is deployed to Cloudflare Pages by `.github/workflows/deploy.yml`. Pull requests get preview deployments.

To set up deployment in a fresh clone:

1. Create a Cloudflare Pages project named `planisphere` (Direct Upload, no Git connection).
2. Create a Cloudflare API token scoped to `Account.Cloudflare Pages:Edit`.
3. Add repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## Branch protection

`main` is protected — see `docs/ops/branch-protection.md`. To (re)apply:

    bash scripts/protect-main.sh <owner>/<repo>

## License

Apache 2.0. See `LICENSE` and `NOTICE`.
