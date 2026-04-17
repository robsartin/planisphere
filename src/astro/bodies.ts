/* SPDX-License-Identifier: Apache-2.0 */
import { Body, Equator, MakeTime, Observer } from "astronomy-engine";
import { raDecToAltAz } from "./coords";
import { getMoonIllumination } from "./moon-phase";

export type CelestialBody = {
  readonly id: string;
  readonly alt: number;
  readonly az: number;
  readonly ra: number;
  readonly dec: number;
  readonly mag: number;
  readonly size: number;
  readonly color: string;
  readonly illumination?: number;
  readonly phaseAngle?: number;
};

type BodyConfig = {
  body: Body;
  id: string;
  color: string;
  size: number;
  mag: number;
};

const BODY_CONFIGS: BodyConfig[] = [
  { body: Body.Sun, id: "Sun", color: "#FDB813", size: 24, mag: -26.74 },
  { body: Body.Moon, id: "Moon", color: "#E8E8E0", size: 20, mag: -12.7 },
  { body: Body.Mercury, id: "Mercury", color: "#B5A7A7", size: 6, mag: 0.0 },
  { body: Body.Venus, id: "Venus", color: "#FFFFCC", size: 10, mag: -4.0 },
  { body: Body.Mars, id: "Mars", color: "#CC4422", size: 8, mag: 1.0 },
  { body: Body.Jupiter, id: "Jupiter", color: "#D4A96A", size: 9, mag: -2.0 },
  { body: Body.Saturn, id: "Saturn", color: "#C8B07A", size: 7, mag: 0.5 },
];

export function computeBodyPositions(
  lat: number,
  lon: number,
  time: Date,
  filterVisible: boolean,
): CelestialBody[] {
  const astroTime = MakeTime(time);
  const observer = new Observer(lat, lon, 0);
  const result: CelestialBody[] = [];

  for (const config of BODY_CONFIGS) {
    const eq = Equator(config.body, astroTime, observer, true, true);
    const raDeg = eq.ra * 15;
    const decDeg = eq.dec;
    const { alt, az } = raDecToAltAz(raDeg, decDeg, lat, lon, time);

    if (filterVisible && alt <= 0) continue;

    const entry: CelestialBody = {
      id: config.id,
      alt,
      az,
      ra: raDeg,
      dec: decDeg,
      mag: config.mag,
      size: config.size,
      color: config.color,
    };

    if (config.id === "Moon") {
      const moonIllum = getMoonIllumination(time);
      const withMoon: CelestialBody = {
        ...entry,
        illumination: moonIllum.fraction,
        phaseAngle: moonIllum.phaseAngle,
      };
      result.push(withMoon);
    } else {
      result.push(entry);
    }
  }

  return result;
}
