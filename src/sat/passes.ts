/* SPDX-License-Identifier: Apache-2.0 */
import { propagate, gstime, eciToEcf, ecfToLookAngles, geodeticToEcf, ecfToEci } from "satellite.js";
import type { EciVec3, Kilometer } from "satellite.js";
import { Body, Equator, GeoVector, MakeTime, Observer, Horizon } from "astronomy-engine";
import type { SatelliteRecord } from "./tle";
import { computeIllumination, type IlluminationInfo, type Vec3 } from "./illumination";

export type IssPass = {
  readonly rise: Date;
  readonly peak: {
    readonly time: Date;
    readonly altDeg: number;
    readonly azDeg: number;
    readonly illumination: IlluminationInfo;
  };
  readonly set: Date;
  readonly satName: string;
};

const DEG = 180 / Math.PI;
const STEP_SECONDS = 30;
/** 1 astronomical unit in km, per IAU 2012 definition. */
const AU_KM = 149_597_870.7;
/** Civil twilight — the sun must be at least this far below the horizon (in degrees) for
 *  a pass to be considered observable. Not full astronomical darkness; it strikes a
 *  balance between "truly dark" and "usefully catches bright ISS passes at dusk/dawn". */
const SUN_BELOW_HORIZON_DEG = -6;

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

function satAltAzDeg(
  satrec: SatelliteRecord["satrec"],
  time: Date,
  latRad: number,
  lonRad: number,
): { alt: number; az: number } | null {
  const posVel = propagate(satrec, time);
  const pos = posVel.position;
  if (!pos || !isValidVec3(pos)) return null;
  const gmst = gstime(time);
  const ecf = eciToEcf(pos, gmst);
  const observerGd = { longitude: lonRad, latitude: latRad, height: 0 as Kilometer };
  const look = ecfToLookAngles(observerGd, ecf);
  return { alt: look.elevation * DEG, az: look.azimuth * DEG };
}

function sunAltDeg(lat: number, lon: number, time: Date): number {
  const astroTime = MakeTime(time);
  const observer = new Observer(lat, lon, 0);
  const eq = Equator(Body.Sun, astroTime, observer, true, true);
  return Horizon(astroTime, observer, eq.ra, eq.dec, "normal").altitude;
}

/** Satellite ECI position (km) at `time`, or null if the propagator failed. */
function satEci(satrec: SatelliteRecord["satrec"], time: Date): Vec3 | null {
  const posVel = propagate(satrec, time);
  const p = posVel.position;
  if (!p || !isValidVec3(p)) return null;
  return { x: p.x, y: p.y, z: p.z };
}

/** Observer geocentric ECI position (km) for `lat,lon` on Earth's surface at `time`. */
function observerEci(latRad: number, lonRad: number, time: Date): Vec3 {
  const ecf = geodeticToEcf({ latitude: latRad, longitude: lonRad, height: 0 as Kilometer });
  const gmst = gstime(time);
  const eci = ecfToEci(ecf, gmst);
  return { x: eci.x, y: eci.y, z: eci.z };
}

/** Geocentric sun position (km) at `time`, J2000 equatorial. Close enough to TEME for
 *  shadow geometry (differences are ~tens of arcsec vs. Earth diameter ~0.004%). */
function sunEci(time: Date): Vec3 {
  const v = GeoVector(Body.Sun, time, true);
  return { x: v.x * AU_KM, y: v.y * AU_KM, z: v.z * AU_KM };
}

function illuminationAt(
  satrec: SatelliteRecord["satrec"],
  latRad: number,
  lonRad: number,
  time: Date,
): IlluminationInfo | null {
  const sat = satEci(satrec, time);
  if (!sat) return null;
  const obs = observerEci(latRad, lonRad, time);
  const sun = sunEci(time);
  return computeIllumination(sat, obs, sun);
}

/**
 * Is this TLE record the International Space Station?
 *
 * Celestrak publishes the ISS name as "ISS (ZARYA)". We match on the "ISS" token and the
 * legacy "ZARYA" alias defensively.
 */
export function isIssRecord(record: SatelliteRecord): boolean {
  const name = record.name.toUpperCase();
  return name.includes("ISS") || name.includes("ZARYA");
}

/**
 * Compute upcoming passes of a single satellite over an observer's horizon.
 *
 * Algorithm: step every STEP_SECONDS across the lookahead window, detect crossings where
 * satellite altitude goes 0 → positive (rise) and positive → 0 (set). Peak is the sample
 * with the highest altitude within the pass.
 *
 * Each candidate pass is then filtered: we require the sun to be at least
 * SUN_BELOW_HORIZON_DEG (civil twilight) below the horizon at the *peak* moment. Passes
 * in full daylight are thus discarded; no magnitude / Earth-shadow check on the satellite
 * itself is performed (follow-up).
 *
 * Deterministic for a fixed TLE, observer, and start time.
 */
export function computeUpcomingPasses(
  record: SatelliteRecord,
  lat: number,
  lon: number,
  now: Date,
  lookaheadHours: number,
): IssPass[] {
  const latRad = lat / DEG;
  const lonRad = lon / DEG;
  const startMs = now.getTime();
  const endMs = startMs + lookaheadHours * 3600 * 1000;
  const stepMs = STEP_SECONDS * 1000;

  type PassShell = {
    rise: Date;
    peakTime: Date;
    peakAlt: number;
    peakAz: number;
    set: Date;
  };
  const shells: PassShell[] = [];

  let prevAlt: number | null = null;
  let prevTime: Date | null = null;

  let inPass = false;
  let passRise: Date | null = null;
  let passPeakAlt = -Infinity;
  let passPeakTime: Date | null = null;
  let passPeakAz = 0;

  for (let t = startMs; t <= endMs; t += stepMs) {
    const time = new Date(t);
    const look = satAltAzDeg(record.satrec, time, latRad, lonRad);
    if (!look) {
      prevAlt = null;
      prevTime = null;
      continue;
    }

    if (prevAlt !== null && prevTime !== null) {
      // Rise: sign change from <=0 to >0
      if (prevAlt <= 0 && look.alt > 0 && !inPass) {
        // Linear interpolate between prev and current to refine the rise moment
        inPass = true;
        passRise = interpolateZeroCrossing(prevTime, prevAlt, time, look.alt);
        passPeakAlt = look.alt;
        passPeakTime = time;
        passPeakAz = look.az;
      } else if (inPass && look.alt > passPeakAlt) {
        passPeakAlt = look.alt;
        passPeakTime = time;
        passPeakAz = look.az;
      } else if (inPass && prevAlt > 0 && look.alt <= 0) {
        const setTime = interpolateZeroCrossing(prevTime, prevAlt, time, look.alt);
        if (passRise !== null && passPeakTime !== null) {
          shells.push({
            rise: passRise,
            peakTime: passPeakTime,
            peakAlt: passPeakAlt,
            peakAz: passPeakAz,
            set: setTime,
          });
        }
        inPass = false;
        passRise = null;
        passPeakAlt = -Infinity;
        passPeakTime = null;
      }
    }

    prevAlt = look.alt;
    prevTime = time;
  }

  // Filter: require it to be dark enough at peak.
  const darkShells = shells.filter(
    (s) => sunAltDeg(lat, lon, s.peakTime) < SUN_BELOW_HORIZON_DEG,
  );

  // Annotate with illumination at peak. Passes where the propagator fails at peak are
  // dropped (should effectively never happen since we already have an alt/az at that time).
  const passes: IssPass[] = [];
  for (const s of darkShells) {
    const illum = illuminationAt(record.satrec, latRad, lonRad, s.peakTime);
    if (!illum) continue;
    passes.push({
      rise: s.rise,
      peak: { time: s.peakTime, altDeg: s.peakAlt, azDeg: s.peakAz, illumination: illum },
      set: s.set,
      satName: record.name,
    });
  }

  passes.sort((a, b) => a.rise.getTime() - b.rise.getTime());
  return passes;
}

/** Given two samples straddling alt = 0, linearly interpolate the crossing time. */
function interpolateZeroCrossing(t0: Date, a0: number, t1: Date, a1: number): Date {
  if (a1 === a0) return t1;
  const frac = -a0 / (a1 - a0);
  const clamped = Math.max(0, Math.min(1, frac));
  return new Date(t0.getTime() + clamped * (t1.getTime() - t0.getTime()));
}
