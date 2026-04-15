# CLAUDE.md

Durable guidance for working in this repo. For the full design, see `docs/specs/2026-04-15-planisphere-v1-design.md`.

## What this is

A web-based **planisphere** — an interactive star chart showing the sky from a chosen location/time, with artificial-satellite overlays. Static single-page app. No backend.

## Stack

- **TypeScript** (strict), **Vite**, **pnpm**
- **CesiumJS** for 3D rendering
- **satellite.js** for SGP4 / TLE propagation
- **Astronomy Engine** for ephemerides and coordinate transforms
- **Vitest** for tests (v8 coverage)
- Deployed to **Cloudflare Pages**; CI on **GitHub Actions**

## License

Apache 2.0. All source files carry SPDX headers. Third-party attributions live in `NOTICE`. Every new dependency needs a short ADR in `docs/adr/` noting the license.

## Non-negotiables

### TDD, always

Every behavior change begins with a failing test that fails for the right reason. No implementation code before a red test. This applies to `astro/`, `sat/`, `result/`, and `state/` without exception. For `scene/` and `ui/`, write the test at the highest level that's still fast and deterministic.

If you catch yourself writing production code "to see if it works" before a test exists, stop and write the test.

### Result<T, E>, never throw for domain errors

Fallible functions return `Result<T, E>`. The discriminated-union shape is:

```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

Errors are typed domain unions (e.g. `TleParseError`, `ObserverInputError`) — never `Error` instances, never strings. Exceptions are reserved for programmer errors (invariant violations, unreachable code). Don't wrap third-party throws in `try/catch` and rethrow — convert to `Result` at the boundary.

### Coverage gates (CI-enforced)

- Pure modules (`astro/`, `sat/`, `result/`, `state/`): **≥ 90%** line, ≥ 85% branch.
- Integration modules (`scene/`, `ui/`, `app.ts`): **≥ 80%** line.
- Project floor: **≥ 85%** line.

Don't lower a threshold to make a PR pass. Add tests or narrow the change.

### Module boundaries

- `astro/` and `sat/` are pure and framework-free. They return plain data + `Result`; they never import Cesium or React.
- `scene/` is the only module allowed to import CesiumJS types.
- `ui/` reads state and dispatches intents; it does not compute positions.

Violating a boundary is a review-blocking issue.

## Repo layout

```
src/
  astro/     pure astro math: time, coords, catalogs, ephemerides
  sat/       TLE loading + SGP4 wrappers
  scene/     CesiumJS viewer, entities, camera
  ui/        controls (time, location, layers)
  state/     URL-synced app state
  result/    Result<T, E> + helpers
  app.ts     composition root
data/        bundled star, constellation, TLE data
docs/
  specs/     design specs (source of truth)
  adr/       short decision records
  plans/     implementation plans (one per feature)
```

## Commands

Once scaffolded:

- `pnpm install` — install deps
- `pnpm dev` — local dev server
- `pnpm test` — run Vitest
- `pnpm test:cov` — run with coverage (what CI enforces)
- `pnpm lint` — ESLint
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm build` — production build into `dist/`

A change is not "done" until `pnpm typecheck && pnpm lint && pnpm test:cov && pnpm build` all pass locally.

## Working style

- Keep changes scoped. A bugfix doesn't need surrounding cleanup; a feature doesn't need speculative abstractions.
- No comments explaining *what* well-named code already says. Only write a comment when the *why* is non-obvious.
- Prefer editing existing files over creating new ones.
- When a task is ambiguous, ask before coding — not after.

## Don't

- Don't throw for domain errors.
- Don't import Cesium outside `scene/`.
- Don't skip the red-test step of TDD.
- Don't commit lowered coverage thresholds.
- Don't add a dependency without an ADR.
- Don't introduce a backend, user accounts, or persistence beyond URL state in v1.
