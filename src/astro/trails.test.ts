/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { computeBodyTrail } from "./trails";

describe("computeBodyTrail", () => {
  it("returns a non-empty array of alt/az points for a known body", () => {
    const result = computeBodyTrail("Sun", 33, -117, new Date("2026-06-15T12:00:00Z"), 4, 5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.length).toBeGreaterThan(0);
    for (const pt of result.value) {
      expect(pt).toHaveProperty("alt");
      expect(pt).toHaveProperty("az");
      expect(Number.isFinite(pt.alt)).toBe(true);
      expect(Number.isFinite(pt.az)).toBe(true);
    }
  });

  it("returns err for an unknown body id", () => {
    const result = computeBodyTrail("Pluto", 33, -117, new Date("2026-06-15T12:00:00Z"), 4, 5);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("unknown-body");
  });

  it("returns N+1 points over N durationHours at 60-minute step", () => {
    // 4 hours, 60-min step => 0, 1, 2, 3, 4 = 5 points
    const result = computeBodyTrail("Sun", 33, -117, new Date("2026-06-15T12:00:00Z"), 4, 60);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(5);
  });

  it("Sun trail moves westward across the sky during daytime", () => {
    // At local noon on summer solstice lat 33 lon -117, Sun is high and moving W.
    // Local noon for lon=-117 is ~19:00 UTC.
    const result = computeBodyTrail("Sun", 33, -117, new Date("2026-06-15T19:00:00Z"), 2, 30);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const pts = result.value;
    // Azimuth should advance monotonically (S -> W is increasing az from 180 -> 270)
    // Pick first and last, check last azimuth is greater than first.
    expect(pts[pts.length - 1]!.az).toBeGreaterThan(pts[0]!.az);
  });

  it("is deterministic for same inputs", () => {
    const a = computeBodyTrail("Jupiter", 40, -74, new Date("2026-03-15T22:00:00Z"), 3, 15);
    const b = computeBodyTrail("Jupiter", 40, -74, new Date("2026-03-15T22:00:00Z"), 3, 15);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.value).toEqual(b.value);
  });

  it("rejects zero or negative durationHours", () => {
    const r = computeBodyTrail("Sun", 33, -117, new Date("2026-06-15T12:00:00Z"), 0, 5);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe("invalid-duration");
  });

  it("rejects zero or negative stepMinutes", () => {
    const r = computeBodyTrail("Sun", 33, -117, new Date("2026-06-15T12:00:00Z"), 4, 0);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe("invalid-step");
  });
});
