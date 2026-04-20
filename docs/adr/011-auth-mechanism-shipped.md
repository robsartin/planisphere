# ADR 011 — Auth mechanism (shipped): HMAC-signed cookies + live D1 sessions, magic-link-only for launch

**Date:** 2026-04-19
**Status:** Accepted — supersedes [ADR 010](010-auth-mechanism.md)

## Context

[ADR 010](010-auth-mechanism.md) proposed a specific auth design for issue #218:
opaque session tokens in D1, magic-link + OAuth (Google + GitHub) in one shot,
Resend for email delivery. ADR 010 was accepted and merged (#230) before its
author noticed that PR #227 was already in flight implementing milestone 2C
with a different, more conservative design.

On review, #227's design is better for shipping Phase 2 — strictly stronger
on one axis (cookie forgery), smaller on the ones that didn't need to ship
in the first auth PR (OAuth, real email provider). This ADR records what
actually shipped, supersedes ADR 010, and names the deferred work so the
follow-ups are tracked rather than lost.

## Decision

The shipped auth design for milestone 2C is:

1. **Session cookie is HMAC-signed AND validated against a live D1 `sessions`
   row.** Cookie value shape: `<sessionId>.<base64url(HMAC-SHA256(secret, sessionId))>`.
   The session id is a `crypto.randomUUID()` (122 bits of entropy); the HMAC
   makes the pair unforgeable. Verification uses constant-time byte comparison.
   Validation also requires a non-expired row in `sessions` — so logout is
   instantaneous (`DELETE FROM sessions WHERE id = ?`) and no JWT-revocation
   distributed-list problem ever arises.
2. **Cookie name `ps_session`.** Attributes: `HttpOnly; SameSite=Lax; Path=/;
Max-Age=2592000` (30 days). `Secure` is appended only when the callback
   URL is HTTPS, so local `http://localhost:8787` dev works; production is
   always HTTPS so the attribute is always present there.
3. **Magic-link only for launch.** `POST /api/auth/request-link` → normalize
   email, rate-limit (one pending link per email per 60 seconds), upsert
   user, insert `magic_links` row, hand the callback URL to the
   `EmailSender`. `GET /api/auth/callback?token=…` → atomic
   `UPDATE magic_links SET used_at = ? WHERE token = ? AND used_at IS NULL
RETURNING *`, upsert user, insert `sessions` row, sign + set cookie, 302
   to `APP_ORIGIN/`.
4. **`EmailSender` interface with a `ConsoleEmailSender` stub.** The magic-link
   URL is `console.log`'d at the Worker; a developer pastes it into the
   browser. Swapping in a real provider is a one-file change.
5. **No OAuth in the shipping PR.** Google + GitHub flows are deferred; the
   interface surface (sign-in modal in `src/ui/login-modal.ts`) is
   magic-link-first so OAuth buttons can be added alongside later without
   restructuring.
6. **Schema** (`migrations/0001_init.sql`): `users(id, email UNIQUE, tier,
created_at)`, `magic_links(token PK, email, created_at, used_at)`,
   `sessions(id PK, user_id FK, created_at, expires_at)`, plus indexes on
   `magic_links.email` and `sessions.expires_at`. Simpler than ADR 010's
   proposed schema — no `oauth_identities` / `oauth_states` tables yet
   (they land when OAuth does).
7. **Module boundary preserved.** `worker/` and `src/` do not import each
   other. Shared shapes (`{email, tier}`) cross only on the wire. Separate
   `tsconfig.worker.json` + `vitest.worker.config.ts` give the Worker its
   own typecheck + test run under real workerd + in-memory D1.

## Differences from ADR 010

| Topic            | ADR 010 proposed                    | ADR 011 shipped                                   |
| ---------------- | ----------------------------------- | ------------------------------------------------- |
| Cookie integrity | opaque token, D1-row check only     | HMAC-signed **and** D1-row check (belt + braces)  |
| Cookie name      | `planisphere_session`               | `ps_session` (shorter header)                     |
| `Secure` flag    | always                              | only when callback is HTTPS (unblocks local dev)  |
| Auth methods     | magic-link + OAuth (Google, GitHub) | magic-link only for launch; OAuth deferred        |
| Email provider   | Resend                              | `ConsoleEmailSender` stub; real provider deferred |
| Rate-limit       | ≤ 3 per email per 10 min            | 1 pending link per email per 60 s                 |
| Schema           | `oauth_identities`, `oauth_states`  | not yet (land with OAuth)                         |
| Trial mechanic   | in the auth milestone               | separate follow-up, not coupled to auth           |

Everything in ADR 010 that isn't contradicted above (module boundary,
session-as-source-of-truth, HttpOnly/SameSite=Lax/Path=/ attributes, session
TTL = 30 days rolling, no password reset ever) carries through unchanged.

## Consequences

- **Signed + D1 is strictly stronger than opaque + D1.** A stolen cookie is
  still useful to an attacker (both schemes), but a forged cookie fails at
  the HMAC check before we even hit D1. No measurable latency cost — the
  HMAC is a single SHA-256 over <50 bytes.
- **`SESSION_SECRET` is a Worker secret** (`wrangler secret put
SESSION_SECRET`). The value in `wrangler.worker.jsonc` is a dev-only
  placeholder. Rotating the secret invalidates all live sessions — an
  accepted consequence, documented in `worker/README.md`.
- **OAuth is a known follow-up, not a shipped feature.** The sign-in modal
  today has only an email field; Google / GitHub buttons land when OAuth
  does. No trial-gate code assumes OAuth exists.
- **`ConsoleEmailSender` is acceptable for the first PR because the auth
  audience at this moment is the `PRO_EMAIL_ALLOWLIST` (ADR 010 §Context).**
  Before the email gate opens to non-allowlisted users, a real provider
  swap is mandatory.
- **Naming: `ADR 010` in this repo is this repo's first auth-mechanism
  decision; `ADR 011` is the shipped revision.** PR #227 authored its own
  ADR at `docs/adr/010-worker-deps.md` before 010-auth-mechanism landed;
  on rebase that file must be renumbered (the next free slot after this
  ADR is `ADR 012`). The rename is mechanical; no content change.

## Follow-ups tracked against #218 (not this ADR)

- Real email provider (Resend or equivalent) — swap the `EmailSender`
  implementation and wire a `RESEND_API_KEY` secret.
- OAuth (Google + GitHub) — add `oauth_identities` + `oauth_states`
  tables, implement `/api/auth/oauth/:provider/start` and
  `/api/auth/oauth/:provider/callback`, add buttons to `login-modal.ts`.
- 14-day localStorage trial mechanic — Phase 2 spec §2C; orthogonal to
  auth, waits on Notebook workspace (#219).
- Session / magic-link TTL pruning (cron) — sessions have `expires_at`
  but nothing deletes expired rows yet.
- Broader rate-limiting (per-IP, Turnstile) — current 1-per-60s-per-email
  is minimal.
- CI job to run Worker tests + Worker coverage gate — today the Worker
  tests run locally via `pnpm test:worker`; CI gating lives in the
  follow-up.

## Alternatives considered (vs. what was in ADR 010)

- **Opaque-only sessions (original ADR 010).** Still safe. Rejected in favor
  of signed-plus-row because the HMAC cost is trivial and prevents a class
  of bugs (e.g. session-id guess/typo landing on another user's row).
- **Pure-JWT sessions.** Already rejected in ADR 010 for the same reasons
  here — no cheap revocation, key-rotation pain.
- **OAuth at launch.** Ship-blocker risk: two OAuth client registrations,
  PKCE, state handling. None of it hard, all of it is extra surface before
  the first login exists. Deferred.
- **Resend at launch.** Requires domain verification + secret management
  before auth can go through its first green path. `ConsoleEmailSender`
  lets #227 ship the Worker + schema + client plumbing now; Resend swap
  is a two-line change when deliverability is needed.
- **Rewriting #227 to match ADR 010.** Considered. ~3,600 LOC of working,
  tested code discarded in exchange for a slightly more uniform session
  story. Not a trade I'm willing to make.
