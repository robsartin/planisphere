/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEventsDrawer } from "./events-drawer";
import type { CelestialEvent } from "../astro/events";

function makeConjunction(when: Date): CelestialEvent {
  return {
    kind: "conjunction",
    when,
    title: "Venus – Mars conjunction",
    description: "Venus and Mars appear within 1.2° of each other.",
    body1: "Venus",
    body2: "Mars",
    separationDeg: 1.2,
  };
}

describe("createEventsDrawer", () => {
  afterEach(() => {
    // Any drawers attached to body get removed here to keep tests isolated.
    document.querySelectorAll("[data-testid='events-drawer']").forEach((el) => el.remove());
  });

  it("returns an object with element, open, close, isOpen, setEvents", () => {
    const drawer = createEventsDrawer({ dispatch: vi.fn() });
    expect(drawer).toHaveProperty("element");
    expect(drawer).toHaveProperty("open");
    expect(drawer).toHaveProperty("close");
    expect(drawer).toHaveProperty("isOpen");
    expect(drawer).toHaveProperty("setEvents");
  });

  it("is closed by default (element hidden)", () => {
    const drawer = createEventsDrawer({ dispatch: vi.fn() });
    expect(drawer.isOpen()).toBe(false);
    expect(drawer.element.style.display).toBe("none");
  });

  it("open() shows the drawer and isOpen() returns true", () => {
    const drawer = createEventsDrawer({ dispatch: vi.fn() });
    drawer.open();
    expect(drawer.isOpen()).toBe(true);
    expect(drawer.element.style.display).not.toBe("none");
  });

  it("close() hides the drawer and isOpen() returns false", () => {
    const drawer = createEventsDrawer({ dispatch: vi.fn() });
    drawer.open();
    drawer.close();
    expect(drawer.isOpen()).toBe(false);
    expect(drawer.element.style.display).toBe("none");
  });

  it("renders the Events heading via the wrapped events panel", () => {
    const drawer = createEventsDrawer({ dispatch: vi.fn() });
    drawer.setEvents([makeConjunction(new Date("2026-06-10T10:00:00Z"))]);
    const heading = drawer.element.querySelector("[data-testid='events-heading']");
    expect(heading).not.toBeNull();
  });

  it("setEvents() re-renders content with a new list", () => {
    const drawer = createEventsDrawer({ dispatch: vi.fn() });
    drawer.setEvents([]);
    expect(drawer.element.querySelectorAll("[data-testid='event-row']").length).toBe(0);

    drawer.setEvents([
      makeConjunction(new Date("2026-06-10T10:00:00Z")),
      makeConjunction(new Date("2026-07-20T18:00:00Z")),
    ]);
    expect(drawer.element.querySelectorAll("[data-testid='event-row']").length).toBe(2);
  });

  it("close button (×) closes the drawer", () => {
    const drawer = createEventsDrawer({ dispatch: vi.fn() });
    drawer.open();
    const closeBtn = drawer.element.querySelector<HTMLButtonElement>(
      "[data-testid='events-drawer-close']",
    );
    expect(closeBtn).not.toBeNull();
    closeBtn!.click();
    expect(drawer.isOpen()).toBe(false);
  });

  it("pressing Escape while open closes the drawer", () => {
    const drawer = createEventsDrawer({ dispatch: vi.fn() });
    document.body.appendChild(drawer.element);
    drawer.open();
    const evt = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(evt);
    expect(drawer.isOpen()).toBe(false);
  });

  it("pressing Escape while closed is a no-op", () => {
    const drawer = createEventsDrawer({ dispatch: vi.fn() });
    document.body.appendChild(drawer.element);
    // Dispatch Escape while closed — should stay closed, no throw.
    const evt = new KeyboardEvent("keydown", { key: "Escape" });
    expect(() => document.dispatchEvent(evt)).not.toThrow();
    expect(drawer.isOpen()).toBe(false);
  });

  it("clicking the backdrop closes the drawer", () => {
    const drawer = createEventsDrawer({ dispatch: vi.fn() });
    drawer.open();
    const backdrop = drawer.element.querySelector<HTMLElement>(
      "[data-testid='events-drawer-backdrop']",
    );
    expect(backdrop).not.toBeNull();
    backdrop!.click();
    expect(drawer.isOpen()).toBe(false);
  });

  it("dispatch is passed through to the events panel Go-to button", () => {
    const dispatch = vi.fn();
    const drawer = createEventsDrawer({ dispatch });
    const when = new Date("2026-06-10T10:00:00Z");
    drawer.setEvents([makeConjunction(when)]);
    const gotoBtn = drawer.element.querySelector<HTMLButtonElement>("[data-testid='event-goto']")!;
    gotoBtn.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "set-time", time: when });
  });
});
