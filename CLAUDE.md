# CLAUDE.md

Durable guidance for working in this repo. For the full design, see `docs/specs/2026-04-15-planisphere-v1-design.md`.

## What this is

A web-based **planisphere** — an interactive star chart showing the sky from a chosen location/time, with artificial-satellite overlays. Built as a static single-page app (Cloudflare Pages). Phase 2 adds a paid **Notebook mode** backed by a Cloudflare Worker + D1 (SQLite) — see [ADR 009](docs/adr/009-backend-selection.md) for the scope expansion and the [ADR index](docs/adr/README.md) for the full decision trail.

## Stack

- **TypeScript** (strict), **Vite**, **pnpm**
- **CesiumJS** for 3D rendering
- **satellite.js** for SGP4 / TLE propagation
- **Astronomy Engine** for ephemerides and coordinate transforms
- **tiptap / ProseMirror** for the Notebook editor (Phase 2, [ADR 013](docs/adr/013-notebook-editor.md))
- **Cloudflare Workers + D1** for auth and notebook persistence (Phase 2)
- **Resend** for magic-link email delivery ([ADR 014](docs/adr/014-email-delivery.md))
- **Vitest** for tests (v8 coverage); **@cloudflare/vitest-pool-workers** for Worker-side tests
- Deployed to **Cloudflare Pages** + **Cloudflare Workers**; CI on **GitHub Actions**

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

Thresholds live in `vitest.config.ts`:

- Pure modules (`astro/`, `sat/`, `result/`, `state/`): **≥ 90%** line, ≥ 85% branch.
- Integration modules (`scene/`, `ui/`, `app.ts`): **≥ 80%** line, ≥ 70% branch.
- Workers (`src/workers/`): ≥ 60% line, ≥ 50% branch (the `astro-worker.ts` entry runs inside a Web Worker and is not jsdom-testable; `star-builder.ts` is fully tested).
- Project floor: **≥ 85%** line, ≥ 80% branch.

Don't lower a threshold to make a PR pass. Add tests or narrow the change.

### Module boundaries

- `astro/` and `sat/` are pure and framework-free. They return plain data + `Result`; they never import Cesium or React.
- `scene/` is the only module allowed to import CesiumJS types.
- `ui/` reads state and dispatches intents; it does not compute positions.
- `src/auth.ts` and `src/notebooks.ts` are the **client** wrappers for the Phase 2 Worker surface; they return `Result<T, AuthError | NotebookError>`. The SPA never calls `fetch` against `/api/*` directly — go through these.
- `worker/` is the Cloudflare Worker entrypoint. It talks to D1 and Resend. It has **no** DOM, no Cesium, no astronomy-engine imports; tests run against `@cloudflare/vitest-pool-workers`.

Violating a boundary is a review-blocking issue.

## Repo layout

```
src/
  astro/     pure astro math: time, coords, catalogs, ephemerides, entities
  sat/       TLE loading + SGP4 wrappers
  scene/     CesiumJS viewer, layers, camera, collection helpers
  ui/        HUD, drawers, palette, object cards, overlays, notebook UI
  state/     URL-synced app state
  result/    Result<T, E> + helpers
  workers/   Web Worker for star alt/az math
  auth.ts    Phase 2 — client wrapper for /api/auth/*
  notebooks.ts Phase 2 — client wrapper for /api/notebooks/*
  features.ts runtime feature flags (Pro gate)
  test-setup.ts Vitest setup — jsdom canvas stub
  app.ts     composition root
  main.ts    browser entrypoint + SW register
worker/      Phase 2 — Cloudflare Worker (auth, notebooks, cron, email)
  routes/    /api/auth/* and /api/notebooks/* handlers
migrations/  D1 schema migrations
data/        bundled star, constellation, TLE, asterism data
docs/
  specs/     design specs (source of truth)
  adr/       short decision records (see adr/README.md for the index)
  plans/     implementation plans (one per feature)
  architecture.md   current module structure + diagrams
  user-guide.md     end-user manual (also rendered inside the in-app Help)
```

## Shared UI utilities

Reach for these before hand-rolling DOM or inline styles:

- **`src/ui/dom.ts` — `el(tag, opts)`** — declarative factory that collapses the usual `createElement` + `dataset.testid` + `.style.*` + `.addEventListener` + `.appendChild(child)` sequence into one call. Keep using `document.createElement` directly when the factory can't express what you need (e.g. when you must read back layout before attaching children); otherwise default to `el()`.
- **`src/ui/styles.ts` palette constants** — `TEXT_COLOR`, `TEXT_MUTED`, `PANEL_BG`, `PANEL_BORDER`, `SURFACE`, `SURFACE_LOW`, `SURFACE_ACTIVE`, `BORDER_SUBTLE`, `ACCENT_COLOR`, `FONT_FAMILY`, `GAP`. Plus the helpers `applyBaseText`, `applyButton`, and `createProPill(testid)`. Don't invent new `rgba(…)` / `#xxxxxx` literals — pick from the palette or extend the palette.

## Test environment

- Vitest runs under **jsdom**. `vitest.config.ts` wires `src/test-setup.ts` as a setup file — it installs a Proxy-backed no-op stub for `HTMLCanvasElement.prototype.getContext("2d")` so the scene layers (compass, messier, satellites) that synthesise billboard canvases during `app.test.ts` bootstrap don't flood stderr with jsdom's "Not implemented" noise. The stub does **not** paint real pixels; tests that need real canvas output should mock at the component boundary, not rely on the setup.
- Worker-side tests live next to their production files under `worker/` and use `@cloudflare/vitest-pool-workers`; `vitest.worker.config.ts` points at that pool. The SPA and Worker test suites are kept in separate configs so their environments don't collide.

## Commands

Once scaffolded:

- `pnpm install` — install deps
- `pnpm dev` — local dev server
- `pnpm test` — run Vitest
- `pnpm test:cov` — run with coverage (what CI enforces)
- `pnpm lint` — ESLint
- `pnpm format:check` — Prettier (check only; CI runs this exact command)
- `pnpm format` — Prettier with `--write` (fixes formatting in place)
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm build` — production build into `dist/`

A change is not "done" — and **must not be pushed to a PR branch** — until ALL of these pass locally, in order:

```
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:cov && pnpm build
```

Treat that one-liner as the canonical pre-push gate. CI runs the same set; skipping `format:check` locally is the most common reason a PR shows red on GitHub after the author's tests all passed. Prettier errors are boring to chase down post-push — fix them before.

If you're about to push and haven't run this full sequence, run it. If anything fails, fix it before pushing (don't push expecting CI to tell you).

### Specifically for rebases / PR updates

Running `pnpm test` is **not** the same as `pnpm test:cov`. The former skips the v8 coverage thresholds; CI runs the latter. Habit of typing `pnpm test` after a rebase is how coverage regressions leak to CI. Use `pnpm test:cov` for the pre-push gate, always.

Rebasing a PR onto a moved `main` is where the pre-push gate matters most — more, not less, than on a fresh branch. The merge surface brings in code you didn't write: new switch cases, new intents, new rendering paths. Your original tests may have covered 100% of what you wrote, yet the rebased branch can fall below the `src/app.ts` branch-coverage gate because the new code needs new tests.

**After every rebase, re-run the full canonical gate:**

```
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:cov && pnpm build
```

If `test:cov` now fails on a threshold line like:

```
ERROR: Coverage for branches (69.66%) does not meet "src/app.ts" threshold (70%)
```

…don't lower the threshold. Open the coverage report (`coverage/lcov.info` or the HTML), find the newly-introduced branches that got in via the rebase, and add tests for them. Common pattern: a switch statement over a union got a new arm you didn't exercise — parameterise the nearest existing test to cover each arm.

Prettier after a rebase: edits can also introduce formatting divergence when markers get resolved by hand. Always run `pnpm format:check` (not just `pnpm lint`) before force-pushing.

## Working style

- Keep changes scoped. A bugfix doesn't need surrounding cleanup; a feature doesn't need speculative abstractions.
- No comments explaining _what_ well-named code already says. Only write a comment when the _why_ is non-obvious.
- Prefer editing existing files over creating new ones.
- When a task is ambiguous, ask before coding — not after.

## Don't

- Don't throw for domain errors.
- Don't import Cesium outside `scene/`.
- Don't skip the red-test step of TDD.
- Don't commit lowered coverage thresholds.
- Don't add a dependency without an ADR.
- Don't introduce a backend, user accounts, or persistence beyond URL state in **v1 / Plan 07 Phase 1**. v1 is shipped; Phase 2 (Notebook / paid tier) explicitly lifts this restriction, scoped and justified by [ADR 009](docs/adr/009-backend-selection.md) (Cloudflare Workers + D1). Outside of Phase 2 work, the rule still applies — don't add a backend, a new persistence layer, or a user-accounts system without an ADR extending the scope.
