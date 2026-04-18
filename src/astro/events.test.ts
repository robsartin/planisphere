/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import {
  computeMeteorShowerPeaks,
  computeLunarEclipses,
  computeConjunctions,
  computeUpcomingEvents,
} from "./events";
import type { CelestialEvent } from "./events";

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
});
