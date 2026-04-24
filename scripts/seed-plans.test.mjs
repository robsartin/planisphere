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

  test("rejects object with bad kind", () => {
    const bad = VALID.replace('"kind": "messier"', '"kind": "alien"');
    const r = parsePlanFile(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/kind/);
  });

  test("rejects unparseable publishedAt", () => {
    const bad = VALID.replace('"publishedAt": "2026-04-01T00:00:00Z"', '"publishedAt": "nope"');
    const r = parsePlanFile(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/publishedAt/);
  });

  test("rejects missing closing fence", () => {
    const r = parsePlanFile('---\n{ "slug": "x" }\n'); // no closing ---
    expect(r.ok).toBe(false);
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
