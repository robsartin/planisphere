/* SPDX-License-Identifier: Apache-2.0 */
import { ok, type Result } from "../result";
import bundledTle from "../../data/tle/visual.txt?raw";

export type TleFetchError = { kind: "tle-fetch-failed"; message: string };

/**
 * Result payload for a successful TLE resolution.
 *
 * `sourceAgeSeconds` is derived from the newest TLE epoch found in `text`;
 * `usedFallback` is `true` iff the network fetch failed and we served the
 * bundled snapshot instead. Together these let the UI decide whether to
 * surface a "positions may be off" warning to the user (#354).
 */
export type TleFetchOk = {
  readonly text: string;
  readonly sourceAgeSeconds: number;
  readonly usedFallback: boolean;
};

const CELESTRAK_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle";

/**
 * Extract the epoch (as milliseconds since Unix epoch) from a TLE line-1.
 *
 * Format: columns 19-20 hold the 2-digit year; columns 21-32 hold the day-of-
 * year plus a fractional part. Two-digit-year convention (see the SGP4
 * literature): 57–99 map to 1957–1999, 00–56 map to 2000–2056.
 *
 * Returns `null` for lines that are too short or contain non-numeric epoch
 * fields — parsing skips those without failing the whole fetch.
 */
function parseTleEpochMs(line1: string): number | null {
  if (line1.length < 32) return null;
  const yy = parseInt(line1.substring(18, 20), 10);
  const dayFrac = parseFloat(line1.substring(20, 32));
  if (!Number.isFinite(yy) || !Number.isFinite(dayFrac)) return null;
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  const jan1Ms = Date.UTC(year, 0, 1);
  return jan1Ms + (dayFrac - 1) * 86_400_000;
}

/**
 * Age (seconds) of the freshest TLE in `text` relative to `nowMs`.
 *
 * We use the *newest* epoch across all records because a batch fetched from
 * Celestrak contains records updated at slightly different times per
 * satellite — the newest tells us when the mirror last received an update,
 * which is what determines whether the whole snapshot has gone stale.
 */
function computeSourceAgeSeconds(text: string, nowMs: number): number {
  let newestEpochMs: number | null = null;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("1 ")) continue;
    const epoch = parseTleEpochMs(line);
    if (epoch === null) continue;
    if (newestEpochMs === null || epoch > newestEpochMs) {
      newestEpochMs = epoch;
    }
  }
  if (newestEpochMs === null) return 0;
  return Math.max(0, Math.floor((nowMs - newestEpochMs) / 1000));
}

export async function fetchTle(): Promise<Result<TleFetchOk, TleFetchError>> {
  const nowMs = Date.now();
  try {
    const response = await fetch(CELESTRAK_URL);
    if (response.ok) {
      const text = await response.text();
      if (text.trim().length > 0) {
        return ok({
          text,
          sourceAgeSeconds: computeSourceAgeSeconds(text, nowMs),
          usedFallback: false,
        });
      }
    }
  } catch {
    // network error — fall through to bundled
  }
  console.warn("[planisphere] TLE fetch failed, using bundled data");
  return ok({
    text: bundledTle,
    sourceAgeSeconds: computeSourceAgeSeconds(bundledTle, nowMs),
    usedFallback: true,
  });
}
