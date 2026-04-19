/* SPDX-License-Identifier: Apache-2.0 */
/**
 * Small helpers used only by Worker tests — creates the schema on the
 * in-memory D1 binding before each test and extracts the signed session
 * cookie from a `Set-Cookie` header.
 *
 * The schema DDL is kept identical to `migrations/0001_init.sql`; the
 * migration file is the source of truth for production, and this helper
 * mirrors it for tests. Keep them in sync by hand — small cost, no extra
 * tooling.
 */
import { env } from "cloudflare:test";
import type { Env } from "./types";

// Re-export the bound env so test files get narrow types.
export const testEnv = env as unknown as Env;

const SCHEMA_STATEMENTS = [
  `CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    tier TEXT NOT NULL DEFAULT 'free',
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE magic_links (
    token TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    used_at INTEGER
  )`,
  `CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE INDEX idx_magic_links_email ON magic_links(email)`,
  `CREATE INDEX idx_sessions_expires ON sessions(expires_at)`,
] as const;

export async function resetDb(): Promise<void> {
  await testEnv.DB.prepare("DROP TABLE IF EXISTS sessions").run();
  await testEnv.DB.prepare("DROP TABLE IF EXISTS magic_links").run();
  await testEnv.DB.prepare("DROP TABLE IF EXISTS users").run();
  for (const stmt of SCHEMA_STATEMENTS) {
    await testEnv.DB.prepare(stmt).run();
  }
}

export function extractSessionCookie(res: Response): string | null {
  const header = res.headers.get("set-cookie");
  if (!header) return null;
  const match = header.match(/ps_session=([^;]+)/);
  return match ? match[1]! : null;
}
