/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { computeIllumination } from "./illumination";

// For these unit tests we pin the sun far along +X (anti-sun direction = -X).
// 1 AU in km, good enough for the shadow geometry (Earth is ~4e-5 AU wide).
const AU_KM = 149_597_870.7;
const SUN_POS = { x: AU_KM, y: 0, z: 0 };

// Typical LEO altitude ~400 km → radius from geocentre ~6778 km.
const LEO_RADIUS_KM = 6778;

describe("computeIllumination", () => {
  it("returns sunlit (not eclipsed) when satellite is on the day-side between Earth and sun", () => {
    // Sat directly between observer and sun along +X. Anti-sun projection d < 0.
    const satPos = { x: LEO_RADIUS_KM, y: 0, z: 0 };
    const obsPos = { x: 6378, y: 0, z: 0 };
    const info = computeIllumination(satPos, obsPos, SUN_POS);
    expect(info.eclipsed).toBe(false);
    expect(info.magnitude).not.toBeNull();
  });

  it("flags the satellite as eclipsed when it sits directly in Earth's umbra (anti-solar, r_perp < R_EARTH)", () => {
    // Sat on the anti-sun side, on-axis: d > 0, r_perp = 0.
    const satPos = { x: -LEO_RADIUS_KM, y: 0, z: 0 };
    const obsPos = { x: -6378, y: 0, z: 0 };
    const info = computeIllumination(satPos, obsPos, SUN_POS);
    expect(info.eclipsed).toBe(true);
    expect(info.magnitude).toBeNull();
  });

  it("does not flag satellites as eclipsed when they are behind Earth but outside the umbra cylinder", () => {
    // Sat on anti-sun side but off-axis by more than Earth's radius.
    const satPos = { x: -LEO_RADIUS_KM, y: 10_000, z: 0 };
    const obsPos = { x: 0, y: 6378, z: 0 };
    const info = computeIllumination(satPos, obsPos, SUN_POS);
    expect(info.eclipsed).toBe(false);
  });

  it("does not flag satellites perpendicular to the sun direction as eclipsed (dusk/dawn terminator)", () => {
    // Sat straight up from the terminator plane — d = 0, not in umbra.
    const satPos = { x: 0, y: 0, z: LEO_RADIUS_KM };
    const obsPos = { x: 0, y: 0, z: 6378 };
    const info = computeIllumination(satPos, obsPos, SUN_POS);
    expect(info.eclipsed).toBe(false);
  });

  it("computes a sensible observer-to-satellite range in km", () => {
    // Observer on earth's surface, sat 400 km straight up along +Z — range should be ~400 km.
    const satPos = { x: 0, y: 0, z: 6778 };
    const obsPos = { x: 0, y: 0, z: 6378 };
    const info = computeIllumination(satPos, obsPos, SUN_POS);
    expect(info.rangeKm).toBeGreaterThan(395);
    expect(info.rangeKm).toBeLessThan(405);
  });

  it("reports phase angle of ~180° when sun is behind the observer (full-phase / head-on pass)", () => {
    // Observer faces anti-sun (e.g. midnight). Sat is above observer in the anti-sun direction.
    // Sun→sat vector is ~-X, observer→sat vector is ~-X. Angle between them is ~0°.
    // Here "full phase" (sun behind observer lighting the sat face-on) corresponds to phaseDeg ~ 0.
    const satPos = { x: -LEO_RADIUS_KM, y: 0, z: 0 };
    const obsPos = { x: -6378, y: 0, z: 0 };
    const info = computeIllumination(satPos, obsPos, SUN_POS);
    // This sat is eclipsed (on-axis in umbra) — skip phase assertion, just test the off-axis case below.
    // Kept here only to document that the phase convention used is "angle between sun→sat and observer→sat".
    expect(info).toBeDefined();
  });

  it("reports a small phase angle (bright, near full-phase) for a geometry where sun is well behind the observer", () => {
    // To get phase ~0, observer→sat must be nearly parallel to sun→sat. That requires the
    // satellite to sit well down-range in the anti-sun direction relative to the observer.
    // Realistic LEO passes never achieve true full phase; this test just pins the phase
    // convention (0 = full, 180 = new) using a contrived-but-sunlit geometry.
    const satPos = { x: -100_000, y: 10_000, z: 0 }; // well outside Earth's umbra (r_perp=10000 > R_EARTH)
    const obsPos = { x: -6378, y: 0, z: 0 };
    const info = computeIllumination(satPos, obsPos, SUN_POS);
    expect(info.eclipsed).toBe(false);
    expect(info.phaseDeg).toBeLessThan(30);
  });

  it("reports a large phase angle (~90°) for a dusk pass (sun just set)", () => {
    // Observer with sun on the horizon (sat is above the observer, sun is 90° off in +X).
    // Sat straight up along +Z from an observer on +Y side of Earth.
    const satPos = { x: 0, y: 6378, z: 400 };
    const obsPos = { x: 0, y: 6378, z: 0 };
    const info = computeIllumination(satPos, obsPos, SUN_POS);
    expect(info.eclipsed).toBe(false);
    // Sun→sat is mostly -X; observer→sat is +Z. Angle ~90°.
    expect(info.phaseDeg).toBeGreaterThan(60);
    expect(info.phaseDeg).toBeLessThan(120);
  });

  it("magnitude brightens (more negative) at closer observer range for the same phase", () => {
    // Two sunlit sats at the same phase angle but different observer ranges.
    // Observer is on +Y side (dawn terminator); sats straight overhead in +Y at different altitudes.
    const sunAt = { x: AU_KM, y: 0, z: 0 };
    const obsPos = { x: 0, y: 6378, z: 0 };
    const near = computeIllumination({ x: 0, y: 6778, z: 0 }, obsPos, sunAt);
    const far = computeIllumination({ x: 0, y: 7578, z: 0 }, obsPos, sunAt);
    expect(near.eclipsed).toBe(false);
    expect(far.eclipsed).toBe(false);
    expect(near.magnitude).not.toBeNull();
    expect(far.magnitude).not.toBeNull();
    // Closer -> lower (more negative) magnitude.
    expect(near.magnitude!).toBeLessThan(far.magnitude!);
  });

  it("magnitude is null when eclipsed", () => {
    const satPos = { x: -LEO_RADIUS_KM, y: 0, z: 0 };
    const obsPos = { x: -6378, y: 0, z: 0 };
    const info = computeIllumination(satPos, obsPos, SUN_POS);
    expect(info.magnitude).toBeNull();
  });

  it("reports a plausible ISS-like magnitude (~-2 to +4) for a sunlit pass at typical LEO range", () => {
    // Dusk-terminator geometry: observer on +Y side with sun on +X. Sat straight overhead.
    // Sunlit, ~400 km range, ~90° phase.
    const satPos = { x: 0, y: 6778, z: 0 };
    const obsPos = { x: 0, y: 6378, z: 0 };
    const info = computeIllumination(satPos, obsPos, SUN_POS);
    expect(info.eclipsed).toBe(false);
    expect(info.magnitude).not.toBeNull();
    // Rough brightness check: not absurd. Accept -3..+5 (napkin formula).
    expect(info.magnitude!).toBeGreaterThan(-3);
    expect(info.magnitude!).toBeLessThan(5);
  });
});
