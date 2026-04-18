/* SPDX-License-Identifier: Apache-2.0 */
import type { HorizontalCoord } from "./coords";
import { raDecToAltAz } from "./coords";

export type GridData = {
  readonly raLines: HorizontalCoord[][];
  readonly decLines: HorizontalCoord[][];
};

/**
 * Compute RA/Dec equatorial grid lines in alt/az coordinates.
 * RA lines: 24 great circles at RA = 0, 15, 30, ..., 345°.
 * Dec lines: 17 small circles at Dec = -80, -70, ..., +80°.
 * Only points above the horizon (alt >= 0) are included.
 */
export function computeRaDecGrid(lat: number, lon: number, time: Date): GridData {
  const raLines: HorizontalCoord[][] = [];
  const decLines: HorizontalCoord[][] = [];

  // RA lines: one per hour (every 15°), sampled at Dec = -80 to +80 in 10° steps
  for (let raHour = 0; raHour < 24; raHour++) {
    const raDeg = raHour * 15;
    const line: HorizontalCoord[] = [];
    for (let dec = -80; dec <= 80; dec += 10) {
      const coord = raDecToAltAz(raDeg, dec, lat, lon, time);
      if (coord.alt >= 0) {
        line.push(coord);
      }
    }
    if (line.length >= 2) {
      raLines.push(line);
    }
  }

  // Dec lines: every 10°, sampled at RA = 0 to 345 in 15° steps
  for (let dec = -80; dec <= 80; dec += 10) {
    const line: HorizontalCoord[] = [];
    for (let raHour = 0; raHour < 24; raHour++) {
      const raDeg = raHour * 15;
      const coord = raDecToAltAz(raDeg, dec, lat, lon, time);
      if (coord.alt >= 0) {
        line.push(coord);
      }
    }
    if (line.length >= 2) {
      decLines.push(line);
    }
  }

  return { raLines, decLines };
}
