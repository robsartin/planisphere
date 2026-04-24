# Monthly Viewing Plans — Design Spec

**Date:** 2026-04-24
**Status:** Approved (brainstorming complete; awaiting implementation plan)
**Issue:** [#220](https://github.com/robsartin/planisphere/issues/220) — UX 2E: Curated monthly viewing plans ("What's up above you")
**Depends on:** ADR 009 (Cloudflare Workers + D1), #218 / 2C (auth), #219 / 2D (notebook workspace — shared patterns only)
**New ADR introduced:** 015 — Viewing Plans storage and Pro-gate enforcement

## 1. Purpose

A Pro-gated Viewing Plans surface. A monthly feed of curated astronomy reads, each a Markdown body paired with clickable linked-entity chips that deep-link into the planisphere's existing intent system. The surface is the first active use of the `users.tier` column as a server-side Pro gate.

This spec scopes the **code-only MVP slice** of #220. The content-pipeline decision (author in-house vs hire vs community-submitted) is intentionally deferred — the data model, ingestion pipeline, and gating work for any of those options.

## 2. Scope

### In scope

- D1 schema + migration for a new `plans` table.
- New Cloudflare Worker routes `GET /api/plans` and `GET /api/plans/:slug`, both gated by session + `tier='pro'`.
- New client wrapper `src/plans.ts` mirroring `src/notebooks.ts`.
- New UI surfaces: Viewing Plans drawer (feed) + full-screen reader modal.
- New HUD entry point (always visible; Pro gate enforced by contents, not by hiding).
- New `AppState.activePlanSlug` field and `?plan=<slug>` URL param for deep-linking.
- Hemisphere filter (client-side, driven by `state.observer.lat`).
- One hand-authored seed plan at `data/plans/2026-04.md` (frontmatter-populated; prose authored by project owner post-landing).
- Zero-dep Node seed script `scripts/seed-plans.mjs` and a `pnpm seed-plans` npm script.
- Documented manual Pro-promotion procedure for `rob.sartin@gmail.com` via `wrangler d1 execute`.
- ADR 015 recording the tier-gate activation, read-only content model, and JSON-frontmatter choice.
- User-guide and architecture-doc updates.
- Full test coverage across state, UI, app, client wrapper, and worker routes, meeting existing CI thresholds.

### Out of scope

- The content-strategy / authorship-pipeline decision (the original #220 "people problem" — filed as a separate follow-up).
- Stripe / paid conversion flow (#221 / 2F).
- Cron-driven auto-publish of a "this month's" plan.
- Admin UI for plan authoring or moderation.
- Plan comments, favorites, "related plans."
- R2-hosted hero images and their licensing/attribution pipeline.
- Lat-range filtering (hemisphere enum covers ~90% of cases).
- Draft / unpublished plan state.
- Authorship metadata beyond a single `author` string.
- i18n of plan content (seed plan is English-only).
- Location-specific altitude or visibility calculations embedded in the plan body.

## 3. Dependencies

No new runtime or devDeps. Everything uses libraries already in `package.json` (`marked`, `dompurify`, Node stdlib in the seed script). JSON frontmatter parses with `JSON.parse`, avoiding a YAML dependency and its associated ADR.

## 4. Data model

### 4.1 D1 migration — `migrations/0004_plans.sql`

```sql
CREATE TABLE plans (
  slug          TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  month         TEXT NOT NULL,                    -- 'YYYY-MM'
  hemisphere    TEXT NOT NULL CHECK (hemisphere IN ('n','s','both')),
  summary       TEXT NOT NULL,
  body_md       TEXT NOT NULL,
  objects_json  TEXT NOT NULL,                    -- JSON array of LinkedEntity
  author        TEXT NOT NULL,
  published_at  INTEGER NOT NULL,                 -- epoch ms
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX idx_plans_month ON plans(month);
```

Notes:

- `slug` is the human-readable primary key (e.g., `2026-04`). Used verbatim in URL `?plan=<slug>`.
- `month` (`YYYY-MM`) is redundant with the MVP slug prefix but becomes meaningful if slugs later go free-form (e.g., `2026-04-lyrids-galaxy-hop`). Kept as a separate column to avoid a later migration.
- `objects_json` is a serialized `LinkedEntity[]` in a TEXT column — idiomatic D1 pattern for small, read-mostly array fields. No second table needed for one-seed MVP.
- All timestamps are `INTEGER` epoch milliseconds, matching the existing schema (`users`, `sessions`, `notebooks`). The Worker converts `published_at` to an ISO-8601 string at the response boundary so the on-wire `publishedAt` field stays human-readable; the seed script converts the authored ISO string back to epoch ms on insert.

### 4.2 Linked-entity shape

```ts
export type LinkedEntityKind =
  | "star" // id = HIP number as string
  | "messier" // id = Messier number as string, e.g. "31"
  | "planet" // id = canonical lower-case name, e.g. "jupiter"
  | "satellite" // id = NORAD id as string
  | "constellation"; // id = IAU 3-letter abbreviation, e.g. "And"

export type LinkedEntity = {
  readonly kind: LinkedEntityKind;
  readonly id: string;
  readonly label: string; // author-provided display text for the chip
};
```

Author-provided `label` means the writer picks the display string ("Andromeda Galaxy (M31)" vs "M31") without the client needing to cross-reference catalog data to render.

### 4.3 Client types (`src/plans.ts`)

```ts
export type PlanSummary = {
  readonly slug: string;
  readonly title: string;
  readonly month: string;
  readonly hemisphere: "n" | "s" | "both";
  readonly summary: string;
  readonly author: string;
  readonly publishedAt: string;
};

export type Plan = PlanSummary & {
  readonly bodyMd: string;
  readonly objects: readonly LinkedEntity[];
};

export type PlanError =
  | { readonly kind: "not_found" }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "not_pro" }
  | { readonly kind: "invalid_payload" }
  | { readonly kind: "network" }
  | { readonly kind: "server" };
```

### 4.4 Seed-file frontmatter — `data/plans/<slug>.md`

```md
---
{
  "slug": "2026-04",
  "title": "April 2026 — title authored by owner",
  "month": "2026-04",
  "hemisphere": "both",
  "summary": "One-line preview for the drawer card.",
  "author": "Rob Sartin",
  "publishedAt": "2026-04-01T00:00:00Z",
  "objects": [{ "kind": "messier", "id": "31", "label": "Andromeda Galaxy (M31)" }],
}
---

Markdown body …
```

**Why JSON frontmatter over YAML.** YAML needs a new devDep (`yaml` / `js-yaml`) and a new ADR. For one seed plan that tax isn't worth paying. JSON parses with `JSON.parse`, gives editor validation for free, and only costs verbosity on the ~10 structured fields — the prose below the fence is still plain Markdown. Revisit when plan count > ~6.

## 5. Worker surface

### 5.1 Routes

```
GET /api/plans         → 200 { plans: PlanSummary[] }   (sorted by month DESC)
GET /api/plans/:slug   → 200 Plan                       (full detail)
```

Read-only — no write endpoints. All content enters D1 via the seed script.

### 5.2 Auth + Pro gate (shared by both handlers)

```ts
// worker/routes/plans.ts
export async function handleListPlans(req: Request, env: Env): Promise<Response> {
  const userId = await getAuthenticatedUserId(req, env);
  if (userId === null) return errorJson("unauthenticated", 401);

  const tier = await getUserTier(env.DB, userId);
  if (tier !== "pro") return errorJson("not_pro", 402);

  const rows = await listPlanSummaries(env.DB);
  return json({ plans: rows });
}
```

`getUserTier(db, userId): Promise<"free" | "pro">` is a new helper in `worker/db.ts`. A missing / null row is treated as `"free"`.

### 5.3 Tier preservation on re-login — verified, no fix needed

The existing `upsertUser()` in `worker/db.ts` is already get-or-insert: it calls `getUserByEmail(email)` first and returns the existing row unchanged if one exists, only inserting with `tier='free'` when the row is new. A manual `UPDATE users SET tier='pro'` survives every subsequent magic-link login for free. No collateral fix needed; no regression test needed beyond the coverage already in the worker suite.

### 5.4 Error mapping

| Status | Body `error`      | Trigger                        |
| ------ | ----------------- | ------------------------------ |
| 401    | `unauthenticated` | No / expired session cookie    |
| 402    | `not_pro`         | Session valid, `tier != 'pro'` |
| 404    | `not_found`       | Unknown slug (or malformed)    |
| 500    | `server`          | DB error / unexpected throw    |

402 "Payment Required" over 403 because the semantic is precisely "this is behind a paid tier."

### 5.5 Slug validation

`/api/plans/:slug` rejects anything outside `^[a-z0-9-]{1,64}$` with 404, not 400 — avoids leaking existence vs non-existence for malformed slugs.

### 5.6 Response shapes

**List** — summaries only (no body, no objects) so the payload stays small:

```json
{
  "plans": [
    {
      "slug": "2026-04",
      "title": "...",
      "month": "2026-04",
      "hemisphere": "both",
      "summary": "...",
      "author": "Rob Sartin",
      "publishedAt": "2026-04-01T00:00:00Z"
    }
  ]
}
```

**Detail** — adds `bodyMd` and `objects`.

## 6. Client wrapper (`src/plans.ts`)

Mirrors `src/notebooks.ts` exactly — single `apiRequest()` helper, `Result<T, PlanError>` return, `credentials: "include"`, no direct `fetch` from the rest of the SPA.

### 6.1 Exports

```ts
export function listPlans(): Promise<Result<readonly PlanSummary[], PlanError>>;
export function getPlan(slug: string): Promise<Result<Plan, PlanError>>;
```

### 6.2 Status → `PlanError` mapping

Centralised in `apiRequest()`:

| HTTP                            | `PlanError.kind`  |
| ------------------------------- | ----------------- |
| 401                             | `unauthenticated` |
| 402                             | `not_pro`         |
| 404                             | `not_found`       |
| 5xx                             | `server`          |
| fetch throws                    | `network`         |
| 2xx + body doesn't match schema | `invalid_payload` |

Payload validation is narrow per-field (`typeof`, enum membership for `hemisphere` and `LinkedEntityKind`, array-ness for `objects`). Not a schema library — same minimalism as `src/auth.ts` and `src/notebooks.ts`.

### 6.3 Caching

Module-local `Map<slug, Plan>` populated by `getPlan()` hits. The list endpoint does not populate the detail cache. No persistence across page reloads.

### 6.4 State integration

Plans are **not** added to `AppState` directly; server-fetched data doesn't belong in URL-serializable state. What _is_ in state:

- New field: `activePlanSlug: string | null`, default `null`. URL-synced as `?plan=<slug>`.
- New intent: `{ type: "set-active-plan"; slug: string | null }`.

Setting the slug to non-null opens the modal; setting it back to `null` closes. This is the only plan-related state the SPA tracks reactively.

## 7. UI surface

### 7.1 New files

- `src/ui/plans-drawer.ts` — drawer containing the plan-list feed (uses the shared `createDrawer` primitive).
- `src/ui/plans-modal.ts` — full-screen reader modal (bare-overlay pattern, matching the Help modal).
- `src/ui/plans-card.ts` — one plan-summary card, reused by the drawer list.

### 7.2 HUD entry point

One new button in the bottom HUD alongside events / tonight's-sky / settings. Always visible to everyone — the Pro gate is enforced by the _contents_ of the drawer, not by hiding the entry point. Ungating the button drives discovery of the Pro tier; non-Pro users see the upsell copy on open rather than never knowing the surface exists.

Click → opens the Viewing Plans drawer via the existing one-drawer-at-a-time coordination (other drawers close).

### 7.3 Drawer states

The drawer body renders one of six states based on `auth + tier + fetch status + filter`:

| State             | Copy                                                      |
| ----------------- | --------------------------------------------------------- |
| `loading`         | "Loading plans…"                                          |
| `unauthenticated` | "Sign in to read monthly viewing plans." + sign-in button |
| `not_pro`         | "Viewing Plans is a Pro feature." + placeholder info text |
| `empty`           | "No plans for the Northern / Southern hemisphere yet."    |
| `error`           | "Couldn't load plans. Try again." + retry button          |
| `list`            | One `plans-card` per plan, latest month first             |

Hemisphere filter is applied **client-side** from `state.observer.lat`: entries with `hemisphere === 'both'` always pass; `'n'` entries require `lat >= 0`; `'s'` require `lat < 0`.

### 7.4 Plan card

Title (prominent) · month label · 1-line summary clipped to ~2 lines · author name. Clicking anywhere on the card dispatches `{ type: "set-active-plan", slug }`.

### 7.5 Modal (reader)

Full-screen overlay. Opens when `state.activePlanSlug !== null`. Closes on X, ESC, or backdrop click — each sets the slug back to `null`.

Layout (max-width ~680px for readable prose):

- **Header** — title + metadata row (month badge, hemisphere badge, author).
- **Summary** — rendered as a pull-quote above the body.
- **Body** — `renderMarkdownToSafeHtml(bodyMd)` via the existing `src/ui/markdown.ts` helper (reuses `marked + DOMPurify`).
- **Targets strip** — below body, one chip per `LinkedEntity`, labelled with `entity.label`. Clicking a chip fires the same intent a scene click on that object would — reusing the object-card flow that already exists. Where the existing intent surface doesn't cover "open card for this id," a new intent is added as part of this slice; specifics settled in the implementation plan.

Focus is trapped within the modal while open; body scroll is locked.

### 7.6 Deep-link behavior

On hydration with `?plan=<slug>` the modal opens and fetches the detail (cache hit if already loaded; brief loading state on miss). If the fetch 404s or errors, the modal displays the error _and_ clears `activePlanSlug` with URL sync, so a bad shared link doesn't render a permanently-broken modal on refresh.

### 7.7 Existing files touched

- `src/ui/index.ts` — add `set-active-plan` intent to `UIIntent` union.
- Bottom-HUD composition (wherever existing drawer buttons live) — add Plans button.
- `src/state/state.ts` — new field + parse / serialize.
- `src/app.ts` — mount the new drawer + modal, handle the new intent, wire fetches on open / hydrate.

## 8. Seed workflow

### 8.1 Content authoring

Author writes Markdown file at `data/plans/<slug>.md` with JSON frontmatter (shape in §4.4). The Markdown body below the fence is plain prose; the structured metadata lives in JSON so the seed script parses it with `JSON.parse`.

### 8.2 Seed script — `scripts/seed-plans.mjs`

Zero-dep Node script (uses only `node:fs`, `node:path`, `node:child_process`). Invoked via `pnpm seed-plans` (new `package.json` script). Behavior:

1. Globs `data/plans/*.md`.
2. For each file: split on `---\n` fences → `JSON.parse` the frontmatter → validate shape (all required fields present and well-typed) → concat the body markdown.
3. Builds a SQL UPSERT per plan in a single generated file (`scripts/.seed-plans.sql`, gitignored). Timestamps are epoch milliseconds; the script supplies `Date.now()` for `created_at`/`updated_at` and `Date.parse(frontmatter.publishedAt)` for `published_at`:

   ```sql
   INSERT INTO plans (slug, title, month, hemisphere, summary, body_md, objects_json, author, published_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(slug) DO UPDATE SET
     title = excluded.title,
     month = excluded.month,
     hemisphere = excluded.hemisphere,
     summary = excluded.summary,
     body_md = excluded.body_md,
     objects_json = excluded.objects_json,
     author = excluded.author,
     published_at = excluded.published_at,
     updated_at = excluded.updated_at;
   ```

4. Invokes `wrangler d1 execute planisphere --file=scripts/.seed-plans.sql [--local|--remote]` via `child_process.spawnSync`. The flag mirrors the script's first CLI arg: `pnpm seed-plans` → local, `pnpm seed-plans --remote` → prod.
5. Idempotent — re-running against the same markdown is a no-op at the row level (except `updated_at`).

Validation errors → `process.exit(1)` with a pointer to the offending file + field. Never silently upserts a partial row.

### 8.3 Pro-user promotion — manual, documented

Tier promotion is **not** part of the seed script (so we don't accidentally re-promote / re-demote on each run). It's a documented one-shot:

```bash
# after rob.sartin@gmail.com has logged in at least once
wrangler d1 execute planisphere --remote \
  --command "UPDATE users SET tier='pro' WHERE email='rob.sartin@gmail.com';"
```

`--local` variant for the dev DB.

### 8.4 Seed content itself

Authored by the project owner, not by the implementation PR. The spec and plan include a placeholder file at `data/plans/2026-04.md` with frontmatter filled in and a one-line body (`TBD — owner to author.`) so the pipeline wires end-to-end; the body gets replaced before deploy. The implementation can ship, review, and pass tests without blocking on prose.

## 9. Testing & coverage

### 9.1 Coverage buckets

| File                                  | Bucket      | Gate (line / branch)       |
| ------------------------------------- | ----------- | -------------------------- |
| `src/plans.ts`                        | Integration | 80 / 70 — target ≥ 90 / 80 |
| `src/state/state.ts` (new field)      | Pure        | 90 / 85                    |
| `src/ui/plans-{drawer,modal,card}.ts` | Integration | 80 / 70                    |
| `src/app.ts` (new intent + hydration) | Integration | 80 / 70 — sticky gate      |
| `worker/routes/plans.ts`              | Worker pool | Match existing             |
| `worker/db.ts` (helpers)              | Worker pool | Match existing             |
| `scripts/seed-plans.mjs`              | Node script | Best-effort; no threshold  |

### 9.2 New test files

- **`src/plans.test.ts`** — happy paths for `listPlans` / `getPlan`; every `PlanError.kind` mapped (6 branches); cache reuse on second `getPlan(slug)`.
- **`src/state/state.test.ts`** — `activePlanSlug` default `null`, `?plan=x` parses, serializes only when non-null, round-trips.
- **`src/ui/plans-drawer.test.ts`** — each of the 6 drawer states renders its copy + action; hemisphere filter drops wrong-hemisphere entries for N, S, and keeps `both`.
- **`src/ui/plans-modal.test.ts`** — opens on non-null `activePlanSlug`, closes via X / ESC / backdrop, 404 during open clears the slug, focus trap active while open.
- **`src/ui/plans-card.test.ts`** — click dispatches `set-active-plan` with the slug.
- **`src/app.test.ts`** — `set-active-plan` intent updates state + URL (slug set / slug cleared — both arms); `?plan=` on boot hydrates; `?plan=<nonexistent>` fetched → error → slug cleared + URL cleaned.
- **`worker/routes/plans.test.ts`** — 8 cases:
  1. Anonymous `GET /api/plans` → 401.
  2. Free user → 402.
  3. Pro user, empty table → 200 `{ plans: [] }`.
  4. Pro user, one seed → 200 with summary; no `body_md` / `objects` leakage.
  5. Pro `GET /api/plans/<existing>` → 200 full detail.
  6. Pro `GET /api/plans/<unknown>` → 404.
  7. Pro `GET /api/plans/<malformed>` → 404 (regex reject).
  8. `getUserTier` null → treated as free → 402.
- **`worker/db.test.ts`** — `getUserTier` for missing row → `'free'`; `listPlanSummaries` ordering (`month DESC`) and excluded fields (`body_md` / `objects_json` not returned); `getPlanBySlug` hit + miss.
- **`scripts/seed-plans.test.mjs`** — fixture `.md` files: valid, missing field, bad `hemisphere` enum, non-array `objects`, malformed JSON frontmatter; each malformed variant exits non-zero with the right message.

### 9.3 `src/app.ts` branch-coverage discipline

The new intent adds ≥ 2 branches (`slug !== null` / `slug === null`) and hydration adds one more (`?plan=` missing vs present). Tests must parameterize `set-active-plan` across both arms, not just the happy case, or the rebase-merge surface can drop branch coverage below 70%.

### 9.4 Manual smoke test (pre-PR)

1. Cold boot at `/` as anon → click Plans button → drawer shows "Sign in" empty state.
2. Log in as free user → drawer shows "Pro feature" empty state.
3. Log in as Pro user (`rob.sartin@gmail.com`) → drawer shows the seed plan card.
4. Click card → modal opens; URL gains `?plan=2026-04`.
5. Close via X / ESC / backdrop — URL drops `?plan=`.
6. Reload `?plan=2026-04` cold — modal opens on seed plan.
7. Reload `?plan=nonexistent` — modal opens briefly, shows error, URL param cleared.
8. Click a linked-entity chip → object card opens for that entity.
9. Change location to Southern hemisphere → drawer still shows the `hemisphere: "both"` seed plan.
10. `pnpm seed-plans` against local D1 is idempotent — row count stays 1 across repeated runs, `updated_at` advances.

### 9.5 Pre-push gate

Canonical one-liner from CLAUDE.md, plus the worker suite:

```
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:cov && pnpm build && pnpm test:worker
```

## 10. Rollout & ADR

### 10.1 ADR 015 — Viewing Plans storage and Pro-gate enforcement

Short decision record recording:

- **First active use of the `users.tier` column** as a server-side gate; prior to this PR every user was `'free'`. Records that the existing get-or-insert shape of `upsertUser()` — which leaves `tier` untouched on re-login — is now load-bearing. A future change that adds a `last_login` (or similar) column via `ON CONFLICT DO UPDATE` must continue to exclude `tier` from the update set.
- **Content pipeline choice** — read-only D1 table, seeded via a Node script parsing Markdown+JSON-frontmatter files in-repo. Rejects two alternatives (cron-driven publishing and an admin `POST` endpoint) as YAGNI for MVP. Commits to revisiting when the content-strategy decision (#220's "people problem") lands.
- **JSON frontmatter over YAML** — deliberate dep-avoidance choice, revisit when plan count > ~6.
- **Manual Pro promotion via `wrangler d1 execute`** — explicit bootstrap procedure; explicitly _not_ a long-term enforcement design (that's #221 / 2F Stripe).

Scope-extension ADR in the spirit of CLAUDE.md ("don't add a backend… without an ADR extending the scope"). The backend itself is covered by ADR 009; the tier-gate and read-only content pattern are new surfaces worth recording.

### 10.2 NOTICE / attribution

Seed content is authored by the project owner under Apache-2.0 — no new third-party attributions. If community / hired content enters later, that's a NOTICE-updating concern for the content-strategy follow-up, not MVP.

### 10.3 Deployment sequencing

Single PR lands everything; deployment is a three-step dance:

1. **Merge** — triggers Pages + Worker deploy. `0004_plans.sql` runs on D1 (additive).
2. **Promote** (once, after `rob.sartin@gmail.com` has logged in at least once post-deploy):

   ```bash
   wrangler d1 execute planisphere --remote \
     --command "UPDATE users SET tier='pro' WHERE email='rob.sartin@gmail.com';"
   ```

3. **Seed** (`pnpm seed-plans --remote`) once the Markdown body has been authored.

Steps 2 and 3 can run in either order. Step 1 can land with the `TBD` placeholder body — the user-visible feature simply shows a placeholder until step 3 replaces it. The code PR isn't blocked on prose.

### 10.4 Rollback / incident posture

- **Migration is additive** (new `plans` table, no ALTER on existing tables) → no schema rollback needed if code reverts.
- **Pro gate as kill-switch**: `UPDATE users SET tier='free' WHERE email='rob.sartin@gmail.com'` hides the drawer content for the only Pro user and effectively disables the feature in prod without a code deploy.
- **No existing-file behavior changes in auth or user-upsert paths** — this PR doesn't modify `upsertUser()` or any cross-cutting login logic. Only new files (plans routes, client wrapper, UI surfaces) and new DB helpers are introduced, which narrows the blast radius of a regression to the feature itself.

### 10.5 Documentation updates in this PR

- **`docs/user-guide.md`** — new short section "Viewing Plans" under the Pro-tier area: what it is, where to find it, example URL, note that `?plan=<slug>` is shareable.
- **`docs/architecture.md`** — append a paragraph on the plans module (drawer + modal + client wrapper + Worker route + seed script) in the style of the existing module notes.
- **`docs/adr/README.md`** — add the new ADR 015 row to the index.

## 11. Out of scope (tracked separately)

Non-goals filed as follow-up issues, not tasks inside this spec:

- Content pipeline / authorship decision (the original #220 "people problem").
- Stripe / trial (#221 / 2F).
- Cron-driven auto-publish of a monthly plan.
- Admin UI for plan authoring.
- Plan comments, favorites, "related plans."
- R2-hosted hero images with a licensing / attribution pipeline.
- YAML frontmatter migration (and its accompanying devDep ADR) once plan count exceeds ~6.
