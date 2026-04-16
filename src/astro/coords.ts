/* SPDX-License-Identifier: Apache-2.0 */
import { MakeTime, Observer, Horizon } from "astronomy-engine";

export type HorizontalCoord = {
  readonly alt: number;
  readonly az: number;
};

export function raDecToAltAz(
  raDeg: number,
  decDeg: number,
  lat: number,
  lon: number,
  time: Date,
): HorizontalCoord {
  const astroTime = MakeTime(time);
  const observer = new Observer(lat, lon, 0);
  const raHours = raDeg / 15;
  const result = Horizon(astroTime, observer, raHours, decDeg, "normal");
  return { alt: result.altitude, az: result.azimuth };
}
