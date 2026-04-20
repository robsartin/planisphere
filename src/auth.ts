/* SPDX-License-Identifier: Apache-2.0 */
import { err, ok, type Result } from "./result";

/**
 * Client-side auth wrapper for the Phase 2 `/api/auth/*` Worker surface.
 *
 * Every network call returns a `Result<T, AuthError>` per CLAUDE.md — this
 * module is the boundary where HTTP error shapes become the typed domain
 * union the rest of the SPA consumes. `currentUser()` is a narrower shape
 * (user | null) because "not logged in" is not an error, it's a state; the
 * SPA calls it at bootstrap to decide what UI to show.
 */

export type AuthUserTier = "free" | "pro";

export type AuthUser = {
  readonly email: string;
  readonly tier: AuthUserTier;
};

export type AuthError =
  | { readonly kind: "invalid_email" }
  | { readonly kind: "rate_limited" }
  | { readonly kind: "invalid_token" }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "network" }
  | { readonly kind: "server" };

/**
 * POST /api/auth/request-link. Triggers a magic-link email (in this PR the
 * Worker logs the URL to its console instead of sending real mail — see
 * `worker/email.ts`). Returns `ok` on HTTP 202, `err` on everything else.
 */
export async function requestMagicLink(email: string): Promise<Result<void, AuthError>> {
  let response: Response;
  try {
    response = await fetch("/api/auth/request-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email }),
    });
  } catch {
    return err({ kind: "network" });
  }
  if (response.status === 202) return ok(undefined);
  if (response.status === 400) return err({ kind: "invalid_email" });
  if (response.status === 429) return err({ kind: "rate_limited" });
  return err({ kind: "server" });
}

/**
 * GET /api/auth/me. Returns the current user if the session cookie is
 * valid, `null` if unauthenticated, a network failure, or any malformed
 * response. Callers treat "null" as "not logged in" — they don't need to
 * distinguish 401 from a dropped connection.
 */
export async function currentUser(): Promise<AuthUser | null> {
  let response: Response;
  try {
    response = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null) return null;
  const email = (body as { email?: unknown }).email;
  const tier = (body as { tier?: unknown }).tier;
  if (typeof email !== "string" || typeof tier !== "string") return null;
  if (tier !== "free" && tier !== "pro") return null;
  return { email, tier };
}

/** POST /api/auth/logout. Best-effort — swallows network errors so the UI
 *  can still clear local state even when offline. */
export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Best-effort: the client will still treat the user as logged-out.
  }
}
