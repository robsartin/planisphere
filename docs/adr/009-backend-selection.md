# ADR 009 — Backend selection: Cloudflare Workers + D1

**Date:** 2026-04-18
**Status:** Accepted

## Context

Plan 07 Phase 2 (see `docs/plans/2026-04-19-07-ux-transformation.md`) introduces
the Notebook — a paid tier with per-user persistence, auth, and eventually
billing. That breaks the v1 "no backend, URL state only" rule from `CLAUDE.md`,
which was explicit that lifting it required an ADR.

Phase 2 needs, at minimum:

- Per-account notebooks (rich-text, linked entities, saved over time).
- Auth (magic-link or OAuth).
- An entitlement gate (free / trial / paid) that the client trusts because
  it's enforced server-side, not just hidden in the UI.
- A place for Stripe webhooks to land and flip subscription state.
- Room to grow: OpenGraph SSR thumbnails for shared deep links, curated
  viewing-plan content, admin dashboards.

It does **not** yet need: realtime collaboration, vector search, heavy media
storage, or a second region. A conservative near-term profile: hundreds to
low thousands of daily notebook writers, KB-sized rows, read-heavy.

The project is solo-operated. Any backend choice has to be reversible, cheap
at zero-to-low usage, and boring to run. The existing deploy target is
Cloudflare Pages (see `docs/architecture.md` § Deployment), configured via
`wrangler.jsonc`. The GitHub → Cloudflare Git integration already builds and
ships the static bundle on every push; Cloudflare secrets are already in the
repo.

## Decision

Adopt **Cloudflare Workers + D1** as the Phase 2 runtime.

- **Cloudflare Workers** hosts the HTTP API (auth callbacks, notebook CRUD,
  Stripe webhooks, OpenGraph SSR). A single Worker service, co-deployed
  with the Pages SPA, reachable at `/api/*` via Pages Functions or a bound
  Worker route.
- **D1** (SQLite at the edge) holds users, sessions, notebooks, subscription
  state. SQLite's shape fits the data model — small, mostly-denormalized
  rows, single-writer per user — and the free tier (5M rows written/day,
  100M rows stored/month at the time of writing) is enough headroom to
  get through Phase 2 launch without a bill.
- **Cloudflare Access** gates Pro-only routes at the edge (Rung 3 of the
  entitlement ladder). Free/trial gating stays in Worker code against D1;
  Access is reserved for true paid-only endpoints where the request should
  never even reach our handler without a valid JWT.
- **Wrangler** (already a transitive part of the Pages deploy) is the one
  CLI: `wrangler dev` for local, `wrangler d1 migrations apply` for schema,
  `wrangler deploy` for the Worker. No extra toolchain.

The Worker and D1 are a separate deploy target from the Pages SPA but share
the same account, the same `wrangler.jsonc` neighbourhood, and the same
ops surface (Cloudflare dashboard). Static assets stay on Pages; API and
database are Workers + D1.

Module-boundary rule: Workers handler code lives in a new top-level
directory (`worker/` or `functions/`, to be decided in the first
implementation issue — #218). It is **not** importable from `src/`, and
`src/` does not import Cloudflare runtime types. The existing boundary
rules in `CLAUDE.md` apply unchanged to the SPA.

## Consequences

- **No second provider.** Everything stays on Cloudflare — one dashboard,
  one billing relationship, one status page to follow. Lower cognitive
  load for a solo op.
- **Cost profile.** At Phase 2 launch usage, expected monthly spend is $0
  (Workers free tier: 100k requests/day; D1 free tier: 5M rows
  written/day, 5GB storage). First paid tier kicks in well past
  product-market fit.
- **Postgres features we give up.** D1 is SQLite — no `jsonb` operators,
  no full-text search beyond FTS5, no `LISTEN/NOTIFY`, no extensions.
  Acceptable for Phase 2's data shape (notebooks are documents keyed by
  user_id; queries are "list my notebooks by date"). If a feature ever
  demands Postgres we can move state to Neon or Supabase behind the same
  Worker API without the client noticing.
- **Edge-first constraints.** Workers have CPU-time limits per request
  (50ms on free tier, 30s on paid) and no filesystem. Heavy work
  (OpenGraph thumbnail compositing, curated-plan builds) that doesn't fit
  the budget moves to a scheduled Worker, Cloudflare Images, or a
  pre-computed asset on Pages — not to a long-lived Node process.
- **WebSockets / realtime.** Not needed for Phase 2 launch. Durable
  Objects remain available if a future milestone wants live-sync notebooks
  or multiplayer viewing sessions; no commitment now.
- **Local dev.** `wrangler dev` runs the Worker and a local D1 instance
  against the Pages dev server. Contributors need `wrangler` on their
  path. No Docker, no local Postgres.
- **CI.** The existing GitHub Actions lint/test/build pipeline is
  unchanged for the SPA. Worker deploys go through a new job (to be added
  alongside #218) that runs `wrangler deploy` on merge to `main`. Secrets
  (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) are already present.
- **License / attribution.** `wrangler`, `@cloudflare/workers-types`, and
  any D1 client libraries are MIT or Apache-2.0 (to be verified per-dep
  in the infra issues). No copyleft concerns.
- **Reversibility.** Data is SQLite. A one-off export via `wrangler d1
export` can move it anywhere that speaks SQL. Auth tokens are JWTs
  whose signing key we own; we can re-issue them against any new backend.

## Alternatives considered

- **Supabase** — fastest ramp: Postgres + GoTrue auth + Realtime + RLS
  in one box, with generous free tier and good docs. Rejected for
  Phase 2 because (a) it adds a second provider and billing
  relationship purely for features we don't yet need (Realtime,
  RLS-on-Postgres, vector), (b) notebook data is small and document-
  shaped, so SQLite covers it without giving anything up, and
  (c) keeping everything on Cloudflare preserves the "boring ops"
  property Rob explicitly wants for the solo phase. **Revisit if:**
  realtime collaborative notebooks move onto the near-term roadmap, or
  we need Postgres-specific features (vector, `jsonb`, full-text).
- **Firebase** — battle-tested and fast to ship against, but tight
  Google lock-in, heavy client SDK, and an auth system that's painful
  to migrate off. The Firestore data model (nested documents, imperative
  security rules) also doesn't buy us anything over SQLite for the
  notebook shape. Rejected.
- **Self-hosted Node + Postgres (e.g. Fly.io, Railway, a VPS)** — most
  flexible long-term, worst near-term ops. A solo operator running a
  service does not need to also be running a database. Rejected.
- **Neon + Workers** — keep Workers for compute, put Postgres behind
  it via Neon's serverless driver. More power than D1 at a similar
  free tier, but introduces the second-provider cost for features we
  don't need yet. Kept as the natural escape hatch if D1 ever stops
  being enough.
- **Stay serverless-less (no backend at all, use localStorage + an
  embeddable Stripe checkout)** — briefly considered for 2A-style
  milestones. Rejected for Phase 2 proper because entitlement gating
  without a server is trivially bypassable and because Stripe webhooks
  need somewhere to land.
