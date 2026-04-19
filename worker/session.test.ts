/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  buildClearSessionCookie,
  buildSessionCookie,
  generateSessionId,
  parseCookieHeader,
  readSessionCookie,
} from "./session";

describe("generateSessionId", () => {
  it("returns a 43-char base64url string (32 random bytes, no padding)", () => {
    const id = generateSessionId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("produces distinct values on repeat calls (randomness is actually used)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) seen.add(generateSessionId());
    expect(seen.size).toBe(10);
  });
});

describe("parseCookieHeader", () => {
  it("returns an empty map for a null header", () => {
    expect(parseCookieHeader(null).size).toBe(0);
  });

  it("returns an empty map for an empty string", () => {
    expect(parseCookieHeader("").size).toBe(0);
  });

  it("parses a single cookie", () => {
    const m = parseCookieHeader("foo=bar");
    expect(m.get("foo")).toBe("bar");
  });

  it("parses multiple cookies separated by semicolons", () => {
    const m = parseCookieHeader("foo=1; bar=2; baz=3");
    expect(m.get("foo")).toBe("1");
    expect(m.get("bar")).toBe("2");
    expect(m.get("baz")).toBe("3");
    expect(m.size).toBe(3);
  });

  it("trims whitespace around keys and values", () => {
    const m = parseCookieHeader("  foo  =  bar  ;  baz=qux  ");
    expect(m.get("foo")).toBe("bar");
    expect(m.get("baz")).toBe("qux");
  });

  it("URL-decodes cookie values (RFC 6265 interop)", () => {
    const m = parseCookieHeader("greeting=hello%20world");
    expect(m.get("greeting")).toBe("hello world");
  });

  it("leaves values alone when they are not well-formed percent-encoded", () => {
    const m = parseCookieHeader("bad=%E0%A4");
    expect(m.get("bad")).toBe("%E0%A4");
  });

  it("ignores malformed entries that have no '='", () => {
    const m = parseCookieHeader("malformed; foo=bar");
    expect(m.get("foo")).toBe("bar");
    expect(m.size).toBe(1);
  });

  it("ignores entries whose key is empty after trimming", () => {
    const m = parseCookieHeader("=orphan; foo=bar");
    expect(m.get("foo")).toBe("bar");
    expect(m.size).toBe(1);
  });

  it("uses the last value when the same name appears twice", () => {
    const m = parseCookieHeader("foo=1; foo=2");
    expect(m.get("foo")).toBe("2");
  });
});

describe("readSessionCookie", () => {
  it("returns null when the header is null", () => {
    expect(readSessionCookie(null)).toBeNull();
  });

  it("returns null when the session cookie is absent", () => {
    expect(readSessionCookie("other=1; nope=2")).toBeNull();
  });

  it("returns the session value when present among other cookies", () => {
    const header = `other=1; ${SESSION_COOKIE_NAME}=abc123; nope=2`;
    expect(readSessionCookie(header)).toBe("abc123");
  });
});

describe("buildSessionCookie", () => {
  it("emits a Set-Cookie value with the ADR-10 attributes", () => {
    const s = buildSessionCookie("abc", { maxAgeSeconds: 60 });
    expect(s).toMatch(new RegExp(`^${SESSION_COOKIE_NAME}=abc;`));
    expect(s).toContain("HttpOnly");
    expect(s).toContain("Secure");
    expect(s).toContain("SameSite=Lax");
    expect(s).toContain("Path=/");
    expect(s).toContain("Max-Age=60");
  });

  it("floors fractional Max-Age values and clamps negatives to zero", () => {
    expect(buildSessionCookie("x", { maxAgeSeconds: 3.9 })).toContain("Max-Age=3");
    expect(buildSessionCookie("x", { maxAgeSeconds: -5 })).toContain("Max-Age=0");
  });

  it("URL-encodes special characters in the session id", () => {
    const s = buildSessionCookie("a b", { maxAgeSeconds: 60 });
    expect(s.startsWith(`${SESSION_COOKIE_NAME}=a%20b;`)).toBe(true);
  });

  it("round-trips through parseCookieHeader / readSessionCookie", () => {
    const id = generateSessionId();
    const setCookie = buildSessionCookie(id, { maxAgeSeconds: SESSION_MAX_AGE_SECONDS });
    // A browser sends back only `name=value` on subsequent requests (attrs
    // aren't echoed), so emulate that by slicing at the first `;`.
    const cookieHeader = setCookie.split(";")[0] ?? "";
    expect(readSessionCookie(cookieHeader)).toBe(id);
  });
});

describe("buildClearSessionCookie", () => {
  it("emits a Set-Cookie that expires the session cookie immediately", () => {
    const s = buildClearSessionCookie();
    expect(s).toMatch(new RegExp(`^${SESSION_COOKIE_NAME}=;`));
    expect(s).toContain("Max-Age=0");
    expect(s).toContain("HttpOnly");
    expect(s).toContain("Secure");
    expect(s).toContain("SameSite=Lax");
    expect(s).toContain("Path=/");
  });
});

describe("SESSION_MAX_AGE_SECONDS", () => {
  it("is 30 days per ADR 010", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(30 * 24 * 60 * 60);
  });
});
