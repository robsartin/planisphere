/* SPDX-License-Identifier: Apache-2.0 */
import type {
  MagicLinkRow,
  NotebookRow,
  NotebookSummaryRow,
  SessionRow,
  UserRow,
  UserTier,
} from "./types";

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
      "SELECT token, email, created_at, used_at, expires_at FROM magic_links " +
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
  expiresAt: number,
): Promise<MagicLinkRow> {
  const createdAt = NOW();
  await db
    .prepare(
      "INSERT INTO magic_links (token, email, created_at, used_at, expires_at) " +
        "VALUES (?, ?, ?, NULL, ?)",
    )
    .bind(token, email, createdAt, expiresAt)
    .run();
  return { token, email, created_at: createdAt, used_at: null, expires_at: expiresAt };
}

/**
 * Consume a magic-link token atomically: return the unused row and mark it
 * used in the same step. Returns `null` if the token is unknown, already
 * used, or past its `expires_at`.
 */
export async function consumeMagicLink(
  db: D1Database,
  token: string,
): Promise<MagicLinkRow | null> {
  const now = NOW();
  const row = await db
    .prepare(
      "UPDATE magic_links SET used_at = ? " +
        "WHERE token = ? AND used_at IS NULL AND expires_at > ? " +
        "RETURNING token, email, created_at, used_at, expires_at",
    )
    .bind(now, token, now)
    .first<MagicLinkRow>();
  return row ?? null;
}

/**
 * Background sweep: drop magic_links rows that are either past their TTL
 * or have already been used. Called by the scheduled handler on the cron
 * trigger declared in wrangler.jsonc. Returns the row count for log /
 * test assertions.
 */
export async function deleteExpiredMagicLinks(db: D1Database): Promise<number> {
  const now = NOW();
  const result = await db
    .prepare("DELETE FROM magic_links WHERE expires_at <= ? OR used_at IS NOT NULL")
    .bind(now)
    .run();
  return Number(result.meta.changes ?? 0);
}

/**
 * Background sweep: drop sessions whose `expires_at` has passed. The read
 * path in `getActiveSession` already rejects them, so the rows linger
 * harmlessly between sweeps; this just keeps the table from growing
 * forever.
 */
export async function deleteExpiredSessions(db: D1Database): Promise<number> {
  const now = NOW();
  const result = await db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now).run();
  return Number(result.meta.changes ?? 0);
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

/**
 * Insert a notebook for `userId` and return the full row. `created_at` and
 * `updated_at` start equal.
 */
export async function insertNotebook(
  db: D1Database,
  userId: number,
  title: string,
  contentJson: string,
): Promise<NotebookRow> {
  const now = NOW();
  const result = await db
    .prepare(
      "INSERT INTO notebooks (user_id, title, content_json, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?)",
    )
    .bind(userId, title, contentJson, now, now)
    .run();
  const id = Number(result.meta.last_row_id);
  return {
    id,
    user_id: userId,
    title,
    content_json: contentJson,
    created_at: now,
    updated_at: now,
  };
}

/** Return a notebook iff `userId` owns it, else `null`. */
export async function getNotebookById(
  db: D1Database,
  id: number,
  userId: number,
): Promise<NotebookRow | null> {
  const row = await db
    .prepare(
      "SELECT id, user_id, title, content_json, created_at, updated_at " +
        "FROM notebooks WHERE id = ? AND user_id = ? LIMIT 1",
    )
    .bind(id, userId)
    .first<NotebookRow>();
  return row ?? null;
}

/** List summaries for a user, newest-updated first. Excludes `content_json`. */
export async function listNotebooksForUser(
  db: D1Database,
  userId: number,
): Promise<NotebookSummaryRow[]> {
  const { results } = await db
    .prepare(
      "SELECT id, title, created_at, updated_at FROM notebooks " +
        "WHERE user_id = ? ORDER BY updated_at DESC",
    )
    .bind(userId)
    .all<NotebookSummaryRow>();
  return results;
}

/**
 * Replace title + content for a notebook the user owns. Returns the updated
 * row, or `null` if the id does not exist or belongs to someone else.
 */
export async function updateNotebook(
  db: D1Database,
  id: number,
  userId: number,
  title: string,
  contentJson: string,
): Promise<NotebookRow | null> {
  const now = NOW();
  const result = await db
    .prepare(
      "UPDATE notebooks SET title = ?, content_json = ?, updated_at = ? " +
        "WHERE id = ? AND user_id = ?",
    )
    .bind(title, contentJson, now, id, userId)
    .run();
  if (!result.meta.changes) return null;
  return getNotebookById(db, id, userId);
}

/** Returns `true` if a row was deleted, `false` if the id is unknown or
 *  belongs to someone else (the request must 404 either way). */
export async function deleteNotebook(db: D1Database, id: number, userId: number): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM notebooks WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  return Boolean(result.meta.changes);
}

/**
 * Return the tier for `userId`, defaulting to `'free'` when the user does
 * not exist. Never throws: the `users.tier` column is load-bearing for the
 * Pro-gate on `/api/plans`, so any unknown/malformed value fails closed to
 * `'free'`.
 */
export async function getUserTier(db: D1Database, userId: number): Promise<UserTier> {
  const row = await db
    .prepare("SELECT tier FROM users WHERE id = ?")
    .bind(userId)
    .first<{ tier: string }>();
  if (row === null) return "free";
  return row.tier === "pro" ? "pro" : "free";
}

export type PlanRow = {
  readonly slug: string;
  readonly title: string;
  readonly month: string;
  readonly hemisphere: "n" | "s" | "both";
  readonly summary: string;
  readonly bodyMd: string;
  readonly objectsJson: string;
  readonly author: string;
  readonly publishedAtMs: number;
};

export type PlanSummaryRow = Omit<PlanRow, "bodyMd" | "objectsJson">;

type RawPlanRow = {
  slug: string;
  title: string;
  month: string;
  hemisphere: string;
  summary: string;
  body_md?: string;
  objects_json?: string;
  author: string;
  published_at: number;
};

function coerceHemisphere(h: string): "n" | "s" | "both" {
  return h === "n" || h === "s" ? h : "both";
}

export async function listPlanSummaries(db: D1Database): Promise<readonly PlanSummaryRow[]> {
  const result = await db
    .prepare(
      "SELECT slug, title, month, hemisphere, summary, author, published_at " +
        "FROM plans ORDER BY month DESC",
    )
    .all<RawPlanRow>();
  return (result.results ?? []).map((r) => ({
    slug: r.slug,
    title: r.title,
    month: r.month,
    hemisphere: coerceHemisphere(r.hemisphere),
    summary: r.summary,
    author: r.author,
    publishedAtMs: r.published_at,
  }));
}

export async function getPlanBySlug(db: D1Database, slug: string): Promise<PlanRow | null> {
  const row = await db
    .prepare(
      "SELECT slug, title, month, hemisphere, summary, body_md, objects_json, author, published_at " +
        "FROM plans WHERE slug = ?",
    )
    .bind(slug)
    .first<RawPlanRow>();
  if (row === null) return null;
  return {
    slug: row.slug,
    title: row.title,
    month: row.month,
    hemisphere: coerceHemisphere(row.hemisphere),
    summary: row.summary,
    bodyMd: row.body_md ?? "",
    objectsJson: row.objects_json ?? "[]",
    author: row.author,
    publishedAtMs: row.published_at,
  };
}

export type UpsertPlanInput = {
  readonly slug: string;
  readonly title: string;
  readonly month: string;
  readonly hemisphere: "n" | "s" | "both";
  readonly summary: string;
  readonly bodyMd: string;
  readonly objectsJson: string;
  readonly author: string;
  readonly publishedAtMs: number;
};

export async function upsertPlan(db: D1Database, input: UpsertPlanInput): Promise<void> {
  const now = NOW();
  await db
    .prepare(
      "INSERT INTO plans (slug, title, month, hemisphere, summary, body_md, objects_json, author, published_at, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(slug) DO UPDATE SET " +
        "  title = excluded.title, month = excluded.month, hemisphere = excluded.hemisphere, " +
        "  summary = excluded.summary, body_md = excluded.body_md, objects_json = excluded.objects_json, " +
        "  author = excluded.author, published_at = excluded.published_at, updated_at = excluded.updated_at",
    )
    .bind(
      input.slug,
      input.title,
      input.month,
      input.hemisphere,
      input.summary,
      input.bodyMd,
      input.objectsJson,
      input.author,
      input.publishedAtMs,
      now,
      now,
    )
    .run();
}
