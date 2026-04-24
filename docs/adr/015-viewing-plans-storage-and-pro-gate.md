<!-- SPDX-License-Identifier: Apache-2.0 -->

# ADR 015 — Viewing Plans storage and Pro-gate enforcement

**Date:** 2026-04-24
**Status:** Accepted
**Supersedes:** —
**Superseded by:** —

## Context

Issue #220 ships a Pro-gated "Viewing Plans" feature — a monthly feed of curated astronomy reads. Before this PR the `users.tier` column existed but was unused; every user was effectively `'free'`. The feature is the first active use of that column as a server-side gate, and it introduces a read-only content model (D1-backed, ingested from in-repo Markdown files).

## Decisions

1. **Activate the `users.tier` column as a server-side Pro gate.**
   `/api/plans` and `/api/plans/:slug` return `402 not_pro` unless the session's user has `tier='pro'`. The existing `upsertUser()` already performs get-or-insert semantics (no UPDATE on conflict), so a manual `UPDATE users SET tier='pro' WHERE email=?` survives every subsequent magic-link login. Any future change to `upsertUser()` that adds an `ON CONFLICT DO UPDATE` clause must deliberately exclude `tier` from the update set.

2. **Pro promotion is a documented manual procedure via `wrangler d1 execute`.**
   MVP bootstrap: `UPDATE users SET tier='pro' WHERE email='rob.sartin@gmail.com'`. This is explicitly not a long-term design; the Stripe-driven automation lives in #221 / 2F. Surfacing the command in this ADR so it doesn't evaporate into tribal knowledge.

3. **Read-only content model via in-repo Markdown + seed script.**
   Plans live as Markdown files in `data/plans/<slug>.md` with a JSON frontmatter fence. A zero-dep Node script (`scripts/seed-plans.mjs`) parses, validates, and upserts via `wrangler d1 execute`. Rejected alternatives: cron-driven publishing (YAGNI for one plan) and an admin `POST /api/plans` endpoint (introduces auth surface without a user-facing authoring UX). Revisit when the content-strategy decision (the "people problem" in #220's issue body) lands.

4. **JSON frontmatter rather than YAML.**
   Adopting YAML would require a new devDep (`yaml` / `js-yaml`) and its own ADR. For the MVP's single seed plan the verbosity tax of JSON is lower than the dep tax. Revisit when plan count exceeds ~6, at which point a dedicated YAML ADR makes sense.

## Consequences

- The `tier` column is load-bearing. Documented in this ADR and enforced by tests in `worker/db.test.ts` (`getUserTier`) and `worker/routes/plans.test.ts` (402 path).
- Content changes require a `pnpm seed-plans --remote` invocation post-deploy. This is cheap for the owner but would not scale to community submissions — the content-pipeline follow-up (#220 "people problem") will revisit.
- JSON frontmatter is author-friendly for structured fields and unambiguous for the parser, at the cost of quoting every key and forbidding trailing commas. `data/plans/` is excluded from Prettier so the no-trailing-comma rule is preserved automatically.

## Alternatives considered

- **Bundle plans as a JS import in the SPA** — simpler but can't be gated server-side.
- **Cloudflare KV for plan content** — another moving part without clear benefit over D1 for read-mostly structured data.
- **Admin UI for CRUD** — premature; no use case for non-owner authoring in the MVP.
