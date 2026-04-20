/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentUser, logout, requestMagicLink, type AuthUser } from "./auth";

describe("requestMagicLink", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok when the API accepts the request (202)", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 202 }));
    const result = await requestMagicLink("alice@example.com");
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/request-link",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ email: "alice@example.com" }),
      }),
    );
  });

  it("returns err invalid_email on 400", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "invalid_email" }), { status: 400 }),
    );
    const result = await requestMagicLink("nope");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("invalid_email");
  });

  it("returns err rate_limited on 429", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 }),
    );
    const result = await requestMagicLink("spam@example.com");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("rate_limited");
  });

  it("returns err network when fetch itself rejects", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const result = await requestMagicLink("x@y.z");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("network");
  });

  it("returns err server on a 500", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    const result = await requestMagicLink("x@y.z");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("server");
  });
});

describe("currentUser", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null on 401", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const user = await currentUser();
    expect(user).toBeNull();
  });

  it("returns the user on 200", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ email: "alice@example.com", tier: "free" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const user = await currentUser();
    const expected: AuthUser = { email: "alice@example.com", tier: "free" };
    expect(user).toEqual(expected);
  });

  it("returns null on a network error", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const user = await currentUser();
    expect(user).toBeNull();
  });

  it("returns null on malformed JSON", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const user = await currentUser();
    expect(user).toBeNull();
  });

  it("returns null when tier is unknown", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ email: "a@b.c", tier: "unknown" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const user = await currentUser();
    expect(user).toBeNull();
  });
});

describe("logout", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs /api/auth/logout with credentials included", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await logout();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("swallows network errors", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(logout()).resolves.toBeUndefined();
  });
});
