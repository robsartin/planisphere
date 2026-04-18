/* SPDX-License-Identifier: Apache-2.0 */
import type { StarRecord } from "./catalog";
import { fastRaDecToAltAz } from "./fast-coords";
import { magToVisual } from "./magnitude";

export type AltAzStar = {
  readonly hip: number;
  readonly ra: number;
  readonly dec: number;
  readonly alt: number;
  readonly az: number;
  readonly mag: number;
  readonly name?: string;
  readonly size: number;
  readonly opacity: number;
};

export function filterVisibleStars(
  catalog: StarRecord[],
  lat: number,
  lon: number,
  time: Date,
): AltAzStar[] {
  const result: AltAzStar[] = [];
  for (const star of catalog) {
    const { alt, az } = fastRaDecToAltAz(star.ra, star.dec, lat, lon, time);
    if (alt <= 0) continue;
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
