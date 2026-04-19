/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSettingsDrawer, SETTINGS_SECTION_STORAGE_KEY } from "./settings-drawer";
import type { UIIntent } from "./index";
import type { LayerVisibility, LayerOpacity } from "../state/state";

const DEFAULT_VISIBILITY: LayerVisibility = {
  stars: true,
  planets: true,
  satellites: true,
  compass: true,
  deepSky: true,
};

const DEFAULT_OPACITY: LayerOpacity = {
  constellationLines: 1.0,
  constellationBoundaries: 1.0,
  satelliteTrails: 1.0,
  raDecGrid: 0.2,
  ecliptic: 0.4,
  milkyWay: 0.3,
};

function makeDrawer(dispatch: (i: UIIntent) => void = () => {}) {
  return createSettingsDrawer({
    visibility: DEFAULT_VISIBILITY,
    opacity: DEFAULT_OPACITY,
    magLimit: 6.0,
    language: "la",
    skyculture: "western",
    dispatch,
  });
}

describe("createSettingsDrawer", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    globalThis.localStorage?.removeItem(SETTINGS_SECTION_STORAGE_KEY);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    globalThis.localStorage?.removeItem(SETTINGS_SECTION_STORAGE_KEY);
  });

  it("returns an object with element, open, close, isOpen", () => {
    const sd = makeDrawer();
    expect(sd).toHaveProperty("element");
    expect(typeof sd.open).toBe("function");
    expect(typeof sd.close).toBe("function");
    expect(typeof sd.isOpen).toBe("function");
  });

  it("is not open initially", () => {
    const sd = makeDrawer();
    document.body.appendChild(sd.element);
    expect(sd.isOpen()).toBe(false);
  });

  it("open() renders the settings sections and flips isOpen true", () => {
    const sd = makeDrawer();
    document.body.appendChild(sd.element);
    sd.open();
    expect(sd.isOpen()).toBe(true);
    expect(sd.element.querySelector("[data-testid='settings-section-visibility']")).not.toBeNull();
    expect(sd.element.querySelector("[data-testid='settings-section-opacity']")).not.toBeNull();
    expect(sd.element.querySelector("[data-testid='settings-section-filters']")).not.toBeNull();
    expect(sd.element.querySelector("[data-testid='settings-section-display']")).not.toBeNull();
  });

  it("close() hides the drawer", () => {
    const sd = makeDrawer();
    document.body.appendChild(sd.element);
    sd.open();
    sd.close();
    expect(sd.isOpen()).toBe(false);
  });

  it("renders all 5 visibility toggles (stars, planets, satellites, compass, deepSky)", () => {
    const sd = makeDrawer();
    document.body.appendChild(sd.element);
    sd.open();
    const toggles = sd.element.querySelectorAll("input[type='checkbox'][data-layer]");
    expect(toggles.length).toBe(5);
  });

  it("renders all 6 opacity sliders", () => {
    const sd = makeDrawer();
    document.body.appendChild(sd.element);
    sd.open();
    const sliders = sd.element.querySelectorAll("input[type='range'][data-opacity]");
    expect(sliders.length).toBe(6);
  });

  it("renders the magnitude-limit slider", () => {
    const sd = makeDrawer();
    document.body.appendChild(sd.element);
    sd.open();
    const mag = sd.element.querySelector("input[data-mag='limit']");
    expect(mag).not.toBeNull();
  });

  it("renders the language dropdown", () => {
    const sd = makeDrawer();
    document.body.appendChild(sd.element);
    sd.open();
    const sel = sd.element.querySelector("select[data-language]");
    expect(sel).not.toBeNull();
  });

  it("renders the skyculture dropdown", () => {
    const sd = makeDrawer();
    document.body.appendChild(sd.element);
    sd.open();
    const sel = sd.element.querySelector("select[data-skyculture]");
    expect(sel).not.toBeNull();
  });

  it("toggle-layer intent dispatches when a visibility checkbox changes", () => {
    const dispatch = vi.fn();
    const sd = makeDrawer(dispatch);
    document.body.appendChild(sd.element);
    sd.open();
    const cb = sd.element.querySelector<HTMLInputElement>("input[data-layer='stars']")!;
    cb.checked = false;
    cb.dispatchEvent(new Event("change"));
    expect(dispatch).toHaveBeenCalledWith({ type: "toggle-layer", layer: "stars" });
  });

  it("set-opacity intent dispatches when an opacity slider moves", () => {
    const dispatch = vi.fn();
    const sd = makeDrawer(dispatch);
    document.body.appendChild(sd.element);
    sd.open();
    const slider = sd.element.querySelector<HTMLInputElement>(
      "input[data-opacity='constellationLines']",
    )!;
    slider.value = "50";
    slider.dispatchEvent(new Event("input"));
    expect(dispatch).toHaveBeenCalledWith({
      type: "set-opacity",
      layer: "constellationLines",
      value: 0.5,
    });
  });

  it("set-mag-limit intent dispatches when the magnitude slider moves", () => {
    const dispatch = vi.fn();
    const sd = makeDrawer(dispatch);
    document.body.appendChild(sd.element);
    sd.open();
    const slider = sd.element.querySelector<HTMLInputElement>("input[data-mag='limit']")!;
    slider.value = "4";
    slider.dispatchEvent(new Event("input"));
    expect(dispatch).toHaveBeenCalledWith({ type: "set-mag-limit", value: 4 });
  });

  it("set-language intent dispatches when the language dropdown changes", () => {
    const dispatch = vi.fn();
    const sd = makeDrawer(dispatch);
    document.body.appendChild(sd.element);
    sd.open();
    const sel = sd.element.querySelector<HTMLSelectElement>("select[data-language]")!;
    sel.value = "zh";
    sel.dispatchEvent(new Event("change"));
    expect(dispatch).toHaveBeenCalledWith({ type: "set-language", language: "zh" });
  });

  it("set-skyculture intent dispatches when the skyculture dropdown changes", () => {
    const dispatch = vi.fn();
    const sd = makeDrawer(dispatch);
    document.body.appendChild(sd.element);
    sd.open();
    const sel = sd.element.querySelector<HTMLSelectElement>("select[data-skyculture]")!;
    sel.value = "chinese";
    sel.dispatchEvent(new Event("change"));
    expect(dispatch).toHaveBeenCalledWith({ type: "set-skyculture", id: "chinese" });
  });

  describe("collapsible sections", () => {
    it("Visibility section is expanded on first open (no stored preference)", () => {
      const sd = makeDrawer();
      document.body.appendChild(sd.element);
      sd.open();
      const section = sd.element.querySelector<HTMLElement>(
        "[data-testid='settings-section-visibility']",
      )!;
      expect(section.dataset.expanded).toBe("true");
    });

    it("Opacity, Filters, Display sections are collapsed on first open", () => {
      const sd = makeDrawer();
      document.body.appendChild(sd.element);
      sd.open();
      for (const id of ["opacity", "filters", "display"]) {
        const section = sd.element.querySelector<HTMLElement>(
          `[data-testid='settings-section-${id}']`,
        )!;
        expect(section.dataset.expanded).toBe("false");
      }
    });

    it("clicking a section header toggles it open and collapses the others", () => {
      const sd = makeDrawer();
      document.body.appendChild(sd.element);
      sd.open();
      const opacityHeader = sd.element.querySelector<HTMLElement>(
        "[data-testid='settings-header-opacity']",
      )!;
      opacityHeader.click();
      expect(
        sd.element.querySelector<HTMLElement>("[data-testid='settings-section-opacity']")!.dataset
          .expanded,
      ).toBe("true");
      expect(
        sd.element.querySelector<HTMLElement>("[data-testid='settings-section-visibility']")!
          .dataset.expanded,
      ).toBe("false");
    });

    it("remembers the last-opened section in localStorage", () => {
      const sd = makeDrawer();
      document.body.appendChild(sd.element);
      sd.open();
      const displayHeader = sd.element.querySelector<HTMLElement>(
        "[data-testid='settings-header-display']",
      )!;
      displayHeader.click();
      expect(globalThis.localStorage?.getItem(SETTINGS_SECTION_STORAGE_KEY)).toBe("display");
    });

    it("restores the last-opened section from localStorage on next open", () => {
      globalThis.localStorage?.setItem(SETTINGS_SECTION_STORAGE_KEY, "filters");
      const sd = makeDrawer();
      document.body.appendChild(sd.element);
      sd.open();
      const filters = sd.element.querySelector<HTMLElement>(
        "[data-testid='settings-section-filters']",
      )!;
      expect(filters.dataset.expanded).toBe("true");
      const visibility = sd.element.querySelector<HTMLElement>(
        "[data-testid='settings-section-visibility']",
      )!;
      expect(visibility.dataset.expanded).toBe("false");
    });

    it("ignores an invalid stored section value and falls back to visibility", () => {
      globalThis.localStorage?.setItem(SETTINGS_SECTION_STORAGE_KEY, "not-a-section");
      const sd = makeDrawer();
      document.body.appendChild(sd.element);
      sd.open();
      const visibility = sd.element.querySelector<HTMLElement>(
        "[data-testid='settings-section-visibility']",
      )!;
      expect(visibility.dataset.expanded).toBe("true");
    });
  });

  it("respects initial language/skyculture/magLimit values", () => {
    const sd = createSettingsDrawer({
      visibility: DEFAULT_VISIBILITY,
      opacity: DEFAULT_OPACITY,
      magLimit: 4.5,
      language: "zh",
      skyculture: "chinese",
      dispatch: () => {},
    });
    document.body.appendChild(sd.element);
    sd.open();
    const mag = sd.element.querySelector<HTMLInputElement>("input[data-mag='limit']")!;
    expect(Number(mag.value)).toBeCloseTo(4.5);
    const lang = sd.element.querySelector<HTMLSelectElement>("select[data-language]")!;
    expect(lang.value).toBe("zh");
    const sky = sd.element.querySelector<HTMLSelectElement>("select[data-skyculture]")!;
    expect(sky.value).toBe("chinese");
  });
});
