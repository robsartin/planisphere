/* SPDX-License-Identifier: Apache-2.0 */
import type { HorizontalCoord } from "./coords";
import { fastRaDecToAltAz } from "./fast-coords";

/**
 * Key points along the Milky Way centerline, stored as RA/Dec (J2000, degrees).
 * These trace the bright band of the galactic plane as seen from Earth.
 * Listed in order roughly following the galactic plane around the sky.
 */
const MILKY_WAY_POINTS: ReadonlyArray<{ ra: number; dec: number }> = [
  { ra: 266, dec: -29 }, // Sagittarius (galactic center)
  { ra: 275, dec: -20 }, // Sagittarius/Scutum
  { ra: 284, dec: -10 }, // Scutum/Aquila
  { ra: 297, dec: 10 }, // Aquila
  { ra: 303, dec: 20 }, // Aquila/Sagitta
  { ra: 310, dec: 42 }, // Cygnus
  { ra: 320, dec: 55 }, // Cygnus/Lacerta
  { ra: 335, dec: 60 }, // Cassiopeia approach
  { ra: 15, dec: 60 }, // Cassiopeia
  { ra: 30, dec: 56 }, // Cassiopeia/Perseus
  { ra: 45, dec: 50 }, // Perseus
  { ra: 55, dec: 45 }, // Perseus
  { ra: 70, dec: 38 }, // Auriga/Perseus boundary
  { ra: 80, dec: 35 }, // Auriga
  { ra: 90, dec: 22 }, // Auriga/Gemini
  { ra: 100, dec: 5 }, // Gemini/Monoceros
  { ra: 110, dec: -5 }, // Monoceros
  { ra: 120, dec: -20 }, // Monoceros/Puppis
  { ra: 130, dec: -45 }, // Puppis/Vela
  { ra: 145, dec: -55 }, // Vela/Carina
  { ra: 160, dec: -60 }, // Carina
  { ra: 175, dec: -62 }, // Carina/Crux approach
  { ra: 190, dec: -60 }, // Crux
  { ra: 205, dec: -55 }, // Crux/Centaurus
  { ra: 210, dec: -50 }, // Centaurus
  { ra: 222, dec: -45 }, // Centaurus/Lupus
  { ra: 235, dec: -40 }, // Lupus/Scorpius
  { ra: 248, dec: -25 }, // Scorpius
  { ra: 258, dec: -30 }, // Scorpius/Sagittarius boundary
];

/**
 * Compute Milky Way band points visible above the horizon.
 *
 * Uses a predefined set of RA/Dec key points tracing the galactic plane,
 * converts each to Alt/Az at the given observer position and time,
 * and returns only those above the horizon.
 *
 * @param lat - Observer latitude in degrees
 * @param lon - Observer longitude in degrees
 * @param time - Observation time (UTC)
 * @returns Array of { alt, az } points above the horizon (alt >= 0)
 */
export function computeMilkyWayPoints(lat: number, lon: number, time: Date): HorizontalCoord[] {
  const points: HorizontalCoord[] = [];

  for (const { ra, dec } of MILKY_WAY_POINTS) {
    const coord = fastRaDecToAltAz(ra, dec, lat, lon, time);
    if (coord.alt >= 0) {
      points.push(coord);
    }
  }

  return points;
}
