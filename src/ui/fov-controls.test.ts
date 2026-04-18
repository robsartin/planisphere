/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi } from "vitest";
import { createFovControls } from "./fov-controls";
import type { UIIntent } from "./index";

describe("createFovControls", () => {
  it("returns an HTMLElement", () => {
    const el = createFovControls("off", vi.fn());
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it("renders a select with an option for each preset", () => {
    const el = createFovControls("off", vi.fn());
    const select = el.querySelector<HTMLSelectElement>("select[data-fov='preset']");
    expect(select).not.toBeNull();
    // off + 4 setups = 5
    expect(select!.querySelectorAll("option").length).toBe(5);
  });

  it("select reflects initial preset", () => {
    const el = createFovControls("binoculars", vi.fn());
    const select = el.querySelector<HTMLSelectElement>("select[data-fov='preset']")!;
    expect(select.value).toBe("binoculars");
  });

  it("changing the select dispatches a set-fov intent", () => {
    const dispatch = vi.fn();
    const el = createFovControls("off", dispatch);
    const select = el.querySelector<HTMLSelectElement>("select[data-fov='preset']")!;
    select.value = "small-scope";
    select.dispatchEvent(new Event("change"));
    expect(dispatch).toHaveBeenCalledOnce();
    const intent = dispatch.mock.calls[0]![0] as UIIntent;
    expect(intent.type).toBe("set-fov");
    if (intent.type === "set-fov") {
      expect(intent.preset).toBe("small-scope");
    }
  });

  it("ignores non-preset select values (defensive)", () => {
    const dispatch = vi.fn();
    const el = createFovControls("off", dispatch);
    const select = el.querySelector<HTMLSelectElement>("select[data-fov='preset']")!;
    // Manually set an invalid value
    select.value = "not-a-preset";
    select.dispatchEvent(new Event("change"));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("has a visible heading labelled 'Telescope FOV' (or similar)", () => {
    const el = createFovControls("off", vi.fn());
    expect(el.textContent?.toLowerCase()).toContain("fov");
  });
});
