/* SPDX-License-Identifier: Apache-2.0 */
import { Body, Observer, SearchRiseSet, SearchHourAngle } from "astronomy-engine";

export type RiseSetResult = {
  readonly rise: Date | null;
  readonly set: Date | null;
  readonly transit: Date | null;
};

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
 * Compute rise, set, and transit times for a named body near the given time.
 *
 * Searches within ±12 hours of `time`. Returns null for a component when the
 * body does not cross the horizon (or meridian) within that window.
 */
export function computeRiseSet(
  bodyName: string,
  lat: number,
  lon: number,
  time: Date,
): RiseSetResult {
  const body = BODY_MAP[bodyName];
  if (body === undefined) {
    return { rise: null, set: null, transit: null };
  }

  const observer = new Observer(lat, lon, 0);

  // Search for rise starting 12 hours before the given time
  const riseStart = new Date(time.getTime() - 12 * 3600 * 1000);
  const riseTime = SearchRiseSet(body, observer, +1, riseStart, 1);
  const rise = riseTime !== null ? riseTime.date : null;

  // Search for set starting 12 hours before the given time
  const setStart = new Date(time.getTime() - 12 * 3600 * 1000);
  const setTime = SearchRiseSet(body, observer, -1, setStart, 1);
  const set = setTime !== null ? setTime.date : null;

  // Transit: hour angle = 0 means upper culmination (due south/north)
  let transit: Date | null;
  try {
    const transitStart = new Date(time.getTime() - 12 * 3600 * 1000);
    const hourAngleEvent = SearchHourAngle(body, observer, 0, transitStart);
    transit = hourAngleEvent.time.date;
  } catch {
    transit = null;
  }

  return { rise, set, transit };
}
