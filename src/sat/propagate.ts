/* SPDX-License-Identifier: Apache-2.0 */
import { propagate, gstime, eciToGeodetic, eciToEcf, ecfToLookAngles } from "satellite.js";
import type { EciVec3, Kilometer } from "satellite.js";
import type { SatelliteRecord } from "./tle";

export type VisibleSatellite = {
  readonly name: string;
  readonly noradId: number;
  readonly alt: number;
  readonly az: number;
  readonly height: number;
  readonly velocity: number;
  readonly trail: readonly { readonly alt: number; readonly az: number }[];
};

const DEG = 180 / Math.PI;
const TRAIL_POINTS = 12;
const TRAIL_INTERVAL_MS = 10_000;

function isValidVec3(v: EciVec3<number>): boolean {
  return (
    v.x !== null &&
    v.y !== null &&
    v.z !== null &&
    Number.isFinite(v.x) &&
    Number.isFinite(v.y) &&
    Number.isFinite(v.z)
  );
}

function computeLookAngles(
  satrec: SatelliteRecord["satrec"],
  time: Date,
  latRad: number,
  lonRad: number,
): { alt: number; az: number; height: number; velocity: number } | null {
  const posVel = propagate(satrec, time);
  if (!posVel) return null;
  const pos = posVel.position;
  const vel = posVel.velocity;

  if (!isValidVec3(pos) || !isValidVec3(vel)) return null;

  const gmst = gstime(time);
  const geo = eciToGeodetic(pos, gmst);
  const ecf = eciToEcf(pos, gmst);
  const observerGd = { longitude: lonRad, latitude: latRad, height: 0 as Kilometer };
  const lookAngles = ecfToLookAngles(observerGd, ecf);

  const height = geo.height;
  const velocity = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);

  return {
    alt: lookAngles.elevation * DEG,
    az: lookAngles.azimuth * DEG,
    height,
    velocity,
  };
}

export function propagateSatellites(
  satellites: SatelliteRecord[],
  lat: number,
  lon: number,
  time: Date,
  filterVisible: boolean,
): VisibleSatellite[] {
  const latRad = lat / DEG;
  const lonRad = lon / DEG;
  const result: VisibleSatellite[] = [];

  for (const sat of satellites) {
    const current = computeLookAngles(sat.satrec, time, latRad, lonRad);
    if (!current) continue;
    if (filterVisible && current.alt <= 0) continue;

    const trail: { alt: number; az: number }[] = [];
    for (let i = TRAIL_POINTS; i >= 1; i--) {
      const trailTime = new Date(time.getTime() - i * TRAIL_INTERVAL_MS);
      const pt = computeLookAngles(sat.satrec, trailTime, latRad, lonRad);
      if (pt) {
        trail.push({ alt: pt.alt, az: pt.az });
      }
    }

    result.push({
      name: sat.name,
      noradId: sat.noradId,
      alt: current.alt,
      az: current.az,
      height: current.height,
      velocity: current.velocity,
      trail,
    });
  }

  return result;
}
