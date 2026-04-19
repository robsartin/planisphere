/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBottomHud } from "./bottom-hud";
import type { BottomHud } from "./bottom-hud";
import type { UIIntent } from "./index";

const BASE_TIME = new Date("2026-04-15T12:34:56Z");

/** jsdom (2024) does not implement PointerEvent. Fabricate one from MouseEvent. */
function makePointerEvent(
  type: string,
  init: { clientX?: number; clientY?: number; pointerId?: number; bubbles?: boolean },
): Event {
  const evt = new MouseEvent(type, {
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    bubbles: init.bubbles ?? true,
    cancelable: true,
  });
  Object.defineProperty(evt, "pointerId", { value: init.pointerId ?? 1 });
  return evt;
}

function makeHud(): {
  hud: BottomHud;
  dispatch: ReturnType<typeof vi.fn>;
  el: HTMLElement;
} {
  const dispatch = vi.fn();
  const hud = createBottomHud({ timeUtc: BASE_TIME, lat: 51.5, lon: -0.12 }, dispatch);
  document.body.appendChild(hud.element);
  return { hud, dispatch, el: hud.element };
}

describe("createBottomHud", () => {
  let hud: BottomHud;
  let dispatch: ReturnType<typeof vi.fn>;
  let el: HTMLElement;

  beforeEach(() => {
    ({ hud, dispatch, el } = makeHud());
  });

  afterEach(() => {
    hud.destroy();
    if (el.parentNode) el.parentNode.removeChild(el);
    vi.useRealTimers();
  });

  it("returns an HTMLElement", () => {
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it("is fixed to the bottom of the viewport", () => {
    expect(el.style.position).toBe("fixed");
    expect(el.style.bottom).toBe("0px");
  });

  it("shows UTC time in HH:MM:SS format", () => {
    const utc = el.querySelector<HTMLElement>("[data-testid='hud-utc']");
    expect(utc).not.toBeNull();
    expect(utc!.textContent).toContain("12:34:56");
    expect(utc!.textContent).toContain("UTC");
  });

  it("shows local time alongside UTC", () => {
    const local = el.querySelector<HTMLElement>("[data-testid='hud-local']");
    expect(local).not.toBeNull();
    expect(local!.textContent).not.toBe("");
  });

  it("shows the observer location in the left chip", () => {
    const loc = el.querySelector<HTMLElement>("[data-testid='hud-location']");
    expect(loc).not.toBeNull();
    expect(loc!.textContent).toContain("51.5");
    expect(loc!.textContent).toContain("-0.12");
  });

  it("shows a compass heading chip (defaults to N)", () => {
    const compass = el.querySelector<HTMLElement>("[data-testid='hud-compass']");
    expect(compass).not.toBeNull();
    expect(compass!.textContent).toMatch(/N/);
  });

  describe("setTime", () => {
    it("updates the UTC time readout", () => {
      hud.setTime(new Date("2030-07-04T09:30:15Z"));
      const utc = el.querySelector<HTMLElement>("[data-testid='hud-utc']")!;
      expect(utc.textContent).toContain("09:30:15");
    });

    it("does not dispatch an intent when called", () => {
      hud.setTime(new Date("2030-07-04T09:30:15Z"));
      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  describe("setObserver", () => {
    it("updates the location chip text", () => {
      hud.setObserver(40.0, -74.0);
      const loc = el.querySelector<HTMLElement>("[data-testid='hud-location']")!;
      expect(loc.textContent).toContain("40");
      expect(loc.textContent).toContain("-74");
    });
  });

  describe("setCompass", () => {
    it("shows N when near 0 degrees", () => {
      hud.setCompass(0);
      const compass = el.querySelector<HTMLElement>("[data-testid='hud-compass']")!;
      expect(compass.textContent).toMatch(/N/);
      expect(compass.textContent).toContain("0");
    });

    it("shows E when near 90 degrees", () => {
      hud.setCompass(90);
      const compass = el.querySelector<HTMLElement>("[data-testid='hud-compass']")!;
      expect(compass.textContent).toMatch(/E/);
    });

    it("shows S when near 180 degrees", () => {
      hud.setCompass(180);
      const compass = el.querySelector<HTMLElement>("[data-testid='hud-compass']")!;
      expect(compass.textContent).toMatch(/S/);
    });

    it("shows W when near 270 degrees", () => {
      hud.setCompass(270);
      const compass = el.querySelector<HTMLElement>("[data-testid='hud-compass']")!;
      expect(compass.textContent).toMatch(/W/);
    });

    it("wraps azimuth modulo 360", () => {
      hud.setCompass(450);
      const compass = el.querySelector<HTMLElement>("[data-testid='hud-compass']")!;
      expect(compass.textContent).toMatch(/E/);
    });
  });

  describe("location picker", () => {
    it("clicking the location chip dispatches open-location-picker intent", () => {
      const loc = el.querySelector<HTMLElement>("[data-testid='hud-location']")!;
      loc.click();
      expect(dispatch).toHaveBeenCalledWith({ type: "open-location-picker" });
    });
  });

  describe("keyboard scrubbing", () => {
    it("ArrowRight dispatches set-time +1 minute", () => {
      const evt = new KeyboardEvent("keydown", { key: "ArrowRight" });
      window.dispatchEvent(evt);
      expect(dispatch).toHaveBeenCalledOnce();
      const intent = dispatch.mock.calls[0]![0] as UIIntent;
      expect(intent.type).toBe("set-time");
      if (intent.type === "set-time") {
        expect(intent.time.getTime()).toBe(BASE_TIME.getTime() + 60_000);
      }
    });

    it("ArrowLeft dispatches set-time -1 minute", () => {
      const evt = new KeyboardEvent("keydown", { key: "ArrowLeft" });
      window.dispatchEvent(evt);
      const intent = dispatch.mock.calls[0]![0] as UIIntent;
      expect(intent.type).toBe("set-time");
      if (intent.type === "set-time") {
        expect(intent.time.getTime()).toBe(BASE_TIME.getTime() - 60_000);
      }
    });

    it("Shift+ArrowRight dispatches set-time +1 hour", () => {
      const evt = new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true });
      window.dispatchEvent(evt);
      const intent = dispatch.mock.calls[0]![0] as UIIntent;
      expect(intent.type).toBe("set-time");
      if (intent.type === "set-time") {
        expect(intent.time.getTime()).toBe(BASE_TIME.getTime() + 3_600_000);
      }
    });

    it("Shift+ArrowLeft dispatches set-time -1 hour", () => {
      const evt = new KeyboardEvent("keydown", { key: "ArrowLeft", shiftKey: true });
      window.dispatchEvent(evt);
      const intent = dispatch.mock.calls[0]![0] as UIIntent;
      expect(intent.type).toBe("set-time");
      if (intent.type === "set-time") {
        expect(intent.time.getTime()).toBe(BASE_TIME.getTime() - 3_600_000);
      }
    });

    it("Alt+ArrowRight dispatches set-time +1 day", () => {
      const evt = new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true });
      window.dispatchEvent(evt);
      const intent = dispatch.mock.calls[0]![0] as UIIntent;
      expect(intent.type).toBe("set-time");
      if (intent.type === "set-time") {
        expect(intent.time.getTime()).toBe(BASE_TIME.getTime() + 86_400_000);
      }
    });

    it("Alt+ArrowLeft dispatches set-time -1 day", () => {
      const evt = new KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true });
      window.dispatchEvent(evt);
      const intent = dispatch.mock.calls[0]![0] as UIIntent;
      expect(intent.type).toBe("set-time");
      if (intent.type === "set-time") {
        expect(intent.time.getTime()).toBe(BASE_TIME.getTime() - 86_400_000);
      }
    });

    it("Space dispatches toggle-animation", () => {
      const evt = new KeyboardEvent("keydown", { key: " " });
      window.dispatchEvent(evt);
      expect(dispatch).toHaveBeenCalledWith({ type: "toggle-animation" });
    });

    it("ignores arrow keys when focus is inside an input element", () => {
      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();
      const evt = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true });
      input.dispatchEvent(evt);
      expect(dispatch).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });

    it("unrelated keys do not dispatch", () => {
      const evt = new KeyboardEvent("keydown", { key: "x" });
      window.dispatchEvent(evt);
      expect(dispatch).not.toHaveBeenCalled();
    });

    it("sequential arrow presses accumulate from current time state", () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
      // Both dispatches compute relative to the last-known setTime state.
      // Since we never call setTime between presses, both use BASE_TIME.
      // app.ts is responsible for feeding setTime back in after handling set-time.
      expect(dispatch).toHaveBeenCalledTimes(2);
    });
  });

  describe("drag-scrub", () => {
    it("dragging the scrub bar horizontally dispatches set-time", () => {
      const scrub = el.querySelector<HTMLElement>("[data-testid='hud-scrub']")!;
      // Simulate pointer down + move
      scrub.dispatchEvent(makePointerEvent("pointerdown", { clientX: 100, pointerId: 1 }));
      window.dispatchEvent(makePointerEvent("pointermove", { clientX: 150, pointerId: 1 }));
      window.dispatchEvent(makePointerEvent("pointerup", { clientX: 150, pointerId: 1 }));
      // At least one set-time intent emitted during the drag
      const setTimeCalls = dispatch.mock.calls.filter(
        (c) => (c[0] as UIIntent).type === "set-time",
      );
      expect(setTimeCalls.length).toBeGreaterThan(0);
    });
  });

  describe("idle fade", () => {
    it("fades out after 2 seconds of no input", () => {
      vi.useFakeTimers();
      const { hud: h, el: e } = makeHud();
      try {
        // Immediately after creation, opacity should be 1 (active)
        expect(parseFloat(e.style.opacity || "1")).toBeGreaterThan(0.5);
        vi.advanceTimersByTime(2500);
        expect(parseFloat(e.style.opacity || "1")).toBeLessThan(0.5);
      } finally {
        h.destroy();
        if (e.parentNode) e.parentNode.removeChild(e);
      }
    });

    it("restores opacity on pointer movement", () => {
      vi.useFakeTimers();
      const { hud: h, el: e } = makeHud();
      try {
        vi.advanceTimersByTime(2500);
        expect(parseFloat(e.style.opacity || "1")).toBeLessThan(0.5);
        window.dispatchEvent(makePointerEvent("pointermove", { clientX: 10, clientY: 10 }));
        expect(parseFloat(e.style.opacity || "1")).toBeGreaterThan(0.5);
      } finally {
        h.destroy();
        if (e.parentNode) e.parentNode.removeChild(e);
      }
    });

    it("restores opacity on keyboard input", () => {
      vi.useFakeTimers();
      const { hud: h, el: e } = makeHud();
      try {
        vi.advanceTimersByTime(2500);
        expect(parseFloat(e.style.opacity || "1")).toBeLessThan(0.5);
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
        expect(parseFloat(e.style.opacity || "1")).toBeGreaterThan(0.5);
      } finally {
        h.destroy();
        if (e.parentNode) e.parentNode.removeChild(e);
      }
    });
  });

  describe("destroy", () => {
    it("removes global listeners so key events stop dispatching", () => {
      const localDispatch = vi.fn();
      const h = createBottomHud(
        { timeUtc: BASE_TIME, lat: 0, lon: 0 },
        localDispatch,
      );
      document.body.appendChild(h.element);
      h.destroy();
      if (h.element.parentNode) h.element.parentNode.removeChild(h.element);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
      expect(localDispatch).not.toHaveBeenCalled();
    });
  });
});
