/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import {
  easeOutCubic,
  interpolateAzAlt,
  inertiaDelta,
  clampFov,
  FOV_MIN_DEG,
  FOV_MAX_DEG,
} from "./animation-math";

describe("easeOutCubic", () => {
  it("returns 0 at t=0", () => {
    expect(easeOutCubic(0)).toBe(0);
  });

  it("returns 1 at t=1", () => {
    expect(easeOutCubic(1)).toBe(1);
  });

  it("is monotonically increasing in [0, 1]", () => {
    let prev = -Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
      const v = easeOutCubic(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("decelerates (derivative decreases) — ease-out shape", () => {
    // First delta should be larger than later delta
    const firstDelta = easeOutCubic(0.1) - easeOutCubic(0);
    const lastDelta = easeOutCubic(1) - easeOutCubic(0.9);
    expect(firstDelta).toBeGreaterThan(lastDelta);
  });

  it("clamps values below 0 to produce 0", () => {
    expect(easeOutCubic(-0.5)).toBe(0);
  });

  it("clamps values above 1 to produce 1", () => {
    expect(easeOutCubic(1.5)).toBe(1);
  });
});

describe("interpolateAzAlt", () => {
  it("returns from when t=0", () => {
    const r = interpolateAzAlt({ az: 90, alt: 30 }, { az: 270, alt: 60 }, 0);
    expect(r.az).toBeCloseTo(90, 6);
    expect(r.alt).toBeCloseTo(30, 6);
  });

  it("returns to when t=1", () => {
    const r = interpolateAzAlt({ az: 90, alt: 30 }, { az: 270, alt: 60 }, 1);
    expect(r.az).toBeCloseTo(270, 6);
    expect(r.alt).toBeCloseTo(60, 6);
  });

  it("linear midpoint for altitude", () => {
    const r = interpolateAzAlt({ az: 0, alt: 0 }, { az: 0, alt: 60 }, 0.5);
    expect(r.alt).toBeCloseTo(30, 6);
  });

  it("takes the shortest arc across the 0/360 wraparound (e.g. 350 -> 10 via +20)", () => {
    const r = interpolateAzAlt({ az: 350, alt: 45 }, { az: 10, alt: 45 }, 0.5);
    // Shortest path from 350 to 10 goes forward via 0 (delta = +20), midpoint = 0 (or 360)
    const az = r.az % 360;
    expect(Math.min(az, 360 - az)).toBeLessThan(1); // close to 0 or 360
  });

  it("takes the shortest arc the other way (e.g. 10 -> 350 via -20)", () => {
    const r = interpolateAzAlt({ az: 10, alt: 45 }, { az: 350, alt: 45 }, 0.5);
    const az = ((r.az % 360) + 360) % 360;
    expect(Math.min(az, 360 - az)).toBeLessThan(1); // close to 0 or 360
  });

  it("returns az in [0, 360)", () => {
    const r = interpolateAzAlt({ az: 350, alt: 45 }, { az: 10, alt: 45 }, 0.5);
    expect(r.az).toBeGreaterThanOrEqual(0);
    expect(r.az).toBeLessThan(360);
  });

  it("handles no azimuth change (delta zero)", () => {
    const r = interpolateAzAlt({ az: 123, alt: 45 }, { az: 123, alt: 45 }, 0.3);
    expect(r.az).toBeCloseTo(123, 6);
    expect(r.alt).toBeCloseTo(45, 6);
  });

  it("180-degree apart goes in a deterministic direction (no NaN)", () => {
    const r = interpolateAzAlt({ az: 0, alt: 30 }, { az: 180, alt: 30 }, 0.5);
    expect(Number.isFinite(r.az)).toBe(true);
    expect(Number.isFinite(r.alt)).toBe(true);
  });
});

describe("inertiaDelta", () => {
  it("returns 0 when velocity is 0", () => {
    expect(inertiaDelta(0, 100, 800)).toBe(0);
  });

  it("returns the full integrated displacement when elapsed >= decayMs", () => {
    // Integral of v0 * (1 - t/decay) over [0, decay] = v0 * decay / 2
    const velocity = 10;
    const decay = 800;
    expect(inertiaDelta(velocity, 1000, decay)).toBeCloseTo((velocity * decay) / 2, 6);
    // Subsequent times stay flat (no further motion)
    expect(inertiaDelta(velocity, 5000, decay)).toBeCloseTo((velocity * decay) / 2, 6);
  });

  it("returns positive integrated distance at start (elapsed small, velocity positive)", () => {
    const d = inertiaDelta(1, 10, 800);
    expect(d).toBeGreaterThan(0);
  });

  it("monotonically non-decreasing in elapsed time for positive velocity", () => {
    let prev = -Infinity;
    for (let e = 0; e <= 800; e += 50) {
      const d = inertiaDelta(1, e, 800);
      expect(d).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = d;
    }
  });

  it("scales linearly with initial velocity", () => {
    const d1 = inertiaDelta(1, 200, 800);
    const d2 = inertiaDelta(2, 200, 800);
    expect(d2).toBeCloseTo(d1 * 2, 6);
  });

  it("sign follows velocity sign", () => {
    expect(inertiaDelta(-1, 100, 800)).toBeLessThan(0);
  });

  it("returns 0 for nonpositive decayMs (defensive)", () => {
    expect(inertiaDelta(1, 100, 0)).toBe(0);
  });
});

describe("clampFov", () => {
  it("clamps below to FOV_MIN_DEG", () => {
    expect(clampFov(0)).toBe(FOV_MIN_DEG);
  });

  it("clamps above to FOV_MAX_DEG", () => {
    expect(clampFov(999)).toBe(FOV_MAX_DEG);
  });

  it("passes through in-range values", () => {
    expect(clampFov(45)).toBe(45);
  });

  it("treats NaN defensively (returns FOV_MIN_DEG or FOV_MAX_DEG but never NaN)", () => {
    const r = clampFov(Number.NaN);
    expect(Number.isFinite(r)).toBe(true);
  });
});
