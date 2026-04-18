/* SPDX-License-Identifier: Apache-2.0 */

/**
 * Fast RA/Dec → Alt/Az coordinate transform.
 *
 * Skips Astronomy Engine's full precession/nutation/aberration/refraction pipeline.
 * Suitable for visual star chart rendering where ~0.5° accuracy is acceptable.
 * Solar system bodies should still use raDecToAltAz (astronomy-engine) for precision.
 */

/**
 * Compute Greenwich Mean Sidereal Time (GMST) in degrees from a Date.
 */
function gmst(date: Date): number {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525;
  const gmstDeg =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T -
    (T * T * T) / 38710000;
  return ((gmstDeg % 360) + 360) % 360;
}

/**
 * Compute Local Sidereal Time (LST) in degrees.
 */
function lst(date: Date, lonDeg: number): number {
  return (((gmst(date) + lonDeg) % 360) + 360) % 360;
}

/**
 * Fast RA/Dec → Alt/Az transform (no precession, no refraction).
 * Accurate to within ~0.5° of Astronomy Engine for visual purposes.
 *
 * @param raDeg - Right Ascension in degrees [0, 360)
 * @param decDeg - Declination in degrees [-90, 90]
 * @param lat - Observer latitude in degrees
 * @param lon - Observer longitude in degrees
 * @param time - Observation time (UTC)
 * @returns { alt: altitude degrees, az: azimuth degrees [0, 360) }
 */
export function fastRaDecToAltAz(
  raDeg: number,
  decDeg: number,
  lat: number,
  lon: number,
  time: Date,
): { alt: number; az: number } {
  const localST = lst(time, lon);
  const haDeg = (((localST - raDeg) % 360) + 360) % 360;

  const haRad = (haDeg * Math.PI) / 180;
  const decRad = (decDeg * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;

  const sinAlt =
    Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const alt = Math.asin(sinAlt) * (180 / Math.PI);

  const cosAz =
    (Math.sin(decRad) - Math.sin(latRad) * sinAlt) /
    (Math.cos(latRad) * Math.cos((alt * Math.PI) / 180));
  let az = Math.acos(Math.min(1, Math.max(-1, cosAz))) * (180 / Math.PI);
  if (Math.sin(haRad) > 0) az = 360 - az;

  return { alt, az };
}
