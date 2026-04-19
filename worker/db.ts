/* SPDX-License-Identifier: Apache-2.0 */
import type { MagicLinkRow, SessionRow, UserRow, UserTier } from "./types";

/**
 * Hand-rolled D1 helpers. No ORM. Every statement is prepared with bound
 * parameters — never string concatenation.
 *
 * All reads return `null` (or `[]`) rather than throwing when a row is
 * missing. Route handlers interpret that as a domain condition (e.g.
 * `invalid_token`) and respond with the right HTTP status.
 */

const NOW = (): number => Date.now();

export async function getUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  const row = await db
    .prepare("SELECT id, email, tier, created_at FROM users WHERE email = ? LIMIT 1")
    .bind(email)
    .first<UserRow>();
  return row ?? null;
}

export async function getUserById(db: D1Database, id: number): Promise<UserRow | null> {
  const row = await db
    .prepare("SELECT id, email, tier, created_at FROM users WHERE id = ? LIMIT 1")
    .bind(id)
    .first<UserRow>();
  return row ?? null;
}

/**
 * Ensure a user exists for the given email, returning the row. Idempotent —
 * repeated calls for the same email return the same `id`.
 */
export async function upsertUser(
  db: D1Database,
  email: string,
  tier: UserTier = "free",
): Promise<UserRow> {
  const existing = await getUserByEmail(db, email);
  if (existing) return existing;
  const createdAt = NOW();
  const result = await db
    .prepare("INSERT INTO users (email, tier, created_at) VALUES (?, ?, ?)")
    .bind(email, tier, createdAt)
    .run();
  const id = Number(result.meta.last_row_id);
  return { id, email, tier, created_at: createdAt };
}

/**
 * Return the newest pending (unused) magic link for an email, or `null` if
 * none. Used for the 60-second rate-limit check.
 */
export async function getPendingMagicLinkForEmail(
  db: D1Database,
  email: string,
): Promise<MagicLinkRow | null> {
  const row = await db
    .prepare(
      "SELECT token, email, created_at, used_at FROM magic_links " +
        "WHERE email = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1",
    )
    .bind(email)
    .first<MagicLinkRow>();
  return row ?? null;
}

export async function insertMagicLink(
  db: D1Database,
  token: string,
  email: string,
): Promise<MagicLinkRow> {
  const createdAt = NOW();
  await db
    .prepare("INSERT INTO magic_links (token, email, created_at, used_at) VALUES (?, ?, ?, NULL)")
    .bind(token, email, createdAt)
    .run();
  return { token, email, created_at: createdAt, used_at: null };
}

/**
 * Consume a magic-link token atomically: return the unused row and mark it
 * used in the same step. Returns `null` if the token is unknown or already
 * used.
 */
export async function consumeMagicLink(
  db: D1Database,
  token: string,
): Promise<MagicLinkRow | null> {
  const now = NOW();
  // UPDATE ... WHERE used_at IS NULL RETURNING * is the atomic "claim" step.
  const row = await db
    .prepare(
      "UPDATE magic_links SET used_at = ? WHERE token = ? AND used_at IS NULL " +
        "RETURNING token, email, created_at, used_at",
    )
    .bind(now, token)
    .first<MagicLinkRow>();
  return row ?? null;
}

export async function insertSession(
  db: D1Database,
  sessionId: string,
  userId: number,
  expiresAt: number,
): Promise<SessionRow> {
  const createdAt = NOW();
  await db
    .prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(sessionId, userId, createdAt, expiresAt)
    .run();
  return { id: sessionId, user_id: userId, created_at: createdAt, expires_at: expiresAt };
}

/** Return the session row if present and not yet expired, else `null`. */
export async function getActiveSession(
  db: D1Database,
  sessionId: string,
): Promise<SessionRow | null> {
  const row = await db
    .prepare("SELECT id, user_id, created_at, expires_at FROM sessions WHERE id = ? LIMIT 1")
    .bind(sessionId)
    .first<SessionRow>();
  if (!row) return null;
  if (row.expires_at <= NOW()) return null;
  return row;
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}
