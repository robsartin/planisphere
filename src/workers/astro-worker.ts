/* SPDX-License-Identifier: Apache-2.0 */

/**
 * Astro computation Web Worker.
 *
 * Uses the simplified typed-array approach for zero-copy message passing:
 * - Receives flat Float64Array of [ra, dec, ra, dec, ...] pairs plus observer params
 * - Returns flat Float64Array of [alt, az, alt, az, ...] pairs and visible index array
 *
 * No astronomy-engine import: pure GMST math is faster and sufficient for visual rendering.
 */

import { lstFromMs, altAzFromRaDec } from "./worker-math";

// ---- Message protocol ----

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

// ---- Worker message handler ----

self.onmessage = (event: MessageEvent<AstroWorkerRequest>) => {
  const { type, id, raDecs, lat, lon, timeMs } = event.data;
  if (type !== "compute-altaz") return;

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

  const response: AstroWorkerResponse = {
    type: "compute-altaz-result",
    id,
    altAzs,
    visibleIndices,
  };

  // Transfer ownership of typed arrays for zero-copy messaging
  self.postMessage(response, [altAzs.buffer, visibleIndices.buffer]);
};
