# Monthly Viewing Plans — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the code-only MVP slice of #220 — a Pro-gated Viewing Plans drawer + reader modal backed by a new D1 `plans` table, a zero-dep seed pipeline for Markdown + JSON-frontmatter plans, and a documented manual Pro-promotion workflow for `rob.sartin@gmail.com`.

**Architecture:** New Cloudflare Worker routes (`GET /api/plans`, `GET /api/plans/:slug`) gated by session + `tier='pro'`. A mirror of the `src/notebooks.ts` client-wrapper pattern returning `Result<T, PlanError>`. Two new UI surfaces — a drawer feed built on the shared `createDrawer` primitive and a full-screen reader modal reusing the Help-modal overlay pattern — plus one new `set-active-plan` intent and `?plan=<slug>` URL sync. Seed content is authored as Markdown with a JSON frontmatter fence and ingested by a zero-dep `pnpm seed-plans` script that shells out to `wrangler d1 execute`. Spec: `docs/specs/2026-04-24-monthly-viewing-plans-design.md`.

**Tech Stack:** TypeScript (strict), Vitest (jsdom + `@cloudflare/vitest-pool-workers`), Cloudflare Workers + D1, `marked` + `dompurify` (already deps). Zero new runtime or devDeps.

---

## File Structure

### Create

| Path                                                 | Responsibility                                                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `migrations/0004_plans.sql`                          | D1 schema for the `plans` table.                                                                                  |
| `worker/routes/plans.ts`                             | Two handlers (`handleListPlans`, `handleGetPlan`) — auth + Pro gate + DB query.                                   |
| `worker/routes/plans.test.ts`                        | 8 cases from spec §5 + payload shape.                                                                             |
| `src/plans.ts`                                       | Client wrapper: `listPlans`, `getPlan`, types, `apiRequest` helper, in-module cache.                              |
| `src/plans.test.ts`                                  | Wrapper happy / error / cache tests.                                                                              |
| `src/ui/plans-card.ts`                               | Summary card factory — click dispatches `set-active-plan`.                                                        |
| `src/ui/plans-card.test.ts`                          | Renders fields; click dispatches intent with slug.                                                                |
| `src/ui/plans-drawer.ts`                             | Drawer with six states + hemisphere filter.                                                                       |
| `src/ui/plans-drawer.test.ts`                        | Each state renders its copy; filter keeps `both` and observer-matched hemisphere.                                 |
| `src/ui/plans-modal.ts`                              | Full-screen overlay: header, summary pull-quote, body (via `renderMarkdownToSafeHtml`), targets strip with chips. |
| `src/ui/plans-modal.test.ts`                         | Lifecycle on `activePlanSlug` change; ESC / backdrop / X all close; 404 clears slug.                              |
| `scripts/seed-plans.mjs`                             | Zero-dep Node script: parse Markdown + JSON frontmatter, build UPSERT SQL, invoke `wrangler d1 execute`.          |
| `scripts/seed-plans.test.mjs`                        | Valid fixture upserts; each malformed fixture exits non-zero.                                                     |
| `data/plans/2026-04.md`                              | Placeholder seed plan (owner-authored prose inserted post-merge).                                                 |
| `docs/adr/015-viewing-plans-storage-and-pro-gate.md` | ADR for the tier-gate activation + read-only content model + JSON-frontmatter choice.                             |

### Modify

| Path                      | Change                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `worker/db.ts`            | Add `getUserTier`, `listPlanSummaries`, `getPlanBySlug`, `upsertPlan` helpers.             |
| `worker/db.test.ts`       | Tests for the four new helpers.                                                            |
| `worker/index.ts`         | Dispatch `GET /api/plans` + `GET /api/plans/:slug` before `notFound()`.                    |
| `src/state/state.ts`      | Add `activePlanSlug: string \| null` to `AppState` + parse/serialize `?plan=`.             |
| `src/state/state.test.ts` | `activePlanSlug` defaults, parse, serialize, round-trip.                                   |
| `src/ui/index.ts`         | Add `set-active-plan` variant to `UIIntent`.                                               |
| `src/ui/panel.ts`         | Add `onOpenPlans` callback to `PanelOptions` and a "Plans" button that calls it.           |
| `src/app.ts`              | Mount `plans-drawer` + `plans-modal`; handle `set-active-plan`; hydrate `?plan=` on boot.  |
| `src/app.test.ts`         | Intent updates state + URL (both arms); `?plan=` hydration; `?plan=<unknown>` clears slug. |
| `package.json`            | Add `"seed-plans": "node scripts/seed-plans.mjs"`.                                         |
| `.gitignore`              | Add `scripts/.seed-plans.sql`.                                                             |
| `docs/user-guide.md`      | New "Viewing Plans" section under the Pro-tier area.                                       |
| `docs/architecture.md`    | One paragraph on the plans module.                                                         |
| `docs/adr/README.md`      | Add row for ADR 015.                                                                       |

### Reuse (read-only)

- `src/ui/drawer.ts` — `createDrawer(options)` → `{ element, open, close, isOpen }`.
- `src/ui/help-modal.ts` — pattern for full-screen overlay (`position: fixed; inset: 0; z-index: 2000`, body-scroll lock via `document.body.style.overflow`).
- `src/ui/markdown.ts` — `renderMarkdownToSafeHtml(md)`.
- `worker/session.ts` — `getAuthenticatedUserId`.
- `worker/test-helpers.ts` — `testEnv`, `resetDb`, `login`, `authed`, `fetchWorker`.

---

## Task-ordering rationale

The Worker is built first (Tasks 1–4) so the client wrapper (Task 5) has a real endpoint to test against. State (Task 6) is independent and lands early to unblock UI. Card (Task 7) has no dependencies beyond types. Drawer (Task 8) uses Card. Modal (Task 9) is independent of the drawer. App wiring (Task 10) ties them together and handles the new intent + hydration — this is the `src/app.ts` branch-coverage hot spot. Seed pipeline (Tasks 11–12) is independent of UI. Docs + ADR (Tasks 13–14) are last. Task 15 is the final smoke + gate.

---

## Task 1: D1 migration — `migrations/0004_plans.sql`

**Files:**

- Create: `migrations/0004_plans.sql`

- [ ] **Step 1: Write the migration**

```sql
-- SPDX-License-Identifier: Apache-2.0
-- Phase 2 milestone 2E: Pro-gated curated monthly viewing plans.
-- Read-only from the Worker; content is seeded via scripts/seed-plans.mjs.

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

- [ ] **Step 2: Apply locally to confirm the SQL is valid**

Run: `wrangler d1 execute planisphere --local --file=migrations/0004_plans.sql`
Expected: "Executed 2 commands" — no parse errors.

- [ ] **Step 3: Verify the table is present**

Run: `wrangler d1 execute planisphere --local --command "SELECT name FROM sqlite_schema WHERE type='table';"`
Expected: output includes `plans`.

- [ ] **Step 4: Commit**

```bash
git add migrations/0004_plans.sql
git commit -m "feat(d1): migration 0004 — plans table for #220"
```

---

## Task 2: Worker DB helpers — `worker/db.ts`

**Files:**

- Modify: `worker/db.ts` (append four new helpers)
- Modify: `worker/db.test.ts`

- [ ] **Step 1: Write the failing tests in `worker/db.test.ts`**

Add near the bottom of the existing test file. Uses the existing `testEnv`, `resetDb` helpers already imported.

```ts
import { getUserTier, listPlanSummaries, getPlanBySlug, upsertPlan } from "./db";

describe("getUserTier", () => {
  beforeEach(resetDb);

  test("returns 'free' when the user does not exist", async () => {
    const tier = await getUserTier(testEnv.DB, 999);
    expect(tier).toBe("free");
  });

  test("returns the row's tier when the user exists", async () => {
    await testEnv.DB.prepare(
      "INSERT INTO users (id, email, tier, created_at) VALUES (1, 'a@example.com', 'pro', ?)",
    )
      .bind(Date.now())
      .run();
    const tier = await getUserTier(testEnv.DB, 1);
    expect(tier).toBe("pro");
  });
});

describe("plans DB helpers", () => {
  beforeEach(resetDb);

  test("upsertPlan inserts a row, listPlanSummaries returns it without body/objects", async () => {
    await upsertPlan(testEnv.DB, {
      slug: "2026-04",
      title: "April",
      month: "2026-04",
      hemisphere: "both",
      summary: "Spring skies.",
      bodyMd: "Secret body",
      objectsJson: '[{"kind":"messier","id":"31","label":"M31"}]',
      author: "Author",
      publishedAtMs: 1_700_000_000_000,
    });

    const rows = await listPlanSummaries(testEnv.DB);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      slug: "2026-04",
      title: "April",
      month: "2026-04",
      hemisphere: "both",
      summary: "Spring skies.",
      author: "Author",
      publishedAtMs: 1_700_000_000_000,
    });
    // critical: body_md / objects_json must NOT leak through the list endpoint
    expect((rows[0] as Record<string, unknown>).bodyMd).toBeUndefined();
    expect((rows[0] as Record<string, unknown>).objectsJson).toBeUndefined();
  });

  test("upsertPlan is idempotent on slug conflict", async () => {
    const base = {
      slug: "2026-04",
      month: "2026-04",
      hemisphere: "both" as const,
      summary: "s",
      bodyMd: "v1",
      objectsJson: "[]",
      author: "A",
      publishedAtMs: 1,
    };
    await upsertPlan(testEnv.DB, { ...base, title: "First" });
    await upsertPlan(testEnv.DB, { ...base, title: "Second", bodyMd: "v2" });

    const detail = await getPlanBySlug(testEnv.DB, "2026-04");
    expect(detail?.title).toBe("Second");
    expect(detail?.bodyMd).toBe("v2");

    const rows = await listPlanSummaries(testEnv.DB);
    expect(rows).toHaveLength(1); // not two
  });

  test("listPlanSummaries orders by month DESC", async () => {
    for (const month of ["2026-02", "2026-04", "2026-03"]) {
      await upsertPlan(testEnv.DB, {
        slug: month,
        title: month,
        month,
        hemisphere: "both",
        summary: "s",
        bodyMd: "",
        objectsJson: "[]",
        author: "A",
        publishedAtMs: 1,
      });
    }
    const rows = await listPlanSummaries(testEnv.DB);
    expect(rows.map((r) => r.month)).toEqual(["2026-04", "2026-03", "2026-02"]);
  });

  test("getPlanBySlug returns full detail for existing slug, null for unknown", async () => {
    await upsertPlan(testEnv.DB, {
      slug: "2026-04",
      title: "T",
      month: "2026-04",
      hemisphere: "n",
      summary: "s",
      bodyMd: "body",
      objectsJson: '[{"kind":"planet","id":"jupiter","label":"Jupiter"}]',
      author: "A",
      publishedAtMs: 42,
    });

    const hit = await getPlanBySlug(testEnv.DB, "2026-04");
    expect(hit).toEqual({
      slug: "2026-04",
      title: "T",
      month: "2026-04",
      hemisphere: "n",
      summary: "s",
      bodyMd: "body",
      objectsJson: '[{"kind":"planet","id":"jupiter","label":"Jupiter"}]',
      author: "A",
      publishedAtMs: 42,
    });

    const miss = await getPlanBySlug(testEnv.DB, "nope");
    expect(miss).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm red**

Run: `pnpm test:worker -- worker/db.test.ts`
Expected: FAIL with `getUserTier` / `upsertPlan` etc. not exported.

- [ ] **Step 3: Append helpers to `worker/db.ts`**

```ts
export type UserTier = "free" | "pro";

export async function getUserTier(db: D1Database, userId: number): Promise<UserTier> {
  const row = await db
    .prepare("SELECT tier FROM users WHERE id = ?")
    .bind(userId)
    .first<{ tier: string }>();
  if (row === null) return "free";
  return row.tier === "pro" ? "pro" : "free";
}

export type PlanRow = {
  readonly slug: string;
  readonly title: string;
  readonly month: string;
  readonly hemisphere: "n" | "s" | "both";
  readonly summary: string;
  readonly bodyMd: string;
  readonly objectsJson: string;
  readonly author: string;
  readonly publishedAtMs: number;
};

export type PlanSummaryRow = Omit<PlanRow, "bodyMd" | "objectsJson">;

type RawPlanRow = {
  slug: string;
  title: string;
  month: string;
  hemisphere: string;
  summary: string;
  body_md?: string;
  objects_json?: string;
  author: string;
  published_at: number;
};

function coerceHemisphere(h: string): "n" | "s" | "both" {
  return h === "n" || h === "s" ? h : "both";
}

export async function listPlanSummaries(db: D1Database): Promise<readonly PlanSummaryRow[]> {
  const result = await db
    .prepare(
      "SELECT slug, title, month, hemisphere, summary, author, published_at " +
        "FROM plans ORDER BY month DESC",
    )
    .all<RawPlanRow>();
  return (result.results ?? []).map((r) => ({
    slug: r.slug,
    title: r.title,
    month: r.month,
    hemisphere: coerceHemisphere(r.hemisphere),
    summary: r.summary,
    author: r.author,
    publishedAtMs: r.published_at,
  }));
}

export async function getPlanBySlug(db: D1Database, slug: string): Promise<PlanRow | null> {
  const row = await db
    .prepare(
      "SELECT slug, title, month, hemisphere, summary, body_md, objects_json, author, published_at " +
        "FROM plans WHERE slug = ?",
    )
    .bind(slug)
    .first<RawPlanRow>();
  if (row === null) return null;
  return {
    slug: row.slug,
    title: row.title,
    month: row.month,
    hemisphere: coerceHemisphere(row.hemisphere),
    summary: row.summary,
    bodyMd: row.body_md ?? "",
    objectsJson: row.objects_json ?? "[]",
    author: row.author,
    publishedAtMs: row.published_at,
  };
}

export type UpsertPlanInput = {
  readonly slug: string;
  readonly title: string;
  readonly month: string;
  readonly hemisphere: "n" | "s" | "both";
  readonly summary: string;
  readonly bodyMd: string;
  readonly objectsJson: string;
  readonly author: string;
  readonly publishedAtMs: number;
};

export async function upsertPlan(db: D1Database, input: UpsertPlanInput): Promise<void> {
  const now = Date.now();
  await db
    .prepare(
      "INSERT INTO plans (slug, title, month, hemisphere, summary, body_md, objects_json, author, published_at, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(slug) DO UPDATE SET " +
        "  title = excluded.title, month = excluded.month, hemisphere = excluded.hemisphere, " +
        "  summary = excluded.summary, body_md = excluded.body_md, objects_json = excluded.objects_json, " +
        "  author = excluded.author, published_at = excluded.published_at, updated_at = excluded.updated_at",
    )
    .bind(
      input.slug,
      input.title,
      input.month,
      input.hemisphere,
      input.summary,
      input.bodyMd,
      input.objectsJson,
      input.author,
      input.publishedAtMs,
      now,
      now,
    )
    .run();
}
```

- [ ] **Step 4: Run to confirm green**

Run: `pnpm test:worker -- worker/db.test.ts`
Expected: PASS for all new tests, no regressions.

- [ ] **Step 5: Commit**

```bash
git add worker/db.ts worker/db.test.ts
git commit -m "feat(worker): plans + tier DB helpers for #220"
```

---

## Task 3: Worker route handlers — `worker/routes/plans.ts`

**Files:**

- Create: `worker/routes/plans.ts`
- Create: `worker/routes/plans.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// worker/routes/plans.test.ts
/* SPDX-License-Identifier: Apache-2.0 */
import { describe, test, expect, beforeEach } from "vitest";
import { testEnv, resetDb, login, authed, fetchWorker } from "../test-helpers";
import { upsertPlan } from "../db";

async function promoteToPro(email: string): Promise<void> {
  await testEnv.DB.prepare("UPDATE users SET tier = 'pro' WHERE email = ?").bind(email).run();
}

async function seedPlan(): Promise<void> {
  await upsertPlan(testEnv.DB, {
    slug: "2026-04",
    title: "April",
    month: "2026-04",
    hemisphere: "both",
    summary: "s",
    bodyMd: "# Body\n\nProse.",
    objectsJson: '[{"kind":"messier","id":"31","label":"M31"}]',
    author: "Author",
    publishedAtMs: 1_700_000_000_000,
  });
}

describe("GET /api/plans", () => {
  beforeEach(resetDb);

  test("401 when anonymous", async () => {
    const res = await fetchWorker(new Request("http://test/api/plans"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthenticated" });
  });

  test("402 when authenticated but free", async () => {
    const cookie = await login("free@example.com");
    const res = await fetchWorker(authed("/api/plans", cookie));
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ error: "not_pro" });
  });

  test("200 + empty list when Pro and no plans", async () => {
    const cookie = await login("rob@example.com");
    await promoteToPro("rob@example.com");
    const res = await fetchWorker(authed("/api/plans", cookie));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ plans: [] });
  });

  test("200 + one summary for Pro; bodyMd / objects NOT leaked", async () => {
    const cookie = await login("rob@example.com");
    await promoteToPro("rob@example.com");
    await seedPlan();
    const res = await fetchWorker(authed("/api/plans", cookie));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { plans: Array<Record<string, unknown>> };
    expect(body.plans).toHaveLength(1);
    expect(body.plans[0].slug).toBe("2026-04");
    expect(body.plans[0].publishedAt).toBe(new Date(1_700_000_000_000).toISOString());
    expect(body.plans[0].bodyMd).toBeUndefined();
    expect(body.plans[0].objects).toBeUndefined();
  });
});

describe("GET /api/plans/:slug", () => {
  beforeEach(resetDb);

  test("200 full detail for existing slug as Pro", async () => {
    const cookie = await login("rob@example.com");
    await promoteToPro("rob@example.com");
    await seedPlan();
    const res = await fetchWorker(authed("/api/plans/2026-04", cookie));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.slug).toBe("2026-04");
    expect(body.bodyMd).toBe("# Body\n\nProse.");
    expect(body.objects).toEqual([{ kind: "messier", id: "31", label: "M31" }]);
    expect(body.publishedAt).toBe(new Date(1_700_000_000_000).toISOString());
  });

  test("404 for unknown slug as Pro", async () => {
    const cookie = await login("rob@example.com");
    await promoteToPro("rob@example.com");
    const res = await fetchWorker(authed("/api/plans/nope", cookie));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  test("404 for malformed slug (regex reject, not 400)", async () => {
    const cookie = await login("rob@example.com");
    await promoteToPro("rob@example.com");
    const res = await fetchWorker(authed("/api/plans/Not%20A%20Slug", cookie));
    expect(res.status).toBe(404);
  });

  test("402 when authenticated but free", async () => {
    const cookie = await login("free@example.com");
    await seedPlan();
    const res = await fetchWorker(authed("/api/plans/2026-04", cookie));
    expect(res.status).toBe(402);
  });
});
```

- [ ] **Step 2: Run to confirm red**

Run: `pnpm test:worker -- worker/routes/plans.test.ts`
Expected: FAIL — 404 Not Found on every route (no dispatch yet).

- [ ] **Step 3: Write the handlers**

```ts
// worker/routes/plans.ts
/* SPDX-License-Identifier: Apache-2.0 */
import type { Env } from "../types";
import { getAuthenticatedUserId } from "../session";
import {
  getUserTier,
  listPlanSummaries,
  getPlanBySlug,
  type PlanRow,
  type PlanSummaryRow,
} from "../db";

const SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorJson(error: string, status: number): Response {
  return json({ error }, status);
}

async function requireProUser(
  req: Request,
  env: Env,
): Promise<{ ok: true; userId: number } | { ok: false; res: Response }> {
  const userId = await getAuthenticatedUserId(req, env);
  if (userId === null) return { ok: false, res: errorJson("unauthenticated", 401) };
  const tier = await getUserTier(env.DB, userId);
  if (tier !== "pro") return { ok: false, res: errorJson("not_pro", 402) };
  return { ok: true, userId };
}

function summaryToWire(row: PlanSummaryRow) {
  return {
    slug: row.slug,
    title: row.title,
    month: row.month,
    hemisphere: row.hemisphere,
    summary: row.summary,
    author: row.author,
    publishedAt: new Date(row.publishedAtMs).toISOString(),
  };
}

function planToWire(row: PlanRow) {
  // Fail closed: if objects_json is corrupted, surface an empty list rather than 500.
  let objects: readonly unknown[] = [];
  try {
    const parsed = JSON.parse(row.objectsJson);
    if (Array.isArray(parsed)) objects = parsed;
  } catch {
    objects = [];
  }
  return {
    ...summaryToWire(row),
    bodyMd: row.bodyMd,
    objects,
  };
}

export async function handleListPlans(req: Request, env: Env): Promise<Response> {
  const auth = await requireProUser(req, env);
  if (!auth.ok) return auth.res;
  const rows = await listPlanSummaries(env.DB);
  return json({ plans: rows.map(summaryToWire) });
}

export async function handleGetPlan(req: Request, env: Env, slug: string): Promise<Response> {
  if (!SLUG_PATTERN.test(slug)) return errorJson("not_found", 404);
  const auth = await requireProUser(req, env);
  if (!auth.ok) return auth.res;
  const row = await getPlanBySlug(env.DB, slug);
  if (row === null) return errorJson("not_found", 404);
  return json(planToWire(row));
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test:worker -- worker/routes/plans.test.ts`
Expected: Most tests PASS except the list/detail happy paths (still need router wiring in Task 4). The 401 / 402 / 404 cases should pass because we can mount the handlers with direct imports in a minimal pool-worker test harness — but since the tests hit `/api/plans` via `fetchWorker`, they actually depend on Task 4 routing.

**Note:** If `fetchWorker` hits the `worker/index.ts` fetch handler only, all route tests fail until Task 4 is done. In that case: proceed to Task 4 now and return to confirm green. Do not commit Task 3 code alone.

- [ ] **Step 5: Proceed to Task 4 (required to complete Task 3's tests)**

Do not commit yet — Task 4 adds the dispatch that makes the tests pass. Commit both together at the end of Task 4.

---

## Task 4: Wire routes into `worker/index.ts`

**Files:**

- Modify: `worker/index.ts`

- [ ] **Step 1: Add the dispatch clauses**

Insert the plans routes BEFORE the final `notFound()` in the fetch handler. Locate them alongside the existing `/api/notebooks` dispatch:

```ts
// Near the top of worker/index.ts imports:
import { handleListPlans, handleGetPlan } from "./routes/plans";

// Inside the fetch handler, before notFound():
if (path === "/api/plans") {
  if (method !== "GET") return methodNotAllowed();
  return await handleListPlans(request, env);
}

const planDetailMatch = /^\/api\/plans\/([^/]+)$/.exec(path);
if (planDetailMatch !== null) {
  if (method !== "GET") return methodNotAllowed();
  return await handleGetPlan(request, env, planDetailMatch[1]!);
}
```

If `methodNotAllowed()` is not yet a helper in this file, reuse whatever the existing `/api/notebooks` dispatch uses for 405 responses, or inline `new Response(null, { status: 405 })`.

- [ ] **Step 2: Run the plans test suite**

Run: `pnpm test:worker -- worker/routes/plans.test.ts`
Expected: All 8 tests PASS.

- [ ] **Step 3: Run the full worker suite to confirm no regressions**

Run: `pnpm test:worker`
Expected: All worker tests PASS (auth, notebooks, session, sweep, plans).

- [ ] **Step 4: Commit Tasks 3 + 4 together**

```bash
git add worker/routes/plans.ts worker/routes/plans.test.ts worker/index.ts
git commit -m "feat(worker): /api/plans routes with session + Pro gate (#220)"
```

---

## Task 5: Client wrapper — `src/plans.ts`

**Files:**

- Create: `src/plans.ts`
- Create: `src/plans.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/plans.test.ts
/* SPDX-License-Identifier: Apache-2.0 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import { listPlans, getPlan, __clearPlanCacheForTests } from "./plans";

function mockFetch(response: Response): void {
  globalThis.fetch = vi.fn(async () => response) as typeof fetch;
}

function mockFetchSequence(responses: Response[]): void {
  let i = 0;
  globalThis.fetch = vi.fn(async () => responses[i++]!) as typeof fetch;
}

function okJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const SAMPLE_SUMMARY = {
  slug: "2026-04",
  title: "April",
  month: "2026-04",
  hemisphere: "both",
  summary: "s",
  author: "A",
  publishedAt: "2026-04-01T00:00:00.000Z",
};

const SAMPLE_DETAIL = {
  ...SAMPLE_SUMMARY,
  bodyMd: "# Body",
  objects: [{ kind: "messier", id: "31", label: "M31" }],
};

beforeEach(() => {
  __clearPlanCacheForTests();
});

describe("listPlans", () => {
  test("happy path — unwraps { plans: [...] }", async () => {
    mockFetch(okJson({ plans: [SAMPLE_SUMMARY] }));
    const res = await listPlans();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toHaveLength(1);
      expect(res.value[0].slug).toBe("2026-04");
    }
  });

  test("401 → unauthenticated", async () => {
    mockFetch(okJson({ error: "unauthenticated" }, 401));
    const res = await listPlans();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe("unauthenticated");
  });

  test("402 → not_pro", async () => {
    mockFetch(okJson({ error: "not_pro" }, 402));
    const res = await listPlans();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe("not_pro");
  });

  test("5xx → server", async () => {
    mockFetch(okJson({ error: "server" }, 500));
    const res = await listPlans();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe("server");
  });

  test("fetch throws → network", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fail");
    }) as typeof fetch;
    const res = await listPlans();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe("network");
  });

  test("malformed body → invalid_payload", async () => {
    mockFetch(okJson({ plans: [{ slug: "2026-04" /* missing fields */ }] }));
    const res = await listPlans();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe("invalid_payload");
  });

  test("bad hemisphere enum → invalid_payload", async () => {
    mockFetch(okJson({ plans: [{ ...SAMPLE_SUMMARY, hemisphere: "mars" }] }));
    const res = await listPlans();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe("invalid_payload");
  });
});

describe("getPlan", () => {
  test("happy path", async () => {
    mockFetch(okJson(SAMPLE_DETAIL));
    const res = await getPlan("2026-04");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.bodyMd).toBe("# Body");
      expect(res.value.objects).toHaveLength(1);
    }
  });

  test("404 → not_found", async () => {
    mockFetch(okJson({ error: "not_found" }, 404));
    const res = await getPlan("nope");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe("not_found");
  });

  test("second call for the same slug hits the cache, not fetch", async () => {
    mockFetchSequence([okJson(SAMPLE_DETAIL)]);
    const first = await getPlan("2026-04");
    expect(first.ok).toBe(true);
    const second = await getPlan("2026-04");
    expect(second.ok).toBe(true);
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(
      1,
    );
  });

  test("objects not array → invalid_payload", async () => {
    mockFetch(okJson({ ...SAMPLE_DETAIL, objects: "nope" }));
    const res = await getPlan("2026-04");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe("invalid_payload");
  });

  test("object with bad kind → invalid_payload", async () => {
    mockFetch(okJson({ ...SAMPLE_DETAIL, objects: [{ kind: "alien", id: "x", label: "x" }] }));
    const res = await getPlan("2026-04");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe("invalid_payload");
  });
});
```

- [ ] **Step 2: Run to confirm red**

Run: `pnpm test src/plans.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the wrapper**

```ts
// src/plans.ts
/* SPDX-License-Identifier: Apache-2.0 */
import { err, ok, type Result } from "./result";

export type LinkedEntityKind = "star" | "messier" | "planet" | "satellite" | "constellation";

const LINKED_ENTITY_KINDS: readonly LinkedEntityKind[] = [
  "star",
  "messier",
  "planet",
  "satellite",
  "constellation",
];

export type LinkedEntity = {
  readonly kind: LinkedEntityKind;
  readonly id: string;
  readonly label: string;
};

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

const planCache = new Map<string, Plan>();

export function __clearPlanCacheForTests(): void {
  planCache.clear();
}

function isHemisphere(v: unknown): v is "n" | "s" | "both" {
  return v === "n" || v === "s" || v === "both";
}

function isLinkedEntityKind(v: unknown): v is LinkedEntityKind {
  return typeof v === "string" && (LINKED_ENTITY_KINDS as readonly string[]).includes(v);
}

function parseSummary(raw: unknown): PlanSummary | null {
  if (raw === null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.slug !== "string") return null;
  if (typeof r.title !== "string") return null;
  if (typeof r.month !== "string") return null;
  if (!isHemisphere(r.hemisphere)) return null;
  if (typeof r.summary !== "string") return null;
  if (typeof r.author !== "string") return null;
  if (typeof r.publishedAt !== "string") return null;
  return {
    slug: r.slug,
    title: r.title,
    month: r.month,
    hemisphere: r.hemisphere,
    summary: r.summary,
    author: r.author,
    publishedAt: r.publishedAt,
  };
}

function parseLinkedEntity(raw: unknown): LinkedEntity | null {
  if (raw === null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isLinkedEntityKind(r.kind)) return null;
  if (typeof r.id !== "string") return null;
  if (typeof r.label !== "string") return null;
  return { kind: r.kind, id: r.id, label: r.label };
}

function parsePlan(raw: unknown): Plan | null {
  const summary = parseSummary(raw);
  if (summary === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.bodyMd !== "string") return null;
  if (!Array.isArray(r.objects)) return null;
  const objects: LinkedEntity[] = [];
  for (const o of r.objects) {
    const entity = parseLinkedEntity(o);
    if (entity === null) return null;
    objects.push(entity);
  }
  return { ...summary, bodyMd: r.bodyMd, objects };
}

function mapStatusToError(status: number): PlanError {
  if (status === 401) return { kind: "unauthenticated" };
  if (status === 402) return { kind: "not_pro" };
  if (status === 404) return { kind: "not_found" };
  return { kind: "server" };
}

async function apiRequest<T>(
  path: string,
  parse: (raw: unknown) => T | null,
): Promise<Result<T, PlanError>> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: "include" });
  } catch {
    return err({ kind: "network" });
  }
  if (!res.ok) return err(mapStatusToError(res.status));
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    return err({ kind: "invalid_payload" });
  }
  const parsed = parse(raw);
  if (parsed === null) return err({ kind: "invalid_payload" });
  return ok(parsed);
}

export async function listPlans(): Promise<Result<readonly PlanSummary[], PlanError>> {
  return apiRequest("/api/plans", (raw) => {
    if (raw === null || typeof raw !== "object") return null;
    const plans = (raw as { plans?: unknown }).plans;
    if (!Array.isArray(plans)) return null;
    const out: PlanSummary[] = [];
    for (const p of plans) {
      const s = parseSummary(p);
      if (s === null) return null;
      out.push(s);
    }
    return out;
  });
}

export async function getPlan(slug: string): Promise<Result<Plan, PlanError>> {
  const cached = planCache.get(slug);
  if (cached !== undefined) return ok(cached);
  const res = await apiRequest(`/api/plans/${encodeURIComponent(slug)}`, parsePlan);
  if (res.ok) planCache.set(slug, res.value);
  return res;
}
```

- [ ] **Step 4: Run to confirm green**

Run: `pnpm test src/plans.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/plans.ts src/plans.test.ts
git commit -m "feat(client): src/plans.ts wrapper for /api/plans (#220)"
```

---

## Task 6: Add `activePlanSlug` to state

**Files:**

- Modify: `src/state/state.ts`
- Modify: `src/state/state.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/state/state.test.ts`:

```ts
describe("activePlanSlug", () => {
  test("defaults to null", () => {
    expect(DEFAULT_STATE.activePlanSlug).toBeNull();
  });

  test("parses ?plan=<slug>", () => {
    const r = parseStateFromSearchParams(new URLSearchParams("lat=0&lon=0&plan=2026-04"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.activePlanSlug).toBe("2026-04");
  });

  test("serializes only when non-null", () => {
    const withSlug = serializeStateToSearchParams({ ...DEFAULT_STATE, activePlanSlug: "2026-04" });
    expect(withSlug.get("plan")).toBe("2026-04");

    const withNull = serializeStateToSearchParams({ ...DEFAULT_STATE, activePlanSlug: null });
    expect(withNull.has("plan")).toBe(false);
  });

  test("round-trips", () => {
    const encoded = serializeStateToSearchParams({ ...DEFAULT_STATE, activePlanSlug: "2026-04" });
    const decoded = parseStateFromSearchParams(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.value.activePlanSlug).toBe("2026-04");
  });

  test("rejects malformed slug — falls back to null", () => {
    const r = parseStateFromSearchParams(new URLSearchParams("lat=0&lon=0&plan=Not%20A%20Slug"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.activePlanSlug).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm red**

Run: `pnpm test src/state/state.test.ts`
Expected: FAIL — `activePlanSlug` is not a property on `AppState`.

- [ ] **Step 3: Add the field**

In `src/state/state.ts`:

```ts
// In AppState type, add:
readonly activePlanSlug: string | null; // URL-synced via ?plan=<slug>

// New default near the other defaults:
export const DEFAULT_ACTIVE_PLAN_SLUG: string | null = null;

// In DEFAULT_STATE, add:
activePlanSlug: DEFAULT_ACTIVE_PLAN_SLUG,

// New parser above parseStateFromSearchParams:
const PLAN_SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;

function parseActivePlanSlug(raw: string | null): string | null {
  if (raw === null) return null;
  return PLAN_SLUG_PATTERN.test(raw) ? raw : null;
}

// In parseStateFromSearchParams, add alongside other parseX calls:
const activePlanSlug = parseActivePlanSlug(params.get("plan"));

// Include activePlanSlug in the returned ok({...}).

// In serializeStateToSearchParams, add near the language block:
if (state.activePlanSlug !== null) {
  params.set("plan", state.activePlanSlug);
}
```

- [ ] **Step 4: Run to confirm green**

Run: `pnpm test src/state/state.test.ts`
Expected: PASS — all new tests + existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/state/state.ts src/state/state.test.ts
git commit -m "feat(state): activePlanSlug field + ?plan URL sync (#220)"
```

---

## Task 7: Plans card — `src/ui/plans-card.ts`

**Files:**

- Create: `src/ui/plans-card.ts`
- Create: `src/ui/plans-card.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/ui/plans-card.test.ts
/* SPDX-License-Identifier: Apache-2.0 */
import { describe, test, expect, vi } from "vitest";
import { createPlanCard } from "./plans-card";
import type { PlanSummary } from "../plans";

const SAMPLE: PlanSummary = {
  slug: "2026-04",
  title: "April — Lyrids",
  month: "2026-04",
  hemisphere: "both",
  summary: "Meteors over galaxies.",
  author: "Rob",
  publishedAt: "2026-04-01T00:00:00.000Z",
};

describe("createPlanCard", () => {
  test("renders title, month, summary, author", () => {
    const dispatch = vi.fn();
    const card = createPlanCard(SAMPLE, dispatch);
    expect(card.textContent).toContain("April — Lyrids");
    expect(card.textContent).toContain("2026-04");
    expect(card.textContent).toContain("Meteors over galaxies.");
    expect(card.textContent).toContain("Rob");
  });

  test("click dispatches set-active-plan with slug", () => {
    const dispatch = vi.fn();
    const card = createPlanCard(SAMPLE, dispatch);
    card.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "set-active-plan", slug: "2026-04" });
  });
});
```

- [ ] **Step 2: Run to confirm red**

Run: `pnpm test src/ui/plans-card.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the component**

```ts
// src/ui/plans-card.ts
/* SPDX-License-Identifier: Apache-2.0 */
import { el } from "./dom";
import { applyBaseText, SURFACE, BORDER_SUBTLE, TEXT_MUTED } from "./styles";
import type { UIIntent } from "./index";
import type { PlanSummary } from "../plans";

export function createPlanCard(
  plan: PlanSummary,
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  const title = el("div", {
    text: plan.title,
    style: { fontSize: "14px", fontWeight: "600", marginBottom: "4px" },
  });
  const meta = el("div", {
    text: `${plan.month} · ${plan.author}`,
    style: { fontSize: "11px", color: TEXT_MUTED, marginBottom: "4px" },
  });
  const summary = el("div", {
    text: plan.summary,
    style: {
      fontSize: "12px",
      lineHeight: "1.4",
      display: "-webkit-box",
      WebkitLineClamp: "2",
      WebkitBoxOrient: "vertical",
      overflow: "hidden",
    } as Partial<CSSStyleDeclaration>,
  });

  const card = el("button", {
    dataset: { planCard: plan.slug },
    style: {
      display: "block",
      textAlign: "left",
      width: "100%",
      padding: "10px 12px",
      marginBottom: "6px",
      background: SURFACE,
      border: `1px solid ${BORDER_SUBTLE}`,
      borderRadius: "6px",
      cursor: "pointer",
    },
    children: [title, meta, summary],
  });
  applyBaseText(card);

  card.addEventListener("click", () => {
    dispatch({ type: "set-active-plan", slug: plan.slug });
  });

  return card;
}
```

**Note:** The `UIIntent` import will fail the typecheck until Task 10 adds `set-active-plan` to the union. Proceed anyway — the next task's step 2 patches it. Running `pnpm test` in this task skips typecheck, so the unit test still passes.

- [ ] **Step 4: Run to confirm the unit test passes (typecheck may still warn)**

Run: `pnpm test src/ui/plans-card.test.ts`
Expected: PASS.

- [ ] **Step 5: Do not commit yet**

The `UIIntent` union doesn't yet include `set-active-plan`; a commit here would leave the repo in a type-unclean state. Proceed to Task 8 and commit after Task 10 resolves the union.

---

## Task 8: Plans drawer — `src/ui/plans-drawer.ts`

**Files:**

- Create: `src/ui/plans-drawer.ts`
- Create: `src/ui/plans-drawer.test.ts`

- [ ] **Step 1: Write the failing tests**

The drawer has six rendering states; every test mounts a fresh drawer and asserts on the rendered content.

```ts
// src/ui/plans-drawer.test.ts
/* SPDX-License-Identifier: Apache-2.0 */
import { describe, test, expect, vi } from "vitest";
import { createPlansDrawer, type PlansDrawerView } from "./plans-drawer";
import type { PlanSummary } from "../plans";

const PLAN_N: PlanSummary = {
  slug: "2026-04-n",
  title: "N-only plan",
  month: "2026-04",
  hemisphere: "n",
  summary: "Northern",
  author: "Rob",
  publishedAt: "2026-04-01T00:00:00.000Z",
};
const PLAN_S: PlanSummary = { ...PLAN_N, slug: "2026-03-s", title: "S-only plan", hemisphere: "s" };
const PLAN_BOTH: PlanSummary = {
  ...PLAN_N,
  slug: "2026-02-both",
  title: "Anywhere",
  hemisphere: "both",
};

function render(view: PlansDrawerView, lat = 0): HTMLElement {
  const dispatch = vi.fn();
  const drawer = createPlansDrawer({ dispatch });
  drawer.setView(view, lat);
  drawer.openPanel();
  return drawer.element;
}

describe("plans drawer states", () => {
  test("loading", () => {
    const el = render({ kind: "loading" });
    expect(el.textContent).toMatch(/Loading plans/i);
  });

  test("unauthenticated", () => {
    const el = render({ kind: "unauthenticated" });
    expect(el.textContent).toMatch(/Sign in/i);
  });

  test("not_pro", () => {
    const el = render({ kind: "not_pro" });
    expect(el.textContent).toMatch(/Pro feature/i);
  });

  test("empty", () => {
    const el = render({ kind: "list", plans: [] }, 10);
    expect(el.textContent).toMatch(/No plans/i);
    expect(el.textContent).toMatch(/Northern/i);
  });

  test("error", () => {
    const el = render({ kind: "error" });
    expect(el.textContent).toMatch(/Couldn.t load/i);
  });

  test("list — northern observer keeps 'both' + 'n', drops 's'", () => {
    const el = render({ kind: "list", plans: [PLAN_N, PLAN_S, PLAN_BOTH] }, 10);
    expect(el.textContent).toContain("N-only plan");
    expect(el.textContent).not.toContain("S-only plan");
    expect(el.textContent).toContain("Anywhere");
  });

  test("list — southern observer keeps 'both' + 's', drops 'n'", () => {
    const el = render({ kind: "list", plans: [PLAN_N, PLAN_S, PLAN_BOTH] }, -10);
    expect(el.textContent).not.toContain("N-only plan");
    expect(el.textContent).toContain("S-only plan");
    expect(el.textContent).toContain("Anywhere");
  });
});

describe("plans drawer intent wiring", () => {
  test("retry button in error state dispatches retry-plans", () => {
    const dispatch = vi.fn();
    const drawer = createPlansDrawer({ dispatch });
    drawer.setView({ kind: "error" }, 0);
    drawer.openPanel();
    const btn = drawer.element.querySelector<HTMLElement>("[data-plans-retry]");
    btn?.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "retry-plans" });
  });
});
```

- [ ] **Step 2: Run to confirm red**

Run: `pnpm test src/ui/plans-drawer.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the drawer**

```ts
// src/ui/plans-drawer.ts
/* SPDX-License-Identifier: Apache-2.0 */
import { el } from "./dom";
import { createDrawer } from "./drawer";
import { applyBaseText, applyButton, TEXT_MUTED } from "./styles";
import { createPlanCard } from "./plans-card";
import type { UIIntent } from "./index";
import type { PlanSummary } from "../plans";

export type PlansDrawerView =
  | { kind: "loading" }
  | { kind: "unauthenticated" }
  | { kind: "not_pro" }
  | { kind: "error" }
  | { kind: "list"; plans: readonly PlanSummary[] };

export type PlansDrawer = {
  element: HTMLElement;
  openPanel: () => void;
  close: () => void;
  isOpen: () => boolean;
  setView: (view: PlansDrawerView, observerLat: number) => void;
};

export type PlansDrawerOptions = {
  dispatch: (intent: UIIntent) => void;
};

function filterByHemisphere(plans: readonly PlanSummary[], lat: number): readonly PlanSummary[] {
  const observerHemi = lat >= 0 ? "n" : "s";
  return plans.filter((p) => p.hemisphere === "both" || p.hemisphere === observerHemi);
}

function emptyCopyForLat(lat: number): string {
  const h = lat >= 0 ? "Northern" : "Southern";
  return `No plans for the ${h} hemisphere yet.`;
}

function renderBody(
  view: PlansDrawerView,
  observerLat: number,
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  if (view.kind === "loading") {
    return el("div", { text: "Loading plans…", style: { padding: "12px", color: TEXT_MUTED } });
  }
  if (view.kind === "unauthenticated") {
    const btn = el("button", { text: "Sign in" });
    applyButton(btn);
    btn.dataset.plansSignin = "";
    btn.addEventListener("click", () => dispatch({ type: "open-sign-in" }));
    return el("div", {
      style: { padding: "12px" },
      children: [el("p", { text: "Sign in to read monthly viewing plans." }), btn],
    });
  }
  if (view.kind === "not_pro") {
    return el("div", {
      style: { padding: "12px" },
      children: [
        el("p", { text: "Viewing Plans is a Pro feature." }),
        el("p", {
          text: "Upgrade details coming soon.",
          style: { color: TEXT_MUTED, fontSize: "12px" },
        }),
      ],
    });
  }
  if (view.kind === "error") {
    const retry = el("button", { text: "Try again" });
    applyButton(retry);
    retry.dataset.plansRetry = "";
    retry.addEventListener("click", () => dispatch({ type: "retry-plans" }));
    return el("div", {
      style: { padding: "12px" },
      children: [el("p", { text: "Couldn't load plans. Try again." }), retry],
    });
  }
  const filtered = filterByHemisphere(view.plans, observerLat);
  if (filtered.length === 0) {
    return el("div", {
      text: emptyCopyForLat(observerLat),
      style: { padding: "12px", color: TEXT_MUTED },
    });
  }
  return el("div", {
    style: { padding: "8px" },
    children: filtered.map((p) => createPlanCard(p, dispatch)),
  });
}

export function createPlansDrawer(options: PlansDrawerOptions): PlansDrawer {
  const content = el("div", { dataset: { testid: "plans-drawer-content" } });
  applyBaseText(content);

  const drawer = createDrawer({
    side: "right",
    width: 360,
    initialContent: content,
  });

  let currentView: PlansDrawerView = { kind: "loading" };
  let currentLat = 0;

  function rerender(): void {
    content.innerHTML = "";
    content.appendChild(
      el("div", {
        text: "Viewing Plans",
        style: { padding: "12px 12px 8px", fontSize: "14px", fontWeight: "600" },
      }),
    );
    content.appendChild(renderBody(currentView, currentLat, options.dispatch));
  }

  rerender();

  return {
    element: drawer.element,
    openPanel: () => drawer.open(content),
    close: drawer.close,
    isOpen: drawer.isOpen,
    setView: (view, lat) => {
      currentView = view;
      currentLat = lat;
      rerender();
    },
  };
}
```

- [ ] **Step 4: Run to confirm green**

Run: `pnpm test src/ui/plans-drawer.test.ts`
Expected: PASS.

- [ ] **Step 5: Do not commit yet**

The `UIIntent` union still needs `set-active-plan`, `open-sign-in`, and `retry-plans`. Task 10 adds them all. Commit at the end of Task 10.

---

## Task 9: Plans modal — `src/ui/plans-modal.ts`

**Files:**

- Create: `src/ui/plans-modal.ts`
- Create: `src/ui/plans-modal.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/ui/plans-modal.test.ts
/* SPDX-License-Identifier: Apache-2.0 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createPlansModal } from "./plans-modal";
import type { Plan } from "../plans";

const SAMPLE: Plan = {
  slug: "2026-04",
  title: "April — Lyrids",
  month: "2026-04",
  hemisphere: "both",
  summary: "Meteors.",
  author: "Rob",
  publishedAt: "2026-04-01T00:00:00.000Z",
  bodyMd: "# Body\n\nProse.",
  objects: [{ kind: "messier", id: "31", label: "Andromeda Galaxy (M31)" }],
};

describe("plans modal", () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let modal: ReturnType<typeof createPlansModal>;

  beforeEach(() => {
    dispatch = vi.fn();
    modal = createPlansModal({ dispatch });
    document.body.appendChild(modal.element);
  });
  afterEach(() => {
    modal.element.remove();
    document.body.style.overflow = "";
  });

  test("hidden when no plan is set", () => {
    expect(modal.element.hidden).toBe(true);
  });

  test("opens on setPlan, shows title + summary + body + chip", () => {
    modal.setPlan(SAMPLE);
    expect(modal.element.hidden).toBe(false);
    expect(modal.element.textContent).toContain("April — Lyrids");
    expect(modal.element.textContent).toContain("Meteors.");
    expect(modal.element.textContent).toContain("Prose.");
    expect(modal.element.textContent).toContain("Andromeda Galaxy (M31)");
    expect(document.body.style.overflow).toBe("hidden");
  });

  test("X button dispatches set-active-plan with null", () => {
    modal.setPlan(SAMPLE);
    const x = modal.element.querySelector<HTMLElement>("[data-plans-modal-close]");
    x?.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "set-active-plan", slug: null });
  });

  test("backdrop click dispatches close", () => {
    modal.setPlan(SAMPLE);
    const backdrop = modal.element.querySelector<HTMLElement>("[data-plans-modal-backdrop]");
    backdrop?.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "set-active-plan", slug: null });
  });

  test("ESC key dispatches close", () => {
    modal.setPlan(SAMPLE);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "set-active-plan", slug: null });
  });

  test("ESC does nothing when closed", () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("setPlan(null) hides and restores scroll lock", () => {
    modal.setPlan(SAMPLE);
    expect(document.body.style.overflow).toBe("hidden");
    modal.setPlan(null);
    expect(modal.element.hidden).toBe(true);
    expect(document.body.style.overflow).toBe("");
  });

  test("setError shows error copy; X still dispatches close", () => {
    modal.setError("2026-04", "not_found");
    expect(modal.element.hidden).toBe(false);
    expect(modal.element.textContent).toMatch(/couldn.t find/i);
    const x = modal.element.querySelector<HTMLElement>("[data-plans-modal-close]");
    x?.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "set-active-plan", slug: null });
  });

  test("chip click dispatches close + open-object-card with center coords", () => {
    modal.setPlan(SAMPLE);
    const chip = modal.element.querySelector<HTMLElement>("[data-plans-chip]");
    chip?.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "set-active-plan", slug: null });
    const openCardCall = dispatch.mock.calls.find(
      (c) => (c[0] as { type: string }).type === "open-object-card",
    );
    expect(openCardCall).toBeDefined();
    expect((openCardCall?.[0] as { objectKind: string }).objectKind).toBe("messier");
  });
});
```

- [ ] **Step 2: Run to confirm red**

Run: `pnpm test src/ui/plans-modal.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the modal**

```ts
// src/ui/plans-modal.ts
/* SPDX-License-Identifier: Apache-2.0 */
import { el } from "./dom";
import {
  applyBaseText,
  applyButton,
  PANEL_BG,
  PANEL_BORDER,
  TEXT_COLOR,
  TEXT_MUTED,
} from "./styles";
import { renderMarkdownToSafeHtml } from "./markdown";
import type { UIIntent } from "./index";
import type { Plan, LinkedEntity, PlanError } from "../plans";

export type PlansModalOptions = {
  dispatch: (intent: UIIntent) => void;
};

export type PlansModal = {
  element: HTMLElement;
  setPlan: (plan: Plan | null) => void;
  setError: (slug: string, kind: PlanError["kind"]) => void;
};

const OBJECT_CARD_SUPPORTED_KINDS: ReadonlySet<LinkedEntity["kind"]> = new Set([
  "planet",
  "messier",
  "star",
  "satellite",
  "constellation",
]);

function errorCopy(kind: PlanError["kind"]): string {
  if (kind === "not_found") return "We couldn't find that plan. It may have been removed.";
  if (kind === "not_pro") return "This plan is a Pro feature.";
  if (kind === "unauthenticated") return "Please sign in to read this plan.";
  return "Something went wrong loading that plan. Please try again.";
}

function buildChip(entity: LinkedEntity, dispatch: (intent: UIIntent) => void): HTMLElement {
  const chip = el("button", {
    text: entity.label,
    dataset: { plansChip: entity.kind + ":" + entity.id },
    style: {
      padding: "6px 10px",
      marginRight: "6px",
      marginBottom: "6px",
      background: "transparent",
      border: `1px solid ${PANEL_BORDER}`,
      borderRadius: "14px",
      fontSize: "12px",
      cursor: "pointer",
      color: TEXT_COLOR,
    },
  });
  applyBaseText(chip);

  if (!OBJECT_CARD_SUPPORTED_KINDS.has(entity.kind)) {
    chip.disabled = true;
    chip.style.opacity = "0.5";
    chip.style.cursor = "not-allowed";
    chip.title = "Not yet supported";
    return chip;
  }

  chip.addEventListener("click", () => {
    dispatch({ type: "set-active-plan", slug: null });
    dispatch({
      type: "open-object-card",
      objectKind: entity.kind,
      id: entity.id,
      screenX: Math.round(window.innerWidth / 2),
      screenY: Math.round(window.innerHeight / 2),
    });
  });
  return chip;
}

export function createPlansModal(options: PlansModalOptions): PlansModal {
  const title = el("h2", {
    style: { margin: "0 0 6px", fontSize: "22px", fontWeight: "600" },
  });
  const meta = el("div", {
    style: { fontSize: "12px", color: TEXT_MUTED, marginBottom: "16px" },
  });
  const pullQuote = el("blockquote", {
    style: {
      margin: "0 0 16px",
      padding: "8px 12px",
      borderLeft: `3px solid ${PANEL_BORDER}`,
      fontStyle: "italic",
      color: TEXT_MUTED,
    },
  });
  const body = el("div", {
    style: { fontSize: "14px", lineHeight: "1.6", marginBottom: "16px" },
  });
  const targetsLabel = el("div", {
    text: "Targets",
    style: {
      fontSize: "11px",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: TEXT_MUTED,
      marginBottom: "6px",
    },
  });
  const targetsStrip = el("div", { style: { display: "flex", flexWrap: "wrap" } });

  const closeBtn = el("button", {
    text: "×",
    dataset: { plansModalClose: "" },
    style: {
      position: "absolute",
      top: "12px",
      right: "12px",
      width: "32px",
      height: "32px",
      borderRadius: "16px",
      border: "none",
      background: "transparent",
      color: TEXT_COLOR,
      fontSize: "20px",
      cursor: "pointer",
    },
  });
  applyButton(closeBtn);
  closeBtn.addEventListener("click", () =>
    options.dispatch({ type: "set-active-plan", slug: null }),
  );

  const card = el("div", {
    dataset: { plansModalCard: "" },
    style: {
      position: "relative",
      maxWidth: "680px",
      width: "min(92vw, 680px)",
      maxHeight: "86vh",
      overflowY: "auto",
      margin: "auto",
      padding: "40px 32px 32px",
      background: PANEL_BG,
      border: `1px solid ${PANEL_BORDER}`,
      borderRadius: "8px",
      color: TEXT_COLOR,
    },
    children: [title, meta, pullQuote, body, targetsLabel, targetsStrip, closeBtn],
  });
  applyBaseText(card);

  const backdrop = el("div", {
    dataset: { plansModalBackdrop: "" },
    style: {
      position: "fixed",
      inset: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0, 0, 0, 0.55)",
      zIndex: "2000",
    },
    children: [card],
  });
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) options.dispatch({ type: "set-active-plan", slug: null });
  });

  const root = el("div", { children: [backdrop] });
  root.hidden = true;

  function setVisible(visible: boolean): void {
    root.hidden = !visible;
    document.body.style.overflow = visible ? "hidden" : "";
  }

  function show(
    titleText: string,
    metaText: string,
    summaryText: string,
    bodyHtml: string,
    objects: readonly LinkedEntity[],
  ): void {
    title.textContent = titleText;
    meta.textContent = metaText;
    pullQuote.textContent = summaryText;
    body.innerHTML = bodyHtml;
    targetsStrip.innerHTML = "";
    if (objects.length === 0) {
      targetsLabel.hidden = true;
    } else {
      targetsLabel.hidden = false;
      for (const o of objects) targetsStrip.appendChild(buildChip(o, options.dispatch));
    }
    setVisible(true);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape" && !root.hidden) {
      options.dispatch({ type: "set-active-plan", slug: null });
    }
  }
  window.addEventListener("keydown", onKeyDown);

  return {
    element: root,
    setPlan: (plan) => {
      if (plan === null) {
        setVisible(false);
        return;
      }
      show(
        plan.title,
        `${plan.month} · ${plan.hemisphere.toUpperCase()} · ${plan.author}`,
        plan.summary,
        renderMarkdownToSafeHtml(plan.bodyMd),
        plan.objects,
      );
    },
    setError: (_slug, kind) => {
      show("Plan unavailable", "", errorCopy(kind), "", []);
    },
  };
}
```

- [ ] **Step 4: Run to confirm green**

Run: `pnpm test src/ui/plans-modal.test.ts`
Expected: PASS.

- [ ] **Step 5: Do not commit yet**

Commit after Task 10.

---

## Task 10: App integration + new intents

**Files:**

- Modify: `src/ui/index.ts`
- Modify: `src/ui/panel.ts`
- Modify: `src/app.ts`
- Modify: `src/app.test.ts`

This is the widest-blast-radius task. It adds three new UIIntent variants (`set-active-plan`, `open-sign-in`, `retry-plans`), wires the "Plans" button into the panel, mounts both new UI components, and handles hydration of `?plan=` on boot. The `src/app.ts` branch-coverage gate (70%) is the thing to watch.

- [ ] **Step 1: Extend `UIIntent` in `src/ui/index.ts`**

```ts
// Add to the UIIntent union:
| { readonly type: "set-active-plan"; readonly slug: string | null }
| { readonly type: "open-sign-in" }
| { readonly type: "retry-plans" }
```

- [ ] **Step 2: Confirm typecheck is now clean (resolves the cross-cutting imports from Tasks 7–9)**

Run: `pnpm typecheck`
Expected: No errors related to `set-active-plan` / `open-sign-in` / `retry-plans`.

- [ ] **Step 3: Add "Plans" button to `src/ui/panel.ts`**

```ts
// Extend PanelOptions (around line 27–41):
onOpenPlans?: () => void;

// Alongside the existing drawer-trigger buttons, create:
const plansBtn = el("button", { text: "Plans", dataset: { testid: "panel-plans-btn" } });
applyButton(plansBtn);
plansBtn.addEventListener("click", () => {
  options.onOpenPlans?.();
});
// Append plansBtn to the same container as the events/tonight/settings buttons.
```

Match the existing style + position of those buttons — don't invent a new pattern.

- [ ] **Step 4: Write the failing app tests**

Append to `src/app.test.ts`:

```ts
describe("set-active-plan intent", () => {
  test("non-null slug updates state and URL", async () => {
    const { store, url } = await bootApp({ initialHash: "" });
    store.dispatch({ type: "set-active-plan", slug: "2026-04" });
    expect(store.getState().activePlanSlug).toBe("2026-04");
    expect(url.toString()).toContain("plan=2026-04");
  });

  test("null slug clears state and drops the URL param", async () => {
    const { store, url } = await bootApp({ initialHash: "?plan=2026-04" });
    store.dispatch({ type: "set-active-plan", slug: null });
    expect(store.getState().activePlanSlug).toBeNull();
    expect(url.toString()).not.toContain("plan=");
  });
});

describe("?plan= hydration", () => {
  test("boot with ?plan=<slug> puts the slug in state and opens the modal", async () => {
    const { store, modal } = await bootApp({ initialHash: "?plan=2026-04" });
    expect(store.getState().activePlanSlug).toBe("2026-04");
    expect(modal.element.hidden).toBe(false);
  });

  test("boot with a malformed ?plan= value is ignored", async () => {
    const { store } = await bootApp({ initialHash: "?plan=NotASlug" });
    expect(store.getState().activePlanSlug).toBeNull();
  });
});
```

**Adapt the shape of `bootApp()` to however the existing `src/app.test.ts` bootstraps the app.** If it uses a helper like `createTestApp({ search })`, match that pattern and expose `modal` through whatever DOM query the existing tests use. The goal is four new tests: two arms of `set-active-plan` + two arms of hydration.

- [ ] **Step 5: Run to confirm red**

Run: `pnpm test src/app.test.ts -t "set-active-plan|plan= hydration"`
Expected: FAIL — intent not handled / modal not wired.

- [ ] **Step 6: Wire the new intents, fetches, mounts, and hydration in `src/app.ts`**

Concrete additions:

```ts
// Imports near the top:
import { listPlans, getPlan } from "./plans";
import { createPlansDrawer, type PlansDrawerView } from "./ui/plans-drawer";
import { createPlansModal } from "./ui/plans-modal";
import { isPro } from "./features";

// Lifecycle-scoped singletons alongside the existing drawer mounts:
const plansDrawer = createPlansDrawer({ dispatch: handleIntent });
const plansModal = createPlansModal({ dispatch: handleIntent });
document.body.appendChild(plansDrawer.element);
document.body.appendChild(plansModal.element);

async function refreshPlansView(): Promise<void> {
  plansDrawer.setView({ kind: "loading" }, state.observer.lat);
  const res = await listPlans();
  if (res.ok) {
    plansDrawer.setView({ kind: "list", plans: res.value }, state.observer.lat);
    return;
  }
  const view: PlansDrawerView =
    res.error.kind === "unauthenticated"
      ? { kind: "unauthenticated" }
      : res.error.kind === "not_pro"
        ? { kind: "not_pro" }
        : { kind: "error" };
  plansDrawer.setView(view, state.observer.lat);
}

async function openPlanBySlug(slug: string): Promise<void> {
  const res = await getPlan(slug);
  if (res.ok) {
    plansModal.setPlan(res.value);
    return;
  }
  plansModal.setError(slug, res.error.kind);
  // Clear the active slug so a reload doesn't render the broken state forever.
  handleIntent({ type: "set-active-plan", slug: null });
}

// In the intent switch (alongside existing cases):
case "set-active-plan": {
  state = { ...state, activePlanSlug: intent.slug };
  syncUrl();
  if (intent.slug === null) {
    plansModal.setPlan(null);
  } else {
    void openPlanBySlug(intent.slug);
  }
  break;
}
case "open-sign-in": {
  // Reuse whatever sign-in intent the auth-drawer currently dispatches;
  // if one already exists, route to it here. Otherwise, no-op for MVP (button present).
  break;
}
case "retry-plans": {
  void refreshPlansView();
  break;
}

// Panel wiring — include onOpenPlans:
createPanel({
  // …existing options…
  onOpenPlans: () => {
    // closes other drawers via existing coordination
    closeOtherDrawers();
    plansDrawer.openPanel();
    void refreshPlansView();
  },
});

// Hydrate ?plan= on boot: after initial state is loaded, if activePlanSlug is not null:
if (state.activePlanSlug !== null) {
  void openPlanBySlug(state.activePlanSlug);
}
```

Use the existing `closeOtherDrawers()` / drawer-coordination helper; don't invent a new one. If the current panel doesn't expose `onOpenPlans`, extending `PanelOptions` in Task 10 Step 3 makes that callback available.

- [ ] **Step 7: Run to confirm green**

Run: `pnpm test src/app.test.ts src/ui/plans-card.test.ts src/ui/plans-drawer.test.ts src/ui/plans-modal.test.ts`
Expected: PASS across all four files.

- [ ] **Step 8: Run the full coverage check — the `src/app.ts` branch gate is the risk**

Run: `pnpm test:cov`
Expected: All thresholds pass. If `src/app.ts` branch coverage is under 70%, add a test that hits the specific missing branch (likely the `open-sign-in` no-op or the error path in `openPlanBySlug`).

- [ ] **Step 9: Commit Tasks 7 through 10 together**

All four UI tasks share the `UIIntent` cross-reference; landing them atomically keeps `main` type-clean at every commit.

```bash
git add src/ui/plans-card.ts src/ui/plans-card.test.ts \
        src/ui/plans-drawer.ts src/ui/plans-drawer.test.ts \
        src/ui/plans-modal.ts src/ui/plans-modal.test.ts \
        src/ui/index.ts src/ui/panel.ts \
        src/app.ts src/app.test.ts
git commit -m "feat(ui): Viewing Plans drawer + reader modal + app wiring (#220)"
```

---

## Task 11: Seed script — `scripts/seed-plans.mjs`

**Files:**

- Create: `scripts/seed-plans.mjs`
- Create: `scripts/seed-plans.test.mjs`
- Modify: `package.json` (new `"seed-plans"` npm script)
- Modify: `.gitignore` (add `scripts/.seed-plans.sql`)

- [ ] **Step 1: Write the failing tests**

```js
// scripts/seed-plans.test.mjs
/* SPDX-License-Identifier: Apache-2.0 */
import { describe, test, expect } from "vitest";
import { parsePlanFile, buildUpsertSql } from "./seed-plans.mjs";

const VALID = `---
{
  "slug": "2026-04",
  "title": "April",
  "month": "2026-04",
  "hemisphere": "both",
  "summary": "s",
  "author": "Rob",
  "publishedAt": "2026-04-01T00:00:00Z",
  "objects": [
    { "kind": "messier", "id": "31", "label": "M31" }
  ]
}
---

Body prose here.`;

describe("parsePlanFile", () => {
  test("parses a valid file", () => {
    const r = parsePlanFile(VALID);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.slug).toBe("2026-04");
      expect(r.value.bodyMd).toBe("Body prose here.");
      expect(r.value.objects).toEqual([{ kind: "messier", id: "31", label: "M31" }]);
      expect(r.value.publishedAtMs).toBe(Date.parse("2026-04-01T00:00:00Z"));
    }
  });

  test("rejects missing frontmatter", () => {
    const r = parsePlanFile("no frontmatter here");
    expect(r.ok).toBe(false);
  });

  test("rejects malformed JSON in frontmatter", () => {
    const bad = VALID.replace('"slug": "2026-04",', '"slug": 2026-04,');
    const r = parsePlanFile(bad);
    expect(r.ok).toBe(false);
  });

  test("rejects unknown hemisphere", () => {
    const bad = VALID.replace('"hemisphere": "both"', '"hemisphere": "mars"');
    const r = parsePlanFile(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/hemisphere/);
  });

  test("rejects objects that isn't an array", () => {
    const bad = VALID.replace(/"objects":[\s\S]*?\]/, '"objects": "nope"');
    const r = parsePlanFile(bad);
    expect(r.ok).toBe(false);
  });

  test("rejects missing title", () => {
    const bad = VALID.replace('"title": "April",', "");
    const r = parsePlanFile(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/title/);
  });
});

describe("buildUpsertSql", () => {
  test("emits an INSERT with placeholders and a matching bind array", () => {
    const parsed = parsePlanFile(VALID);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const { sql, binds } = buildUpsertSql(parsed.value, 12345);
    expect(sql).toContain("INSERT INTO plans");
    expect(sql).toContain("ON CONFLICT(slug) DO UPDATE");
    expect(binds).toHaveLength(11); // 9 fields + created_at + updated_at
    expect(binds[0]).toBe("2026-04"); // slug is first
    expect(binds[binds.length - 1]).toBe(12345); // updated_at is last
  });
});
```

- [ ] **Step 2: Run to confirm red**

Run: `pnpm test scripts/seed-plans.test.mjs`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the script**

```js
// scripts/seed-plans.mjs
/* SPDX-License-Identifier: Apache-2.0 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const HEMIS = new Set(["n", "s", "both"]);
const KINDS = new Set(["star", "messier", "planet", "satellite", "constellation"]);

/**
 * Parse a Markdown file with a JSON frontmatter fence into a typed plan record.
 * Returns { ok: true, value } or { ok: false, error }.
 */
export function parsePlanFile(raw) {
  const FENCE = "---";
  if (!raw.startsWith(FENCE + "\n") && !raw.startsWith(FENCE + "\r\n")) {
    return { ok: false, error: "file must start with a --- fence" };
  }
  const afterOpen = raw.slice(FENCE.length).replace(/^\r?\n/, "");
  const closeIdx = afterOpen.indexOf("\n" + FENCE);
  if (closeIdx === -1) return { ok: false, error: "no closing --- fence found" };

  const jsonBlock = afterOpen.slice(0, closeIdx).trim();
  const bodyMd = afterOpen
    .slice(closeIdx + FENCE.length + 1)
    .replace(/^\r?\n/, "")
    .trimEnd();

  let fm;
  try {
    fm = JSON.parse(jsonBlock);
  } catch (e) {
    return { ok: false, error: `JSON parse: ${e.message}` };
  }

  for (const key of ["slug", "title", "month", "hemisphere", "summary", "author", "publishedAt"]) {
    if (typeof fm[key] !== "string" || fm[key].length === 0) {
      return { ok: false, error: `missing or non-string field: ${key}` };
    }
  }
  if (!HEMIS.has(fm.hemisphere)) {
    return { ok: false, error: `bad hemisphere: ${fm.hemisphere}` };
  }
  if (!Array.isArray(fm.objects)) {
    return { ok: false, error: "objects must be an array" };
  }
  for (const [i, o] of fm.objects.entries()) {
    if (o === null || typeof o !== "object") {
      return { ok: false, error: `objects[${i}] not an object` };
    }
    if (!KINDS.has(o.kind)) {
      return { ok: false, error: `objects[${i}].kind invalid: ${o.kind}` };
    }
    if (typeof o.id !== "string" || o.id.length === 0) {
      return { ok: false, error: `objects[${i}].id missing or non-string` };
    }
    if (typeof o.label !== "string" || o.label.length === 0) {
      return { ok: false, error: `objects[${i}].label missing or non-string` };
    }
  }
  const publishedAtMs = Date.parse(fm.publishedAt);
  if (Number.isNaN(publishedAtMs)) {
    return { ok: false, error: `unparseable publishedAt: ${fm.publishedAt}` };
  }
  return {
    ok: true,
    value: {
      slug: fm.slug,
      title: fm.title,
      month: fm.month,
      hemisphere: fm.hemisphere,
      summary: fm.summary,
      author: fm.author,
      publishedAtMs,
      objects: fm.objects,
      bodyMd,
    },
  };
}

const UPSERT_SQL =
  "INSERT INTO plans (slug, title, month, hemisphere, summary, body_md, objects_json, author, published_at, created_at, updated_at) " +
  "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
  "ON CONFLICT(slug) DO UPDATE SET " +
  "title = excluded.title, month = excluded.month, hemisphere = excluded.hemisphere, " +
  "summary = excluded.summary, body_md = excluded.body_md, objects_json = excluded.objects_json, " +
  "author = excluded.author, published_at = excluded.published_at, updated_at = excluded.updated_at";

export function buildUpsertSql(plan, nowMs) {
  return {
    sql: UPSERT_SQL,
    binds: [
      plan.slug,
      plan.title,
      plan.month,
      plan.hemisphere,
      plan.summary,
      plan.bodyMd,
      JSON.stringify(plan.objects),
      plan.author,
      plan.publishedAtMs,
      nowMs,
      nowMs,
    ],
  };
}

function sqlLiteral(v) {
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

function inlineStatement({ sql, binds }) {
  let i = 0;
  return sql.replace(/\?/g, () => sqlLiteral(binds[i++])) + ";";
}

function main() {
  const root = resolve(new URL(".", import.meta.url).pathname, "..");
  const plansDir = join(root, "data", "plans");
  const sqlPath = join(root, "scripts", ".seed-plans.sql");
  const isRemote = process.argv.includes("--remote");

  let files;
  try {
    files = readdirSync(plansDir).filter((f) => f.endsWith(".md"));
  } catch (e) {
    console.error(`Cannot read ${plansDir}: ${e.message}`);
    process.exit(1);
  }
  if (files.length === 0) {
    console.error(`No .md files in ${plansDir}`);
    process.exit(1);
  }

  const statements = [];
  const now = Date.now();
  for (const file of files) {
    const full = join(plansDir, file);
    const raw = readFileSync(full, "utf8");
    const parsed = parsePlanFile(raw);
    if (!parsed.ok) {
      console.error(`[${full}] ${parsed.error}`);
      process.exit(1);
    }
    statements.push(inlineStatement(buildUpsertSql(parsed.value, now)));
  }

  writeFileSync(sqlPath, statements.join("\n") + "\n", "utf8");

  const args = [
    "d1",
    "execute",
    "planisphere",
    isRemote ? "--remote" : "--local",
    `--file=${sqlPath}`,
  ];
  const result = spawnSync("wrangler", args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error("wrangler d1 execute failed");
    process.exit(result.status ?? 1);
  }
  console.log(`Upserted ${files.length} plan(s) into ${isRemote ? "remote" : "local"} D1.`);
}

// Only run main() when invoked as a script, not when imported as a module by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test scripts/seed-plans.test.mjs`
Expected: PASS.

- [ ] **Step 5: Add the `package.json` script**

```json
"seed-plans": "node scripts/seed-plans.mjs"
```

Place in the `scripts` block alphabetically with the existing scripts.

- [ ] **Step 6: Add `.gitignore` entry**

Append to `.gitignore`:

```
# generated by pnpm seed-plans
scripts/.seed-plans.sql
```

- [ ] **Step 7: Commit**

```bash
git add scripts/seed-plans.mjs scripts/seed-plans.test.mjs package.json .gitignore
git commit -m "feat(scripts): zero-dep seed-plans pipeline for #220"
```

---

## Task 12: Placeholder seed plan — `data/plans/2026-04.md`

**Files:**

- Create: `data/plans/2026-04.md`

- [ ] **Step 1: Write the placeholder file**

```md
---
{
  "slug": "2026-04",
  "title": "April 2026 — TBD title",
  "month": "2026-04",
  "hemisphere": "both",
  "summary": "Placeholder preview — owner to replace before deploy.",
  "author": "Rob Sartin",
  "publishedAt": "2026-04-01T00:00:00Z",
  "objects": [{ "kind": "messier", "id": "31", "label": "Andromeda Galaxy (M31)" }],
}
---

TBD — owner to author.
```

- [ ] **Step 2: Verify the seed script accepts it against local D1**

Run: `pnpm seed-plans`
Expected: "Upserted 1 plan(s) into local D1." — no parse errors.

- [ ] **Step 3: Verify the row landed**

Run: `wrangler d1 execute planisphere --local --command "SELECT slug, title FROM plans;"`
Expected: one row with slug `2026-04`.

- [ ] **Step 4: Commit**

```bash
git add data/plans/2026-04.md
git commit -m "feat(data): placeholder seed plan for #220 MVP"
```

---

## Task 13: ADR 015

**Files:**

- Create: `docs/adr/015-viewing-plans-storage-and-pro-gate.md`
- Modify: `docs/adr/README.md`

- [ ] **Step 1: Write the ADR**

```md
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
- JSON frontmatter is author-friendly for structured fields and unambiguous for the parser, at the cost of quoting every key and forbidding trailing commas.

## Alternatives considered

- **Bundle plans as a JS import in the SPA** — simpler but can't be gated server-side.
- **Cloudflare KV for plan content** — another moving part without clear benefit over D1 for read-mostly structured data.
- **Admin UI for CRUD** — premature; no use case for non-owner authoring in the MVP.
```

- [ ] **Step 2: Add ADR 015 row to `docs/adr/README.md`**

Match the existing table / list format:

```md
| 015 | Viewing Plans storage and Pro-gate enforcement | Accepted | 2026-04-24 |
```

- [ ] **Step 3: Commit**

```bash
git add docs/adr/015-viewing-plans-storage-and-pro-gate.md docs/adr/README.md
git commit -m "docs(adr): 015 — Viewing Plans storage and Pro-gate enforcement"
```

---

## Task 14: User guide + architecture doc updates

**Files:**

- Modify: `docs/user-guide.md`
- Modify: `docs/architecture.md`

- [ ] **Step 1: Add "Viewing Plans" section to `docs/user-guide.md`**

Insert under the Pro-tier section in the style of existing subsections:

```md
## Viewing Plans (Pro)

Viewing Plans are short monthly reads that highlight what's worth looking at this month, with one-click jumps into the sky from your location. Click the **Plans** button in the HUD to open the drawer. Each plan card shows the month and a preview; click to open the full read.

Plans are filtered by your hemisphere — a Northern-hemisphere observer won't see plans tagged for the South, and vice versa. Plans tagged `both` show everywhere.

Every plan has a shareable deep link. `https://planisphere.example/?plan=2026-04` opens the app directly to the April 2026 plan. If someone without Pro access opens the link they'll see the Pro-upgrade prompt instead.

Target chips at the bottom of each plan (Andromeda Galaxy, Jupiter, etc.) open the object card for that target in the sky and close the reader so you can see it from where you're standing.
```

Adjust the example URL / specific dates as appropriate for the repo.

- [ ] **Step 2: Add plans-module paragraph to `docs/architecture.md`**

Match the style of the existing per-module notes:

```md
### Viewing Plans

Pro-gated read-only content module. `worker/routes/plans.ts` exposes `GET /api/plans` (summaries) and `GET /api/plans/:slug` (detail), both fronted by the session + `users.tier='pro'` check. D1 schema lives in `migrations/0004_plans.sql`. Client side, `src/plans.ts` mirrors the `src/notebooks.ts` `Result<T, PlanError>` wrapper pattern with a small in-module cache for detail lookups. UI is split across `src/ui/plans-drawer.ts` (feed + hemisphere filter + six render states) and `src/ui/plans-modal.ts` (reader overlay + linked-entity chips that dispatch `open-object-card`). State is synced via `AppState.activePlanSlug` and `?plan=<slug>`. Content is authored as Markdown in `data/plans/<slug>.md` with a JSON frontmatter fence, ingested by `scripts/seed-plans.mjs` and committed to D1 via `pnpm seed-plans [--remote]`. See ADR 015 for the tier-gate and content-model rationale.
```

- [ ] **Step 3: Commit**

```bash
git add docs/user-guide.md docs/architecture.md
git commit -m "docs: Viewing Plans section in user-guide + architecture note"
```

---

## Task 15: Final verification — smoke test + pre-push gate

**Files:** none (verification only)

- [ ] **Step 1: Local smoke test against a development instance**

Start dev servers: `pnpm dev`

Then walk through the manual smoke checklist from spec §9.4:

1. Cold boot at `/` as anon → click Plans button → drawer shows "Sign in" empty state.
2. Log in as free user → drawer shows "Pro feature" empty state.
3. Log in as Pro user (`rob.sartin@gmail.com`) → drawer shows the seed plan card.
4. Click card → modal opens; URL gains `?plan=2026-04`.
5. Close via X / ESC / backdrop — URL drops `?plan=`.
6. Reload `?plan=2026-04` cold — modal opens on seed plan.
7. Reload `?plan=nonexistent` — modal opens briefly, shows error, URL param cleared.
8. Click a linked-entity chip → object card opens for that entity, modal closes.
9. Change location to Southern hemisphere → drawer still shows the `hemisphere: "both"` seed plan.
10. `pnpm seed-plans` against local D1 is idempotent — row count stays 1 across repeated runs.

For step 3 locally, promote the dev user manually: `wrangler d1 execute planisphere --local --command "UPDATE users SET tier='pro' WHERE email='rob.sartin@gmail.com';"`

- [ ] **Step 2: Pre-push gate — canonical one-liner plus worker suite**

Run:

```
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:cov && pnpm build && pnpm test:worker
```

Expected: All green. If `pnpm test:cov` flags `src/app.ts` branch coverage under 70%, add a test for the missing branch (most likely in the intent switch or hydration paths) and re-run.

- [ ] **Step 3: Push branch and open PR**

```bash
git push -u origin feat/viewing-plans-mvp
gh pr create --title "feat: Viewing Plans MVP (#220)" --body "..."
```

PR body should include:

- Summary referencing the spec (`docs/specs/2026-04-24-monthly-viewing-plans-design.md`) and ADR 015.
- Explicit note that the seed plan body at `data/plans/2026-04.md` is still a `TBD` placeholder — owner replaces before `pnpm seed-plans --remote`.
- Post-merge deployment checklist:
  1. Merge → auto-deploy.
  2. Promote: `wrangler d1 execute planisphere --remote --command "UPDATE users SET tier='pro' WHERE email='rob.sartin@gmail.com';"`
  3. Author the plan body in `data/plans/2026-04.md` and commit.
  4. `pnpm seed-plans --remote`.
- Closes `#220`.
