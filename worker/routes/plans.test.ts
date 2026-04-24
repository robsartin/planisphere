/* SPDX-License-Identifier: Apache-2.0 */
import { describe, test, expect, beforeEach } from "vitest";
import { testEnv, resetDb, login, authed, fetchWorker, TEST_BASE } from "../test-helpers";
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
    const res = await fetchWorker(new Request(`${TEST_BASE}/api/plans`));
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
    expect(body.plans[0]!.slug).toBe("2026-04");
    expect(body.plans[0]!.publishedAt).toBe(new Date(1_700_000_000_000).toISOString());
    expect(body.plans[0]!.bodyMd).toBeUndefined();
    expect(body.plans[0]!.objects).toBeUndefined();
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
