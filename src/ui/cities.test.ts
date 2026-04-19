/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import rawCities from "../../data/cities.json";

describe("data/cities.json", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(rawCities)).toBe(true);
    expect(rawCities.length).toBeGreaterThanOrEqual(25);
  });

  it("each entry has name, country, lat (-90..90), lon (-180..180)", () => {
    for (const c of rawCities as readonly unknown[]) {
      expect(typeof c).toBe("object");
      expect(c).not.toBeNull();
      const entry = c as Record<string, unknown>;
      expect(typeof entry.name).toBe("string");
      expect(typeof entry.country).toBe("string");
      expect(typeof entry.lat).toBe("number");
      expect(typeof entry.lon).toBe("number");
      const lat = entry.lat as number;
      const lon = entry.lon as number;
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
      expect(lon).toBeGreaterThan(-180);
      expect(lon).toBeLessThanOrEqual(180);
    }
  });

  it("city names are unique", () => {
    const names = (rawCities as readonly { name: string }[]).map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("includes well-known anchor cities", () => {
    const names = new Set((rawCities as readonly { name: string }[]).map((c) => c.name));
    expect(names.has("London")).toBe(true);
    expect(names.has("New York")).toBe(true);
    expect(names.has("Tokyo")).toBe(true);
    expect(names.has("Sydney")).toBe(true);
  });
});
