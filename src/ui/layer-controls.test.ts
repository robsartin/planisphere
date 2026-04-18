/* SPDX-License-Identifier: Apache-2.0 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLayerControls } from "./layer-controls";
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
};

describe("createLayerControls", () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let el: HTMLElement;

  beforeEach(() => {
    dispatch = vi.fn();
    el = createLayerControls(DEFAULT_VISIBILITY, DEFAULT_OPACITY, dispatch);
  });

  it("returns an HTMLElement", () => {
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it("renders a toggle checkbox for each toggle layer (stars, planets, satellites, compass, deepSky)", () => {
    const toggles = el.querySelectorAll("input[type='checkbox']");
    expect(toggles.length).toBe(5);
  });

  it("toggle checkboxes reflect initial visibility state (all true)", () => {
    const checkboxes = [...el.querySelectorAll<HTMLInputElement>("input[type='checkbox']")];
    expect(checkboxes.every((cb) => cb.checked)).toBe(true);
  });

  it("clicking a layer toggle dispatches toggle-layer intent", () => {
    const starsToggle = el.querySelector<HTMLInputElement>("input[data-layer='stars']")!;
    starsToggle.checked = false;
    starsToggle.dispatchEvent(new Event("change"));
    expect(dispatch).toHaveBeenCalledOnce();
    const intent = dispatch.mock.calls[0]![0] as UIIntent;
    expect(intent.type).toBe("toggle-layer");
    if (intent.type === "toggle-layer") {
      expect(intent.layer).toBe("stars");
    }
  });

  it("renders opacity sliders for all 5 line layers", () => {
    const sliders = el.querySelectorAll("input[type='range']");
    expect(sliders.length).toBe(5);
  });

  it("has opacity slider for constellationLines", () => {
    const slider = el.querySelector<HTMLInputElement>("input[data-opacity='constellationLines']");
    expect(slider).not.toBeNull();
  });

  it("has opacity slider for constellationBoundaries", () => {
    const slider = el.querySelector<HTMLInputElement>(
      "input[data-opacity='constellationBoundaries']",
    );
    expect(slider).not.toBeNull();
  });

  it("has opacity slider for satelliteTrails", () => {
    const slider = el.querySelector<HTMLInputElement>("input[data-opacity='satelliteTrails']");
    expect(slider).not.toBeNull();
  });

  it("has opacity slider for raDecGrid", () => {
    const slider = el.querySelector<HTMLInputElement>("input[data-opacity='raDecGrid']");
    expect(slider).not.toBeNull();
  });

  it("has opacity slider for ecliptic", () => {
    const slider = el.querySelector<HTMLInputElement>("input[data-opacity='ecliptic']");
    expect(slider).not.toBeNull();
  });

  it("moving an opacity slider dispatches set-opacity intent", () => {
    const slider = el.querySelector<HTMLInputElement>("input[data-opacity='constellationLines']")!;
    slider.value = "50";
    slider.dispatchEvent(new Event("input"));
    expect(dispatch).toHaveBeenCalledOnce();
    const intent = dispatch.mock.calls[0]![0] as UIIntent;
    expect(intent.type).toBe("set-opacity");
    if (intent.type === "set-opacity") {
      expect(intent.layer).toBe("constellationLines");
      expect(intent.value).toBeCloseTo(0.5);
    }
  });

  it("raDecGrid slider dispatches set-opacity with raDecGrid key", () => {
    const slider = el.querySelector<HTMLInputElement>("input[data-opacity='raDecGrid']")!;
    slider.value = "30";
    slider.dispatchEvent(new Event("input"));
    const intent = dispatch.mock.calls[0]![0] as UIIntent;
    expect(intent.type).toBe("set-opacity");
    if (intent.type === "set-opacity") {
      expect(intent.layer).toBe("raDecGrid");
      expect(intent.value).toBeCloseTo(0.3);
    }
  });

  it("ecliptic slider dispatches set-opacity with ecliptic key", () => {
    const slider = el.querySelector<HTMLInputElement>("input[data-opacity='ecliptic']")!;
    slider.value = "60";
    slider.dispatchEvent(new Event("input"));
    const intent = dispatch.mock.calls[0]![0] as UIIntent;
    expect(intent.type).toBe("set-opacity");
    if (intent.type === "set-opacity") {
      expect(intent.layer).toBe("ecliptic");
      expect(intent.value).toBeCloseTo(0.6);
    }
  });

  it("line layer sliders are always visible (no parent toggle)", () => {
    // Since line layers have no toggle, their slider rows are always present
    const rows = el.querySelectorAll<HTMLElement>("[data-opacity-row]");
    for (const row of rows) {
      expect(row.style.display).not.toBe("none");
    }
  });

  it("does not render checkboxes for constellationLines or constellationBoundaries", () => {
    const clCheckbox = el.querySelector("input[data-layer='constellationLines']");
    const cbCheckbox = el.querySelector("input[data-layer='constellationBoundaries']");
    expect(clCheckbox).toBeNull();
    expect(cbCheckbox).toBeNull();
  });
});
