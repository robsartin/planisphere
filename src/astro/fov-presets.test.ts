/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { FOV_PRESETS, getFovDegrees, isFovPresetId, parseFovPreset } from "./fov-presets";

describe("FOV_PRESETS table", () => {
  it("contains off, naked-eye, binoculars, small-scope, large-scope", () => {
    const ids = FOV_PRESETS.map((p) => p.id);
    expect(ids).toContain("off");
    expect(ids).toContain("naked-eye");
    expect(ids).toContain("binoculars");
    expect(ids).toContain("small-scope");
    expect(ids).toContain("large-scope");
  });

  it("naked-eye is 5 degrees", () => {
    const p = FOV_PRESETS.find((x) => x.id === "naked-eye");
    expect(p?.degrees).toBe(5);
  });

  it("binoculars is 7 degrees", () => {
    const p = FOV_PRESETS.find((x) => x.id === "binoculars");
    expect(p?.degrees).toBe(7);
  });

  it("small-scope is 1 degree", () => {
    const p = FOV_PRESETS.find((x) => x.id === "small-scope");
    expect(p?.degrees).toBe(1);
  });

  it("large-scope is 0.5 degrees", () => {
    const p = FOV_PRESETS.find((x) => x.id === "large-scope");
    expect(p?.degrees).toBe(0.5);
  });

  it("off has 0 degrees (no reticle)", () => {
    const p = FOV_PRESETS.find((x) => x.id === "off");
    expect(p?.degrees).toBe(0);
  });

  it("every preset has a human-readable label", () => {
    for (const p of FOV_PRESETS) {
      expect(typeof p.label).toBe("string");
      expect(p.label.length).toBeGreaterThan(0);
    }
  });
});

describe("isFovPresetId", () => {
  it("returns true for known preset ids", () => {
    expect(isFovPresetId("off")).toBe(true);
    expect(isFovPresetId("naked-eye")).toBe(true);
    expect(isFovPresetId("binoculars")).toBe(true);
    expect(isFovPresetId("small-scope")).toBe(true);
    expect(isFovPresetId("large-scope")).toBe(true);
  });

  it("returns false for unknown ids", () => {
    expect(isFovPresetId("unknown")).toBe(false);
    expect(isFovPresetId("")).toBe(false);
    expect(isFovPresetId("NAKED-EYE")).toBe(false);
  });
});

describe("parseFovPreset", () => {
  it("returns the id if valid", () => {
    expect(parseFovPreset("binoculars")).toBe("binoculars");
  });

  it("returns 'off' for null, undefined, or unknown values", () => {
    expect(parseFovPreset(null)).toBe("off");
    expect(parseFovPreset(undefined)).toBe("off");
    expect(parseFovPreset("garbage")).toBe("off");
  });
});

describe("getFovDegrees", () => {
  it("returns the degree value for each preset", () => {
    expect(getFovDegrees("off")).toBe(0);
    expect(getFovDegrees("naked-eye")).toBe(5);
    expect(getFovDegrees("binoculars")).toBe(7);
    expect(getFovDegrees("small-scope")).toBe(1);
    expect(getFovDegrees("large-scope")).toBe(0.5);
  });
});
