/* SPDX-License-Identifier: Apache-2.0 */

/**
 * Session cookie + session-id helpers for the Workers auth layer.
 *
 * Pure, side-effect-free utilities against Web-standard APIs
 * (`crypto.getRandomValues`, `btoa`, `encodeURIComponent`). No Cloudflare
 * runtime types, no D1, no `fetch`. Callable from the Worker and testable
 * under plain vitest. See ADR 010 for the session model.
 */

export const SESSION_COOKIE_NAME = "planisphere_session";

/** 30 days. Rolling: refreshed on each authenticated request (ADR 010). */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** 32 bytes of randomness, base64url-encoded (43 chars, no padding). */
export function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/**
 * Parse the HTTP `Cookie:` request header into a key→value map. Duplicate
 * names resolve to the last occurrence (the simple, predictable rule —
 * matches how `document.cookie` is usually consumed). Malformed segments
 * without `=` or with an empty key are skipped. Values are
 * percent-decoded; malformed sequences pass through untouched.
 */
export function parseCookieHeader(header: string | null): Map<string, string> {
  const out = new Map<string, string>();
  if (header === null || header.length === 0) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (key.length === 0) continue;
    const rawVal = part.slice(idx + 1).trim();
    let val = rawVal;
    try {
      val = decodeURIComponent(rawVal);
    } catch {
      // Leave raw if the value isn't well-formed percent-encoded.
    }
    out.set(key, val);
  }
  return out;
}

/** Return the session token from a Cookie header, or null if not present. */
export function readSessionCookie(header: string | null): string | null {
  const cookies = parseCookieHeader(header);
  return cookies.get(SESSION_COOKIE_NAME) ?? null;
}

/**
 * Build a `Set-Cookie` value that establishes a session cookie with the
 * security attributes mandated by ADR 010: HttpOnly, Secure, SameSite=Lax,
 * Path=/, and an explicit Max-Age (clamped to a non-negative integer).
 */
export function buildSessionCookie(id: string, opts: { maxAgeSeconds: number }): string {
  const maxAge = Math.max(0, Math.floor(opts.maxAgeSeconds));
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(id)}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

/** Build a `Set-Cookie` value that clears the session cookie immediately. */
export function buildClearSessionCookie(): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Max-Age=0",
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}
