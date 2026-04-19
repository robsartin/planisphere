/* SPDX-License-Identifier: Apache-2.0 */
/**
 * Small crypto helpers for magic-link tokens + HMAC-signed session cookies.
 *
 * Uses the Workers runtime `crypto` / `crypto.subtle` globals directly — no
 * Node-only APIs, no third-party deps. Runs inside workerd in production and
 * inside `@cloudflare/vitest-pool-workers` during tests.
 */

/** Opaque single-use login token. `crypto.randomUUID()` is 122 bits of
 *  entropy — plenty for a short-lived one-use credential. */
export function generateToken(): string {
  return crypto.randomUUID();
}

/**
 * Sign a session id with HMAC-SHA256 so the client can carry it in a cookie
 * without being able to forge it.
 *
 * Returns `"<sessionId>.<base64url(signature)>"`. The session id is not
 * secret — the signature is what makes the pair unforgeable. Verification
 * uses constant-time byte comparison.
 */
export async function signCookie(secret: string, sessionId: string): Promise<string> {
  const sig = await hmac(secret, sessionId);
  return `${sessionId}.${b64urlEncode(sig)}`;
}

/**
 * Verify a signed cookie and return the session id, or `null` if the cookie
 * is malformed / tampered / signed with a different secret.
 */
export async function verifyCookie(secret: string, cookie: string): Promise<string | null> {
  const dot = cookie.lastIndexOf(".");
  if (dot < 1 || dot === cookie.length - 1) return null;
  const sessionId = cookie.slice(0, dot);
  const providedSig = b64urlDecode(cookie.slice(dot + 1));
  if (providedSig === null) return null;
  const expectedSig = await hmac(secret, sessionId);
  if (!timingSafeEqual(providedSig, expectedSig)) return null;
  return sessionId;
}

async function hmac(secret: string, message: string): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, enc.encode(message));
}

function timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < av.length; i++) {
    // Non-null assertions are safe: i < length.
    diff |= av[i]! ^ bv[i]!;
  }
  return diff === 0;
}

function b64urlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): ArrayBuffer | null {
  try {
    const padded = s.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const bin = atob(padded + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  } catch {
    return null;
  }
}
