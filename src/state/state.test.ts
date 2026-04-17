/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { expectOk, isErr, isOk } from "../result";
import { DEFAULT_STATE, parseStateFromSearchParams, serializeStateToSearchParams } from "./state";

describe("AppState — defaults", () => {
  it("has observer at (0, 0) and a valid timeUtc", () => {
    expect(DEFAULT_STATE.observer.lat).toBe(0);
    expect(DEFAULT_STATE.observer.lon).toBe(0);
    expect(DEFAULT_STATE.timeUtc).toBeInstanceOf(Date);
    expect(Number.isFinite(DEFAULT_STATE.timeUtc.getTime())).toBe(true);
  });
});

describe("AppState — parse from URLSearchParams", () => {
  it("returns defaults when all params are absent", () => {
    const r = parseStateFromSearchParams(new URLSearchParams());
    expect(isOk(r)).toBe(true);
    const s = expectOk(r);
    expect(s.observer.lat).toBe(DEFAULT_STATE.observer.lat);
    expect(s.observer.lon).toBe(DEFAULT_STATE.observer.lon);
  });

  it("parses valid lat/lon/t", () => {
    const params = new URLSearchParams({
      lat: "37.7749",
      lon: "-122.4194",
      t: "2026-04-15T12:00:00.000Z",
    });
    const s = expectOk(parseStateFromSearchParams(params));
    expect(s.observer.lat).toBeCloseTo(37.7749, 4);
    expect(s.observer.lon).toBeCloseTo(-122.4194, 4);
    expect(s.timeUtc.toISOString()).toBe("2026-04-15T12:00:00.000Z");
  });

  it("returns Err for out-of-range latitude", () => {
    const r = parseStateFromSearchParams(new URLSearchParams({ lat: "95" }));
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("lat-out-of-range");
  });

  it("returns Err for out-of-range longitude", () => {
    const r = parseStateFromSearchParams(new URLSearchParams({ lon: "-200" }));
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("lon-out-of-range");
  });

  it("returns Err for non-numeric latitude", () => {
    const r = parseStateFromSearchParams(new URLSearchParams({ lat: "abc" }));
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("lat-not-a-number");
  });

  it("returns Err for invalid ISO timestamp", () => {
    const r = parseStateFromSearchParams(new URLSearchParams({ t: "not-a-date" }));
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("time-invalid");
  });
});

describe("AppState — serialize", () => {
  it("round-trips a known state", () => {
    const params = new URLSearchParams({
      lat: "10",
      lon: "20",
      t: "2030-01-01T00:00:00.000Z",
    });
    const s = expectOk(parseStateFromSearchParams(params));
    const out = serializeStateToSearchParams(s);
    const s2 = expectOk(parseStateFromSearchParams(out));
    expect(s2.observer.lat).toBe(s.observer.lat);
    expect(s2.observer.lon).toBe(s.observer.lon);
    expect(s2.timeUtc.toISOString()).toBe(s.timeUtc.toISOString());
  });
});

describe("LayerVisibility — defaults", () => {
  it("all layers visible by default", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams()));
    expect(s.layers.stars).toBe(true);
    expect(s.layers.planets).toBe(true);
    expect(s.layers.satellites).toBe(true);
    expect(s.layers.constellationLines).toBe(true);
    expect(s.layers.constellationBoundaries).toBe(true);
    expect(s.layers.compass).toBe(true);
  });
});

describe("LayerVisibility — parse from URL", () => {
  it("parses subset of visible layers from 'layers' param", () => {
    const params = new URLSearchParams({ layers: "stars,planets,compass" });
    const s = expectOk(parseStateFromSearchParams(params));
    expect(s.layers.stars).toBe(true);
    expect(s.layers.planets).toBe(true);
    expect(s.layers.compass).toBe(true);
    expect(s.layers.satellites).toBe(false);
    expect(s.layers.constellationLines).toBe(false);
    expect(s.layers.constellationBoundaries).toBe(false);
  });

  it("treats 'layers' param absence as all visible", () => {
    const params = new URLSearchParams({ lat: "10", lon: "20" });
    const s = expectOk(parseStateFromSearchParams(params));
    expect(s.layers.stars).toBe(true);
    expect(s.layers.satellites).toBe(true);
  });
});

describe("LayerOpacity — defaults", () => {
  it("all opacities default to 1.0", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams()));
    expect(s.opacity.constellationLines).toBe(1.0);
    expect(s.opacity.constellationBoundaries).toBe(1.0);
    expect(s.opacity.satelliteTrails).toBe(1.0);
  });
});

describe("LayerOpacity — parse from URL", () => {
  it("parses opacity params op_cl, op_cb, op_st as 0–1 fractions", () => {
    const params = new URLSearchParams({ op_cl: "50", op_cb: "25", op_st: "75" });
    const s = expectOk(parseStateFromSearchParams(params));
    expect(s.opacity.constellationLines).toBeCloseTo(0.5);
    expect(s.opacity.constellationBoundaries).toBeCloseTo(0.25);
    expect(s.opacity.satelliteTrails).toBeCloseTo(0.75);
  });

  it("clamps opacity to [0, 1]", () => {
    const params = new URLSearchParams({ op_cl: "150", op_cb: "-10" });
    const s = expectOk(parseStateFromSearchParams(params));
    expect(s.opacity.constellationLines).toBe(1.0);
    expect(s.opacity.constellationBoundaries).toBe(0.0);
  });
});

describe("AppState — serialize round-trip with layer fields", () => {
  it("serialises and re-parses layers + opacity", () => {
    const params = new URLSearchParams({
      lat: "33",
      lon: "-117",
      t: "2026-06-01T00:00:00Z",
      layers: "stars,compass",
      op_cl: "60",
      op_cb: "30",
      op_st: "80",
    });
    const s = expectOk(parseStateFromSearchParams(params));
    const out = serializeStateToSearchParams(s);
    const s2 = expectOk(parseStateFromSearchParams(out));
    expect(s2.layers.stars).toBe(true);
    expect(s2.layers.compass).toBe(true);
    expect(s2.layers.satellites).toBe(false);
    expect(s2.opacity.constellationLines).toBeCloseTo(0.6);
    expect(s2.opacity.constellationBoundaries).toBeCloseTo(0.3);
    expect(s2.opacity.satelliteTrails).toBeCloseTo(0.8);
  });
});
