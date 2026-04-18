/* SPDX-License-Identifier: Apache-2.0 */
import { Body, Equator, MakeTime, Observer } from "astronomy-engine";
import { err, ok, type Result } from "../result";
import { raDecToAltAz, type HorizontalCoord } from "./coords";

export type TrailError =
  | { kind: "unknown-body"; id: string }
  | { kind: "invalid-duration"; value: number }
  | { kind: "invalid-step"; value: number };

const BODY_MAP: Record<string, Body> = {
  Sun: Body.Sun,
  Moon: Body.Moon,
  Mercury: Body.Mercury,
  Venus: Body.Venus,
  Mars: Body.Mars,
  Jupiter: Body.Jupiter,
  Saturn: Body.Saturn,
};

/**
 * Compute a body's future path across the sky as a series of alt/az points.
 *
 * Samples every `stepMinutes` from `startTime` through `startTime + durationHours`.
 * Returns (N + 1) points where N = floor(durationHours * 60 / stepMinutes).
 */
export function computeBodyTrail(
  id: string,
  lat: number,
  lon: number,
  startTime: Date,
  durationHours: number,
  stepMinutes: number,
): Result<HorizontalCoord[], TrailError> {
  const body = BODY_MAP[id];
  if (body === undefined) return err({ kind: "unknown-body", id });
  if (!(durationHours > 0)) return err({ kind: "invalid-duration", value: durationHours });
  if (!(stepMinutes > 0)) return err({ kind: "invalid-step", value: stepMinutes });

  const observer = new Observer(lat, lon, 0);
  const totalMinutes = durationHours * 60;
  const steps = Math.floor(totalMinutes / stepMinutes);
  const points: HorizontalCoord[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = new Date(startTime.getTime() + i * stepMinutes * 60_000);
    const astroTime = MakeTime(t);
    const eq = Equator(body, astroTime, observer, true, true);
    const raDeg = eq.ra * 15;
    const { alt, az } = raDecToAltAz(raDeg, eq.dec, lat, lon, t);
    points.push({ alt, az });
  }

  return ok(points);
}
