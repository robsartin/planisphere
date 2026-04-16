/* SPDX-License-Identifier: Apache-2.0 */
import { parseStateFromSearchParams } from "./state";

export function bootstrap(
  root: HTMLElement | null,
  params: URLSearchParams = new URLSearchParams(globalThis.location?.search ?? ""),
): void {
  if (!root) return;
  const r = parseStateFromSearchParams(params);
  if (!r.ok) {
    root.textContent = `Planisphere — state error: ${r.error.kind}`;
    return;
  }
  const { observer, timeUtc } = r.value;
  root.textContent = `Planisphere — observer (${observer.lat}, ${observer.lon}) @ ${timeUtc.toISOString()}`;
}
