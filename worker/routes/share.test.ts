/* SPDX-License-Identifier: Apache-2.0 */
import { describe, test, expect, beforeEach } from "vitest";
import { testEnv, resetDb, login, fetchWorker, TEST_BASE } from "../test-helpers";
import { _resetRateLimiterForTests } from "./share";

/**
 * Route tests for #377. The rate-limiter's in-memory bucket is per-isolate
 * state that leaks across tests; every `beforeEach` calls the reset helper
 * so counters start at zero.
 */

const SAME_ORIGIN_URL = `${TEST_BASE}/?lat=61.2&lon=-149.9&t=2026-04-25T08:00:00Z`;

async function postShare(body: unknown, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie !== undefined) headers.cookie = `ps_session=${cookie}`;
  return fetchWorker(
    new Request(`${TEST_BASE}/api/share`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/share", () => {
  beforeEach(async () => {
    _resetRateLimiterForTests();
    await resetDb();
  });

  test("400 when body is not JSON", async () => {
    const res = await fetchWorker(
      new Request(`${TEST_BASE}/api/share`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_request" });
  });

  test("400 when url field is missing", async () => {
    const res = await postShare({});
    expect(res.status).toBe(400);
  });

  test("400 when url is not the request origin (open-redirect defense)", async () => {
    // The Worker's test base is http://localhost — evil.com is not
    // same-origin, so the mint MUST refuse regardless of auth state.
    const res = await postShare({ url: "https://evil.example.com/attacker" });
    expect(res.status).toBe(400);
  });

  test("400 when url is longer than 4096 chars", async () => {
    const huge = `${TEST_BASE}/?x=${"a".repeat(4200)}`;
    const res = await postShare({ url: huge });
    expect(res.status).toBe(400);
  });

  test("201 anonymously mints a 6-char code and returns the shortUrl", async () => {
    const res = await postShare({ url: SAME_ORIGIN_URL });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { code: string; shortUrl: string };
    expect(body.code).toMatch(/^[0-9A-Za-z]{6}$/);
    expect(body.shortUrl).toBe(`${TEST_BASE}/s/${body.code}`);
    // The row lives in the DB with created_by = NULL for anon.
    const row = await testEnv.DB.prepare(
      "SELECT target_url, created_by, hit_count FROM share_links WHERE code = ?",
    )
      .bind(body.code)
      .first<{ target_url: string; created_by: number | null; hit_count: number }>();
    expect(row).not.toBeNull();
    expect(row!.target_url).toBe(SAME_ORIGIN_URL);
    expect(row!.created_by).toBeNull();
    expect(row!.hit_count).toBe(0);
  });

  test("201 attributes the row to the authed user", async () => {
    const cookie = await login("rob@example.com");
    const res = await postShare({ url: SAME_ORIGIN_URL }, cookie);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { code: string };
    const row = await testEnv.DB.prepare("SELECT created_by FROM share_links WHERE code = ?")
      .bind(body.code)
      .first<{ created_by: number | null }>();
    expect(row!.created_by).not.toBeNull();
    expect(typeof row!.created_by).toBe("number");
  });

  test("429 after burning the anonymous per-minute budget", async () => {
    // Anon limit is 5/min/IP. Sixth request in the same window trips it.
    for (let i = 0; i < 5; i++) {
      const ok = await postShare({ url: SAME_ORIGIN_URL });
      expect(ok.status).toBe(201);
    }
    const denied = await postShare({ url: SAME_ORIGIN_URL });
    expect(denied.status).toBe(429);
    expect(await denied.json()).toEqual({ error: "rate_limited" });
  });

  test("authenticated callers get a higher (30/min) budget", async () => {
    const cookie = await login("rob@example.com");
    // 10 mints in a row must succeed — well above the anon ceiling of 5.
    for (let i = 0; i < 10; i++) {
      const ok = await postShare({ url: SAME_ORIGIN_URL }, cookie);
      expect(ok.status).toBe(201);
    }
  });

  test("405 on non-POST methods to /api/share", async () => {
    const res = await fetchWorker(new Request(`${TEST_BASE}/api/share`, { method: "GET" }));
    expect(res.status).toBe(405);
  });
});

describe("GET /s/:code", () => {
  beforeEach(async () => {
    _resetRateLimiterForTests();
    await resetDb();
  });

  test("404 on unknown code", async () => {
    const res = await fetchWorker(new Request(`${TEST_BASE}/s/ABCDEF`, { redirect: "manual" }));
    expect(res.status).toBe(404);
  });

  test("404 on malformed code (wrong length / bad chars)", async () => {
    const bad = await fetchWorker(new Request(`${TEST_BASE}/s/nope`, { redirect: "manual" }));
    expect(bad.status).toBe(404);
    const symbols = await fetchWorker(new Request(`${TEST_BASE}/s/aa-bb!`, { redirect: "manual" }));
    expect(symbols.status).toBe(404);
  });

  test("302 to the stored URL and increments hit_count", async () => {
    // Mint a real code first.
    const mint = await postShare({ url: SAME_ORIGIN_URL });
    const { code } = (await mint.json()) as { code: string };

    const res = await fetchWorker(new Request(`${TEST_BASE}/s/${code}`, { redirect: "manual" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(SAME_ORIGIN_URL);

    // Hit count reflects the redirect. The bump is fire-and-forget so
    // give the pending update a beat to settle.
    await new Promise((resolve) => setTimeout(resolve, 20));
    const row = await testEnv.DB.prepare("SELECT hit_count FROM share_links WHERE code = ?")
      .bind(code)
      .first<{ hit_count: number }>();
    expect(row!.hit_count).toBe(1);
  });

  test("405 on non-GET method to /s/:code", async () => {
    const res = await fetchWorker(new Request(`${TEST_BASE}/s/ABCDEF`, { method: "POST" }));
    expect(res.status).toBe(405);
  });
});
