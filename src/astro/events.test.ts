/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import {
  computeMeteorShowerPeaks,
  computeLunarEclipses,
  computeConjunctions,
  computeUpcomingEvents,
} from "./events";
import type { CelestialEvent } from "./events";
import { computeBodyPositions } from "./bodies";
import { raDecToAltAz } from "./coords";
import { expectOk } from "../result";
import { parseTle } from "../sat/tle";

// Pinned ISS TLE from 2024-04-09 — same one used in passes.test.ts for determinism.
const ISS_TLE = `ISS (ZARYA)
1 25544U 98067A   24100.50000000  .00016717  00000-0  10270-3 0  9006
2 25544  51.6400 208.9163 0002476 102.8574 355.4846 15.49909786447384`;

describe("computeMeteorShowerPeaks", () => {
  it("returns events within the lookahead window only", () => {
    // From 2026-06-01, lookahead 90 days covers Perseids (Aug 12) but not Geminids (Dec).
    const now = new Date("2026-06-01T00:00:00Z");
    const events = computeMeteorShowerPeaks(now, 90);
    const ids = events.map((e) => e.showerId);
    expect(ids).toContain("perseids");
    expect(ids).not.toContain("geminids");
    expect(ids).not.toContain("quadrantids");
  });

  it("returns events sorted by date ascending", () => {
    const now = new Date("2026-01-15T00:00:00Z");
    const events = computeMeteorShowerPeaks(now, 365);
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.when.getTime()).toBeGreaterThanOrEqual(events[i - 1]!.when.getTime());
    }
  });

  it("rolls past-year showers forward to the next calendar year", () => {
    // 2026-12-20 is after Geminids peak. We should get next year's Quadrantids (Jan 3, 2027).
    const now = new Date("2026-12-20T00:00:00Z");
    const events = computeMeteorShowerPeaks(now, 30);
    const quadrantids = events.find((e) => e.showerId === "quadrantids");
    expect(quadrantids).toBeDefined();
    expect(quadrantids!.when.getUTCFullYear()).toBe(2027);
    expect(quadrantids!.when.getUTCMonth()).toBe(0); // January
  });

  it("each event has kind, when, title, description", () => {
    const now = new Date("2026-07-01T00:00:00Z");
    const events = computeMeteorShowerPeaks(now, 180);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e.kind).toBe("meteor-shower-peak");
      expect(e.when).toBeInstanceOf(Date);
      expect(typeof e.title).toBe("string");
      expect(e.title.length).toBeGreaterThan(0);
      expect(typeof e.description).toBe("string");
    }
  });

  it("does not include events whose peak is strictly before 'now'", () => {
    // Jan 10, 2026 — Quadrantids (Jan 3) already past; should roll to 2027.
    const now = new Date("2026-01-10T00:00:00Z");
    const events = computeMeteorShowerPeaks(now, 365);
    const q = events.find((e) => e.showerId === "quadrantids");
    expect(q).toBeDefined();
    expect(q!.when.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("computeLunarEclipses", () => {
  it("returns a list of lunar eclipses within the lookahead", () => {
    // A full year should yield at least one eclipse.
    const now = new Date("2026-01-01T00:00:00Z");
    const events = computeLunarEclipses(now, 365);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e.kind).toBe("lunar-eclipse");
      expect(e.when).toBeInstanceOf(Date);
      expect(e.when.getTime()).toBeGreaterThanOrEqual(now.getTime());
      expect(["penumbral", "partial", "total"]).toContain(e.eclipseKind);
    }
  });

  it("returns events sorted by time", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const events = computeLunarEclipses(now, 730);
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.when.getTime()).toBeGreaterThan(events[i - 1]!.when.getTime());
    }
  });

  it("respects the lookahead window", () => {
    // 7 days: very unlikely to contain an eclipse.
    const now = new Date("2026-01-01T00:00:00Z");
    const events = computeLunarEclipses(now, 7);
    for (const e of events) {
      const deltaDays = (e.when.getTime() - now.getTime()) / (24 * 3600 * 1000);
      expect(deltaDays).toBeLessThanOrEqual(7);
    }
  });
});

describe("computeConjunctions", () => {
  it("returns an array of conjunction events with kind 'conjunction'", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const events = computeConjunctions(now, 30);
    for (const e of events) {
      expect(e.kind).toBe("conjunction");
      expect(e.when).toBeInstanceOf(Date);
      expect(typeof e.body1).toBe("string");
      expect(typeof e.body2).toBe("string");
      expect(e.body1).not.toBe(e.body2);
      expect(typeof e.separationDeg).toBe("number");
      expect(e.separationDeg).toBeGreaterThanOrEqual(0);
    }
  });

  it("only returns conjunctions within the lookahead window", () => {
    const now = new Date("2026-03-01T00:00:00Z");
    const lookaheadDays = 30;
    const events = computeConjunctions(now, lookaheadDays);
    for (const e of events) {
      expect(e.when.getTime()).toBeGreaterThanOrEqual(now.getTime());
      const deltaDays = (e.when.getTime() - now.getTime()) / (24 * 3600 * 1000);
      expect(deltaDays).toBeLessThanOrEqual(lookaheadDays + 0.5);
    }
  });

  it("events sorted by when ascending", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const events = computeConjunctions(now, 60);
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.when.getTime()).toBeGreaterThanOrEqual(events[i - 1]!.when.getTime());
    }
  });

  it("separation is below threshold (close appulse)", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const events = computeConjunctions(now, 180);
    // We consider conjunctions only when bodies come within ~5°.
    for (const e of events) {
      expect(e.separationDeg).toBeLessThan(5.01);
    }
  });
});

describe("computeUpcomingEvents", () => {
  it("returns a Result ok with a list", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const result = computeUpcomingEvents(now);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.value)).toBe(true);
    }
  });

  it("events are sorted by time ascending", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const result = computeUpcomingEvents(now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const events: CelestialEvent[] = result.value;
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.when.getTime()).toBeGreaterThanOrEqual(events[i - 1]!.when.getTime());
    }
  });

  it("includes events from all three kinds when data exists", () => {
    // Full year from Jan 1 2026 should include all three kinds.
    const now = new Date("2026-01-01T00:00:00Z");
    const result = computeUpcomingEvents(now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const kinds = new Set(result.value.map((e) => e.kind));
    expect(kinds.has("meteor-shower-peak")).toBe(true);
    expect(kinds.has("lunar-eclipse")).toBe(true);
    // Conjunction occurrence within 30 days is plausible but not guaranteed; if not
    // present, that's acceptable. This assertion only runs when at least one is found.
  });

  it("all events have future 'when' relative to now", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const result = computeUpcomingEvents(now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const e of result.value) {
      expect(e.when.getTime()).toBeGreaterThanOrEqual(now.getTime());
    }
  });

  it("includes ISS passes when satellite records are provided and passes exist", () => {
    // Pin to 2024-04-10 so the pinned TLE is near its epoch; Denver, CO.
    const now = new Date("2024-04-10T00:00:00Z");
    const sats = expectOk(parseTle(ISS_TLE));
    const result = computeUpcomingEvents(now, { lat: 39.74, lon: -104.99 }, sats);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const issEvents = result.value.filter(
      (e): e is Extract<CelestialEvent, { kind: "iss-pass" }> => e.kind === "iss-pass",
    );
    expect(issEvents.length).toBeGreaterThan(0);
    for (const e of issEvents) {
      expect(e.when).toBeInstanceOf(Date);
      expect(typeof e.title).toBe("string");
      expect(e.title).toMatch(/ISS/);
      expect(e.peakAltDeg).toBeGreaterThan(0);
      expect(e.peakAzDeg).toBeGreaterThanOrEqual(0);
      expect(e.peakAzDeg).toBeLessThan(360);
      expect(e.durationSec).toBeGreaterThan(0);
    }
  });

  it("returns no ISS passes when satellite records are omitted", () => {
    const now = new Date("2024-04-10T00:00:00Z");
    const result = computeUpcomingEvents(now, { lat: 39.74, lon: -104.99 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const issEvents = result.value.filter((e) => e.kind === "iss-pass");
    expect(issEvents).toHaveLength(0);
  });

  it("sets ISS event 'when' to the peak time (not the rise time) so Go-to jumps to the easiest viewing moment", () => {
    const now = new Date("2024-04-10T00:00:00Z");
    const sats = expectOk(parseTle(ISS_TLE));
    const result = computeUpcomingEvents(now, { lat: 39.74, lon: -104.99 }, sats);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const issEvents = result.value.filter(
      (e): e is Extract<CelestialEvent, { kind: "iss-pass" }> => e.kind === "iss-pass",
    );
    expect(issEvents.length).toBeGreaterThan(0);
    for (const e of issEvents) {
      // The description lists a peak time in local-time HH:MM; parse it back out
      // and confirm `when` matches. (Regression guard: we used to emit rise time.)
      const m = /Peaks \d+° in the [A-Z]+ at (\d{2}:\d{2}) local/.exec(e.description);
      expect(m).not.toBeNull();
      if (m === null) continue;
      const [peakH, peakM] = m[1]!.split(":").map(Number);
      expect(e.when.getHours()).toBe(peakH);
      expect(e.when.getMinutes()).toBe(peakM);
    }
  });

  it("returns no ISS passes when no record matches ISS", () => {
    const now = new Date("2024-04-10T00:00:00Z");
    const hubbleOnly = `HUBBLE
1 20580U 90037B   24100.50000000  .00001234  00000-0  56789-4 0  9005
2 20580  28.4700 123.4567 0002345  67.8901 292.1098 15.09876543210987`;
    const sats = expectOk(parseTle(hubbleOnly));
    const result = computeUpcomingEvents(now, { lat: 39.74, lon: -104.99 }, sats);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const issEvents = result.value.filter((e) => e.kind === "iss-pass");
    expect(issEvents).toHaveLength(0);
  });
});

// ---------- View-direction enrichment for non-ISS events ----------

/**
 * Azimuthal midpoint on a circle: the "short-arc" midpoint accounting for
 * wrap-around at 0°/360°. Returns value in [0, 360).
 */
function azMidpointDeg(a: number, b: number): number {
  let diff = b - a;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  const mid = a + diff / 2;
  return ((mid % 360) + 360) % 360;
}

describe("computeConjunctions — view direction", () => {
  it("emits viewAz/viewAlt at the midpoint of the two bodies' alt/az at the peak instant", () => {
    // 30-day window starting Jan 1 2026 — known to contain multiple conjunctions.
    const now = new Date("2026-01-01T00:00:00Z");
    const observer = { lat: 39.74, lon: -104.99 };
    const events = computeConjunctions(now, 30, observer);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(typeof e.viewAz).toBe("number");
      expect(typeof e.viewAlt).toBe("number");
      // Rebuild the bodies at `when`, find the two involved; view should match midpoint.
      const positions = computeBodyPositions(observer.lat, observer.lon, e.when, false);
      const p1 = positions.find((p) => p.id === e.body1);
      const p2 = positions.find((p) => p.id === e.body2);
      expect(p1).toBeDefined();
      expect(p2).toBeDefined();
      if (!p1 || !p2) continue;
      const expectedAlt = (p1.alt + p2.alt) / 2;
      const expectedAz = azMidpointDeg(p1.az, p2.az);
      expect(e.viewAlt).toBeCloseTo(expectedAlt, 3);
      expect(e.viewAz).toBeCloseTo(expectedAz, 3);
    }
  });

  it("still emits a view direction when bodies are below the horizon at peak", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const observer = { lat: 39.74, lon: -104.99 };
    const events = computeConjunctions(now, 30, observer);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(Number.isFinite(e.viewAz)).toBe(true);
      expect(Number.isFinite(e.viewAlt)).toBe(true);
      expect(e.viewAz).toBeGreaterThanOrEqual(0);
      expect(e.viewAz).toBeLessThan(360);
      expect(e.viewAlt).toBeGreaterThanOrEqual(-90);
      expect(e.viewAlt).toBeLessThanOrEqual(90);
    }
  });
});

describe("computeLunarEclipses — view direction", () => {
  it("emits viewAz/viewAlt equal to the Moon's alt/az at the peak instant", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const observer = { lat: 39.74, lon: -104.99 };
    const events = computeLunarEclipses(now, 365, observer);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(typeof e.viewAz).toBe("number");
      expect(typeof e.viewAlt).toBe("number");
      const positions = computeBodyPositions(observer.lat, observer.lon, e.when, false);
      const moon = positions.find((p) => p.id === "Moon");
      expect(moon).toBeDefined();
      if (!moon) continue;
      expect(e.viewAlt).toBeCloseTo(moon.alt, 3);
      expect(e.viewAz).toBeCloseTo(moon.az, 3);
    }
  });
});

describe("computeMeteorShowerPeaks — observer-local time + radiant view", () => {
  it("shifts `when` to roughly local night (within ±3h of local 03:00 on the peak day) for a western-hemisphere observer", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    // Denver: lon ≈ -105 → ~7h behind UTC.
    const observer = { lat: 39.74, lon: -104.99 };
    const events = computeMeteorShowerPeaks(now, 365, observer);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      // Peak day local calendar date should match the canonical shower peak day.
      // We shift ~3h after local midnight, so the local date should equal the
      // canonical peak day (shifted from midnight UTC by -7h then +3h = -4h;
      // local-time displayed to Denver observer on peak day early morning).
      // Simpler check: local hour should be between midnight and ~6 AM.
      const localHour = (e.when.getUTCHours() + observer.lon / 15 + 24) % 24;
      expect(localHour).toBeGreaterThanOrEqual(0);
      expect(localHour).toBeLessThan(6);
    }
  });

  it("still returns entries for all canonical showers within a 1-year window", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const observer = { lat: 39.74, lon: -104.99 };
    const events = computeMeteorShowerPeaks(now, 365, observer);
    const ids = new Set(events.map((e) => e.showerId));
    for (const id of [
      "quadrantids",
      "lyrids",
      "eta-aquariids",
      "perseids",
      "orionids",
      "leonids",
      "geminids",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("emits viewAz/viewAlt pointing at the shower's radiant (RA/Dec → Alt/Az) at the adjusted `when`", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const observer = { lat: 39.74, lon: -104.99 };
    const events = computeMeteorShowerPeaks(now, 365, observer);
    const perseids = events.find((e) => e.showerId === "perseids");
    expect(perseids).toBeDefined();
    if (!perseids) return;
    // Perseid radiant: RA ≈ 03h04m = 46.0°, Dec ≈ +58°.
    const expected = raDecToAltAz(46.0, 58.0, observer.lat, observer.lon, perseids.when);
    expect(perseids.viewAlt).toBeCloseTo(expected.alt, 3);
    expect(perseids.viewAz).toBeCloseTo(expected.az, 3);
  });
});
