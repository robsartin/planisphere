/* SPDX-License-Identifier: Apache-2.0 */
import { describe, test, expect, beforeEach } from "vitest";
import { testEnv, resetDb } from "./test-helpers";
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
