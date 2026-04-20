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
import { readSessionId } from "../session";
import {
  MAGIC_LINK_RATE_WINDOW_MS,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  type ApiErrorCode,
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

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
}

function errorJson(code: ApiErrorCode, status: number, message?: string): Response {
  return json({ error: code, ...(message ? { message } : {}) }, { status });
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
    typeof body === "object" && body !== null && "email" in body
      ? (body as { email: unknown }).email
      : undefined;
  const normalized = normalizeEmail(emailInput);
  if (normalized === null) return errorJson("invalid_email", 400);

  // Rate-limit: one pending link per 60s.
  const pending = await getPendingMagicLinkForEmail(env.DB, normalized);
  if (pending && Date.now() - pending.created_at < MAGIC_LINK_RATE_WINDOW_MS) {
    return errorJson("rate_limited", 429);
  }

  await upsertUser(env.DB, normalized);
  const token = generateToken();
  await insertMagicLink(env.DB, token, normalized);

  const callbackUrl = new URL("/api/auth/callback", env.APP_ORIGIN);
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

  const secureFlag = url.protocol === "https:" ? "; Secure" : "";
  const cookie =
    `${SESSION_COOKIE}=${signed}; HttpOnly${secureFlag}; SameSite=Lax; ` +
    `Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`;

  return new Response(null, {
    status: 302,
    headers: {
      "Set-Cookie": cookie,
      Location: env.APP_ORIGIN + "/",
    },
  });
}

/** POST /api/auth/logout */
export async function handleLogout(req: Request, env: Env): Promise<Response> {
  const sessionId = await readSessionId(req, env);
  if (sessionId !== null) {
    await deleteSession(env.DB, sessionId);
  }
  const url = new URL(req.url);
  const secureFlag = url.protocol === "https:" ? "; Secure" : "";
  const cookie = `${SESSION_COOKIE}=; HttpOnly${secureFlag}; SameSite=Lax; Path=/; Max-Age=0`;
  return new Response(null, { status: 204, headers: { "Set-Cookie": cookie } });
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
