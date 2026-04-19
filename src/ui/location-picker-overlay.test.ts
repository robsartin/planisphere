/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocationPickerOverlay } from "./location-picker-overlay";
import type { UIIntent } from "./index";

describe("createLocationPickerOverlay", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.body.style.overflow = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.body.style.overflow = "";
  });

  function make(opts?: { dispatch?: (intent: UIIntent) => void; lat?: number; lon?: number }): {
    overlay: ReturnType<typeof createLocationPickerOverlay>;
    dispatch: ReturnType<typeof vi.fn>;
  } {
    const dispatch = vi.fn();
    const overlay = createLocationPickerOverlay({
      dispatch: opts?.dispatch ?? dispatch,
      initialLat: opts?.lat ?? 40.71,
      initialLon: opts?.lon ?? -74.01,
    });
    document.body.appendChild(overlay.element);
    return { overlay, dispatch };
  }

  it("returns an object with element, open, close, isOpen", () => {
    const { overlay } = make();
    expect(overlay).toHaveProperty("element");
    expect(typeof overlay.open).toBe("function");
    expect(typeof overlay.close).toBe("function");
    expect(typeof overlay.isOpen).toBe("function");
  });

  it("is hidden initially", () => {
    const { overlay } = make();
    expect(overlay.isOpen()).toBe(false);
    expect(overlay.element.style.display).toBe("none");
  });

  it("open() makes it visible", () => {
    const { overlay } = make();
    overlay.open();
    expect(overlay.isOpen()).toBe(true);
    expect(overlay.element.style.display).not.toBe("none");
  });

  it("close() hides it", () => {
    const { overlay } = make();
    overlay.open();
    overlay.close();
    expect(overlay.isOpen()).toBe(false);
    expect(overlay.element.style.display).toBe("none");
  });

  it("close button (×) closes the overlay", () => {
    const { overlay } = make();
    overlay.open();
    const btn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-testid='location-picker-close']",
    );
    expect(btn).not.toBeNull();
    btn!.click();
    expect(overlay.isOpen()).toBe(false);
  });

  it("clicking the backdrop closes the overlay", () => {
    const { overlay } = make();
    overlay.open();
    const backdrop = overlay.element.querySelector<HTMLElement>(
      "[data-testid='location-picker-backdrop']",
    );
    expect(backdrop).not.toBeNull();
    backdrop!.click();
    expect(overlay.isOpen()).toBe(false);
  });

  it("clicking the panel does NOT close the overlay", () => {
    const { overlay } = make();
    overlay.open();
    const panel = overlay.element.querySelector<HTMLElement>(
      "[data-testid='location-picker-panel']",
    );
    expect(panel).not.toBeNull();
    panel!.click();
    expect(overlay.isOpen()).toBe(true);
  });

  it("Escape closes the overlay when open", () => {
    const { overlay } = make();
    overlay.open();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(overlay.isOpen()).toBe(false);
  });

  it("Escape is a no-op when the overlay is closed", () => {
    const { overlay } = make();
    expect(overlay.isOpen()).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(overlay.isOpen()).toBe(false);
  });

  it("'📍 Use my location' dispatches { type: 'now' }", () => {
    const { overlay, dispatch } = make();
    overlay.open();
    const btn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-testid='location-picker-use-my-location']",
    );
    expect(btn).not.toBeNull();
    btn!.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "now" });
  });

  it("'Set location' dispatches set-observer with the typed lat/lon", () => {
    const { overlay, dispatch } = make({ lat: 40.71, lon: -74.01 });
    overlay.open();
    const latInput = overlay.element.querySelector<HTMLInputElement>(
      "input[data-field='picker-lat']",
    );
    const lonInput = overlay.element.querySelector<HTMLInputElement>(
      "input[data-field='picker-lon']",
    );
    expect(latInput).not.toBeNull();
    expect(lonInput).not.toBeNull();
    latInput!.value = "51.5";
    lonInput!.value = "-0.12";
    const setBtn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-testid='location-picker-set']",
    );
    expect(setBtn).not.toBeNull();
    setBtn!.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "set-observer", lat: 51.5, lon: -0.12 });
  });

  it("'Set location' clamps lat/lon to valid ranges", () => {
    const { overlay, dispatch } = make();
    overlay.open();
    const latInput = overlay.element.querySelector<HTMLInputElement>(
      "input[data-field='picker-lat']",
    )!;
    const lonInput = overlay.element.querySelector<HTMLInputElement>(
      "input[data-field='picker-lon']",
    )!;
    latInput.value = "200";
    lonInput.value = "-9999";
    overlay.element
      .querySelector<HTMLButtonElement>("[data-testid='location-picker-set']")!
      .click();
    expect(dispatch).toHaveBeenCalledWith({ type: "set-observer", lat: 90, lon: -180 });
  });

  it("'Set location' ignores non-numeric entries (does not dispatch)", () => {
    const { overlay, dispatch } = make();
    overlay.open();
    const latInput = overlay.element.querySelector<HTMLInputElement>(
      "input[data-field='picker-lat']",
    )!;
    latInput.value = "not a number";
    overlay.element
      .querySelector<HTMLButtonElement>("[data-testid='location-picker-set']")!
      .click();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("'Set location' closes the overlay after dispatching", () => {
    const { overlay } = make();
    overlay.open();
    overlay.element
      .querySelector<HTMLButtonElement>("[data-testid='location-picker-set']")!
      .click();
    expect(overlay.isOpen()).toBe(false);
  });

  it("clicking a city pill dispatches set-observer with that city's coords", () => {
    const { overlay, dispatch } = make();
    overlay.open();
    const cityButtons = overlay.element.querySelectorAll<HTMLButtonElement>(
      "[data-testid='location-picker-city']",
    );
    expect(cityButtons.length).toBeGreaterThan(0);
    const london = Array.from(cityButtons).find((b) => b.textContent?.includes("London"));
    expect(london).toBeDefined();
    london!.click();
    expect(dispatch).toHaveBeenCalled();
    const call = dispatch.mock.calls[0]![0] as { type: string; lat: number; lon: number };
    expect(call.type).toBe("set-observer");
    expect(call.lat).toBeCloseTo(51.5074, 2);
    expect(call.lon).toBeCloseTo(-0.1278, 2);
  });

  it("clicking a city also closes the overlay", () => {
    const { overlay } = make();
    overlay.open();
    const firstCity = overlay.element.querySelector<HTMLButtonElement>(
      "[data-testid='location-picker-city']",
    )!;
    firstCity.click();
    expect(overlay.isOpen()).toBe(false);
  });

  it("cancel (backdrop / Esc / ×) does NOT dispatch anything", () => {
    const { overlay, dispatch } = make();
    overlay.open();
    overlay.element
      .querySelector<HTMLButtonElement>("[data-testid='location-picker-close']")!
      .click();
    expect(dispatch).not.toHaveBeenCalled();

    overlay.open();
    overlay.element.querySelector<HTMLElement>("[data-testid='location-picker-backdrop']")!.click();
    expect(dispatch).not.toHaveBeenCalled();

    overlay.open();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("initial lat/lon prefill the numeric inputs", () => {
    const { overlay } = make({ lat: 35.69, lon: 139.69 });
    overlay.open();
    const latInput = overlay.element.querySelector<HTMLInputElement>(
      "input[data-field='picker-lat']",
    )!;
    const lonInput = overlay.element.querySelector<HTMLInputElement>(
      "input[data-field='picker-lon']",
    )!;
    expect(Number(latInput.value)).toBeCloseTo(35.69, 2);
    expect(Number(lonInput.value)).toBeCloseTo(139.69, 2);
  });

  it("re-opening resets inputs to the current observer values", () => {
    const { overlay } = make({ lat: 40.71, lon: -74.01 });
    overlay.open();
    const latInput = overlay.element.querySelector<HTMLInputElement>(
      "input[data-field='picker-lat']",
    )!;
    latInput.value = "0";
    overlay.close();
    overlay.open();
    expect(Number(latInput.value)).toBeCloseTo(40.71, 2);
  });

  it("renders at least ~20 quick-pick cities", () => {
    const { overlay } = make();
    overlay.open();
    const cityButtons = overlay.element.querySelectorAll<HTMLButtonElement>(
      "[data-testid='location-picker-city']",
    );
    expect(cityButtons.length).toBeGreaterThanOrEqual(20);
  });
});
