/* SPDX-License-Identifier: Apache-2.0 */
import { twoline2satrec, SatRecError } from "satellite.js";
import type { SatRec } from "satellite.js";
import { err, ok, type Result } from "../result";

export type SatelliteRecord = {
  readonly name: string;
  readonly noradId: number;
  readonly satrec: SatRec;
};

export type TleParseError = { kind: "tle-parse-failed"; message: string };

export function parseTle(raw: unknown): Result<SatelliteRecord[], TleParseError> {
  if (typeof raw !== "string") {
    return err({ kind: "tle-parse-failed", message: "TLE input is not a string" });
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return err({ kind: "tle-parse-failed", message: "TLE input is empty" });
  }

  const lines = trimmed.split("\n").map((l) => l.trim());
  const satellites: SatelliteRecord[] = [];

  let i = 0;
  while (i < lines.length) {
    if (i + 2 >= lines.length) break;
    const nameLine = lines[i]!;
    const line1 = lines[i + 1]!;
    const line2 = lines[i + 2]!;

    if (!line1.startsWith("1 ") || !line2.startsWith("2 ")) {
      i++;
      continue;
    }

    try {
      const satrec = twoline2satrec(line1, line2);
      if (satrec.error !== SatRecError.None || !Number.isFinite(satrec.no) || !Number.isFinite(satrec.inclo)) {
        i += 3;
        continue;
      }
      const noradId = parseInt(line1.substring(2, 7).trim(), 10);
      satellites.push({
        name: nameLine.trim(),
        noradId: Number.isFinite(noradId) ? noradId : 0,
        satrec,
      });
    } catch {
      // malformed TLE — skip
    }
    i += 3;
  }

  if (satellites.length === 0) {
    return err({ kind: "tle-parse-failed", message: "No valid TLE entries found" });
  }
  return ok(satellites);
}
