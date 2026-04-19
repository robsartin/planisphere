# `worker/` — Cloudflare Worker (Phase 2 API)

First backend code in this repo. Scope and rationale are in
[ADR 009](../docs/adr/009-backend-selection.md); the dev-dep choices for
testing and local dev are in [ADR 010](../docs/adr/010-worker-deps.md).

This Worker owns the `/api/*` surface for the Notebook-tier features. Milestone
2C (this PR, closes #218) ships the magic-link auth slice; notebook CRUD
(#219), Stripe (#221), and follow-ups are layered in later without changing
the module shape.

## Layout

```
worker/
  index.ts      Fetch handler. Parses the URL, dispatches to a route module.
  routes/
    auth.ts     /api/auth/* — request-link, callback, logout, me.
  db.ts         Thin helpers over the D1 binding. Hand-rolled prepared
                statements; no ORM.
  crypto.ts     Token generation + HMAC cookie signing / verification via
                the workers `crypto.subtle` runtime.
  email.ts      EmailSender interface + a console-log stub for dev.
                Swap in Resend/Postmark/SES in a one-file change.
  types.ts      Shared types: Env binding, User row, MagicLink row,
                AuthError domain union, SessionPayload.
  *.test.ts     Vitest tests running under @cloudflare/vitest-pool-workers
                — real workerd + real D1. See vitest.worker.config.ts.

migrations/
  0001_init.sql  users, magic_links, sessions tables + indexes.
```

## Module-boundary rule

- `worker/` is the **only** directory that imports `@cloudflare/workers-types`
  and uses the Workers runtime.
- `worker/` does **not** import anything from `src/`, and `src/` does not
  import anything from `worker/`. The two are deployed separately and the
  shapes they share (e.g. `{email, tier}` from `/api/auth/me`) live on
  the wire only — the client's own `AuthUser` type is declared in
  `src/auth.ts`.

## Result types

Worker code does not currently use the client's `Result<T, E>` helper; route
handlers produce `Response` objects directly. Domain error cases are returned
as typed JSON with well-known `code` strings (`invalid_email`,
`rate_limited`, `invalid_token`, …) and the right HTTP status. The client's
`src/auth.ts` maps those back into `Result<T, AuthError>` for the rest of
the SPA. This keeps the Worker's HTTP layer idiomatic while still giving the
client the strict-Result contract CLAUDE.md mandates.

## Magic-link flow

```
  client                Worker                 D1                 email
  ------                ------                 --                 -----
  POST /api/auth/
  request-link          rate-limit (60s/email)
  {email}        ─────► check magic_links.created_at
                        crypto.randomUUID() as token
                        INSERT users IF NOT EXISTS
                        INSERT magic_links  ──────► magic_links row
                        EmailSender.sendMagicLink
                                                                  console.log
                        HTTP 202
                ◄──────
  GET /api/auth/
  callback?token=T                                        (user clicks link)
                 ─────► SELECT magic_links WHERE token=T AND used_at IS NULL
                        UPDATE magic_links SET used_at=now   ► marks one-use
                        INSERT sessions  ──────────► sessions row
                        Set-Cookie: ps_session=<signed>
                        Location: APP_ORIGIN/
                ◄──────

  GET /api/auth/me
  (cookie attached) ──► verify HMAC on cookie
                        SELECT sessions, users
                        HTTP 200 {email, tier}
                ◄──────

  POST /api/auth/
  logout        ───────► Set-Cookie: ps_session=; Max-Age=0
                ◄──────  HTTP 204
```

**Single-use tokens.** A token is usable exactly once; the second GET
returns 401 `invalid_token`. Tokens have no explicit TTL in this PR — a
follow-up will add `expires_at` and a periodic cleanup job (#TBD).

**Rate limiting.** One pending magic link per email per 60 seconds. If
the previous link has been used (`used_at IS NOT NULL`) it doesn't count
toward the limit; a freshly-requested second link replaces the pending
one.

**Cookie.** `ps_session` — HTTP-only, `Secure` (in prod), `SameSite=Lax`,
`Path=/`, signed `HMAC-SHA256(SESSION_SECRET, session_id)`. Max-Age 30 days,
matching the `sessions.expires_at` in D1. Verification rejects a cookie
whose signature fails _or_ whose `sessions` row is missing / expired.

## Env / secrets

Declared as the `Env` type in `worker/types.ts`:

```ts
type Env = {
  DB: D1Database;
  APP_ORIGIN: string; // e.g. "https://planisphere.app" — cookie redirects
  SESSION_SECRET: string; // HMAC key — set via `wrangler secret put`
};
```

`SESSION_SECRET` is a Worker secret (never committed). `APP_ORIGIN` and the
D1 binding are in `wrangler.worker.jsonc`. The dev SESSION_SECRET is a
placeholder string — fine for local development, not for any deployed
environment.

## What's stubbed in this PR

- **Email delivery.** `email.ts` logs `[auth] magic link for <email>: <url>`
  to the Worker console. Extracting a `EmailSender` interface means swapping
  in Resend / Postmark / SES is a one-file change.
- **Session expiry cleanup.** Expired `sessions` rows are rejected at read
  time but not pruned. Follow-up.
- **Magic-link expiry.** Tokens are single-use but have no time-to-live
  beyond that. Follow-up.

## Deferred (out of scope)

- Stripe billing / webhooks — milestone 2F (#221).
- Notebook content persistence to D1 — milestone 2D (#219).
- Rate-limiting beyond the request-link rule.
- Admin UI.

## Running locally

```
wrangler d1 create planisphere-dev --local   # one-time
wrangler d1 migrations apply planisphere-dev --local --config wrangler.worker.jsonc
pnpm dev                                     # vite + wrangler dev in parallel
```

`pnpm dev:client` and `pnpm dev:worker` are available for running only one
side. See `docs/adr/010-worker-deps.md` for why we use `concurrently`.

## Testing

Worker tests colocate with source (`worker/*.test.ts`) and run under
`@cloudflare/vitest-pool-workers`, which spins up a real workerd isolate +
D1 binding per test file.

```
pnpm test:worker
```

These tests are **not** part of `pnpm test` / `pnpm test:cov` today — per
the PR scope, Worker code doesn't count toward the Phase-1 `src/**`
coverage gates. A follow-up will decide what a Worker coverage gate looks
like.
