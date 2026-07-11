/* SPDX-License-Identifier: Apache-2.0 */
import { err, ok, type Result } from "./result";

/**
 * Client wrapper for the `/api/share` shortlink service (#377).
 *
 * `createShareLink(url)` posts to the Worker, returning the minted
 * `{ code, shortUrl }` on success or a typed `ShareError`. The SPA races
 * this against the inline "copy the long URL" path so the user never
 * waits on the network: if `createShareLink` wins the race under 400 ms,
 * the short URL lands on their clipboard; if not, the long URL does.
 */

export type ShareError =
  | { readonly kind: "invalid_url" }
  | { readonly kind: "rate_limited" }
  | { readonly kind: "network" }
  | { readonly kind: "server" };

export type ShareLink = {
  readonly code: string;
  readonly shortUrl: string;
};

export async function createShareLink(url: string): Promise<Result<ShareLink, ShareError>> {
  let response: Response;
  try {
    response = await fetch("/api/share", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ url }),
    });
  } catch {
    return err({ kind: "network" });
  }

  if (response.status === 201) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return err({ kind: "server" });
    }
    if (
      body === null ||
      typeof body !== "object" ||
      typeof (body as { code?: unknown }).code !== "string" ||
      typeof (body as { shortUrl?: unknown }).shortUrl !== "string"
    ) {
      return err({ kind: "server" });
    }
    const rec = body as { code: string; shortUrl: string };
    return ok({ code: rec.code, shortUrl: rec.shortUrl });
  }
  if (response.status === 400) return err({ kind: "invalid_url" });
  if (response.status === 429) return err({ kind: "rate_limited" });
  return err({ kind: "server" });
}
