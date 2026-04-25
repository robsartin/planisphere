<!-- SPDX-License-Identifier: Apache-2.0 -->

# ADR 016 — Playwright for end-to-end browser tests

**Date:** 2026-04-25
**Status:** Accepted

## Context

GitHub issue #303 follows a hover-pick regression that shipped to production
in PR #301 and was only caught after merge. The bug — Cesium's default 3×3
pick rectangle being smaller than star sprites — could not surface in the
existing jsdom Vitest suite because jsdom has no WebGL implementation; the
`Scene.pick` framebuffer path is only exercised by a real GPU. Even the fix
(#302, widening to 21×21) was validated by a one-off Playwright script that
was deleted after use.

We need a small, durable browser-side test layer that catches this class of
regression on the next push, without bloating the canonical pre-push gate
that runs on every developer save.

## Decision

Add **Playwright** + `@playwright/test` (`^1.x`) as devDependencies and
introduce a top-level `e2e/` directory holding a focused suite of five
specs:

1. Hover-pick sweep (the regression that motivates this ADR).
2. URL-state round-trip — boot with query params, assert they survive
   the bootstrap.
3. Deep-link plan modal — boot with `?plan=<slug>`, assert the reader
   modal renders. Uses `page.route()` to intercept `/api/plans/*` so the
   test doesn't need a live worker.
4. Bottom-HUD / drawer-rail smoke — assert each of the four drawer
   triggers (events, tonight, settings, plans) opens its drawer.
5. Cesium initialises — count non-black pixels on the canvas within
   5 s of load to catch WebGL init regressions.

Playwright is **license-clean** (Apache-2.0 — same as this project), used
by Microsoft, Google, and the wider browser-vendor ecosystem; no separate
attribution beyond the standard NOTICE entry.

### Headed Chromium only

Cesium's shaders fail to compile under SwiftShader, the headless GL backend.
`playwright.config.ts` sets `use: { headless: false }` and the suite runs
only in Chromium. Firefox / WebKit are explicitly out of scope; revisit
only if a Safari-specific regression forces it.

On Linux CI the suite runs under `xvfb-run -a pnpm e2e`. macOS local dev
needs no Xvfb. The CI job runs `npx playwright install --with-deps
chromium` before the suite — it is excluded from the canonical pre-push
gate so first-time-clone friction stays low.

### Out of the canonical pre-push gate

`pnpm e2e` is **not** added to `pnpm typecheck && pnpm lint &&
pnpm format:check && pnpm test:cov && pnpm build`. The browser launch
adds ~5 s overhead per run and requires a working display, neither of
which belong in the every-save gate. The CI workflow makes the e2e job
`needs: [build]` so PRs that fail the cheap checks don't burn e2e
minutes.

### Pro-gated tests use a localStorage stub

`page.addInitScript` pre-seeds `planisphere.user.v1` with the allowlisted
email so `isPro()` returns true for the deep-link plan modal test (see
`src/features.ts` for the storage shape). This is the same surface
documented in [ADR 015](015-viewing-plans-storage-and-pro-gate.md) — no
new shipping code is added to support it.

The same script also pre-seeds `planisphere.onboarding.v1=dismissed`
across every test so the onboarding overlay (which would otherwise cover
the canvas centre and break every pick) doesn't appear.

### Dev server

`playwright.config.ts` uses Playwright's `webServer` feature to start
`pnpm dev:client` (just Vite, no `wrangler dev`) before tests run. The
plan modal test stubs `/api/plans/*` via `page.route()` so the absence
of the worker doesn't matter. `reuseExistingServer: !process.env.CI`
keeps local iteration fast.

## Consequences

- **DevDep weight:** Playwright + browser binaries are large (~500 MB
  for chromium). They live under `~/.cache/ms-playwright`, not in the
  shipped bundle. `npx playwright install chromium` is documented in
  README.
- **CI minutes:** the `e2e` job adds ~30 s per run (Xvfb boot + browser
  launch + suite). Net positive vs. the cost of another regression like
  #302.
- **No coverage contribution:** Playwright tests don't feed the v8
  coverage thresholds in `vitest.config.ts`. That is by design — the
  thresholds gate jsdom-runnable code, not browser surfaces.
- **No visual regression:** screenshot baselines / `pixelmatch` are
  explicitly out of scope. The Cesium-initialises test counts non-black
  pixels rather than diffing against a baseline; that's enough to catch
  "WebGL never started" without the maintenance tax of golden images.

## Alternatives considered

- **Cypress.** Comparable feature set; rejected on the unrequested
  paid tier prompts during install and the heavier UI runner. Playwright's
  pure-CLI workflow fits this repo's "everything in CI" conventions
  better.
- **Puppeteer-only / no test runner.** The disposable diagnostic that
  caught #302 was a Puppeteer one-off; promoting it to that shape would
  miss the test-runner ergonomics (parallelism, retries, fixtures,
  trace viewer) we need for the four other tests.
- **Headless Cesium via mocked GL.** Theoretically possible (e.g. headless
  GL via `gl` npm package), but reproducing Cesium's shader pipeline
  outside a real browser is exactly what we already have jsdom for —
  and that's what missed the bug.
- **Add e2e to the canonical gate.** Rejected — too slow for every
  developer save, and the CI job already enforces it on every PR.
