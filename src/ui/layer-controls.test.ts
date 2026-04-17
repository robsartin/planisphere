/* SPDX-License-Identifier: Apache-2.0 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLayerControls } from "./layer-controls";
import type { UIIntent } from "./index";
import type { LayerVisibility, LayerOpacity } from "../state/state";

const DEFAULT_VISIBILITY: LayerVisibility = {
  stars: true,
  planets: true,
  satellites: true,
  constellationLines: true,
  constellationBoundaries: true,
  compass: true,
};

const DEFAULT_OPACITY: LayerOpacity = {
  constellationLines: 1.0,
  constellationBoundaries: 1.0,
  satelliteTrails: 1.0,
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

  it("renders a toggle for each layer", () => {
    const toggles = el.querySelectorAll("input[type='checkbox']");
    expect(toggles.length).toBe(6);
  });

  it("toggles reflect initial visibility state", () => {
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

  it("renders opacity sliders for dimmable layers", () => {
    const sliders = el.querySelectorAll("input[type='range']");
    expect(sliders.length).toBe(3);
  });

  it("opacity sliders reflect initial opacity (100%)", () => {
    const sliders = [...el.querySelectorAll<HTMLInputElement>("input[type='range']")];
    expect(sliders.every((s) => Number(s.value) === 100)).toBe(true);
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

  it("opacity slider is hidden when parent layer toggle is off", () => {
    // Start with constellationLines off
    const offVisibility: LayerVisibility = { ...DEFAULT_VISIBILITY, constellationLines: false };
    const el2 = createLayerControls(offVisibility, DEFAULT_OPACITY, vi.fn());
    const sliderRow = el2.querySelector<HTMLElement>("[data-opacity-row='constellationLines']")!;
    expect(sliderRow.style.display).toBe("none");
  });

  it("opacity slider becomes visible when parent layer is toggled on", () => {
    const toggle = el.querySelector<HTMLInputElement>("input[data-layer='constellationLines']")!;
    const sliderRow = el.querySelector<HTMLElement>("[data-opacity-row='constellationLines']")!;
    // Currently visible; toggle off then on
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
    expect(sliderRow.style.display).toBe("none");
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));
    expect(sliderRow.style.display).not.toBe("none");
  });
});
