/* SPDX-License-Identifier: Apache-2.0 */

/**
 * Helpers to convert between flat typed arrays (used for worker message passing)
 * and the AltAzStar[] domain type used throughout the app.
 */

import type { StarRecord, AltAzStar } from "../astro";
import { magToVisual } from "../astro";

/**
 * Build a flat Float64Array of [ra, dec, ra, dec, ...] from a star catalog.
 * Used for zero-copy transfer to the astro worker.
 */
export function buildRaDecArray(catalog: StarRecord[]): Float64Array {
  const arr = new Float64Array(catalog.length * 2);
  for (let i = 0; i < catalog.length; i++) {
    arr[i * 2] = catalog[i]!.ra;
    arr[i * 2 + 1] = catalog[i]!.dec;
  }
  return arr;
}

/**
 * Reconstruct AltAzStar[] from the star catalog and worker-computed altAzs/visibleIndices.
 *
 * The worker returns:
 * - altAzs: Float64Array of [alt0, az0, alt1, az1, ...] (indexed by catalog position)
 * - visibleIndices: Uint16Array of catalog indices where alt > 0
 *
 * This rebuilds full AltAzStar objects on the main thread (magToVisual stays here).
 */
export function buildAltAzStars(
  catalog: StarRecord[],
  altAzs: Float64Array,
  visibleIndices: Uint16Array,
  magLimit = 6.0,
): AltAzStar[] {
  const result: AltAzStar[] = [];
  for (const i of visibleIndices) {
    const star = catalog[i];
    if (!star) continue;
    // Apply magnitude filter (catalog may contain stars dimmer than the current limit)
    if (star.mag > magLimit) continue;
    const alt = altAzs[i * 2];
    const az = altAzs[i * 2 + 1];
    if (alt === undefined || az === undefined) continue;
    const { size, opacity } = magToVisual(star.mag);
    result.push({
      hip: star.hip,
      ra: star.ra,
      dec: star.dec,
      alt,
      az,
      mag: star.mag,
      ...(star.name !== undefined ? { name: star.name } : {}),
      size,
      opacity,
    });
  }
  return result;
}
