# ADR 001 — Core toolchain

**Date:** 2026-04-15
**Status:** Accepted

## Context

The v1 design spec (`docs/specs/2026-04-15-planisphere-v1-design.md`) requires
a static SPA with TDD, typed errors, and enforced coverage gates. We need to
pick concrete tools before scaffolding.

## Decision

- Runtime: TypeScript (strict) compiled by Vite.
- Package manager: pnpm (reproducible, fast, disk-efficient).
- Test runner: Vitest with @vitest/coverage-v8.
- Lint/format: ESLint (typescript-eslint, recommended-type-checked) + Prettier.
- CI: GitHub Actions.
- Hosting: Cloudflare Pages.

## Consequences

- One Node runtime version pinned (`.nvmrc` = 20.11.1).
- All contributors install pnpm ≥ 9.
- Coverage thresholds are enforced per-directory in `vitest.config.ts`; relaxing
  them requires a follow-up ADR.

## Alternatives considered

- npm / yarn: rejected — pnpm's disk model and strictness fit this project.
- Jest: rejected — Vitest integrates natively with Vite and starts much faster.
- Rollup-only build: rejected — Vite provides the dev server we need for free.
