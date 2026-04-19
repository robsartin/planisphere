# ADR 010 — Worker dev deps: `@cloudflare/vitest-pool-workers` + `concurrently`

**Date:** 2026-04-18
**Status:** Accepted

## Context

[ADR 009](009-backend-selection.md) adopted Cloudflare Workers + D1 as the
Phase 2 runtime. Implementing milestone 2C (#218 — magic-link auth) stands up
the first Worker code in this repo under a new top-level `worker/` directory.

Two small tooling decisions fall out of that:

1. **How to test Worker code.** The Worker handlers use the Workers runtime
   (`crypto.subtle`, D1 prepared statements, `Request`/`Response`). Vitest
   running under `jsdom` (our existing `src/` test environment) doesn't
   provide any of those, and mocking them by hand is both tedious and
   unfaithful to the real runtime. Cloudflare ships an official Vitest
   integration — `@cloudflare/vitest-pool-workers` — that runs each test
   file inside a real `workerd` isolate, with a real D1 instance, bound
   exactly as `wrangler dev` would bind them in development.
2. **How to run the client SPA and the Worker together in local dev.**
   `pnpm dev` must still launch Vite for the SPA; a new `pnpm dev:worker`
   launches `wrangler dev`; and `pnpm dev` itself should (optionally) run
   both in parallel so contributors don't have to juggle two terminals.

## Decision

Add two **dev-only** dependencies:

- **`@cloudflare/vitest-pool-workers`** — official Cloudflare Vitest pool
  that spins up a workerd isolate per test file. License: MIT. Keeps
  Worker tests colocated with the code they exercise (`worker/*.test.ts`)
  and gives them the real runtime, including D1 bindings via in-memory
  SQLite. Referenced from a separate `vitest.worker.config.ts` so the
  existing `src/**` Vitest run — under `jsdom`, with the Phase-1 coverage
  gates — is completely untouched.
- **`concurrently`** — runs multiple commands in parallel from one
  `package.json` script, with interleaved, prefixed output and unified
  Ctrl-C handling. License: MIT. ~20 KB install footprint, no runtime
  impact. Used only to orchestrate `pnpm dev` = `vite` + `wrangler dev`.

Neither dep ships in the production bundle. Both are MIT — compatible with
our Apache 2.0 license.

## Consequences

- **Worker test fidelity.** Tests hit real `crypto.subtle`, real `Request`
  semantics, and a real D1 binding. Regressions caused by jsdom polyfills
  diverging from workerd can't happen, because jsdom is not in the path.
- **Two Vitest configs.** `vitest.config.ts` (existing, `src/**`, jsdom)
  stays the source of truth for Phase-1 coverage gates and is run by
  `pnpm test` / `pnpm test:cov`. A new `vitest.worker.config.ts` runs
  `worker/**/*.test.ts` under the Workers pool. A new
  `pnpm test:worker` script runs the latter. `pnpm test:cov` does **not**
  include Worker tests in its coverage numbers — per the PR scope,
  `worker/**` doesn't count toward existing thresholds yet, and a
  follow-up issue will decide what the Worker coverage gate looks like.
- **Typecheck covers both.** `tsconfig.json` adds a project reference to
  `tsconfig.worker.json`, so `pnpm typecheck` (`tsc --noEmit -b`) covers
  `worker/` and `src/` in one command. No separate Worker typecheck
  script.
- **Dev loop.** `pnpm dev` runs `concurrently "vite" "wrangler dev"` so
  both the SPA and the Worker are live. `pnpm dev:client` and
  `pnpm dev:worker` remain available for contributors who want just one.
- **No runtime cost.** Both deps are `devDependencies`. Production bundle
  size and Worker deploy artifact are unaffected.
- **Reversibility.** If the Vitest Workers pool ever misbehaves we can
  fall back to hand-mocking `crypto.subtle` and stubbing D1, at the cost
  of test fidelity. `concurrently` is swappable for `npm-run-all` or
  shell `&` without friction.

## Alternatives considered

- **Miniflare directly.** Miniflare underlies the Vitest pool; we could
  script it by hand. Rejected because the official pool already wires
  vitest ↔ miniflare ↔ D1, test-scoped isolates, and bindings based on
  `wrangler.jsonc`. Rolling it ourselves is strictly more code for no
  new capability.
- **jsdom + manual stubs for Worker code.** Rejected. The Worker uses
  `crypto.subtle.importKey` / `sign`, and D1 prepared statements — both
  sufficiently large surfaces that stubbing them faithfully is more work
  than adopting the Cloudflare pool, and strictly less accurate.
- **`npm-run-all` instead of `concurrently`.** Comparable; `concurrently`
  picked for its interleaved-output format and unified Ctrl-C. Both are
  MIT; the choice is stylistic.
- **Shell `&` in the dev script.** Works but cross-platform-hostile
  (Windows contributors), no prefixed output, no unified interrupt.
  Rejected.
