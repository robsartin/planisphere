/* SPDX-License-Identifier: Apache-2.0 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../index";
import { testEnv, resetDb, extractSessionCookie } from "../test-helpers";
import type { EmailSender } from "../email";

/**
 * End-to-end auth-route tests. Runs inside a real workerd isolate via
 * `@cloudflare/vitest-pool-workers` with an in-memory D1 binding.
 */

async function fetchWorker(req: Request): Promise<Response> {
  if (!worker.fetch) throw new Error("worker has no fetch handler");
  return worker.fetch(req, testEnv, {} as unknown as ExecutionContext);
}

const BASE = "http://localhost";

beforeEach(async () => {
  await resetDb();
});

describe("POST /api/auth/request-link", () => {
  it("accepts a valid email and returns 202", async () => {
    const res = await fetchWorker(
      new Request(`${BASE}/api/auth/request-link`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "alice@example.com" }),
      }),
    );
    expect(res.status).toBe(202);
  });

  it("persists a users row for the email on first request", async () => {
    await fetchWorker(
      new Request(`${BASE}/api/auth/request-link`, {
        method: "POST",
        body: JSON.stringify({ email: "Bob@Example.COM" }),
      }),
    );
    const row = await testEnv.DB.prepare("SELECT email FROM users WHERE email = ?")
      .bind("bob@example.com")
      .first<{ email: string }>();
    expect(row?.email).toBe("bob@example.com");
  });

  it("returns 400 for a malformed email", async () => {
    const res = await fetchWorker(
      new Request(`${BASE}/api/auth/request-link`, {
        method: "POST",
        body: JSON.stringify({ email: "not-an-email" }),
      }),
    );
    expect(res.status).toBe(400);
    const body: { error: string } = await res.json();
    expect(body.error).toBe("invalid_email");
  });

  it("returns 400 when the body is not JSON", async () => {
    const res = await fetchWorker(
      new Request(`${BASE}/api/auth/request-link`, {
        method: "POST",
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 429 when a second link is requested within 60s", async () => {
    await fetchWorker(
      new Request(`${BASE}/api/auth/request-link`, {
        method: "POST",
        body: JSON.stringify({ email: "spam@example.com" }),
      }),
    );
    const res = await fetchWorker(
      new Request(`${BASE}/api/auth/request-link`, {
        method: "POST",
        body: JSON.stringify({ email: "spam@example.com" }),
      }),
    );
    expect(res.status).toBe(429);
    const body: { error: string } = await res.json();
    expect(body.error).toBe("rate_limited");
  });

  it("returns 405 for non-POST", async () => {
    const res = await fetchWorker(new Request(`${BASE}/api/auth/request-link`));
    expect(res.status).toBe(405);
  });
});

describe("GET /api/auth/callback", () => {
  it("consumes the token, sets a cookie, and redirects to APP_ORIGIN", async () => {
    // Request a link, read the token straight out of D1.
    await fetchWorker(
      new Request(`${BASE}/api/auth/request-link`, {
        method: "POST",
        body: JSON.stringify({ email: "claire@example.com" }),
      }),
    );
    const pending = await testEnv.DB.prepare(
      "SELECT token FROM magic_links WHERE email = ? ORDER BY created_at DESC LIMIT 1",
    )
      .bind("claire@example.com")
      .first<{ token: string }>();
    expect(pending?.token).toBeTruthy();

    const res = await fetchWorker(new Request(`${BASE}/api/auth/callback?token=${pending!.token}`));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("http://localhost:5173");
    const cookie = extractSessionCookie(res);
    expect(cookie).toBeTruthy();
    expect(cookie).toContain(".");

    // Session row exists in D1.
    const session = await testEnv.DB.prepare("SELECT COUNT(*) as n FROM sessions").first<{
      n: number;
    }>();
    expect(session?.n).toBe(1);

    // Second use of the same token should fail — one-shot.
    const res2 = await fetchWorker(
      new Request(`${BASE}/api/auth/callback?token=${pending!.token}`),
    );
    expect(res2.status).toBe(401);
  });

  it("returns 400 when token is missing", async () => {
    const res = await fetchWorker(new Request(`${BASE}/api/auth/callback`));
    expect(res.status).toBe(400);
  });

  it("returns 401 for an unknown token", async () => {
    const res = await fetchWorker(new Request(`${BASE}/api/auth/callback?token=does-not-exist`));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  async function login(email: string): Promise<string> {
    await fetchWorker(
      new Request(`${BASE}/api/auth/request-link`, {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    );
    const pending = await testEnv.DB.prepare(
      "SELECT token FROM magic_links WHERE email = ? ORDER BY created_at DESC LIMIT 1",
    )
      .bind(email)
      .first<{ token: string }>();
    const res = await fetchWorker(new Request(`${BASE}/api/auth/callback?token=${pending!.token}`));
    const cookie = extractSessionCookie(res);
    return cookie!;
  }

  it("returns 401 without a cookie", async () => {
    const res = await fetchWorker(new Request(`${BASE}/api/auth/me`));
    expect(res.status).toBe(401);
  });

  it("returns 401 with a malformed cookie", async () => {
    const res = await fetchWorker(
      new Request(`${BASE}/api/auth/me`, {
        headers: { cookie: "ps_session=bogus" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns {email, tier} with a valid session cookie", async () => {
    const cookie = await login("dave@example.com");
    const res = await fetchWorker(
      new Request(`${BASE}/api/auth/me`, {
        headers: { cookie: `ps_session=${cookie}` },
      }),
    );
    expect(res.status).toBe(200);
    const body: { email: string; tier: string } = await res.json();
    expect(body.email).toBe("dave@example.com");
    expect(body.tier).toBe("free");
  });

  it("returns 401 after logout", async () => {
    const cookie = await login("evan@example.com");
    const logoutRes = await fetchWorker(
      new Request(`${BASE}/api/auth/logout`, {
        method: "POST",
        headers: { cookie: `ps_session=${cookie}` },
      }),
    );
    expect(logoutRes.status).toBe(204);

    const meRes = await fetchWorker(
      new Request(`${BASE}/api/auth/me`, {
        headers: { cookie: `ps_session=${cookie}` },
      }),
    );
    expect(meRes.status).toBe(401);
  });
});

describe("routing", () => {
  it("returns 404 for unknown paths", async () => {
    const res = await fetchWorker(new Request(`${BASE}/api/auth/unknown`));
    expect(res.status).toBe(404);
  });

  it("returns 405 for wrong method on /me", async () => {
    const res = await fetchWorker(new Request(`${BASE}/api/auth/me`, { method: "POST" }));
    expect(res.status).toBe(405);
  });
});

describe("email stub", () => {
  it("logs the magic link URL on request", async () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await fetchWorker(
      new Request(`${BASE}/api/auth/request-link`, {
        method: "POST",
        body: JSON.stringify({ email: "logme@example.com" }),
      }),
    );
    const logged = logSpy.mock.calls.some(
      (c) => typeof c[0] === "string" && c[0].includes("[auth] magic link for logme@example.com"),
    );
    expect(logged).toBe(true);
    logSpy.mockRestore();
    // Silence the unused-param lint on _ in EmailSender (indirect check).
    const _shape: EmailSender = { sendMagicLink: async () => {} };
    void _shape;
  });
});
