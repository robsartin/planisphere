/* SPDX-License-Identifier: Apache-2.0 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLocationControls } from "./location-controls";
import type { UIIntent } from "./index";

describe("createLocationControls", () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let el: HTMLElement;

  beforeEach(() => {
    dispatch = vi.fn();
    el = createLocationControls(33.45, -117.15, dispatch);
  });

  it("returns an HTMLElement", () => {
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it("has lat and lon number inputs prefilled with initial values", () => {
    const inputs = el.querySelectorAll<HTMLInputElement>("input[type='number']");
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    const latInput = [...inputs].find((i) => i.dataset.field === "lat");
    const lonInput = [...inputs].find((i) => i.dataset.field === "lon");
    expect(latInput).not.toBeNull();
    expect(lonInput).not.toBeNull();
    expect(Number(latInput!.value)).toBeCloseTo(33.45);
    expect(Number(lonInput!.value)).toBeCloseTo(-117.15);
  });

  it("has a preset cities dropdown", () => {
    const select = el.querySelector("select");
    expect(select).not.toBeNull();
    // Should include at least New York and Tokyo
    const options = [...select!.querySelectorAll("option")].map((o) => o.textContent);
    expect(options.some((t) => t?.includes("New York"))).toBe(true);
    expect(options.some((t) => t?.includes("Tokyo"))).toBe(true);
  });

  it("changing lat/lon inputs dispatches set-observer intent", () => {
    const latInput = el.querySelector<HTMLInputElement>("input[data-field='lat']")!;
    latInput.value = "51.5";
    latInput.dispatchEvent(new Event("change"));
    expect(dispatch).toHaveBeenCalledOnce();
    const intent = dispatch.mock.calls[0]![0] as UIIntent;
    expect(intent.type).toBe("set-observer");
    if (intent.type === "set-observer") {
      expect(intent.lat).toBeCloseTo(51.5);
    }
  });

  it("ignores non-numeric lat input", () => {
    const latInput = el.querySelector<HTMLInputElement>("input[data-field='lat']")!;
    latInput.value = "abc";
    latInput.dispatchEvent(new Event("change"));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("selecting a preset city dispatches set-observer with city coordinates", () => {
    const select = el.querySelector<HTMLSelectElement>("select")!;
    // Find the New York option
    const nyOption = [...select.querySelectorAll("option")].find((o) =>
      o.textContent?.includes("New York"),
    )!;
    select.value = nyOption.value;
    select.dispatchEvent(new Event("change"));
    expect(dispatch).toHaveBeenCalledOnce();
    const intent = dispatch.mock.calls[0]![0] as UIIntent;
    expect(intent.type).toBe("set-observer");
    if (intent.type === "set-observer") {
      expect(intent.lat).toBeCloseTo(40.71, 1);
      expect(intent.lon).toBeCloseTo(-74.01, 1);
    }
  });
});
