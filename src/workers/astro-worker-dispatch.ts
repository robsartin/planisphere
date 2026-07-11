/* SPDX-License-Identifier: Apache-2.0 */

/**
 * Pure dispatch function for the astro Web Worker (issue #376).
 *
 * The Worker entry (`astro-worker.ts`) can't be exercised under jsdom — a
 * Web Worker runs in its own realm and jsdom doesn't spin one up — so the
 * message-handler body used to sit as an anonymous callback and go untested,
 * dragging `astro-worker.ts` coverage to 0%.
 *
 * Extracting the handler into this pure function lets vitest hit every
 * branch: unknown message type, empty inputs, mixed above/below-horizon
 * results, and the postMessage transferables list the caller must forward
 * to keep the zero-copy contract.
 *
 * `astro-worker.ts` is now a ~5-line file that wires `self.onmessage` to
 * this function and forwards the result to `self.postMessage`.
 */

import { lstFromMs, altAzFromRaDec } from "./worker-math";

export type AstroWorkerRequest = {
  type: "compute-altaz";
  /** Sequence id to correlate response with request */
  id: number;
  /** Flat Float64Array of [ra0, dec0, ra1, dec1, ...] */
  raDecs: Float64Array;
  lat: number;
  lon: number;
  timeMs: number;
};

export type AstroWorkerResponse = {
  type: "compute-altaz-result";
  id: number;
  /** Flat Float64Array of [alt0, az0, alt1, az1, ...] — same length as raDecs */
  altAzs: Float64Array;
  /** Indices of entries where alt > 0 */
  visibleIndices: Uint16Array;
};

/**
 * Dispatch outcome. When the message type isn't recognised we return
 * `null` — the worker entry drops it silently, matching the pre-refactor
 * `if (type !== "compute-altaz") return;` early-out.
 */
export type AstroWorkerDispatch = {
  response: AstroWorkerResponse;
  /**
   * Transferable buffers the caller must pass as the second argument to
   * `self.postMessage`. Keeps the zero-copy contract in one place so the
   * entry file doesn't have to know which fields are transferable.
   */
  transferables: Transferable[];
};

export function handleAstroWorkerMessage(req: AstroWorkerRequest): AstroWorkerDispatch | null {
  if (req.type !== "compute-altaz") return null;

  const { id, raDecs, lat, lon, timeMs } = req;
  const count = raDecs.length / 2;
  const altAzs = new Float64Array(count * 2);
  const visible: number[] = [];

  const latRad = (lat * Math.PI) / 180;
  const localST = lstFromMs(timeMs, lon);

  for (let i = 0; i < count; i++) {
    const ra = raDecs[i * 2]!;
    const dec = raDecs[i * 2 + 1]!;
    const { alt, az } = altAzFromRaDec(ra, dec, latRad, localST);
    altAzs[i * 2] = alt;
    altAzs[i * 2 + 1] = az;
    if (alt > 0) visible.push(i);
  }

  const visibleIndices = new Uint16Array(visible);

  return {
    response: {
      type: "compute-altaz-result",
      id,
      altAzs,
      visibleIndices,
    },
    transferables: [altAzs.buffer, visibleIndices.buffer],
  };
}
