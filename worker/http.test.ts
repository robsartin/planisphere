/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import {
  badRequest,
  clearSessionCookie,
  errorJson,
  isHttpsRequest,
  json,
  methodNotAllowed,
  notFound,
  sessionCookie,
} from "./http";

describe("json", () => {
  it("sets content-type: application/json", async () => {
    const res = json({ hello: "world" });
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(await res.json()).toEqual({ hello: "world" });
  });

  it("passes through init (status, headers)", () => {
    const res = json({ x: 1 }, { status: 418, headers: { "x-extra": "y" } });
    expect(res.status).toBe(418);
    expect(res.headers.get("x-extra")).toBe("y");
    expect(res.headers.get("content-type")).toBe("application/json");
  });
});

describe("errorJson", () => {
  it("returns the wire error shape { error } with no message", async () => {
    const res = errorJson("not_found", 404);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("includes `message` when supplied", async () => {
    const res = errorJson("server_error", 500, "db offline");
    expect(await res.json()).toEqual({ error: "server_error", message: "db offline" });
  });

  it("omits the message key when called without a message", async () => {
    const body: Record<string, unknown> = await errorJson("not_found", 404).json();
    expect(Object.keys(body)).toEqual(["error"]);
  });
});

describe("standard error shortcuts", () => {
  it("methodNotAllowed → 405 { error: 'method_not_allowed' }", async () => {
    const res = methodNotAllowed();
    expect(res.status).toBe(405);
    expect(await res.json()).toEqual({ error: "method_not_allowed" });
  });

  it("notFound → 404 { error: 'not_found' }", async () => {
    const res = notFound();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("badRequest → 400 { error: 'invalid_payload' }", async () => {
    const res = badRequest();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_payload" });
  });
});

describe("sessionCookie", () => {
  it("builds a signed cookie with HttpOnly + SameSite=Lax + Path=/", () => {
    const cookie = sessionCookie({ value: "abc.sig", maxAgeSec: 3600, secure: false });
    expect(cookie).toContain("ps_session=abc.sig");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=3600");
    expect(cookie).not.toContain("Secure");
  });

  it("adds `Secure` when secure=true", () => {
    const cookie = sessionCookie({ value: "abc.sig", maxAgeSec: 3600, secure: true });
    expect(cookie).toContain("Secure");
  });
});

describe("clearSessionCookie", () => {
  it("empties the value and sets Max-Age=0", () => {
    const cookie = clearSessionCookie({ secure: false });
    expect(cookie).toContain("ps_session=;");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).not.toContain("Secure");
  });

  it("adds `Secure` when secure=true", () => {
    const cookie = clearSessionCookie({ secure: true });
    expect(cookie).toContain("Secure");
  });
});

describe("isHttpsRequest", () => {
  it("true for https URLs", () => {
    expect(isHttpsRequest(new URL("https://example.com/x"))).toBe(true);
  });

  it("false for http URLs", () => {
    expect(isHttpsRequest(new URL("http://example.com/x"))).toBe(false);
  });
});
