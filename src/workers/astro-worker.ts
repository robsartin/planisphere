/* SPDX-License-Identifier: Apache-2.0 */

/**
 * Astro computation Web Worker (entry).
 *
 * All logic lives in the pure `handleAstroWorkerMessage` in
 * `astro-worker-dispatch.ts` so it can be tested under jsdom (issue #376).
 * This entry is just the Worker-global glue: dispatch the message, forward
 * the response with the transferables list to keep the zero-copy contract.
 */

import { handleAstroWorkerMessage, type AstroWorkerRequest } from "./astro-worker-dispatch";

// Re-export the message-protocol types so existing importers of this file
// keep compiling — the Worker entry has historically been the type source
// of truth for the client wrapper (`astro-worker-client.ts`).
export type { AstroWorkerRequest, AstroWorkerResponse } from "./astro-worker-dispatch";

/* c8 ignore start — Worker-global bridge, not reachable under jsdom. All
 * behavior is exercised via handleAstroWorkerMessage in
 * astro-worker-dispatch.test.ts. */
self.onmessage = (event: MessageEvent<AstroWorkerRequest>) => {
  const out = handleAstroWorkerMessage(event.data);
  if (out === null) return;
  self.postMessage(out.response, out.transferables);
};
/* c8 ignore stop */
