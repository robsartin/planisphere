/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTonightDrawer } from "./tonight-drawer";
import type { CelestialBody } from "../astro/bodies";

function makeBody(overrides: Partial<CelestialBody> & { id: string }): CelestialBody {
  return {
    id: overrides.id,
    alt: overrides.alt ?? 45,
    az: overrides.az ?? 90,
    ra: overrides.ra ?? 180,
    dec: overrides.dec ?? 0,
    mag: overrides.mag ?? 0,
    size: overrides.size ?? 8,
    color: overrides.color ?? "#ffffff",
  };
}

const BODIES_ABOVE: CelestialBody[] = [
  makeBody({ id: "Sun", alt: 55, az: 180 }),
  makeBody({ id: "Moon", alt: 30, az: 90 }),
  makeBody({ id: "Mars", alt: 10, az: 120 }),
];

const BODIES_MIXED: CelestialBody[] = [
  makeBody({ id: "Sun", alt: 55, az: 180 }),
  makeBody({ id: "Venus", alt: -5, az: 270 }),
  makeBody({ id: "Jupiter", alt: 20, az: 60 }),
];

const LAT = 34;
const LON = -118;
const TIME = new Date("2026-06-15T18:00:00Z");

describe("createTonightDrawer", () => {
  afterEach(() => {
    document.querySelectorAll("[data-testid='tonight-drawer']").forEach((el) => el.remove());
  });

  it("returns an object with element, open, close, isOpen, setBodies", () => {
    const drawer = createTonightDrawer({ dispatch: vi.fn() });
    expect(drawer).toHaveProperty("element");
    expect(typeof drawer.open).toBe("function");
    expect(typeof drawer.close).toBe("function");
    expect(typeof drawer.isOpen).toBe("function");
    expect(typeof drawer.setBodies).toBe("function");
  });

  it("is closed by default (element hidden)", () => {
    const drawer = createTonightDrawer({ dispatch: vi.fn() });
    expect(drawer.isOpen()).toBe(false);
    expect(drawer.element.style.display).toBe("none");
  });

  it("open() shows the drawer and isOpen() returns true", () => {
    const drawer = createTonightDrawer({ dispatch: vi.fn() });
    drawer.open();
    expect(drawer.isOpen()).toBe(true);
    expect(drawer.element.style.display).not.toBe("none");
  });

  it("close() hides the drawer and isOpen() returns false", () => {
    const drawer = createTonightDrawer({ dispatch: vi.fn() });
    drawer.open();
    drawer.close();
    expect(drawer.isOpen()).toBe(false);
    expect(drawer.element.style.display).toBe("none");
  });

  it("renders a 'Tonight's sky' title in the drawer header", () => {
    const drawer = createTonightDrawer({ dispatch: vi.fn() });
    const title = drawer.element.querySelector("[data-testid='tonight-drawer-title']");
    expect(title).not.toBeNull();
    expect(title!.textContent).toMatch(/tonight/i);
  });

  it("setBodies renders a planet-info row per body", () => {
    const drawer = createTonightDrawer({ dispatch: vi.fn() });
    drawer.setBodies(BODIES_ABOVE, LAT, LON, TIME, null);
    const rows = drawer.element.querySelectorAll("[data-testid='planet-info-row']");
    expect(rows.length).toBe(BODIES_ABOVE.length);
  });

  it("setBodies re-renders when called with a new body list", () => {
    const drawer = createTonightDrawer({ dispatch: vi.fn() });
    drawer.setBodies(BODIES_ABOVE, LAT, LON, TIME, null);
    expect(drawer.element.querySelectorAll("[data-testid='planet-info-row']").length).toBe(
      BODIES_ABOVE.length,
    );
    drawer.setBodies(BODIES_MIXED, LAT, LON, TIME, null);
    expect(drawer.element.querySelectorAll("[data-testid='planet-info-row']").length).toBe(
      BODIES_MIXED.length,
    );
  });

  it("close button (×) closes the drawer", () => {
    const drawer = createTonightDrawer({ dispatch: vi.fn() });
    drawer.open();
    const closeBtn = drawer.element.querySelector<HTMLButtonElement>(
      "[data-testid='tonight-drawer-close']",
    );
    expect(closeBtn).not.toBeNull();
    closeBtn!.click();
    expect(drawer.isOpen()).toBe(false);
  });

  it("pressing Escape while open closes the drawer", () => {
    const drawer = createTonightDrawer({ dispatch: vi.fn() });
    document.body.appendChild(drawer.element);
    drawer.open();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(drawer.isOpen()).toBe(false);
  });

  it("pressing Escape while closed is a no-op", () => {
    const drawer = createTonightDrawer({ dispatch: vi.fn() });
    document.body.appendChild(drawer.element);
    expect(() =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    ).not.toThrow();
    expect(drawer.isOpen()).toBe(false);
  });

  it("clicking the backdrop closes the drawer", () => {
    const drawer = createTonightDrawer({ dispatch: vi.fn() });
    drawer.open();
    const backdrop = drawer.element.querySelector<HTMLElement>(
      "[data-testid='tonight-drawer-backdrop']",
    );
    expect(backdrop).not.toBeNull();
    backdrop!.click();
    expect(drawer.isOpen()).toBe(false);
  });

  it("clicking an above-horizon body name dispatches set-view", () => {
    const dispatch = vi.fn();
    const drawer = createTonightDrawer({ dispatch });
    drawer.setBodies(BODIES_ABOVE, LAT, LON, TIME, null);
    const rows = drawer.element.querySelectorAll("[data-testid='planet-info-row']");
    const sunRow = [...rows].find(
      (r) => r.querySelector("[data-testid='planet-name']")?.textContent === "Sun",
    )!;
    const nameEl = sunRow.querySelector<HTMLElement>("[data-testid='planet-name']")!;
    nameEl.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "set-view", az: 180, alt: 55 });
  });

  it("clicking 'Show path' dispatches show-trail with the body id", () => {
    const dispatch = vi.fn();
    const drawer = createTonightDrawer({ dispatch });
    drawer.setBodies(BODIES_ABOVE, LAT, LON, TIME, null);
    const rows = drawer.element.querySelectorAll("[data-testid='planet-info-row']");
    const marsRow = [...rows].find(
      (r) => r.querySelector("[data-testid='planet-name']")?.textContent === "Mars",
    )!;
    const btn = marsRow.querySelector<HTMLButtonElement>("[data-testid='planet-show-trail']")!;
    btn.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "show-trail", objectKind: "body", id: "Mars" });
  });

  it("clicking 'Hide path' when trailBodyId matches dispatches hide-trail", () => {
    const dispatch = vi.fn();
    const drawer = createTonightDrawer({ dispatch });
    drawer.setBodies(BODIES_ABOVE, LAT, LON, TIME, "Mars");
    const rows = drawer.element.querySelectorAll("[data-testid='planet-info-row']");
    const marsRow = [...rows].find(
      (r) => r.querySelector("[data-testid='planet-name']")?.textContent === "Mars",
    )!;
    const btn = marsRow.querySelector<HTMLButtonElement>("[data-testid='planet-show-trail']")!;
    expect(btn.textContent?.toLowerCase()).toContain("hide");
    btn.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "hide-trail" });
  });
});
