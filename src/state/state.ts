/* SPDX-License-Identifier: Apache-2.0 */
import { err, ok, type Result } from "../result";

export type Observer = { readonly lat: number; readonly lon: number };

export type AppState = {
  readonly observer: Observer;
  readonly timeUtc: Date;
};

export type StateParseError =
  | { kind: "lat-not-a-number"; raw: string }
  | { kind: "lat-out-of-range"; value: number }
  | { kind: "lon-not-a-number"; raw: string }
  | { kind: "lon-out-of-range"; value: number }
  | { kind: "time-invalid"; raw: string };

export const DEFAULT_STATE: AppState = {
  observer: { lat: 0, lon: 0 },
  timeUtc: new Date("2026-04-15T00:00:00.000Z"),
};

function parseLat(raw: string): Result<number, StateParseError> {
  const n = Number(raw);
  if (!Number.isFinite(n)) return err({ kind: "lat-not-a-number", raw });
  if (n < -90 || n > 90) return err({ kind: "lat-out-of-range", value: n });
  return ok(n);
}

function parseLon(raw: string): Result<number, StateParseError> {
  const n = Number(raw);
  if (!Number.isFinite(n)) return err({ kind: "lon-not-a-number", raw });
  if (n < -180 || n > 180) return err({ kind: "lon-out-of-range", value: n });
  return ok(n);
}

function parseTime(raw: string): Result<Date, StateParseError> {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return err({ kind: "time-invalid", raw });
  return ok(d);
}

export function parseStateFromSearchParams(
  params: URLSearchParams,
): Result<AppState, StateParseError> {
  let lat = DEFAULT_STATE.observer.lat;
  let lon = DEFAULT_STATE.observer.lon;
  let timeUtc = DEFAULT_STATE.timeUtc;

  const rawLat = params.get("lat");
  if (rawLat !== null) {
    const r = parseLat(rawLat);
    if (!r.ok) return r;
    lat = r.value;
  }

  const rawLon = params.get("lon");
  if (rawLon !== null) {
    const r = parseLon(rawLon);
    if (!r.ok) return r;
    lon = r.value;
  }

  const rawT = params.get("t");
  if (rawT !== null) {
    const r = parseTime(rawT);
    if (!r.ok) return r;
    timeUtc = r.value;
  }

  return ok({ observer: { lat, lon }, timeUtc });
}

export function serializeStateToSearchParams(state: AppState): URLSearchParams {
  const params = new URLSearchParams();
  params.set("lat", String(state.observer.lat));
  params.set("lon", String(state.observer.lon));
  params.set("t", state.timeUtc.toISOString());
  return params;
}
