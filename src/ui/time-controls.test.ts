/* SPDX-License-Identifier: Apache-2.0 */
import { beforeEach, describe, expect, it, vi } from "vitest";
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
});
