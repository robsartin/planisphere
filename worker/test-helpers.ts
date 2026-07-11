/* SPDX-License-Identifier: Apache-2.0 */
/**
 * Helpers shared across Worker tests — schema bootstrap, a `fetchWorker`
 * wrapper over the entry point, and the `login(email)` / `authed(...)`
 * helpers that every authenticated route test needs.
 *
 * The schema DDL mirrors `migrations/0001_init.sql` + `0002_notebooks.sql`
 * + `0003_magic_link_ttl.sql` + `0004_plans.sql` — the migration files
 * remain the source of truth for production; we keep this in sync by
 * hand (small cost, no extra tooling).
 */
import { env } from "cloudflare:test";
import worker from "./index";
import type { Env as _Env } from "./types";

// Re-export the bound env so test files get narrow types.
// _Env is imported purely to teach the `cloudflare:test` module-augmentation
// in env.d.ts about the Env shape; not referenced directly.
export const testEnv = env;

/** Origin used by every worker-test request. Arbitrary, but shared so the
 *  redirect Location + CORS assertions all line up. */
export const TEST_BASE = "http://localhost";

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
    used_at INTEGER,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE notebooks (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE plans (
    slug         TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    month        TEXT NOT NULL,
    hemisphere   TEXT NOT NULL CHECK (hemisphere IN ('n','s','both')),
    summary      TEXT NOT NULL,
    body_md      TEXT NOT NULL,
    objects_json TEXT NOT NULL,
    author       TEXT NOT NULL,
    published_at INTEGER NOT NULL,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL
  )`,
  `CREATE TABLE share_links (
    code        TEXT PRIMARY KEY,
    target_url  TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    created_by  INTEGER,
    hit_count   INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`,
  `CREATE INDEX idx_magic_links_email ON magic_links(email)`,
  `CREATE INDEX idx_magic_links_expires ON magic_links(expires_at)`,
  `CREATE INDEX idx_sessions_expires ON sessions(expires_at)`,
  `CREATE INDEX idx_notebooks_user_updated ON notebooks(user_id, updated_at DESC)`,
  `CREATE INDEX idx_plans_month ON plans(month)`,
  `CREATE INDEX idx_share_links_created_at ON share_links(created_at)`,
] as const;

export async function resetDb(): Promise<void> {
  await testEnv.DB.prepare("DROP TABLE IF EXISTS share_links").run();
  await testEnv.DB.prepare("DROP TABLE IF EXISTS plans").run();
  await testEnv.DB.prepare("DROP TABLE IF EXISTS notebooks").run();
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

/** Invoke the worker's `fetch` handler with the bound `testEnv`. */
export async function fetchWorker(req: Request): Promise<Response> {
  if (!worker.fetch) throw new Error("worker has no fetch handler");
  return worker.fetch(req, testEnv, {} as unknown as ExecutionContext);
}

/** Request a magic link for `email`, claim it via the callback, and
 *  return the signed `ps_session` cookie value. Throws if the login
 *  flow didn't end with a Set-Cookie (signals a broken test fixture
 *  or a real regression in the auth routes). */
export async function login(email: string): Promise<string> {
  await fetchWorker(
    new Request(`${TEST_BASE}/api/auth/request-link`, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  );
  const pending = await testEnv.DB.prepare(
    "SELECT token FROM magic_links WHERE email = ? ORDER BY created_at DESC LIMIT 1",
  )
    .bind(email)
    .first<{ token: string }>();
  const res = await fetchWorker(
    new Request(`${TEST_BASE}/api/auth/callback?token=${pending!.token}`),
  );
  const cookie = extractSessionCookie(res);
  if (cookie === null) throw new Error(`login(${email}) did not yield a session cookie`);
  return cookie;
}

/** Build an authenticated `Request` to `path` with the given session
 *  cookie. Pass `init` for method / body / headers. */
export function authed(path: string, cookie: string, init?: RequestInit): Request {
  return new Request(`${TEST_BASE}${path}`, {
    ...init,
    headers: { cookie: `ps_session=${cookie}`, ...(init?.headers ?? {}) },
  });
}
