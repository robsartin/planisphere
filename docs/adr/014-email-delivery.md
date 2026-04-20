# ADR 014 — Email delivery: Resend HTTP API

**Date:** 2026-04-20
**Status:** Accepted

## Context

ADR 011 and the shipped auth slice (#227) added `worker/email.ts` with an
`EmailSender` interface and a `ConsoleEmailSender` stub that logs the
magic-link URL to the Worker console. That stub is fine for local dev
and the private beta — a grepable `[auth] magic link for …` line in
`wrangler tail` is faster than a round trip to an inbox — but it means
nobody outside the development loop can actually sign in.

We need real email delivery before we ship sign-in to anyone who isn't
tailing the Worker logs. The requirements:

1. **Transactional**, not marketing — magic links, deliverability-first.
2. **HTTP-API-based**, reachable from a Cloudflare Worker using only
   `fetch()`. No Node-only SMTP libs, no `@aws-sdk/*` packages bloating
   the Worker bundle.
3. **Permissive license on any SDK we might eventually add** — in
   practice we'll use raw `fetch`, keeping the dep surface zero.
4. **Sensible free / low-volume pricing** for the private beta.
5. **Domain-verification story** that lives in DNS (SPF, DKIM), so the
   migration cost to another provider later is "swap the sender class +
   update DNS," not "re-architect email."

## Decision

Use **Resend** (https://resend.com) as the email provider, called via
its HTTP API (`POST https://api.resend.com/emails`) directly from the
Worker with `fetch`.

Concretely:

- No new npm dependency. `ResendEmailSender` lives in
  `worker/email.ts` alongside the existing `ConsoleEmailSender` and
  implements the same `EmailSender` interface.
- API key is a Worker secret: `RESEND_API_KEY` (set via
  `wrangler secret put`). Missing / empty → factory falls back to
  `ConsoleEmailSender`. This keeps local dev and the Vitest worker
  tests running offline.
- `EMAIL_FROM` is a non-secret var in `wrangler.jsonc` — the verified
  sender address on the Resend side (e.g. `noreply@planisphere.app`).
- The Worker boot path passes `env` into `createEmailSender(env)`; the
  factory picks the right implementation.

Licensing: Resend's customer-facing service has no license bearing on
our code. We're not taking a runtime Resend SDK dep — just calling
their REST API — so there's no OSS license to audit here. An account
TOS applies, not a software license.

## Consequences

- **Dependency surface:** unchanged (zero new npm packages). The
  provider is an external service, not a library.
- **Operational steps** (one-time, per environment):
  1. Verify a sender domain in the Resend dashboard (SPF + DKIM
     TXT records on the domain's DNS).
  2. Create an API key with "Send Email" scope.
  3. `wrangler secret put RESEND_API_KEY` — paste the key.
  4. Update `EMAIL_FROM` in `wrangler.jsonc` to the verified sender
     address and redeploy.
- **Offline / test friendliness:** the factory's secret-presence check
  means `pnpm dev`, `pnpm test:worker`, and the preview deploy all
  keep working when no Resend key is configured. The fallback is the
  existing console stub — tests don't need to mock Resend.
- **Swap cost** (if we ever leave Resend):
  - Add a new `FooEmailSender` class implementing `EmailSender`.
  - Flip the factory's selector (env-var name + implementation class).
  - Update DNS if the new provider needs different records.
  - No change to routes, no migration of data. The boundary is clean.
- **Deliverability:** Resend's shared IPs are reputable and it ships
  SPF/DKIM by default when a domain is verified. Dedicated IPs are a
  paid add-on we don't need at beta volumes.

## Alternatives considered

- **Postmark.** Comparable quality, arguably better reputation for
  pure transactional. Rejected on minor DX factors: its API requires a
  `Server-Token` header with a per-server token; its account model
  separates transactional and broadcast servers up-front; pricing
  tiers kick in sooner. Nothing disqualifying — a reasonable swap if
  Resend deliverability disappoints.
- **AWS SES.** Cheapest at scale and the most mature. Rejected for
  Worker fit: the first-class path is the AWS SDK, which is heavyweight
  for a Worker. The raw SigV4-signed HTTP request is doable but
  substantially more code than Resend's `Authorization: Bearer` +
  JSON body. Account setup (IAM, sandbox-exit process) also adds
  days, not hours.
- **Mailgun.** Historically the transactional default; the service
  has drifted toward marketing-first in recent years and its
  documentation lags the API. No compelling DX or price advantage
  over Resend at our volume.
- **SendGrid.** Ownership change + recent deliverability incidents
  made it the weakest option on reputation among the names considered.
- **Cloudflare Email Workers / Email Routing.** Cloudflare-native and
  tempting for the "one vendor" reason, but **inbound-only** at the
  time of writing. Not applicable to sending magic links.
- **Staying on `ConsoleEmailSender` forever.** Rejected — we can't
  ship sign-in to real users who aren't tailing `wrangler`.
