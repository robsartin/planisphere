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
  milkyWay: 0.3,
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

  it("renders opacity sliders for all 6 line layers plus the mag slider", () => {
    const sliders = el.querySelectorAll("input[type='range']");
    expect(sliders.length).toBe(7);
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

  it("has opacity slider for milkyWay", () => {
    const slider = el.querySelector<HTMLInputElement>("input[data-opacity='milkyWay']");
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

describe("createLayerControls — language dropdown", () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let el: HTMLElement;

  beforeEach(() => {
    dispatch = vi.fn();
    el = createLayerControls(DEFAULT_VISIBILITY, DEFAULT_OPACITY, dispatch, 6.0, "la");
  });

  it("renders a language select with data-language attribute", () => {
    const select = el.querySelector<HTMLSelectElement>("select[data-language]");
    expect(select).not.toBeNull();
  });

  it("includes options for la, en, zh, ar, el", () => {
    const select = el.querySelector<HTMLSelectElement>("select[data-language]")!;
    const values = [...select.options].map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(["la", "en", "zh", "ar", "el"]));
  });

  it("select initialises to the given language", () => {
    const elEn = createLayerControls(DEFAULT_VISIBILITY, DEFAULT_OPACITY, dispatch, 6.0, "en");
    const select = elEn.querySelector<HTMLSelectElement>("select[data-language]")!;
    expect(select.value).toBe("en");
  });

  it("changing the select dispatches set-language intent", () => {
    const select = el.querySelector<HTMLSelectElement>("select[data-language]")!;
    select.value = "zh";
    select.dispatchEvent(new Event("change"));
    expect(dispatch).toHaveBeenCalledOnce();
    const intent = dispatch.mock.calls[0]![0] as UIIntent;
    expect(intent.type).toBe("set-language");
    if (intent.type === "set-language") {
      expect(intent.language).toBe("zh");
    }
  });

  it("defaults to 'la' when no initial language is passed", () => {
    const elDefault = createLayerControls(DEFAULT_VISIBILITY, DEFAULT_OPACITY, dispatch);
    const select = elDefault.querySelector<HTMLSelectElement>("select[data-language]")!;
    expect(select.value).toBe("la");
  });
});

describe("createLayerControls — magnitude slider", () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let el: HTMLElement;

  beforeEach(() => {
    dispatch = vi.fn();
    el = createLayerControls(DEFAULT_VISIBILITY, DEFAULT_OPACITY, dispatch, 6.0);
  });

  it("renders a magnitude limit slider with data-mag attribute", () => {
    const slider = el.querySelector<HTMLInputElement>("input[data-mag='limit']");
    expect(slider).not.toBeNull();
  });

  it("magnitude slider range is 1 to 6", () => {
    const slider = el.querySelector<HTMLInputElement>("input[data-mag='limit']")!;
    expect(slider.min).toBe("1");
    expect(slider.max).toBe("6");
  });

  it("magnitude slider step is 0.5", () => {
    const slider = el.querySelector<HTMLInputElement>("input[data-mag='limit']")!;
    expect(slider.step).toBe("0.5");
  });

  it("magnitude slider initialises to the given magLimit", () => {
    const elWith4 = createLayerControls(DEFAULT_VISIBILITY, DEFAULT_OPACITY, dispatch, 4.0);
    const slider = elWith4.querySelector<HTMLInputElement>("input[data-mag='limit']")!;
    expect(Number(slider.value)).toBeCloseTo(4.0);
  });

  it("label shows current value formatted as 'Mag \u2264 X.X'", () => {
    const label = el.querySelector<HTMLElement>("[data-mag-label]");
    expect(label).not.toBeNull();
    expect(label!.textContent).toContain("6.0");
  });

  it("moving the magnitude slider dispatches set-mag-limit intent", () => {
    const slider = el.querySelector<HTMLInputElement>("input[data-mag='limit']")!;
    slider.value = "4";
    slider.dispatchEvent(new Event("input"));
    expect(dispatch).toHaveBeenCalledOnce();
    const intent = dispatch.mock.calls[0]![0] as UIIntent;
    expect(intent.type).toBe("set-mag-limit");
    if (intent.type === "set-mag-limit") {
      expect(intent.value).toBeCloseTo(4.0);
    }
  });

  it("label updates when slider changes", () => {
    const slider = el.querySelector<HTMLInputElement>("input[data-mag='limit']")!;
    const label = el.querySelector<HTMLElement>("[data-mag-label]")!;
    slider.value = "3.5";
    slider.dispatchEvent(new Event("input"));
    expect(label.textContent).toContain("3.5");
  });
});
