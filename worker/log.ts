/* SPDX-License-Identifier: Apache-2.0 */

/**
 * Tiny structured logger for the Worker. Each call emits a single-line
 * JSON object via `console.log` / `console.error` — Cloudflare's
 * observability feed records the string and lets us filter / aggregate by
 * `event` field without regex-scraping.
 *
 * Usage:
 *   logEvent("sweep.completed", { magicLinks: n, sessions: m });
 *   logError("worker.unhandled", err, { path, method });
 *
 * The dev-only console stubs in `worker/email.ts` stay as plain-string
 * `console.log` — they exist for humans grepping `wrangler tail`, not for
 * the observability pipeline.
 */

export function logEvent(event: string, fields?: Record<string, unknown>): void {
  const line = { ...(fields ?? {}), event, t: Date.now() };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
}

export function logError(event: string, err: unknown, fields?: Record<string, unknown>): void {
  const message = err instanceof Error ? err.message : safeString(err);
  const stack = err instanceof Error ? err.stack : undefined;
  const line: Record<string, unknown> = {
    ...(fields ?? {}),
    event,
    t: Date.now(),
    error: message,
  };
  if (stack !== undefined) line["stack"] = stack;

  console.error(JSON.stringify(line));
}

function safeString(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}
