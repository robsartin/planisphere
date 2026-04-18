/* SPDX-License-Identifier: Apache-2.0 */
import { err, ok, type Result } from "../result";
import { fastRaDecToAltAz } from "./fast-coords";

export type MessierRecord = {
  readonly m: number;
  readonly name: string;
  readonly type: string;
  readonly ra: number;
  readonly dec: number;
  readonly mag: number;
};

export type MessierLoadError = { kind: "messier-load-failed"; message: string };

export type VisibleMessier = {
  readonly m: number;
  readonly name: string;
  readonly type: string;
  readonly alt: number;
  readonly az: number;
  readonly ra: number;
  readonly dec: number;
  readonly mag: number;
};

export function parseMessier(raw: unknown): Result<MessierRecord[], MessierLoadError> {
  if (!Array.isArray(raw)) {
    return err({ kind: "messier-load-failed", message: "Messier catalog is not an array" });
  }
  if (raw.length === 0) {
    return err({ kind: "messier-load-failed", message: "Messier catalog is empty" });
  }

  const objects: MessierRecord[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const m = Number(e.m);
    const ra = Number(e.ra);
    const dec = Number(e.dec);
    const mag = Number(e.mag);
    if (!Number.isFinite(m) || m <= 0) continue;
    if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(mag)) continue;
    const name = typeof e.name === "string" ? e.name : "";
    const type = typeof e.type === "string" ? e.type : "other";
    objects.push({ m, name, type, ra, dec, mag });
  }

  if (objects.length === 0) {
    return err({ kind: "messier-load-failed", message: "No valid Messier objects after parsing" });
  }
  return ok(objects);
}

export function filterVisibleMessier(
  objects: MessierRecord[],
  lat: number,
  lon: number,
  time: Date,
): VisibleMessier[] {
  const result: VisibleMessier[] = [];
  for (const obj of objects) {
    const { alt, az } = fastRaDecToAltAz(obj.ra, obj.dec, lat, lon, time);
    if (alt <= 0) continue;
    result.push({
      m: obj.m,
      name: obj.name,
      type: obj.type,
      alt,
      az,
      ra: obj.ra,
      dec: obj.dec,
      mag: obj.mag,
    });
  }
  return result;
}
