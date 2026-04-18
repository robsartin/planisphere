/* SPDX-License-Identifier: Apache-2.0 */
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { createTimeControls } from "./time-controls";
import type { UIIntent } from "./index";

const BASE_TIME = new Date("2026-04-15T12:00:00Z");

describe("createTimeControls", () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let el: HTMLElement;

  beforeEach(() => {
    dispatch = vi.fn();
    el = createTimeControls(BASE_TIME, dispatch);
  });

  it("returns an HTMLElement", () => {
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it("contains a datetime-local input pre-filled from the given time", () => {
    const input = el.querySelector<HTMLInputElement>("input[type='datetime-local']");
    expect(input).not.toBeNull();
    expect(input!.value).not.toBe("");
  });

  it("contains a Now button", () => {
    const buttons = [...el.querySelectorAll("button")].map((b) => b.textContent);
    expect(buttons.some((t) => t?.includes("Now"))).toBe(true);
  });

  it("Now button dispatches set-time with approximately current time", () => {
    const btn = [...el.querySelectorAll("button")].find((b) => b.textContent?.includes("Now"))!;
    const before = Date.now();
    btn.click();
    const after = Date.now();
    expect(dispatch).toHaveBeenCalledOnce();
    const intent = dispatch.mock.calls[0]![0] as UIIntent;
    expect(intent.type).toBe("set-time");
    if (intent.type === "set-time") {
      expect(intent.time.getTime()).toBeGreaterThanOrEqual(before);
      expect(intent.time.getTime()).toBeLessThanOrEqual(after + 100);
    }
  });

  it("+1h button dispatches set-time one hour ahead of current value", () => {
    const btn = [...el.querySelectorAll("button")].find((b) => b.textContent?.includes("+1h"))!;
    btn.click();
    expect(dispatch).toHaveBeenCalledOnce();
    const intent = dispatch.mock.calls[0]![0] as UIIntent;
    expect(intent.type).toBe("set-time");
    if (intent.type === "set-time") {
      expect(intent.time.getTime()).toBe(BASE_TIME.getTime() + 3_600_000);
    }
  });

  it("-1h button dispatches set-time one hour behind current value", () => {
    const btn = [...el.querySelectorAll("button")].find((b) => b.textContent?.includes("-1h"))!;
    btn.click();
    const intent = dispatch.mock.calls[0]![0] as UIIntent;
    expect(intent.type).toBe("set-time");
    if (intent.type === "set-time") {
      expect(intent.time.getTime()).toBe(BASE_TIME.getTime() - 3_600_000);
    }
  });

  it("+1d button dispatches set-time 24 hours ahead", () => {
    const btn = [...el.querySelectorAll("button")].find((b) => b.textContent?.includes("+1d"))!;
    btn.click();
    const intent = dispatch.mock.calls[0]![0] as UIIntent;
    expect(intent.type).toBe("set-time");
    if (intent.type === "set-time") {
      expect(intent.time.getTime()).toBe(BASE_TIME.getTime() + 86_400_000);
    }
  });

  it("-1d button dispatches set-time 24 hours behind", () => {
    const btn = [...el.querySelectorAll("button")].find((b) => b.textContent?.includes("-1d"))!;
    btn.click();
    const intent = dispatch.mock.calls[0]![0] as UIIntent;
    expect(intent.type).toBe("set-time");
    if (intent.type === "set-time") {
      expect(intent.time.getTime()).toBe(BASE_TIME.getTime() - 86_400_000);
    }
  });

  it("+1m button dispatches set-time one minute ahead", () => {
    const btn = [...el.querySelectorAll("button")].find((b) => b.textContent?.includes("+1m"))!;
    btn.click();
    const intent = dispatch.mock.calls[0]![0] as UIIntent;
    expect(intent.type).toBe("set-time");
    if (intent.type === "set-time") {
      expect(intent.time.getTime()).toBe(BASE_TIME.getTime() + 60_000);
    }
  });

  it("-1m button dispatches set-time one minute behind", () => {
    const btn = [...el.querySelectorAll("button")].find((b) => b.textContent?.includes("-1m"))!;
    btn.click();
    const intent = dispatch.mock.calls[0]![0] as UIIntent;
    expect(intent.type).toBe("set-time");
    if (intent.type === "set-time") {
      expect(intent.time.getTime()).toBe(BASE_TIME.getTime() - 60_000);
    }
  });

  // Play/pause animation tests
  describe("play/pause animation", () => {
    let rafCallbacks: Array<(ts: number) => void>;

    beforeEach(() => {
      rafCallbacks = [];
      vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
        rafCallbacks.push(cb as (ts: number) => void);
        return rafCallbacks.length;
      });
      vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("contains a play button", () => {
      const buttons = [...el.querySelectorAll("button")].map((b) => b.textContent);
      expect(buttons.some((t) => t?.includes("▶") || t?.includes("⏸"))).toBe(true);
    });

    it("play button starts the animation loop on click", () => {
      const playBtn = [...el.querySelectorAll("button")].find(
        (b) => b.textContent?.includes("▶") || b.textContent?.includes("⏸"),
      )!;
      expect(rafCallbacks.length).toBe(0);
      playBtn.click();
      expect(rafCallbacks.length).toBeGreaterThan(0);
    });

    it("clicking play again (pause) stops the animation loop", () => {
      const cancelSpy = vi.spyOn(globalThis, "cancelAnimationFrame");
      const playBtn = [...el.querySelectorAll("button")].find(
        (b) => b.textContent?.includes("▶") || b.textContent?.includes("⏸"),
      )!;
      playBtn.click(); // start
      expect(playBtn.textContent).toContain("⏸");
      playBtn.click(); // pause
      expect(playBtn.textContent).toContain("▶");
      expect(cancelSpy).toHaveBeenCalled();
    });

    it("animation frame dispatches set-time with simulated elapsed time at 1x", () => {
      const playBtn = [...el.querySelectorAll("button")].find(
        (b) => b.textContent?.includes("▶") || b.textContent?.includes("⏸"),
      )!;
      dispatch.mockClear();
      playBtn.click(); // start playing at 1x
      expect(rafCallbacks.length).toBeGreaterThan(0);
      // Simulate a 100ms real-time frame
      const firstCb = rafCallbacks[0]!;
      rafCallbacks.length = 0;
      firstCb(1000); // first frame: set lastFrameTime
      // second frame: 100ms later → 100ms * 1x = 100ms simulated
      const secondCb = rafCallbacks[0]!;
      secondCb(1100);
      expect(dispatch).toHaveBeenCalled();
      const intent = dispatch.mock.calls[dispatch.mock.calls.length - 1]![0] as UIIntent;
      expect(intent.type).toBe("set-time");
      if (intent.type === "set-time") {
        expect(intent.time.getTime()).toBe(BASE_TIME.getTime() + 100);
      }
    });

    it("animation frame dispatches set-time with 10x simulated elapsed at 10x speed", () => {
      // Select 10x speed
      const select = el.querySelector<HTMLSelectElement>("select[data-speed]");
      expect(select).not.toBeNull();
      select!.value = "10";
      select!.dispatchEvent(new Event("change"));

      const playBtn = [...el.querySelectorAll("button")].find(
        (b) => b.textContent?.includes("▶") || b.textContent?.includes("⏸"),
      )!;
      dispatch.mockClear();
      playBtn.click();

      const firstCb = rafCallbacks[0]!;
      rafCallbacks.length = 0;
      firstCb(1000);
      const secondCb = rafCallbacks[0]!;
      secondCb(1100); // 100ms real → 1000ms simulated at 10x
      expect(dispatch).toHaveBeenCalled();
      const intent = dispatch.mock.calls[dispatch.mock.calls.length - 1]![0] as UIIntent;
      expect(intent.type).toBe("set-time");
      if (intent.type === "set-time") {
        expect(intent.time.getTime()).toBe(BASE_TIME.getTime() + 1000);
      }
    });

    it("speed dropdown has options 1x, 10x, 100x, 1000x", () => {
      const select = el.querySelector<HTMLSelectElement>("select[data-speed]");
      expect(select).not.toBeNull();
      const values = [...select!.options].map((o) => o.value);
      expect(values).toContain("1");
      expect(values).toContain("10");
      expect(values).toContain("100");
      expect(values).toContain("1000");
    });
  });
});
