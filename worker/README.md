# `worker/` — Cloudflare Worker (Phase 2 API)

First backend code in this repo. Scope and rationale are in
[ADR 009](../docs/adr/009-backend-selection.md); the dev-dep choices for
testing and local dev are in [ADR 012](../docs/adr/012-worker-deps.md).
The shipped auth design is [ADR 011](../docs/adr/011-auth-mechanism-shipped.md)
(supersedes the initial [ADR 010](../docs/adr/010-auth-mechanism.md)).

This Worker owns the `/api/*` surface for the Notebook-tier features.
Milestone 2C (#218, #227, #234) shipped the magic-link auth slice; milestone
2D (#219) added the notebook CRUD routes backing ADR 013. Stripe (#221) and
subsequent milestones layer in without changing the module shape.

## Layout

```
worker/
  index.ts         Fetch handler. Parses the URL, dispatches to a route module.
  session.ts       Shared cookie + session helpers (getAuthenticatedUserId).
  routes/
    auth.ts        /api/auth/* — request-link, callback, logout, me.
    notebooks.ts   /api/notebooks[/:id] — list, create, read, update, delete.
  db.ts            Thin helpers over the D1 binding. Hand-rolled prepared
                   statements; no ORM.
  crypto.ts        Token generation + HMAC cookie signing / verification via
                   the workers `crypto.subtle` runtime.
  email.ts         EmailSender interface + a console-log stub for dev.
                   Swap in Resend/Postmark/SES in a one-file change.
  types.ts         Shared types: Env binding, row types, ApiErrorCode union,
                   size caps (NOTEBOOK_CONTENT_MAX_BYTES etc).
  *.test.ts        Vitest tests running under @cloudflare/vitest-pool-workers
                   — real workerd + real D1. See vitest.worker.config.ts.

migrations/
  0001_init.sql       users, magic_links, sessions tables + indexes.
  0002_notebooks.sql  notebooks table + (user_id, updated_at DESC) index.
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

## Notebook routes (`/api/notebooks`)

Every route below requires an authenticated session (same `ps_session`
cookie). Unauthenticated → `401 {"error":"unauthenticated"}`. All input
validation failures → `400 {"error":"invalid_payload"}`.

| Method   | Path                 | Body                                        | Success response                                          |
| -------- | -------------------- | ------------------------------------------- | --------------------------------------------------------- |
| `GET`    | `/api/notebooks`     | —                                           | `200 {"notebooks":[{id,title,created_at,updated_at}, …]}` |
| `POST`   | `/api/notebooks`     | `{"title": string, "content_json": string}` | `201 {id, title, content_json, created_at, updated_at}`   |
| `GET`    | `/api/notebooks/:id` | —                                           | `200 {id, title, content_json, created_at, updated_at}`   |
| `PUT`    | `/api/notebooks/:id` | `{"title": string, "content_json": string}` | `200 {… updated row …}`                                   |
| `DELETE` | `/api/notebooks/:id` | —                                           | `204`                                                     |

Constraints enforced server-side:

- `title`: non-empty after trimming, ≤ 200 chars.
- `content_json`: must parse as JSON (shape is tiptap JSON per ADR 013),
  ≤ `NOTEBOOK_CONTENT_MAX_BYTES` (256 KB) UTF-8 encoded.
- `:id`: positive integer; malformed → 400.
- Ownership: reads and writes are scoped to the authenticated user —
  another user's id is indistinguishable from a missing one (404).

The list endpoint excludes `content_json` so the response stays small.

## Env / secrets

Declared as the `Env` type in `worker/types.ts`:

```ts
type Env = {
  DB: D1Database;
  APP_ORIGIN: string; // e.g. "https://planisphere.app" — cookie redirects
  SESSION_SECRET: string; // HMAC key — set via `wrangler secret put`
  RESEND_API_KEY?: string; // Resend secret — ADR 014
  EMAIL_FROM?: string; // verified sender on Resend
};
```

`SESSION_SECRET` and `RESEND_API_KEY` are Worker secrets (never committed).
`APP_ORIGIN`, `EMAIL_FROM`, and the D1 binding are in `wrangler.jsonc` —
the single Worker-with-Static-Assets config that deploys both this
module and the SPA `dist/` bundle. The dev `SESSION_SECRET` is a
placeholder string — fine for local development, not for any deployed
environment.

### Email delivery (Resend)

Real magic-link email uses the [Resend](https://resend.com) HTTP API
(ADR 014). To switch off the dev stub in a deployed environment:

1. Verify your sender domain in the Resend dashboard — add the SPF +
   DKIM TXT records they emit to your DNS.
2. Create an API key scoped to "Send Email".
3. `pnpm exec wrangler secret put RESEND_API_KEY` — paste the key.
4. Set `EMAIL_FROM` in `wrangler.jsonc` to the verified address
   (e.g. `noreply@planisphere.app`) and redeploy.

Until both `RESEND_API_KEY` and `EMAIL_FROM` are non-empty, the Worker
uses `ConsoleEmailSender` — grep `wrangler tail --search "[auth]"` for
`[auth] magic link for <email>: <url>`.

## Background sweep (cron trigger)

`worker/index.ts` exports a `scheduled` handler invoked by Cloudflare on
the cron schedule declared in `wrangler.jsonc` (`triggers.crons`,
hourly). Each run calls:

- `deleteExpiredMagicLinks(env.DB)` — drops rows past their `expires_at`
  **or** already used. Magic-link TTL is `MAGIC_LINK_TTL_SECONDS` (15
  minutes) — `consumeMagicLink` enforces it on the read path too.
- `deleteExpiredSessions(env.DB)` — drops sessions past `expires_at`.
  `getActiveSession` already rejects them at read time, so the rows
  linger harmlessly between sweeps; this just keeps the table from
  growing forever.

Both helpers return the row count, which is logged as
`[sweep] magic_links=N sessions=N` for `wrangler tail` visibility.

## Deferred (out of scope)

- Client-side editor + save/load wire-up — lands with the editor-swap PR.
- Stripe billing / webhooks — milestone 2F (#221).
- Notebook content persistence to D1 — milestone 2D (#219).
- Rate-limiting beyond the request-link rule.
- Admin UI.

## Running locally

```
pnpm exec wrangler d1 migrations apply planisphere-dev --local   # one-time
pnpm dev                                                         # vite :5173 + wrangler dev :8787
```

Vite proxies `/api/*` → `http://localhost:8787` so the SPA stays on one
origin for fetch / cookie semantics, matching production (where the merged
`wrangler.jsonc` serves both halves). `pnpm dev:client` and `pnpm
dev:worker` are available for running only one side. See
`docs/adr/012-worker-deps.md` for why we use `concurrently`.

## First-time deploy (per environment)

The Worker and its D1 database are provisioned out-of-band; `wrangler.jsonc`
ships with placeholder values.

```
pnpm exec wrangler d1 create planisphere-dev            # paste the UUID into wrangler.jsonc
pnpm exec wrangler secret put SESSION_SECRET            # strong random value, per env
pnpm exec wrangler d1 migrations apply planisphere-dev --remote
```

After that, the Cloudflare Git integration takes over — every push to
`main` (and every PR) gets both the SPA and `/api/*` in the same preview
URL.

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
