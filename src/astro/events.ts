/* SPDX-License-Identifier: Apache-2.0 */
import {
  AngleBetween,
  Body,
  GeoVector,
  NextLunarEclipse,
  SearchLunarEclipse,
} from "astronomy-engine";
import { ok, type Result } from "../result";
import rawMeteorShowers from "../../data/meteor-showers.json";
import { computeBodyPositions } from "./bodies";
import { raDecToAltAz } from "./coords";
import type { SatelliteRecord } from "../sat/tle";
import { computeUpcomingPasses, isIssRecord, type IssPass } from "../sat/passes";

// Meteor-shower reference data: International Meteor Organization (IMO) calendar.
// Dates listed are canonical annual peaks (UTC); the real peak drifts by a few hours
// year-to-year, which is acceptable for a high-level "upcoming events" list.
type MeteorShowerRecord = {
  readonly id: string;
  readonly name: string;
  readonly peakMonth: number; // 1..12
  readonly peakDay: number; // 1..31
  readonly zhr: number; // zenith hourly rate (approximate)
  readonly raDeg: number; // radiant right ascension (degrees)
  readonly decDeg: number; // radiant declination (degrees)
};

const METEOR_SHOWERS = rawMeteorShowers as readonly MeteorShowerRecord[];

const CONJUNCTION_BODIES: readonly { readonly id: string; readonly body: Body }[] = [
  { id: "Sun", body: Body.Sun },
  { id: "Moon", body: Body.Moon },
  { id: "Mercury", body: Body.Mercury },
  { id: "Venus", body: Body.Venus },
  { id: "Mars", body: Body.Mars },
  { id: "Jupiter", body: Body.Jupiter },
  { id: "Saturn", body: Body.Saturn },
];

/** Maximum angular separation (degrees) we'll call a "conjunction". */
const CONJUNCTION_THRESHOLD_DEG = 5;
/** Coarse sample step for conjunction search (hours). */
const CONJUNCTION_STEP_HOURS = 6;

export type ConjunctionEvent = {
  readonly kind: "conjunction";
  readonly when: Date;
  readonly title: string;
  readonly description: string;
  readonly body1: string;
  readonly body2: string;
  readonly separationDeg: number;
  /** Azimuth (degrees, 0..360) to aim the camera at the midpoint of the two bodies.
   *  Populated when an observer is supplied; omitted otherwise. */
  readonly viewAz?: number;
  /** Altitude (degrees, -90..90) to aim the camera; midpoint of the two bodies. */
  readonly viewAlt?: number;
};

export type LunarEclipseEvent = {
  readonly kind: "lunar-eclipse";
  readonly when: Date;
  readonly title: string;
  readonly description: string;
  readonly eclipseKind: "penumbral" | "partial" | "total";
  readonly obscuration: number;
  /** Azimuth (degrees, 0..360) of the Moon at peak obscuration. Below-horizon values
   *  are kept — the user will see "sky where the Moon would be". */
  readonly viewAz?: number;
  /** Altitude (degrees, -90..90) of the Moon at peak obscuration. */
  readonly viewAlt?: number;
};

export type MeteorShowerEvent = {
  readonly kind: "meteor-shower-peak";
  readonly when: Date;
  readonly title: string;
  readonly description: string;
  readonly showerId: string;
  readonly showerName: string;
  readonly zhr: number;
  /** Azimuth (degrees) of the shower's radiant at `when`. */
  readonly viewAz?: number;
  /** Altitude (degrees) of the shower's radiant at `when`. */
  readonly viewAlt?: number;
};

export type IssPassEvent = {
  readonly kind: "iss-pass";
  readonly when: Date;
  readonly title: string;
  readonly description: string;
  readonly peakAltDeg: number;
  readonly peakAzDeg: number;
  readonly durationSec: number;
  /** True if the ISS is in Earth's umbra at peak — visually invisible even at night. */
  readonly eclipsed: boolean;
  /** Approximate visual magnitude at peak; null when eclipsed. See sat/illumination.ts. */
  readonly magnitudeAtPeak: number | null;
};

export type CelestialEvent =
  ConjunctionEvent | LunarEclipseEvent | MeteorShowerEvent | IssPassEvent;

/** Typed domain errors returned from computeUpcomingEvents. Currently none are produced,
 *  but the Result wrapper keeps the boundary consistent if future variants (e.g. parse
 *  failure of the bundled shower table) surface. */
export type EventsError = { readonly kind: "unknown"; readonly message: string };

// ---------- Meteor showers ----------

/**
 * Shift from the IMO-listed "UTC midnight on the peak day" to a more useful local
 * viewing instant near the radiant's highest point for most observers: roughly 03:00
 * local time on the peak day at the observer's longitude.
 *
 * When no observer is supplied we fall back to the raw UTC midnight (preserves the
 * original behavior for callers that don't care about a viewing-ready time).
 */
function meteorPeakTime(
  year: number,
  month: number,
  day: number,
  observer: ObserverInput | undefined,
): number {
  const baseUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  if (!observer) return baseUtc;
  // Shift so the local clock reads ~03:00 on the peak day.
  const shiftHours = -observer.lon / 15 + 3;
  return baseUtc + shiftHours * 3600 * 1000;
}

/**
 * Return upcoming meteor-shower peaks within `lookaheadDays` of `now`.
 *
 * When `observer` is supplied, `when` is shifted from midnight UTC to roughly 03:00
 * local time on the peak day and `viewAz/viewAlt` point at the radiant at that instant.
 */
export function computeMeteorShowerPeaks(
  now: Date,
  lookaheadDays: number,
  observer?: ObserverInput,
): MeteorShowerEvent[] {
  const horizon = now.getTime() + lookaheadDays * 24 * 3600 * 1000;
  const nowYear = now.getUTCFullYear();
  const events: MeteorShowerEvent[] = [];

  for (const s of METEOR_SHOWERS) {
    // Try current year first; if already past, roll forward to next year.
    let peak = meteorPeakTime(nowYear, s.peakMonth, s.peakDay, observer);
    if (peak < now.getTime()) {
      peak = meteorPeakTime(nowYear + 1, s.peakMonth, s.peakDay, observer);
    }
    if (peak > horizon) continue;

    const when = new Date(peak);
    const view =
      observer !== undefined
        ? raDecToAltAz(s.raDeg, s.decDeg, observer.lat, observer.lon, when)
        : undefined;

    events.push({
      kind: "meteor-shower-peak",
      when,
      title: `${s.name} meteor shower peak`,
      description: `Expect up to ~${s.zhr} meteors per hour at peak under dark skies.`,
      showerId: s.id,
      showerName: s.name,
      zhr: s.zhr,
      ...(view !== undefined ? { viewAz: view.az, viewAlt: view.alt } : {}),
    });
  }

  events.sort((a, b) => a.when.getTime() - b.when.getTime());
  return events;
}

// ---------- Lunar eclipses ----------

/**
 * Return lunar eclipses within `lookaheadDays` of `now`.
 *
 * When `observer` is supplied, each event carries `viewAz/viewAlt` pointing at the
 * Moon at the peak obscuration instant. Below-horizon values are preserved — the user
 * still sees "where the Moon would be" rather than a stale upward-default view.
 */
export function computeLunarEclipses(
  now: Date,
  lookaheadDays: number,
  observer?: ObserverInput,
): LunarEclipseEvent[] {
  const horizon = now.getTime() + lookaheadDays * 24 * 3600 * 1000;
  const events: LunarEclipseEvent[] = [];

  let info = SearchLunarEclipse(now);
  // Safety cap: eclipses are at most ~2/year, so < 10 iterations is plenty per year.
  for (let i = 0; i < 20; i++) {
    const t = info.peak.date.getTime();
    if (t > horizon) break;
    if (t >= now.getTime()) {
      const when = info.peak.date;
      const view = observer !== undefined ? moonAltAz(observer.lat, observer.lon, when) : undefined;
      events.push({
        kind: "lunar-eclipse",
        when,
        title: `Lunar eclipse (${info.kind})`,
        description: `${capitalize(info.kind)} lunar eclipse; peak obscuration ${(info.obscuration * 100).toFixed(0)}%.`,
        eclipseKind: info.kind as "penumbral" | "partial" | "total",
        obscuration: info.obscuration,
        ...(view !== undefined ? { viewAz: view.az, viewAlt: view.alt } : {}),
      });
    }
    info = NextLunarEclipse(info.peak);
  }

  return events;
}

function moonAltAz(lat: number, lon: number, time: Date): { alt: number; az: number } {
  const positions = computeBodyPositions(lat, lon, time, false);
  const moon = positions.find((p) => p.id === "Moon");
  // Moon is always present in BODY_CONFIGS, so this fallback is unreachable in practice.
  if (!moon) return { alt: 0, az: 0 };
  return { alt: moon.alt, az: moon.az };
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  const first = s.charAt(0);
  return first.toUpperCase() + s.slice(1);
}

// ---------- Conjunctions ----------

function angularSeparationDeg(b1: Body, b2: Body, date: Date): number {
  const v1 = GeoVector(b1, date, true);
  const v2 = GeoVector(b2, date, true);
  return AngleBetween(v1, v2);
}

/**
 * Find close approaches between all pairs of (Sun, Moon, Mercury..Saturn).
 *
 * We sample every CONJUNCTION_STEP_HOURS across the lookahead window, spot local minima
 * in angular separation that drop below CONJUNCTION_THRESHOLD_DEG, then refine with a
 * small golden-section / parabolic narrowing over the 3-sample bracket.
 *
 * When `observer` is supplied, each event carries `viewAz/viewAlt` — the angular midpoint
 * of the two bodies' horizontal positions at the peak instant. Bodies may be below the
 * horizon; the midpoint is still emitted (user sees daylight sky in that case).
 *
 * This is approximate — good for UI display, not for precision ephemerides.
 */
export function computeConjunctions(
  now: Date,
  lookaheadDays: number,
  observer?: ObserverInput,
): ConjunctionEvent[] {
  const events: ConjunctionEvent[] = [];
  const startMs = now.getTime();
  const endMs = startMs + lookaheadDays * 24 * 3600 * 1000;
  const stepMs = CONJUNCTION_STEP_HOURS * 3600 * 1000;

  for (let i = 0; i < CONJUNCTION_BODIES.length; i++) {
    const a = CONJUNCTION_BODIES[i];
    if (a === undefined) continue;
    for (let j = i + 1; j < CONJUNCTION_BODIES.length; j++) {
      const b = CONJUNCTION_BODIES[j];
      if (b === undefined) continue;

      // Precompute the separation series.
      const samples: { t: number; sep: number }[] = [];
      for (let t = startMs; t <= endMs; t += stepMs) {
        samples.push({ t, sep: angularSeparationDeg(a.body, b.body, new Date(t)) });
      }

      // Detect strict local minima that dip under the threshold.
      for (let k = 1; k < samples.length - 1; k++) {
        const prev = samples[k - 1];
        const cur = samples[k];
        const next = samples[k + 1];
        if (prev === undefined || cur === undefined || next === undefined) continue;
        if (cur.sep > CONJUNCTION_THRESHOLD_DEG) continue;
        if (cur.sep >= prev.sep || cur.sep >= next.sep) continue;

        // Refine within [prev.t, next.t] to pinpoint the minimum.
        const refined = refineMinimum(a.body, b.body, prev.t, next.t);
        const when = new Date(refined.t);
        const view =
          observer !== undefined
            ? conjunctionMidpointAltAz(a.id, b.id, observer.lat, observer.lon, when)
            : undefined;
        events.push({
          kind: "conjunction",
          when,
          title: `${a.id} – ${b.id} conjunction`,
          description: `${a.id} and ${b.id} appear within ${refined.sep.toFixed(1)}° of each other.`,
          body1: a.id,
          body2: b.id,
          separationDeg: refined.sep,
          ...(view !== undefined ? { viewAz: view.az, viewAlt: view.alt } : {}),
        });
      }
    }
  }

  events.sort((x, y) => x.when.getTime() - y.when.getTime());
  return events;
}

/**
 * Angular midpoint of two bodies' horizontal positions at `time`, for the observer's
 * location. Returns `undefined` if either body is missing from `computeBodyPositions`.
 *
 * Altitude is the arithmetic mean; azimuth uses the short-arc mean on the 0°/360° circle.
 */
function conjunctionMidpointAltAz(
  id1: string,
  id2: string,
  lat: number,
  lon: number,
  time: Date,
): { alt: number; az: number } | undefined {
  const positions = computeBodyPositions(lat, lon, time, false);
  const p1 = positions.find((p) => p.id === id1);
  const p2 = positions.find((p) => p.id === id2);
  if (!p1 || !p2) return undefined;
  const alt = (p1.alt + p2.alt) / 2;
  // Short-arc azimuth midpoint.
  let diff = p2.az - p1.az;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  const rawAz = p1.az + diff / 2;
  const az = ((rawAz % 360) + 360) % 360;
  return { alt, az };
}

/** Iterative parabolic / bisection refinement for the minimum separation in [lo, hi]. */
function refineMinimum(b1: Body, b2: Body, loMs: number, hiMs: number): { t: number; sep: number } {
  let lo = loMs;
  let hi = hiMs;
  // 20 iterations of ternary narrowing — cuts interval by ~2/3 each iter; plenty of precision.
  for (let iter = 0; iter < 20; iter++) {
    const third = (hi - lo) / 3;
    const m1 = lo + third;
    const m2 = hi - third;
    const s1 = angularSeparationDeg(b1, b2, new Date(m1));
    const s2 = angularSeparationDeg(b1, b2, new Date(m2));
    if (s1 < s2) {
      hi = m2;
    } else {
      lo = m1;
    }
  }
  const t = (lo + hi) / 2;
  const sep = angularSeparationDeg(b1, b2, new Date(t));
  return { t, sep };
}

// ---------- ISS passes ----------

const COMPASS_POINTS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

function azToCompass(azDeg: number): string {
  const idx = Math.round(((azDeg % 360) + 360) / 22.5) % 16;
  return COMPASS_POINTS[idx]!;
}

function formatLocalTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Turn an IssPass into a CelestialEvent. `when` is the peak time so Go-to jumps to
 *  the highest-altitude (easiest viewing) moment of the pass rather than to the horizon.
 *
 *  Eclipsed passes are *kept* in the list (not filtered) so the user can see a pass
 *  exists, but their title is prefixed "(shadow)" and the description notes invisibility.
 *  The UI applies reduced opacity — see ui/events-panel.ts. */
function toIssPassEvent(pass: IssPass): IssPassEvent {
  const durationSec = Math.round((pass.set.getTime() - pass.rise.getTime()) / 1000);
  const minutes = Math.max(1, Math.round(durationSec / 60));
  const peakAltInt = Math.round(pass.peak.altDeg);
  const peakCompass = azToCompass(pass.peak.azDeg);
  const setLocal = formatLocalTime(pass.set);
  const peakLocal = formatLocalTime(pass.peak.time);
  const illum = pass.peak.illumination;

  const title = illum.eclipsed
    ? `ISS pass — in Earth's shadow (${peakAltInt}° peak)`
    : `ISS pass — mag ${formatMagnitude(illum.magnitude)}, peaks at ${peakAltInt}°`;

  const visibilityNote = illum.eclipsed
    ? " Satellite is in Earth's shadow at peak — not visible."
    : "";
  const description = `Peaks ${peakAltInt}° in the ${peakCompass} at ${peakLocal} local, sets ${setLocal} (${minutes} min pass).${visibilityNote}`;

  return {
    kind: "iss-pass",
    when: pass.peak.time,
    title,
    description,
    peakAltDeg: pass.peak.altDeg,
    peakAzDeg: pass.peak.azDeg,
    durationSec,
    eclipsed: illum.eclipsed,
    magnitudeAtPeak: illum.magnitude,
  };
}

/** Format a magnitude with a leading sign and one decimal, e.g. "-1.8" or "+2.4".
 *  Never trust the third decimal of our model (see illumination.ts). */
function formatMagnitude(m: number | null): string {
  if (m === null) return "n/a";
  const sign = m >= 0 ? "+" : "";
  return `${sign}${m.toFixed(1)}`;
}

// ---------- Composition ----------

export type ObserverInput = { readonly lat: number; readonly lon: number };

const DEFAULT_LOOKAHEAD_CONJUNCTION_DAYS = 30;
const DEFAULT_LOOKAHEAD_ECLIPSE_DAYS = 365;
const DEFAULT_LOOKAHEAD_SHOWER_DAYS = 365;
const DEFAULT_LOOKAHEAD_ISS_HOURS = 48;

/**
 * Compose the upcoming events list for display.
 *
 * Computes conjunctions (30-day horizon), lunar eclipses (1-year horizon),
 * meteor-shower peaks (1-year horizon), and ISS passes (48-hour horizon, ISS record
 * only, observer required), then merges and sorts them.
 *
 * `satelliteRecords` is optional. When supplied, the ISS record (if present) contributes
 * pass events; non-ISS satellites are ignored in this scope.
 */
export function computeUpcomingEvents(
  now: Date,
  observer?: ObserverInput,
  satelliteRecords?: readonly SatelliteRecord[],
): Result<CelestialEvent[], EventsError> {
  const conjunctions = computeConjunctions(now, DEFAULT_LOOKAHEAD_CONJUNCTION_DAYS, observer);
  const eclipses = computeLunarEclipses(now, DEFAULT_LOOKAHEAD_ECLIPSE_DAYS, observer);
  const showers = computeMeteorShowerPeaks(now, DEFAULT_LOOKAHEAD_SHOWER_DAYS, observer);

  const issEvents: IssPassEvent[] = [];
  if (observer && satelliteRecords) {
    const iss = satelliteRecords.find(isIssRecord);
    if (iss) {
      const passes = computeUpcomingPasses(
        iss,
        observer.lat,
        observer.lon,
        now,
        DEFAULT_LOOKAHEAD_ISS_HOURS,
      );
      for (const p of passes) issEvents.push(toIssPassEvent(p));
    }
  }

  const merged: CelestialEvent[] = [...conjunctions, ...eclipses, ...showers, ...issEvents];
  merged.sort((a, b) => a.when.getTime() - b.when.getTime());
  return ok(merged);
}
