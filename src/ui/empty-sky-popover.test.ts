/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi } from "vitest";
import { createEmptySkyPopover } from "./empty-sky-popover";
import type { UIIntent } from "./index";
import type { CelestialEvent, IssPassEvent, MeteorShowerEvent } from "../astro/events";

function issPass(when: Date, peakAlt = 45, peakAz = 120): IssPassEvent {
  return {
    kind: "iss-pass",
    when,
    title: `ISS pass at ${peakAlt}°`,
    description: "ISS pass description",
    peakAltDeg: peakAlt,
    peakAzDeg: peakAz,
    durationSec: 360,
    eclipsed: false,
    magnitudeAtPeak: -2,
  };
}

function shower(when: Date, name: string, view?: { az: number; alt: number }): MeteorShowerEvent {
  return {
    kind: "meteor-shower-peak",
    when,
    title: `${name} meteor shower peak`,
    description: `Expect meteors from ${name}.`,
    showerId: name.toLowerCase(),
    showerName: name,
    zhr: 100,
    ...(view ? { viewAz: view.az, viewAlt: view.alt } : {}),
  };
}

describe("createEmptySkyPopover", () => {
  it("returns a detached element and starts closed", () => {
    const popover = createEmptySkyPopover({ dispatch: vi.fn(), initialFov: "off" });
    expect(popover.element).toBeInstanceOf(HTMLElement);
    expect(popover.isOpen()).toBe(false);
    // Closed popover is hidden
    expect(popover.element.style.display).toBe("none");
  });

  it("open() displays the popover and shows alt/az readout", () => {
    const popover = createEmptySkyPopover({ dispatch: vi.fn(), initialFov: "off" });
    popover.open(42.5, 123.7, 100, 200);
    expect(popover.isOpen()).toBe(true);
    expect(popover.element.style.display).toBe("block");
    const readout = popover.element.querySelector<HTMLElement>(
      "[data-testid='empty-sky-popover-readout']",
    );
    expect(readout).not.toBeNull();
    expect(readout!.textContent).toContain("42.5");
    expect(readout!.textContent).toContain("123.7");
  });

  it("open() renders a small reticle at the click point", () => {
    const popover = createEmptySkyPopover({ dispatch: vi.fn(), initialFov: "off" });
    popover.open(10, 20, 150, 250);
    const reticle = popover.element.querySelector<HTMLElement>(
      "[data-testid='empty-sky-popover-reticle']",
    );
    expect(reticle).not.toBeNull();
    expect(reticle!.style.left).toBe("150px");
    expect(reticle!.style.top).toBe("250px");
  });

  it("'Look here' button dispatches set-view with the clicked az/alt", () => {
    const dispatch = vi.fn();
    const popover = createEmptySkyPopover({ dispatch, initialFov: "off" });
    popover.open(30, 180, 100, 200);
    const btn = popover.element.querySelector<HTMLButtonElement>(
      "[data-testid='empty-sky-popover-look-here']",
    );
    expect(btn).not.toBeNull();
    btn!.click();
    expect(dispatch).toHaveBeenCalledWith({
      type: "set-view",
      az: 180,
      alt: 30,
    } satisfies UIIntent);
  });

  it("'Look here' click auto-closes the popover", () => {
    const popover = createEmptySkyPopover({ dispatch: vi.fn(), initialFov: "off" });
    popover.open(30, 180, 100, 200);
    const btn = popover.element.querySelector<HTMLButtonElement>(
      "[data-testid='empty-sky-popover-look-here']",
    );
    btn!.click();
    expect(popover.isOpen()).toBe(false);
  });

  it("embedded FOV dropdown dispatches set-fov when changed", () => {
    const dispatch = vi.fn();
    const popover = createEmptySkyPopover({ dispatch, initialFov: "off" });
    popover.open(30, 180, 100, 200);
    const select = popover.element.querySelector<HTMLSelectElement>("select[data-fov='preset']");
    expect(select).not.toBeNull();
    select!.value = "binoculars";
    select!.dispatchEvent(new Event("change"));
    expect(dispatch).toHaveBeenCalledWith({
      type: "set-fov",
      preset: "binoculars",
    } satisfies UIIntent);
  });

  it("the embedded FOV dropdown reflects the initialFov prop", () => {
    const popover = createEmptySkyPopover({ dispatch: vi.fn(), initialFov: "binoculars" });
    popover.open(30, 180, 100, 200);
    const select = popover.element.querySelector<HTMLSelectElement>("select[data-fov='preset']");
    expect(select).not.toBeNull();
    expect(select!.value).toBe("binoculars");
  });

  it("close() hides the popover", () => {
    const popover = createEmptySkyPopover({ dispatch: vi.fn(), initialFov: "off" });
    popover.open(30, 180, 100, 200);
    popover.close();
    expect(popover.isOpen()).toBe(false);
    expect(popover.element.style.display).toBe("none");
  });

  it("close button (×) closes the popover", () => {
    const popover = createEmptySkyPopover({ dispatch: vi.fn(), initialFov: "off" });
    popover.open(30, 180, 100, 200);
    const closeBtn = popover.element.querySelector<HTMLButtonElement>(
      "[data-testid='empty-sky-popover-close']",
    );
    expect(closeBtn).not.toBeNull();
    closeBtn!.click();
    expect(popover.isOpen()).toBe(false);
  });

  it("Escape key closes the popover", () => {
    const popover = createEmptySkyPopover({ dispatch: vi.fn(), initialFov: "off" });
    document.body.appendChild(popover.element);
    popover.open(30, 180, 100, 200);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(popover.isOpen()).toBe(false);
    popover.element.remove();
  });

  it("Escape is a no-op when the popover is already closed", () => {
    const popover = createEmptySkyPopover({ dispatch: vi.fn(), initialFov: "off" });
    document.body.appendChild(popover.element);
    // Never opened — pressing Escape should not throw or change state.
    expect(() =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    ).not.toThrow();
    expect(popover.isOpen()).toBe(false);
    popover.element.remove();
  });

  it("re-opening updates alt/az + position", () => {
    const popover = createEmptySkyPopover({ dispatch: vi.fn(), initialFov: "off" });
    popover.open(10, 20, 100, 100);
    popover.open(70, 300, 200, 200);
    const readout = popover.element.querySelector<HTMLElement>(
      "[data-testid='empty-sky-popover-readout']",
    );
    expect(readout!.textContent).toContain("70");
    expect(readout!.textContent).toContain("300");
  });

  it("positions the card near the click point", () => {
    const popover = createEmptySkyPopover({ dispatch: vi.fn(), initialFov: "off" });
    popover.open(30, 180, 100, 200);
    const card = popover.element.querySelector<HTMLElement>(
      "[data-testid='empty-sky-popover-card']",
    );
    expect(card).not.toBeNull();
    // The card should be anchored via `left` and `top` near (but not at) the click point.
    expect(card!.style.left).not.toBe("");
    expect(card!.style.top).not.toBe("");
  });

  it("renders no upcoming-events section when getEvents is not supplied", () => {
    const popover = createEmptySkyPopover({ dispatch: vi.fn(), initialFov: "off" });
    popover.open(30, 180, 100, 200);
    expect(
      popover.element.querySelector<HTMLElement>("[data-testid='empty-sky-popover-events']"),
    ).toBeNull();
    expect(
      popover.element.querySelectorAll<HTMLElement>("[data-testid='empty-sky-popover-event-row']")
        .length,
    ).toBe(0);
  });

  it("renders no events section when getEvents returns an empty list", () => {
    const popover = createEmptySkyPopover({
      dispatch: vi.fn(),
      initialFov: "off",
      getEvents: () => [],
      getNow: () => new Date("2026-07-06T00:00:00Z"),
    });
    popover.open(30, 180, 100, 200);
    expect(
      popover.element.querySelector<HTMLElement>("[data-testid='empty-sky-popover-events']"),
    ).toBeNull();
  });

  it("renders exactly 3 upcoming-events rows sorted by time when 4+ events are supplied", () => {
    const now = new Date("2026-07-06T00:00:00Z");
    const events: CelestialEvent[] = [
      shower(new Date("2026-07-08T03:00:00Z"), "Perseids"), // +2d 3h
      issPass(new Date("2026-07-06T00:42:00Z")), // +42 min
      shower(new Date("2026-07-06T05:00:00Z"), "Delta Aquariids"), // +5h
      shower(new Date("2026-07-10T00:00:00Z"), "Alpha Capricornids"), // +4d
    ];
    const popover = createEmptySkyPopover({
      dispatch: vi.fn(),
      initialFov: "off",
      getEvents: () => events,
      getNow: () => now,
    });
    popover.open(30, 180, 100, 200);

    const rows = popover.element.querySelectorAll<HTMLElement>(
      "[data-testid='empty-sky-popover-event-row']",
    );
    expect(rows.length).toBe(3);

    // Sorted by time — the ISS (42min) first, then Delta Aquariids (5h), then Perseids (2d).
    expect(rows[0]!.textContent).toContain("ISS");
    expect(rows[1]!.textContent).toContain("Delta Aquariids");
    expect(rows[2]!.textContent).toContain("Perseids");
    // Alpha Capricornids (further out) is dropped by the 3-cap.
    const allText = popover.element.textContent ?? "";
    expect(allText).not.toContain("Alpha Capricornids");
  });

  it("relative-time chip shows minutes for events under an hour out", () => {
    const now = new Date("2026-07-06T00:00:00Z");
    const events: CelestialEvent[] = [issPass(new Date("2026-07-06T00:42:00Z"))];
    const popover = createEmptySkyPopover({
      dispatch: vi.fn(),
      initialFov: "off",
      getEvents: () => events,
      getNow: () => now,
    });
    popover.open(30, 180, 100, 200);
    const chip = popover.element.querySelector<HTMLElement>(
      "[data-testid='empty-sky-popover-event-chip']",
    );
    expect(chip).not.toBeNull();
    expect(chip!.textContent).toContain("42 min");
    expect(chip!.textContent).toContain("in");
  });

  it("relative-time chip shows Xd Yh for multi-day events", () => {
    const now = new Date("2026-07-06T00:00:00Z");
    const events: CelestialEvent[] = [
      shower(new Date("2026-07-09T14:00:00Z"), "Perseids"), // 3d 14h
    ];
    const popover = createEmptySkyPopover({
      dispatch: vi.fn(),
      initialFov: "off",
      getEvents: () => events,
      getNow: () => now,
    });
    popover.open(30, 180, 100, 200);
    const chip = popover.element.querySelector<HTMLElement>(
      "[data-testid='empty-sky-popover-event-chip']",
    );
    expect(chip).not.toBeNull();
    expect(chip!.textContent).toContain("3d");
    expect(chip!.textContent).toContain("14h");
  });

  it("clicking an events row with a view direction dispatches set-time AND set-view", () => {
    const now = new Date("2026-07-06T00:00:00Z");
    const events: CelestialEvent[] = [issPass(new Date("2026-07-06T00:42:00Z"), 45, 120)];
    const dispatch = vi.fn();
    const popover = createEmptySkyPopover({
      dispatch,
      initialFov: "off",
      getEvents: () => events,
      getNow: () => now,
    });
    popover.open(30, 180, 100, 200);

    const row = popover.element.querySelector<HTMLElement>(
      "[data-testid='empty-sky-popover-event-row']",
    );
    expect(row).not.toBeNull();
    row!.click();

    expect(dispatch).toHaveBeenCalledWith({
      type: "set-time",
      time: events[0]!.when,
    } satisfies UIIntent);
    expect(dispatch).toHaveBeenCalledWith({
      type: "set-view",
      az: 120,
      alt: 45,
    } satisfies UIIntent);
  });

  it("clicking an events row without a view direction only dispatches set-time", () => {
    const now = new Date("2026-07-06T00:00:00Z");
    // Meteor shower without viewAz/viewAlt supplied.
    const events: CelestialEvent[] = [shower(new Date("2026-07-06T05:00:00Z"), "Perseids")];
    const dispatch = vi.fn();
    const popover = createEmptySkyPopover({
      dispatch,
      initialFov: "off",
      getEvents: () => events,
      getNow: () => now,
    });
    popover.open(30, 180, 100, 200);
    const row = popover.element.querySelector<HTMLElement>(
      "[data-testid='empty-sky-popover-event-row']",
    );
    row!.click();

    expect(dispatch).toHaveBeenCalledWith({
      type: "set-time",
      time: events[0]!.when,
    } satisfies UIIntent);
    // No set-view intent should have been dispatched.
    expect(
      dispatch.mock.calls.some(
        (call: unknown[]) =>
          typeof call[0] === "object" &&
          call[0] !== null &&
          (call[0] as { type: string }).type === "set-view",
      ),
    ).toBe(false);
  });

  it("clicking an events row closes the popover", () => {
    const now = new Date("2026-07-06T00:00:00Z");
    const events: CelestialEvent[] = [issPass(new Date("2026-07-06T00:42:00Z"))];
    const popover = createEmptySkyPopover({
      dispatch: vi.fn(),
      initialFov: "off",
      getEvents: () => events,
      getNow: () => now,
    });
    popover.open(30, 180, 100, 200);
    const row = popover.element.querySelector<HTMLElement>(
      "[data-testid='empty-sky-popover-event-row']",
    );
    row!.click();
    expect(popover.isOpen()).toBe(false);
  });

  it("re-opening after events change picks up the fresh list", () => {
    const now = new Date("2026-07-06T00:00:00Z");
    let events: CelestialEvent[] = [];
    const popover = createEmptySkyPopover({
      dispatch: vi.fn(),
      initialFov: "off",
      getEvents: () => events,
      getNow: () => now,
    });
    popover.open(30, 180, 100, 200);
    expect(
      popover.element.querySelectorAll<HTMLElement>("[data-testid='empty-sky-popover-event-row']")
        .length,
    ).toBe(0);

    // Fresh events arrive; next open must reflect them.
    events = [issPass(new Date("2026-07-06T00:42:00Z"))];
    popover.close();
    popover.open(30, 180, 100, 200);
    expect(
      popover.element.querySelectorAll<HTMLElement>("[data-testid='empty-sky-popover-event-row']")
        .length,
    ).toBe(1);
  });

  it("flips the card to the left when the click is near the right viewport edge", () => {
    // Mock the viewport — the popover should keep the card fully on-screen.
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { value: 800, configurable: true });
    try {
      const popover = createEmptySkyPopover({ dispatch: vi.fn(), initialFov: "off" });
      // Click near the right edge: card should flip left.
      popover.open(30, 180, 790, 100);
      const card = popover.element.querySelector<HTMLElement>(
        "[data-testid='empty-sky-popover-card']",
      );
      const left = parseFloat(card!.style.left);
      expect(left).toBeLessThan(790);
    } finally {
      Object.defineProperty(window, "innerWidth", { value: originalWidth, configurable: true });
    }
  });
});
