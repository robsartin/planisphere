# ADR 010 — Auth mechanism: magic-link + OAuth (Google + GitHub) over D1 sessions

**Date:** 2026-04-19
**Status:** Superseded by [ADR 011](011-auth-mechanism-shipped.md) on 2026-04-19

> Superseded before any implementation landed. PR #227 was already in flight
> with a different (and better-considered) design when this ADR merged. The
> shipped design — HMAC-signed cookies over live D1 sessions, magic-link
> only for launch — is recorded in ADR 011. This ADR is retained as the
> record of the alternative that was considered and rejected.

## Context

Issue #218 (Plan 07 Phase 2 milestone 2C) needs authentication. ADR 009
picked Cloudflare Workers + D1 as the runtime but deliberately deferred the
auth-mechanism decision. The spec (`docs/plans/2026-04-19-07-ux-transformation.md`
§ 2C) lists the options as "Email magic-link or OAuth (Google, GitHub)" and
requires:

- Account state drives the trial / paid gate.
- Free trial mechanic: 14 days of Notebook features via localStorage, no
  card, zero friction.
- Session stored server-side; client reads via secure cookie.
- Convert to a real account on "Save to cloud".

Current state (ADR-less, introduced by #224): `src/features.ts` persists a
bare `{ email }` object in localStorage and checks it against a hard-coded
allowlist. This is Rung 1 of the entitlement ladder — trivially bypassable,
fine for a private beta, not fine once money is involved.

Constraints:

- Solo-op. Boring ops. No password database to babysit.
- No second billing relationship unless a feature demands it (ADR 009).
- The free-trial ethos is "enter an email, try Notebook, pay later"; any
  signup step that's heavier than that erodes the conversion funnel.
- Workers runtime: no long-lived processes, no filesystem, 50 ms CPU budget
  per request on the free tier.

## Decision

Support **both** sign-in flows from day one, against a single server-side
session layer:

1. **Email magic-link (primary)** — users enter an email, we send a
   one-time login link, clicking it sets a session cookie. No password
   ever stored. Delivered via **Resend** (HTTP API, works inside Workers,
   3k emails/month free tier — ample for Phase 2 launch traffic). One
   provider dependency; domain verification is a one-time setup against
   the `planisphere.*` domain we already own.
2. **OAuth — Google + GitHub (secondary)** — "Continue with Google" /
   "Continue with GitHub" buttons alongside the email field. Standard
   authorization-code flow with PKCE, implemented directly against each
   provider's endpoints (no third-party auth SDK). On first OAuth sign-in
   we create/find the `users` row by normalized email and attach the
   `oauth_identity`.

Both flows land at the same place: a server-issued opaque session token
stored in D1, delivered to the browser as a `HttpOnly; Secure;
SameSite=Lax` cookie.

### Session model

- `sessions` is a D1 table: `(id TEXT PRIMARY KEY, user_id, created_at,
expires_at, last_seen_at)`.
- `id` is 32 bytes of `crypto.getRandomValues` base64url-encoded. Opaque
  to the client.
- Cookie name: `planisphere_session`. Attributes: `HttpOnly; Secure;
SameSite=Lax; Path=/; Max-Age=2592000` (30 days, rolling — refreshed on
  each authenticated request).
- Logout deletes the row; the cookie becomes dead immediately, no grace
  window, no distributed revocation list to reconcile.
- JWTs are **not** used. An extra D1 row read per authenticated request
  is cheap (the request is already hitting D1 for notebook data) and
  buys instant revocation, no key-rotation story, and no "is this JWT
  actually still valid" ambiguity.

### Magic-link specifics

- `POST /api/auth/magic-link/request` with `{ email }` → inserts a row in
  `magic_link_tokens(token, email, expires_at, consumed_at)` and emails
  the user a link to `/api/auth/magic-link/consume?token=<32 bytes>`.
- Token lifetime: 15 minutes. Single-use (consumed → `consumed_at` set).
- Rate-limit: ≤ 3 requests per email per 10 min window, enforced by a
  D1 query over `magic_link_tokens`. Not Turnstile yet — revisit if
  abuse shows up.
- Email body is plain text + HTML, signed-from `login@planisphere.<tld>`.
- `GET /api/auth/magic-link/consume?token=…` verifies, marks consumed,
  upserts the `users` row, creates a `sessions` row, sets the cookie,
  302-redirects to `/?welcome=1`.

### OAuth specifics

- Flow: authorization code + PKCE. Per-provider client IDs and secrets
  stored as Wrangler secrets (`GOOGLE_OAUTH_CLIENT_ID`,
  `GOOGLE_OAUTH_CLIENT_SECRET`, `GITHUB_OAUTH_CLIENT_ID`,
  `GITHUB_OAUTH_CLIENT_SECRET`).
- `GET /api/auth/oauth/:provider/start` → generate `state` + PKCE
  `code_verifier`, stash them in a short-lived `oauth_states` D1 row,
  302 to the provider's authorize endpoint.
- `GET /api/auth/oauth/:provider/callback?code=…&state=…` → verify
  `state`, exchange `code` for an access token, fetch the user's
  primary verified email, upsert `users` by email, upsert
  `oauth_identities(provider, provider_user_id, user_id)`, create
  session, set cookie, 302 to `/?welcome=1`.
- **No refresh tokens retained.** We only use the provider to prove
  identity once per session; we don't need ongoing access.
- Scopes: Google `openid email`; GitHub `user:email`. Nothing else.

### Account linking

First sign-in by email `foo@example.com` creates the `users` row. A
later Google sign-in for the same email attaches an `oauth_identities`
row to the existing user. A later GitHub sign-in attaches another.
Single `users` row, multiple ways to authenticate into it. A different
email on an OAuth profile creates a separate account — we do not do
surprise merges.

### Trial mechanic

- Trial is **client-side** and **account-less**. First time a user
  enters Notebook mode we stamp `localStorage.planisphere.trial.startedAt`.
- `isTrialActive()` returns `(Date.now() - startedAt) < 14 days`.
- After 14 days, the trial banner becomes a conversion nag ("Save to
  cloud to keep using Notebook beyond the trial") — the UI still works.
- "Save to cloud" triggers the magic-link / OAuth flow. On successful
  sign-in, the Worker migrates whatever's in localStorage into the
  authenticated user's D1 rows. No account == no cloud save, but
  local notebooks persist.
- Rung 1 (`isPro()` email allowlist) remains unchanged for dev/beta
  access; the trial sits below it and is orthogonal.

## Consequences

- **Two client integrations to ship.** Magic-link form + two OAuth
  buttons. Mitigated by sharing the post-auth cookie/redirect plumbing
  between all three — the divergence is front-door only.
- **Four secrets to manage in Wrangler** (Resend API key plus four
  OAuth client IDs/secrets across two providers). Documented in
  `worker/README.md` (to be added in the first implementation PR).
- **Two provider relationships beyond Cloudflare and Stripe** — Resend
  (email) and Google / GitHub (OAuth identity). All three have free
  tiers adequate for Phase 2 launch; none require billing setup to
  start. Each adds a surface that can break ("Google paused this OAuth
  app", "Resend deliverability drop"); mitigation is that magic-link
  and OAuth are independent paths, so an outage on one still leaves the
  other working.
- **No password reset, ever.** Magic-link and OAuth both make password
  resets a non-feature. Fewer flows, less attack surface, no secret
  hashing code to review.
- **GDPR-friendly.** We store an email, an opaque session token, and
  optionally one or two `(provider, provider_user_id)` tuples. Account
  deletion is a single `DELETE FROM users WHERE id = ?` with foreign
  keys cascading. "Download my data" is a `SELECT` over a handful of
  tables.
- **Rate-limiting surface.** Magic-link request is the obvious abuse
  target. D1-query throttling covers the launch; Cloudflare
  Turnstile / WAF rate rules are the escape hatch if logs show noise.
- **Workers compatibility.** All of `crypto.subtle`, `crypto.getRandomValues`,
  `fetch`, and `Response` are available in the Workers runtime. No Node
  polyfills. The email template renders as a string (no React server
  rendering).
- **Testability.** The Worker HTTP handlers are pure functions of
  `(Request, env)`. Unit tests construct synthetic requests; the D1
  binding is swapped for an in-memory implementation in tests. No
  integration test against live Resend or OAuth providers in CI — those
  are stubbed at the module boundary.
- **Reversibility.** Sessions are rows in D1; switching providers
  later (e.g. replacing Resend with SES) is a single email-module
  swap. Switching away from D1 is covered by ADR 009.
- **License / attribution.** No new npm dependencies are introduced by
  this ADR: the Worker speaks to Resend and OAuth providers over plain
  `fetch`. If a subsequent PR adds a thin Resend or OAuth helper
  library, that library's license is recorded in `NOTICE` at that
  point.

## Alternatives considered

- **Magic-link only.** Recommended against only because OAuth buttons
  measurably reduce signup friction for users who already have a
  Google or GitHub account, and because Rob explicitly asked for
  both options in the Phase 2 plan review. Implementation cost of
  adding OAuth on top of an already-shipped magic-link path is
  modest; deferring it means a second migration later.
- **OAuth only (Google + GitHub).** Rejected: locks out every user
  who doesn't have a Google or GitHub account (non-trivial overlap
  with stargazers / educators / older demographics). Magic-link is
  the universal fallback.
- **Passwords.** Rejected: introduces credential storage, password
  reset flows, breach-list check surface, and a forgotten-password
  email path that ends up being magic-link anyway. Modern Auth 101
  is "don't ship password auth unless there's a reason."
- **Third-party auth platform (Clerk, Auth0, Supabase Auth, Firebase
  Auth).** Fast to integrate but reintroduces the second-provider
  cost that ADR 009 explicitly rejected, and puts the session source
  of truth outside our D1. Not worth it for two flows against a
  single users table.
- **JWT-only sessions** (no D1 `sessions` table, cookie is the JWT).
  Faster per-request — no D1 lookup. Rejected: cheap revocation and
  rolling expiry are worth one small D1 read given every
  authenticated request is hitting D1 anyway. Key-rotation and
  "invalidate all sessions" semantics are also substantially easier
  with server-side sessions.
- **Resend → alternatives.** Amazon SES is cheaper at scale but
  heavier to set up (domain + DKIM + console UX); deferred behind
  Resend as the natural graduation path if volume justifies it.
  MailChannels' Workers-free-tier ended in 2024 and now requires a
  paid plan — no longer the default. Postmark is close to Resend
  feature-wise but Resend's Workers story is slightly tighter.
