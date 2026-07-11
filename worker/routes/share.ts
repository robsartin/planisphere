/* SPDX-License-Identifier: Apache-2.0 */
import type { Env } from "../types";
import { getAuthenticatedUserId } from "../session";
import { logError } from "../log";

/**
 * Short-URL redirect service (#377).
 *
 * `POST /api/share  { url }` → `{ code, shortUrl }`
 *   Mints a 6-char base62 code that redirects to `url`. Anonymous callers
 *   are permitted but rate-limited to 5/min/IP; authenticated Pro / free
 *   callers get 30/min. `url` must live under the Worker's own origin so
 *   the redirect cannot be pointed at an attacker-controlled site.
 *
 * `GET /s/:code` → 302 to the stored URL (or 404). Bumps `hit_count`
 *   fire-and-forget so the redirect isn't gated on the write.
 */

const CODE_LEN = 6;
const CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const CODE_PATTERN = /^[0-9A-Za-z]{6}$/;
const MAX_URL_LEN = 4096;
const CREATE_LIMIT_ANON_PER_MIN = 5;
const CREATE_LIMIT_AUTHED_PER_MIN = 30;
const MINT_ATTEMPTS = 5;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorJson(error: string, status: number): Response {
  return json({ error }, status);
}

function mintCode(): string {
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    // Alphabet is 62 chars; modulo bias over 256 is ~4% which is fine for
    // an unauthenticated collision-resistant lookup key, not a secret.
    out += CODE_ALPHABET[bytes[i]! % 62];
  }
  return out;
}

// Simple in-memory sliding-window bucket keyed by (userId ?? ip). Workers
// isolates don't share memory, but each isolate's bucket is fine for
// slowing down a spammer; a real cross-isolate rate-limit would use
// Durable Objects and is scope-creep for this PR.
type Bucket = { readonly windowStartMs: number; count: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;

function checkRateLimit(key: string, limit: number, nowMs: number): boolean {
  const b = buckets.get(key);
  if (b === undefined || nowMs - b.windowStartMs >= WINDOW_MS) {
    buckets.set(key, { windowStartMs: nowMs, count: 1 });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

function clientIp(req: Request): string {
  // Cloudflare sets CF-Connecting-IP; fall back to a shared bucket key
  // rather than throwing, so tests without the header still exercise the
  // rate-limiter deterministically.
  return req.headers.get("CF-Connecting-IP") ?? "unknown";
}

function isSameOrigin(candidate: string, requestOrigin: string): boolean {
  try {
    const parsed = new URL(candidate);
    return parsed.origin === requestOrigin;
  } catch {
    return false;
  }
}

export async function handleCreateShareLink(req: Request, env: Env): Promise<Response> {
  const nowMs = Date.now();
  const userId = await getAuthenticatedUserId(req, env);
  const rateKey = userId !== null ? `u:${String(userId)}` : `ip:${clientIp(req)}`;
  const limit = userId !== null ? CREATE_LIMIT_AUTHED_PER_MIN : CREATE_LIMIT_ANON_PER_MIN;
  if (!checkRateLimit(rateKey, limit, nowMs)) {
    return errorJson("rate_limited", 429);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return errorJson("bad_request", 400);
  }
  if (payload === null || typeof payload !== "object") return errorJson("bad_request", 400);
  const url = (payload as { url?: unknown }).url;
  if (typeof url !== "string" || url.length === 0 || url.length > MAX_URL_LEN) {
    return errorJson("bad_request", 400);
  }

  const reqOrigin = new URL(req.url).origin;
  if (!isSameOrigin(url, reqOrigin)) {
    // Open-redirect defense — the code must not point at an
    // attacker-controlled site. This is the whole reason we validate.
    return errorJson("bad_request", 400);
  }

  // Try a few codes to sidestep the astronomically-unlikely collision.
  // 62^6 = ~57 billion; even at millions of links per code-length the
  // collision rate stays under a percent per mint attempt.
  for (let attempt = 0; attempt < MINT_ATTEMPTS; attempt++) {
    const code = mintCode();
    try {
      await env.DB.prepare(
        "INSERT INTO share_links (code, target_url, created_at, created_by) VALUES (?, ?, ?, ?)",
      )
        .bind(code, url, nowMs, userId)
        .run();
      const shortUrl = `${reqOrigin}/s/${code}`;
      return json({ code, shortUrl }, 201);
    } catch (err) {
      // Assume UNIQUE-constraint collision on `code`. Retry with a fresh
      // one — any other DB failure will fall out after the loop.
      if (attempt === MINT_ATTEMPTS - 1) {
        logError("share.mint_exhausted", err, { attempts: MINT_ATTEMPTS });
        return errorJson("mint_failed", 500);
      }
    }
  }
  // Unreachable — the loop returns or throws.
  return errorJson("mint_failed", 500);
}

export async function handleShareRedirect(req: Request, env: Env, code: string): Promise<Response> {
  if (!CODE_PATTERN.test(code)) return new Response("not found", { status: 404 });
  const row = await env.DB.prepare("SELECT target_url FROM share_links WHERE code = ?")
    .bind(code)
    .first<{ target_url: string }>();
  if (row === null) return new Response("not found", { status: 404 });

  // Bump hit_count fire-and-forget — the redirect must not wait on the write.
  // Any error is swallowed; the hit-count is telemetry, not a correctness lever.
  void env.DB.prepare("UPDATE share_links SET hit_count = hit_count + 1 WHERE code = ?")
    .bind(code)
    .run()
    .catch(() => {
      // No-op — the redirect already went out.
    });

  return Response.redirect(row.target_url, 302);
}

/**
 * Test-only: reset the in-memory rate-limit buckets. Never called from
 * production paths — only from tests that need a clean slate between cases.
 */
export function _resetRateLimiterForTests(): void {
  buckets.clear();
}
