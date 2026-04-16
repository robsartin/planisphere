# Planisphere

Interactive web planisphere with satellite overlays. Static SPA built with CesiumJS and satellite.js. Apache 2.0 licensed.

See `docs/specs/2026-04-15-planisphere-v1-design.md` for the full v1 design and `CLAUDE.md` for working conventions.

## Prerequisites

- Node 20.11.1 (see `.nvmrc`)
- pnpm ≥ 9.12.0

## Commands

    pnpm install       # install deps
    pnpm dev           # local dev server on http://localhost:5173
    pnpm typecheck     # tsc --noEmit
    pnpm lint          # ESLint + SPDX header check
    pnpm format:check  # Prettier check
    pnpm test          # Vitest
    pnpm test:cov      # Vitest with coverage (enforces thresholds)
    pnpm build         # typecheck + production build to dist/

A change is not "done" until `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:cov && pnpm build` all pass locally.

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
