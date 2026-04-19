/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCommandPalette } from "./command-palette";
import type { PaletteSources } from "./palette-results";
import type { UIIntent } from "./index";

function baseSources(overrides: Partial<PaletteSources> = {}): PaletteSources {
  return {
    objects: [
      { id: "Sirius", label: "Sirius", type: "star" },
      { id: "Orion", label: "Orion", type: "constellation" },
      { id: "Mars", label: "Mars", type: "body" },
    ],
    events: [{ id: "evt-0", label: "Perseids peak", description: "Meteor shower" }],
    places: [{ id: "lon", label: "London", lat: 51.5, lon: -0.12 }],
    settings: [
      { id: "toggle-night-vision", label: "Toggle night vision" },
      { id: "copy-link", label: "Copy link" },
    ],
    recents: [],
    ...overrides,
  };
}

describe("createCommandPalette", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("returns an object with element, open, close, isOpen", () => {
    const palette = createCommandPalette({
      getSources: () => baseSources(),
      dispatch: vi.fn(),
      onRecentSelected: vi.fn(),
    });
    expect(palette).toHaveProperty("element");
    expect(typeof palette.open).toBe("function");
    expect(typeof palette.close).toBe("function");
    expect(typeof palette.isOpen).toBe("function");
  });

  it("is hidden initially", () => {
    const palette = createCommandPalette({
      getSources: () => baseSources(),
      dispatch: vi.fn(),
      onRecentSelected: vi.fn(),
    });
    document.body.appendChild(palette.element);
    expect(palette.isOpen()).toBe(false);
    expect(palette.element.style.display).toBe("none");
  });

  it("open() makes it visible and shows the input focused", () => {
    const palette = createCommandPalette({
      getSources: () => baseSources(),
      dispatch: vi.fn(),
      onRecentSelected: vi.fn(),
    });
    document.body.appendChild(palette.element);
    palette.open();
    expect(palette.isOpen()).toBe(true);
    expect(palette.element.style.display).not.toBe("none");
    const input = palette.element.querySelector<HTMLInputElement>("[data-testid='palette-input']")!;
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it("close() hides it and clears the input", () => {
    const palette = createCommandPalette({
      getSources: () => baseSources(),
      dispatch: vi.fn(),
      onRecentSelected: vi.fn(),
    });
    document.body.appendChild(palette.element);
    palette.open();
    const input = palette.element.querySelector<HTMLInputElement>("[data-testid='palette-input']")!;
    input.value = "sir";
    input.dispatchEvent(new Event("input"));
    palette.close();
    expect(palette.isOpen()).toBe(false);
    expect(palette.element.style.display).toBe("none");
    expect(input.value).toBe("");
  });

  it("typing filters visible results", () => {
    const palette = createCommandPalette({
      getSources: () => baseSources(),
      dispatch: vi.fn(),
      onRecentSelected: vi.fn(),
    });
    document.body.appendChild(palette.element);
    palette.open();
    const input = palette.element.querySelector<HTMLInputElement>("[data-testid='palette-input']")!;
    input.value = "sir";
    input.dispatchEvent(new Event("input"));
    const items = palette.element.querySelectorAll("[data-testid='palette-item']");
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]!.textContent).toContain("Sirius");
  });

  it("Enter executes the top (highlighted) result — object dispatches pin-object", () => {
    const dispatch = vi.fn();
    const palette = createCommandPalette({
      getSources: () => baseSources(),
      dispatch,
      onRecentSelected: vi.fn(),
    });
    document.body.appendChild(palette.element);
    palette.open();
    const input = palette.element.querySelector<HTMLInputElement>("[data-testid='palette-input']")!;
    input.value = "sirius";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "pin-object", id: "Sirius" });
  });

  it("Enter on a place result dispatches set-observer", () => {
    const dispatch = vi.fn();
    const palette = createCommandPalette({
      getSources: () => baseSources(),
      dispatch,
      onRecentSelected: vi.fn(),
    });
    document.body.appendChild(palette.element);
    palette.open();
    const input = palette.element.querySelector<HTMLInputElement>("[data-testid='palette-input']")!;
    input.value = "london";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(dispatch).toHaveBeenCalledWith({
      type: "set-observer",
      lat: 51.5,
      lon: -0.12,
    });
  });

  it("Enter on an action result dispatches the action intent from the handler", () => {
    const dispatch = vi.fn();
    const palette = createCommandPalette({
      getSources: () => ({
        ...baseSources({ settings: [] }),
        settings: [
          {
            id: "toggle-night-vision",
            label: "Night vision",
            intent: { type: "toggle-night-vision" },
          },
        ],
      }),
      dispatch,
      onRecentSelected: vi.fn(),
    });
    document.body.appendChild(palette.element);
    palette.open();
    const input = palette.element.querySelector<HTMLInputElement>("[data-testid='palette-input']")!;
    input.value = "night vision";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "toggle-night-vision" });
  });

  it("ArrowDown / ArrowUp navigate selection", () => {
    const palette = createCommandPalette({
      getSources: () => baseSources(),
      dispatch: vi.fn(),
      onRecentSelected: vi.fn(),
    });
    document.body.appendChild(palette.element);
    palette.open();
    const input = palette.element.querySelector<HTMLInputElement>("[data-testid='palette-input']")!;
    // Broad query: match multiple items
    input.value = "o";
    input.dispatchEvent(new Event("input"));
    const selectedBefore = palette.element.querySelector(
      "[data-testid='palette-item'][aria-selected='true']",
    );
    expect(selectedBefore).not.toBeNull();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    const allItems = palette.element.querySelectorAll("[data-testid='palette-item']");
    expect(allItems.length).toBeGreaterThan(1);
    expect(allItems[1]!.getAttribute("aria-selected")).toBe("true");
    expect(allItems[0]!.getAttribute("aria-selected")).toBe("false");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    expect(allItems[0]!.getAttribute("aria-selected")).toBe("true");
  });

  it("Escape closes the palette", () => {
    const palette = createCommandPalette({
      getSources: () => baseSources(),
      dispatch: vi.fn(),
      onRecentSelected: vi.fn(),
    });
    document.body.appendChild(palette.element);
    palette.open();
    const input = palette.element.querySelector<HTMLInputElement>("[data-testid='palette-input']")!;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(palette.isOpen()).toBe(false);
  });

  it("clicking the backdrop closes the palette", () => {
    const palette = createCommandPalette({
      getSources: () => baseSources(),
      dispatch: vi.fn(),
      onRecentSelected: vi.fn(),
    });
    document.body.appendChild(palette.element);
    palette.open();
    const backdrop = palette.element.querySelector<HTMLElement>(
      "[data-testid='palette-backdrop']",
    )!;
    backdrop.click();
    expect(palette.isOpen()).toBe(false);
  });

  it("clicking a result selects and executes it", () => {
    const dispatch = vi.fn();
    const palette = createCommandPalette({
      getSources: () => baseSources(),
      dispatch,
      onRecentSelected: vi.fn(),
    });
    document.body.appendChild(palette.element);
    palette.open();
    const input = palette.element.querySelector<HTMLInputElement>("[data-testid='palette-input']")!;
    input.value = "london";
    input.dispatchEvent(new Event("input"));
    const item = palette.element.querySelector<HTMLElement>("[data-testid='palette-item']")!;
    item.click();
    expect(dispatch).toHaveBeenCalled();
    const intent = dispatch.mock.calls[0]![0] as UIIntent;
    expect(intent.type).toBe("set-observer");
  });

  it("Enter when no results is a no-op (does not throw)", () => {
    const dispatch = vi.fn();
    const palette = createCommandPalette({
      getSources: () => baseSources(),
      dispatch,
      onRecentSelected: vi.fn(),
    });
    document.body.appendChild(palette.element);
    palette.open();
    const input = palette.element.querySelector<HTMLInputElement>("[data-testid='palette-input']")!;
    input.value = "zzzzzzzz";
    input.dispatchEvent(new Event("input"));
    expect(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))).not.toThrow();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("opening a second time shows the settings list by default when no recents", () => {
    const palette = createCommandPalette({
      getSources: () => baseSources(),
      dispatch: vi.fn(),
      onRecentSelected: vi.fn(),
    });
    document.body.appendChild(palette.element);
    palette.open();
    const items = palette.element.querySelectorAll("[data-testid='palette-item']");
    expect(items.length).toBeGreaterThan(0);
  });

  it("selecting a result notifies onRecentSelected so caller can persist it", () => {
    const onRecentSelected = vi.fn();
    const palette = createCommandPalette({
      getSources: () => baseSources(),
      dispatch: vi.fn(),
      onRecentSelected,
    });
    document.body.appendChild(palette.element);
    palette.open();
    const input = palette.element.querySelector<HTMLInputElement>("[data-testid='palette-input']")!;
    input.value = "copy link";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onRecentSelected).toHaveBeenCalledOnce();
    const arg = onRecentSelected.mock.calls[0]![0] as { id: string; label: string };
    expect(arg.id).toBe("copy-link");
    expect(arg.label).toBe("Copy link");
  });

  it("selecting a result closes the palette", () => {
    const palette = createCommandPalette({
      getSources: () => baseSources(),
      dispatch: vi.fn(),
      onRecentSelected: vi.fn(),
    });
    document.body.appendChild(palette.element);
    palette.open();
    const input = palette.element.querySelector<HTMLInputElement>("[data-testid='palette-input']")!;
    input.value = "sirius";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(palette.isOpen()).toBe(false);
  });

  it("onRecentSelected receives a normalized entry with an id prefix for place kinds", () => {
    const onRecentSelected = vi.fn();
    const palette = createCommandPalette({
      getSources: () => baseSources(),
      dispatch: vi.fn(),
      onRecentSelected,
    });
    document.body.appendChild(palette.element);
    palette.open();
    const input = palette.element.querySelector<HTMLInputElement>("[data-testid='palette-input']")!;
    input.value = "london";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    const arg = onRecentSelected.mock.calls[0]![0] as { id: string };
    expect(arg.id).toBe("place:lon");
  });

  it("event result Enter dispatches set-time and (when view present) set-view", () => {
    const dispatch = vi.fn();
    const eventTime = new Date("2026-08-12T00:00:00Z");
    const palette = createCommandPalette({
      getSources: () => ({
        ...baseSources({ events: [] }),
        events: [
          {
            id: "perseids",
            label: "Perseids peak",
            description: "",
            when: eventTime,
            viewAz: 45,
            viewAlt: 60,
          },
        ],
      }),
      dispatch,
      onRecentSelected: vi.fn(),
    });
    document.body.appendChild(palette.element);
    palette.open();
    const input = palette.element.querySelector<HTMLInputElement>("[data-testid='palette-input']")!;
    input.value = "perseids";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    const intents = dispatch.mock.calls.map((c) => (c[0] as UIIntent).type);
    expect(intents).toContain("set-time");
    expect(intents).toContain("set-view");
  });
});
