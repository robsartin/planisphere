/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi } from "vitest";
import { createViewControls } from "./view-controls";

describe("createViewControls", () => {
  it("creates a section with preset buttons and inputs", () => {
    const el = createViewControls(0, 89.9, vi.fn());
    expect(el.querySelector('[data-testid="view-zenith"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="view-n"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="view-s"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="view-e"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="view-w"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="view-az"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="view-alt"]')).toBeTruthy();
  });

  it("zenith button dispatches set-view with alt 89.9", () => {
    const onIntent = vi.fn();
    const el = createViewControls(0, 89.9, onIntent);
    const btn = el.querySelector('[data-testid="view-zenith"]') as HTMLButtonElement;
    btn.click();
    expect(onIntent).toHaveBeenCalledWith({ type: "set-view", az: 0, alt: 89.9 });
  });

  it("south button dispatches set-view with az 180", () => {
    const onIntent = vi.fn();
    const el = createViewControls(0, 89.9, onIntent);
    const btn = el.querySelector('[data-testid="view-s"]') as HTMLButtonElement;
    btn.click();
    expect(onIntent).toHaveBeenCalledWith({ type: "set-view", az: 180, alt: 30 });
  });

  it("changing az input dispatches set-view", () => {
    const onIntent = vi.fn();
    const el = createViewControls(0, 89.9, onIntent);
    const azInput = el.querySelector('[data-testid="view-az"]') as HTMLInputElement;
    azInput.value = "270";
    azInput.dispatchEvent(new Event("change"));
    expect(onIntent).toHaveBeenCalledWith(expect.objectContaining({ type: "set-view", az: 270 }));
  });

  it("preset buttons update input values", () => {
    const el = createViewControls(0, 89.9, vi.fn());
    const btn = el.querySelector('[data-testid="view-s"]') as HTMLButtonElement;
    btn.click();
    const azInput = el.querySelector('[data-testid="view-az"]') as HTMLInputElement;
    const altInput = el.querySelector('[data-testid="view-alt"]') as HTMLInputElement;
    expect(azInput.value).toBe("180");
    expect(altInput.value).toBe("30");
  });
});
