/* SPDX-License-Identifier: Apache-2.0 */

/**
 * Feature-gate primitives (Rung 1 of the entitlement ladder, issue #224).
 *
 * Intentionally trivial: a bundle-time email allowlist plus a localStorage-persisted
 * identity. This is bypassable in ~10 seconds by anyone who reads the source, and
 * that's fine — it exists to gate paid surfaces during a private beta without
 * standing up auth infrastructure yet. Proper enforcement arrives in Rungs 2/3
 * (signed JWT / Cloudflare Access) once the business model firms up.
 */

/** Lowercased emails that currently have "Pro" entitlements. */
export const PRO_EMAIL_ALLOWLIST: ReadonlySet<string> = new Set(["rob.sartin@gmail.com"]);

/** localStorage key used for the persisted user identity. Bump the suffix
 *  (`.v2`) when the shape changes so old blobs never deserialise into a
 *  schema-aware reader. */
export const USER_STORAGE_KEY = "planisphere.user.v1";

export type User = { email: string | null };

function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Read the persisted user identity. Returns `{ email: null }` on every
 * failure path — missing key, malformed JSON, unexpected shape, or
 * localStorage unavailable — so callers don't need to handle errors.
 */
export function getUser(): User {
  let raw: string | null;
  try {
    raw = globalThis.localStorage?.getItem(USER_STORAGE_KEY) ?? null;
  } catch {
    return { email: null };
  }
  if (raw === null) return { email: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { email: null };
  }
  if (parsed === null || typeof parsed !== "object") return { email: null };
  const rec = parsed as Record<string, unknown>;
  if (typeof rec.email !== "string") return { email: null };
  return { email: rec.email };
}

/** Persist an email as the current user. Normalised to trimmed-lowercase. */
export function setUser(email: string): void {
  const normalised = normaliseEmail(email);
  const payload = JSON.stringify({ email: normalised });
  try {
    globalThis.localStorage?.setItem(USER_STORAGE_KEY, payload);
  } catch {
    // Quota exceeded / storage disabled — Rung 1 is best-effort persistence.
  }
}

/** Remove the persisted user identity. */
export function clearUser(): void {
  try {
    globalThis.localStorage?.removeItem(USER_STORAGE_KEY);
  } catch {
    // Ignore — nothing to do if storage is unavailable.
  }
}

/** True iff the currently persisted email is on the Pro allowlist. */
export function isPro(): boolean {
  const { email } = getUser();
  if (email === null) return false;
  return PRO_EMAIL_ALLOWLIST.has(normaliseEmail(email));
}
