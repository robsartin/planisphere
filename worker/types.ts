/* SPDX-License-Identifier: Apache-2.0 */

/** D1 + secret bindings available to the Worker. Populated by the runtime
 *  from `wrangler.jsonc` + `wrangler secret put`. */
export type Env = {
  readonly DB: D1Database;
  readonly APP_ORIGIN: string;
  readonly SESSION_SECRET: string;
  /** Resend API key (Worker secret). Absent / empty in dev → auth falls
   *  back to the console-log stub. See ADR 014. */
  readonly RESEND_API_KEY?: string;
  /** Verified sender address on the Resend side, e.g. `noreply@your-domain`.
   *  Required alongside `RESEND_API_KEY` to switch off the dev stub. */
  readonly EMAIL_FROM?: string;
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

export type NotebookRow = {
  readonly id: number;
  readonly user_id: number;
  readonly title: string;
  readonly content_json: string;
  readonly created_at: number;
  readonly updated_at: number;
};

/** Summary row returned by `GET /api/notebooks` — omits `content_json` so
 *  the list response stays small even when individual documents are large. */
export type NotebookSummaryRow = Omit<NotebookRow, "content_json" | "user_id">;

/** Wire error code used in API JSON bodies. The client maps these into a
 *  narrow `AuthError` union in `src/auth.ts`. */
export type ApiErrorCode =
  | "invalid_email"
  | "rate_limited"
  | "invalid_token"
  | "unauthenticated"
  | "server_error"
  | "method_not_allowed"
  | "not_found"
  | "invalid_payload";

/** Max byte length of `content_json` on the wire. Keeps individual
 *  notebook documents in a sensible range and prevents accidental
 *  oversized payloads from filling D1. */
export const NOTEBOOK_CONTENT_MAX_BYTES = 256 * 1024;
export const NOTEBOOK_TITLE_MAX_LEN = 200;

/** The session cookie name. HTTP-only + signed (see `crypto.ts`). */
export const SESSION_COOKIE = "ps_session";
/** Max session age, in seconds (30 days). */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
/** One-pending-link-per-email window, in milliseconds. */
export const MAGIC_LINK_RATE_WINDOW_MS = 60_000;
