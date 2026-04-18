/* SPDX-License-Identifier: Apache-2.0 */

/**
 * Pure math for alt/az computation used inside the astro Web Worker.
 *
 * Extracted as a separate module so the math can be unit-tested independently
 * of the Worker message-passing scaffold (which requires a Worker context).
 */

/**
 * Greenwich Mean Sidereal Time from Unix timestamp (milliseconds), returns degrees.
 */
export function gmstFromMs(timeMs: number): number {
  const jd = timeMs / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525;
  const deg =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T -
    (T * T * T) / 38710000;
  return ((deg % 360) + 360) % 360;
}

/**
 * Local Sidereal Time in degrees.
 */
export function lstFromMs(timeMs: number, lonDeg: number): number {
  return (((gmstFromMs(timeMs) + lonDeg) % 360) + 360) % 360;
}

/**
 * Convert RA/Dec to altitude and azimuth.
 * @param raDeg - Right Ascension in degrees
 * @param decDeg - Declination in degrees
 * @param latRad - Observer latitude in radians (pre-computed for hot loops)
 * @param localST - Local Sidereal Time in degrees
 */
export function altAzFromRaDec(
  raDeg: number,
  decDeg: number,
  latRad: number,
  localST: number,
): { alt: number; az: number } {
  const haDeg = (((localST - raDeg) % 360) + 360) % 360;
  const haRad = (haDeg * Math.PI) / 180;
  const decRad = (decDeg * Math.PI) / 180;

  const sinAlt =
    Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const alt = Math.asin(sinAlt) * (180 / Math.PI);

  const cosAlt = Math.cos((alt * Math.PI) / 180);
  const cosAz =
    cosAlt > 1e-10
      ? (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * cosAlt)
      : 0;
  let az = Math.acos(Math.min(1, Math.max(-1, cosAz))) * (180 / Math.PI);
  if (Math.sin(haRad) > 0) az = 360 - az;

  return { alt, az };
}
