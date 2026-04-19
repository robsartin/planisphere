/* SPDX-License-Identifier: Apache-2.0 */

/**
 * Satellite illumination model: Earth-shadow detection and rough magnitude estimate.
 *
 * Pure module — no I/O, no Cesium. Called per-pass at the peak moment to annotate the
 * event with "eclipsed yes/no" and an approximate visual magnitude, so the UI can show
 * "brilliant / faint / in Earth's shadow" without lying about precision.
 *
 * Shadow geometry: cylindrical umbra model.
 *   - Earth is a sphere of radius R_EARTH; the umbra is approximated as an
 *     infinite cylinder along the anti-sun axis. This is slightly pessimistic
 *     (ignores that the real umbra is a cone) but good enough for LEO where the
 *     cone's tip is ~1.4e6 km down-axis (far beyond any satellite we care about).
 *   - Penumbra band is narrow (~hundreds of km at LEO) and is treated as
 *     pure-umbra vs. pure-sunlit — no partial illumination.
 *   - Atmospheric extinction / reddening at low altitude and the ~30-km
 *     "atmospheric refraction" sliver near the terminator are future work.
 *
 * Magnitude: simplified amateur-satellite-observer formula based on the "standard
 * magnitude at 1000 km, full phase" convention used by communities like Heavens-Above
 * and the tables maintained by Mike McCants. Reference: the Wikipedia article
 * "Satellite magnitude" and Marco Langbroek's Sattrackcam blog. For the ISS the
 * canonical m0 (standard magnitude at 1000 km, full phase) is around -1.8.
 *
 *     m ≈ m0 + 5·log10(range_km / 1000) − 2.5·log10(specular + diffuse·cos(phase))
 *
 * We use a simple Lambertian-only "specular+diffuse" of (cos(phase) + diffuse_term)
 * with floor 0.01, which keeps the model monotone and avoids log(0). Accuracy is
 * order-of-magnitude only. Do not render magnitude with more than one decimal digit.
 */

export type Vec3 = { readonly x: number; readonly y: number; readonly z: number };

export type IlluminationInfo = {
  readonly eclipsed: boolean;
  /** Approximate visual magnitude, or null if the satellite is in Earth's shadow. */
  readonly magnitude: number | null;
  /** Sun–satellite–observer phase angle in degrees (0 = sun behind observer, full phase). */
  readonly phaseDeg: number;
  /** Observer-to-satellite range in km. */
  readonly rangeKm: number;
};

const R_EARTH_KM = 6378;
/** ISS-like standard magnitude at 1000 km range, full phase. Empirical. */
const M0_ISS = -1.8;
/** Diffuse term to keep the brightness factor positive at 90° phase. Tuned for UI plausibility. */
const DIFFUSE_TERM = 0.1;

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function magnitudeVec(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

function normalize(a: Vec3): Vec3 {
  const m = magnitudeVec(a);
  if (m === 0) return { x: 0, y: 0, z: 0 };
  return { x: a.x / m, y: a.y / m, z: a.z / m };
}

/**
 * Decide whether `satPosEci` is in Earth's umbra (cylindrical shadow model) and
 * compute the observer's view geometry (range + phase angle) so callers can
 * estimate apparent brightness.
 *
 * All inputs share a common geocentric inertial frame and use km. We don't care
 * whether that frame is TEME, J2000, or GCRS — the differences are ~tens of
 * arcseconds, far below our modelling precision.
 */
export function computeIllumination(
  satPosEci: Vec3,
  observerPosEci: Vec3,
  sunPosEci: Vec3,
): IlluminationInfo {
  const uSun = normalize(sunPosEci);

  // Projection of satellite onto the Earth–Sun axis.
  // d = -dot(sat, uSun) : positive means the satellite is on the anti-sun side.
  const d = -dot(satPosEci, uSun);

  // Perpendicular distance from satellite to the anti-sun axis.
  const parallel = dot(satPosEci, uSun);
  const axial: Vec3 = {
    x: parallel * uSun.x,
    y: parallel * uSun.y,
    z: parallel * uSun.z,
  };
  const perp: Vec3 = sub(satPosEci, axial);
  const rPerp = magnitudeVec(perp);

  const eclipsed = d > 0 && rPerp < R_EARTH_KM;

  // Observer geometry.
  const obsToSat = sub(satPosEci, observerPosEci);
  const rangeKm = magnitudeVec(obsToSat);

  // Phase angle: angle between (sun→sat) and (observer→sat) vectors.
  const sunToSat = sub(satPosEci, sunPosEci);
  const cosPhase = dot(sunToSat, obsToSat) / (magnitudeVec(sunToSat) * magnitudeVec(obsToSat));
  const clamped = Math.max(-1, Math.min(1, cosPhase));
  const phaseDeg = Math.acos(clamped) * DEG;

  if (eclipsed) {
    return { eclipsed: true, magnitude: null, phaseDeg, rangeKm };
  }

  // Brightness factor: Lambertian-ish term with diffuse floor.
  //   phase 0° (full phase) → factor ≈ 1 + diffuse
  //   phase 90°             → factor ≈ diffuse
  //   phase 180°            → factor floors at diffuse (we clamp cos ≥ 0)
  const cosP = Math.max(0, Math.cos(phaseDeg * RAD));
  const brightness = cosP + DIFFUSE_TERM;

  const magnitude = M0_ISS + 5 * Math.log10(rangeKm / 1000) - 2.5 * Math.log10(brightness);

  return { eclipsed: false, magnitude, phaseDeg, rangeKm };
}
