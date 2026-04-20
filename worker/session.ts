/* SPDX-License-Identifier: Apache-2.0 */
import { verifyCookie } from "./crypto";
import { getActiveSession } from "./db";
import { SESSION_COOKIE, type Env } from "./types";

/**
 * Shared cookie / session helpers. Any route that needs to know "who is this
 * request from?" goes through `getAuthenticatedUserId` — it verifies the
 * signed cookie and checks the sessions row is still valid in one step.
 */

export async function readSessionId(req: Request, env: Env): Promise<string | null> {
  const raw = parseCookie(req.headers.get("cookie"), SESSION_COOKIE);
  if (raw === null) return null;
  return verifyCookie(env.SESSION_SECRET, raw);
}

export async function getAuthenticatedUserId(req: Request, env: Env): Promise<number | null> {
  const sessionId = await readSessionId(req, env);
  if (sessionId === null) return null;
  const session = await getActiveSession(env.DB, sessionId);
  return session?.user_id ?? null;
}

export function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    if (k === name) return part.slice(eq + 1).trim();
  }
  return null;
}
