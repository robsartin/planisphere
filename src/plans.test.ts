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
      expect(res.value[0]!.slug).toBe("2026-04");
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
