/* SPDX-License-Identifier: Apache-2.0 */
import { SESSION_COOKIE, type ApiErrorCode } from "./types";

/**
 * Small HTTP helpers shared across Worker route modules. Centralises the
 * `content-type: application/json` header, the wire error shape, and the
 * `Set-Cookie` string for the signed session cookie so no route handler
 * can forget a detail.
 */

/** JSON response with the content-type header set. */
export function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
}

/** Wire error shape: `{error: ApiErrorCode, message?: string}`. */
export function errorJson(code: ApiErrorCode, status: number, message?: string): Response {
  return json({ error: code, ...(message === undefined ? {} : { message }) }, { status });
}

/** 405 response body — standard method-not-allowed error. */
export function methodNotAllowed(): Response {
  return errorJson("method_not_allowed", 405);
}

/** 404 response body — standard not-found error. */
export function notFound(): Response {
  return errorJson("not_found", 404);
}

/** 400 response body — standard invalid-payload error. */
export function badRequest(): Response {
  return errorJson("invalid_payload", 400);
}

export type SessionCookieOptions = {
  readonly value: string;
  readonly maxAgeSec: number;
  readonly secure: boolean;
};

/** Build the signed `ps_session` Set-Cookie string. `value` is the
 *  HMAC-signed session id (see `crypto.signCookie`). */
export function sessionCookie(opts: SessionCookieOptions): string {
  const secureFlag = opts.secure ? "; Secure" : "";
  return (
    `${SESSION_COOKIE}=${opts.value}; HttpOnly${secureFlag}; SameSite=Lax; ` +
    `Path=/; Max-Age=${String(opts.maxAgeSec)}`
  );
}

/** Build the Set-Cookie string that clears the session on logout. */
export function clearSessionCookie(opts: { readonly secure: boolean }): string {
  const secureFlag = opts.secure ? "; Secure" : "";
  return `${SESSION_COOKIE}=; HttpOnly${secureFlag}; SameSite=Lax; Path=/; Max-Age=0`;
}

/** True when the request URL uses https — used to set the `Secure` flag. */
export function isHttpsRequest(url: URL): boolean {
  return url.protocol === "https:";
}
