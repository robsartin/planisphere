/* SPDX-License-Identifier: Apache-2.0 */
import { generateToken, signCookie } from "../crypto";
import {
  consumeMagicLink,
  deleteSession,
  getActiveSession,
  getPendingMagicLinkForEmail,
  getUserById,
  insertMagicLink,
  insertSession,
  upsertUser,
} from "../db";
import type { EmailSender } from "../email";
import { clearSessionCookie, errorJson, isHttpsRequest, json, sessionCookie } from "../http";
import { readSessionId } from "../session";
import {
  MAGIC_LINK_RATE_WINDOW_MS,
  MAGIC_LINK_TTL_SECONDS,
  SESSION_MAX_AGE_SECONDS,
  type Env,
} from "../types";

/**
 * Routes for `/api/auth/*`. Each handler returns a plain `Response`; the
 * error shape on the wire is `{error: ApiErrorCode, message?: string}`.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(trimmed)) return null;
  return trimmed;
}

/** POST /api/auth/request-link */
export async function handleRequestLink(
  req: Request,
  env: Env,
  email: EmailSender,
): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorJson("invalid_email", 400);
  }
  const emailInput =
    typeof body === "object" && body !== null && "email" in body ? body.email : undefined;
  const normalized = normalizeEmail(emailInput);
  if (normalized === null) return errorJson("invalid_email", 400);

  // Rate-limit: one pending link per 60s.
  const pending = await getPendingMagicLinkForEmail(env.DB, normalized);
  if (pending && Date.now() - pending.created_at < MAGIC_LINK_RATE_WINDOW_MS) {
    return errorJson("rate_limited", 429);
  }

  await upsertUser(env.DB, normalized);
  const token = generateToken();
  const expiresAt = Date.now() + MAGIC_LINK_TTL_SECONDS * 1000;
  await insertMagicLink(env.DB, token, normalized, expiresAt);

  // Build the callback URL against the request's own origin, not a fixed
  // env var. The Worker is same-origin with the SPA (ADR 009), so the
  // request URL's origin is exactly where the user should land back —
  // works correctly for `localhost`, preview URLs, and production
  // without any per-environment config.
  const callbackUrl = new URL("/api/auth/callback", new URL(req.url).origin);
  callbackUrl.searchParams.set("token", token);
  await email.sendMagicLink(normalized, callbackUrl.toString());

  return new Response(null, { status: 202 });
}

/** GET /api/auth/callback?token=... */
export async function handleCallback(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return errorJson("invalid_token", 400);

  const consumed = await consumeMagicLink(env.DB, token);
  if (!consumed) return errorJson("invalid_token", 401);

  const user = await upsertUser(env.DB, consumed.email);
  const sessionId = generateToken();
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  await insertSession(env.DB, sessionId, user.id, expiresAt);
  const signed = await signCookie(env.SESSION_SECRET, sessionId);

  return new Response(null, {
    status: 302,
    headers: {
      "Set-Cookie": sessionCookie({
        value: signed,
        maxAgeSec: SESSION_MAX_AGE_SECONDS,
        secure: isHttpsRequest(url),
      }),
      Location: url.origin + "/",
    },
  });
}

/** POST /api/auth/logout */
export async function handleLogout(req: Request, env: Env): Promise<Response> {
  const sessionId = await readSessionId(req, env);
  if (sessionId !== null) {
    await deleteSession(env.DB, sessionId);
  }
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": clearSessionCookie({ secure: isHttpsRequest(new URL(req.url)) }) },
  });
}

/** GET /api/auth/me */
export async function handleMe(req: Request, env: Env): Promise<Response> {
  const sessionId = await readSessionId(req, env);
  if (sessionId === null) return errorJson("unauthenticated", 401);
  const session = await getActiveSession(env.DB, sessionId);
  if (!session) return errorJson("unauthenticated", 401);
  const user = await getUserById(env.DB, session.user_id);
  if (!user) return errorJson("unauthenticated", 401);
  return json({ email: user.email, tier: user.tier });
}
