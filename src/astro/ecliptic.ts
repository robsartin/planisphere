/* SPDX-License-Identifier: Apache-2.0 */
import type { HorizontalCoord } from "./coords";
import { fastRaDecToAltAz } from "./fast-coords";

// Mean obliquity of the ecliptic (J2000.0, degrees)
const OBLIQUITY_DEG = 23.4393;

/**
 * Compute a series of alt/az points tracing the ecliptic line.
 * Samples ecliptic longitude at 2° intervals (0° to 358°, 180 points).
 * Converts ecliptic (lon, lat=0) → equatorial (RA, Dec) → horizontal (alt, az).
 * Only points above the horizon (alt >= 0) are included.
 */
export function computeEclipticLine(lat: number, lon: number, time: Date): HorizontalCoord[] {
  const points: HorizontalCoord[] = [];
  const epsilonRad = (OBLIQUITY_DEG * Math.PI) / 180;

  for (let lambdaDeg = 0; lambdaDeg < 360; lambdaDeg += 2) {
    const lambdaRad = (lambdaDeg * Math.PI) / 180;

    // Ecliptic to equatorial conversion (ecliptic lat = 0)
    const raDeg =
      (Math.atan2(Math.sin(lambdaRad) * Math.cos(epsilonRad), Math.cos(lambdaRad)) * 180) / Math.PI;
    const decDeg = (Math.asin(Math.sin(lambdaRad) * Math.sin(epsilonRad)) * 180) / Math.PI;

    // atan2 returns [-180, 180]; normalize to [0, 360]
    const raDegNorm = raDeg < 0 ? raDeg + 360 : raDeg;

    const coord = fastRaDecToAltAz(raDegNorm, decDeg, lat, lon, time);
    if (coord.alt >= 0) {
      points.push(coord);
    }
  }

  return points;
}
