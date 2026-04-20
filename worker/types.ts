/* SPDX-License-Identifier: Apache-2.0 */

/** D1 + secret bindings available to the Worker. Populated by the runtime
 *  from `wrangler.worker.jsonc` + `wrangler secret put`. */
export type Env = {
  readonly DB: D1Database;
  readonly APP_ORIGIN: string;
  readonly SESSION_SECRET: string;
};

/** User row in D1. Tier is a string column; the narrow union is enforced
 *  in TypeScript at every read site. */
export type UserTier = "free" | "pro";

export type UserRow = {
  readonly id: number;
  readonly email: string;
  readonly tier: UserTier;
  readonly created_at: number;
};

export type MagicLinkRow = {
  readonly token: string;
  readonly email: string;
  readonly created_at: number;
  readonly used_at: number | null;
};

export type SessionRow = {
  readonly id: string;
  readonly user_id: number;
  readonly created_at: number;
  readonly expires_at: number;
};

/** Wire error code used in API JSON bodies. The client maps these into a
 *  narrow `AuthError` union in `src/auth.ts`. */
export type ApiErrorCode =
  | "invalid_email"
  | "rate_limited"
  | "invalid_token"
  | "unauthenticated"
  | "server_error"
  | "method_not_allowed"
  | "not_found";

/** The session cookie name. HTTP-only + signed (see `crypto.ts`). */
export const SESSION_COOKIE = "ps_session";
/** Max session age, in seconds (30 days). */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
/** One-pending-link-per-email window, in milliseconds. */
export const MAGIC_LINK_RATE_WINDOW_MS = 60_000;
