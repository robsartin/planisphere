/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { generateToken, signCookie, verifyCookie } from "./crypto";

const SECRET = "test-secret-at-least-32-bytes-long-please!!";

describe("generateToken", () => {
  it("produces a UUID-shaped string", () => {
    const token = generateToken();
    // RFC 4122 v4: 36 chars, 4 hyphens, hex
    expect(token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-9a-f][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("produces distinct values across calls", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
  });
});

describe("signCookie / verifyCookie", () => {
  it("round-trips a session id", async () => {
    const sid = "session-abc-123";
    const cookie = await signCookie(SECRET, sid);
    expect(cookie).toContain(sid);
    expect(cookie).toContain(".");
    const verified = await verifyCookie(SECRET, cookie);
    expect(verified).toBe(sid);
  });

  it("rejects a cookie with a tampered payload", async () => {
    const sid = "session-abc-123";
    const cookie = await signCookie(SECRET, sid);
    const dotIdx = cookie.indexOf(".");
    const tampered = "session-xyz" + cookie.slice(dotIdx);
    const verified = await verifyCookie(SECRET, tampered);
    expect(verified).toBeNull();
  });

  it("rejects a cookie with a tampered signature", async () => {
    const sid = "session-abc-123";
    const cookie = await signCookie(SECRET, sid);
    const tampered = cookie.slice(0, -4) + "AAAA";
    const verified = await verifyCookie(SECRET, tampered);
    expect(verified).toBeNull();
  });

  it("rejects a cookie with no separator", async () => {
    const verified = await verifyCookie(SECRET, "no-dot-here");
    expect(verified).toBeNull();
  });

  it("rejects a cookie signed with a different secret", async () => {
    const sid = "session-abc-123";
    const cookie = await signCookie(SECRET, sid);
    const verified = await verifyCookie("different-secret", cookie);
    expect(verified).toBeNull();
  });
});
