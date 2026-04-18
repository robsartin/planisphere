/* SPDX-License-Identifier: Apache-2.0 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPlanetInfo } from "./planet-info";
import type { CelestialBody } from "../astro/bodies";

// A small set of fake bodies for testing the UI
function makeBody(overrides: Partial<CelestialBody> & { id: string }): CelestialBody {
  const base: CelestialBody = {
    id: overrides.id,
    alt: overrides.alt ?? 45,
    az: overrides.az ?? 90,
    ra: overrides.ra ?? 180,
    dec: overrides.dec ?? 0,
    mag: overrides.mag ?? 0,
    size: overrides.size ?? 8,
    color: overrides.color ?? "#ffffff",
  };
  if (overrides.illumination !== undefined && overrides.phaseAngle !== undefined) {
    return { ...base, illumination: overrides.illumination, phaseAngle: overrides.phaseAngle };
  }
  if (overrides.illumination !== undefined) {
    return { ...base, illumination: overrides.illumination };
  }
  return base;
}

const BODIES_ABOVE: CelestialBody[] = [
  makeBody({ id: "Sun", alt: 55, az: 180 }),
  makeBody({ id: "Moon", alt: 30, az: 90, illumination: 0.75, phaseAngle: 60 }),
  makeBody({ id: "Mars", alt: 10, az: 120 }),
];

const BODIES_MIXED: CelestialBody[] = [
  makeBody({ id: "Sun", alt: 55, az: 180 }),
  makeBody({ id: "Venus", alt: -5, az: 270 }), // below horizon
  makeBody({ id: "Jupiter", alt: 20, az: 60 }),
];

const LAT = 34;
const LON = -118;
const TIME = new Date("2026-06-15T18:00:00Z");

describe("createPlanetInfo", () => {
  let element: HTMLElement;

  beforeEach(() => {
    element = createPlanetInfo(BODIES_ABOVE, LAT, LON, TIME);
  });

  it("returns an HTMLElement", () => {
    expect(element).toBeInstanceOf(HTMLElement);
  });

  it("renders a section heading", () => {
    const heading = element.querySelector("[data-testid='planet-info-heading']");
    expect(heading).not.toBeNull();
  });

  it("renders a row for each body", () => {
    const rows = element.querySelectorAll("[data-testid='planet-info-row']");
    expect(rows.length).toBe(BODIES_ABOVE.length);
  });

  it("renders the body name in each row", () => {
    const rows = element.querySelectorAll("[data-testid='planet-info-row']");
    const names = [...rows].map((r) => r.querySelector("[data-testid='planet-name']")?.textContent);
    expect(names).toContain("Sun");
    expect(names).toContain("Moon");
    expect(names).toContain("Mars");
  });

  it("renders Alt/Az for each body", () => {
    const rows = element.querySelectorAll("[data-testid='planet-info-row']");
    for (const row of rows) {
      const altaz = row.querySelector("[data-testid='planet-altaz']");
      expect(altaz).not.toBeNull();
      expect(altaz!.textContent).toMatch(/alt|az/i);
    }
  });

  it("renders rise time for each body", () => {
    const rows = element.querySelectorAll("[data-testid='planet-info-row']");
    for (const row of rows) {
      const rise = row.querySelector("[data-testid='planet-rise']");
      expect(rise).not.toBeNull();
    }
  });

  it("renders set time for each body", () => {
    const rows = element.querySelectorAll("[data-testid='planet-info-row']");
    for (const row of rows) {
      const set = row.querySelector("[data-testid='planet-set']");
      expect(set).not.toBeNull();
    }
  });

  it("shows 'below horizon' indicator for bodies with alt <= 0", () => {
    const mixedEl = createPlanetInfo(BODIES_MIXED, LAT, LON, TIME);
    const rows = mixedEl.querySelectorAll("[data-testid='planet-info-row']");
    const venusRow = [...rows].find((r) => {
      return r.querySelector("[data-testid='planet-name']")?.textContent === "Venus";
    });
    expect(venusRow).toBeDefined();
    const indicator = venusRow!.querySelector("[data-testid='planet-below-horizon']");
    expect(indicator).not.toBeNull();
  });

  it("does not show below-horizon indicator for bodies above horizon", () => {
    const rows = element.querySelectorAll("[data-testid='planet-info-row']");
    const sunRow = [...rows].find((r) => {
      return r.querySelector("[data-testid='planet-name']")?.textContent === "Sun";
    });
    expect(sunRow).toBeDefined();
    const indicator = sunRow!.querySelector("[data-testid='planet-below-horizon']");
    expect(indicator).toBeNull();
  });

  it("is collapsible — has a toggle button", () => {
    const toggle = element.querySelector("[data-testid='planet-info-toggle']");
    expect(toggle).not.toBeNull();
  });

  it("collapse toggle hides rows on click", () => {
    const toggle = element.querySelector<HTMLButtonElement>("[data-testid='planet-info-toggle']")!;
    const body = element.querySelector<HTMLElement>("[data-testid='planet-info-body']")!;
    // Initially visible
    expect(body.style.display).not.toBe("none");
    toggle.click();
    expect(body.style.display).toBe("none");
  });

  it("second toggle click re-shows rows", () => {
    const toggle = element.querySelector<HTMLButtonElement>("[data-testid='planet-info-toggle']")!;
    const body = element.querySelector<HTMLElement>("[data-testid='planet-info-body']")!;
    toggle.click();
    toggle.click();
    expect(body.style.display).not.toBe("none");
  });

  it("rise time is formatted as HH:MM", () => {
    const rows = element.querySelectorAll("[data-testid='planet-info-row']");
    const sunRow = [...rows].find((r) => {
      return r.querySelector("[data-testid='planet-name']")?.textContent === "Sun";
    });
    const riseEl = sunRow?.querySelector("[data-testid='planet-rise']");
    expect(riseEl?.textContent).toMatch(/\d{2}:\d{2}|--|n\/a/i);
  });

  it("set time is formatted as HH:MM", () => {
    const rows = element.querySelectorAll("[data-testid='planet-info-row']");
    const sunRow = [...rows].find((r) => {
      return r.querySelector("[data-testid='planet-name']")?.textContent === "Sun";
    });
    const setEl = sunRow?.querySelector("[data-testid='planet-set']");
    expect(setEl?.textContent).toMatch(/\d{2}:\d{2}|--|n\/a/i);
  });

  describe("update", () => {
    it("createPlanetInfo accepts a different body list without throwing", () => {
      expect(() => createPlanetInfo(BODIES_MIXED, LAT, LON, TIME)).not.toThrow();
    });
  });

  describe("clickable planet names (onSelect)", () => {
    it("above-horizon body name has cursor: pointer and textDecoration: underline when onSelect is provided", () => {
      const onSelect = vi.fn();
      const el = createPlanetInfo(BODIES_ABOVE, LAT, LON, TIME, onSelect);
      const rows = el.querySelectorAll("[data-testid='planet-info-row']");
      const sunRow = [...rows].find((r) => {
        return r.querySelector("[data-testid='planet-name']")?.textContent === "Sun";
      });
      expect(sunRow).toBeDefined();
      const nameEl = sunRow!.querySelector<HTMLElement>("[data-testid='planet-name']")!;
      expect(nameEl.style.cursor).toBe("pointer");
      expect(nameEl.style.textDecoration).toBe("underline");
    });

    it("clicking above-horizon name calls onSelect with correct az/alt", () => {
      const onSelect = vi.fn();
      const el = createPlanetInfo(BODIES_ABOVE, LAT, LON, TIME, onSelect);
      const rows = el.querySelectorAll("[data-testid='planet-info-row']");
      const sunRow = [...rows].find((r) => {
        return r.querySelector("[data-testid='planet-name']")?.textContent === "Sun";
      });
      const nameEl = sunRow!.querySelector<HTMLElement>("[data-testid='planet-name']")!;
      nameEl.click();
      expect(onSelect).toHaveBeenCalledOnce();
      expect(onSelect).toHaveBeenCalledWith(180, 55);
    });

    it("below-horizon body name is not clickable (no underline)", () => {
      const onSelect = vi.fn();
      const el = createPlanetInfo(BODIES_MIXED, LAT, LON, TIME, onSelect);
      const rows = el.querySelectorAll("[data-testid='planet-info-row']");
      const venusRow = [...rows].find((r) => {
        return r.querySelector("[data-testid='planet-name']")?.textContent === "Venus";
      });
      expect(venusRow).toBeDefined();
      const nameEl = venusRow!.querySelector<HTMLElement>("[data-testid='planet-name']")!;
      expect(nameEl.style.cursor).not.toBe("pointer");
      expect(nameEl.style.textDecoration).not.toBe("underline");
      nameEl.click();
      expect(onSelect).not.toHaveBeenCalled();
    });
  });
});
