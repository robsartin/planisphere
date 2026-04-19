/* SPDX-License-Identifier: Apache-2.0 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPanel } from "./panel";
import type { UIIntent } from "./index";

describe("createPanel", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("returns an object with element, setContent, and setCollapsed", () => {
    const panel = createPanel(container);
    expect(panel).toHaveProperty("element");
    expect(panel).toHaveProperty("setContent");
    expect(panel).toHaveProperty("setCollapsed");
  });

  it("appends the panel element to the container", () => {
    createPanel(container);
    expect(container.children.length).toBe(1);
  });

  it("panel has a header with a title and toggle button", () => {
    const { element } = createPanel(container);
    const header = element.querySelector("[data-testid='panel-header']");
    expect(header).not.toBeNull();
    const btn = element.querySelector("[data-testid='panel-toggle']");
    expect(btn).not.toBeNull();
  });

  it("collapse button toggles the body visibility", () => {
    const { element } = createPanel(container);
    const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-toggle']")!;
    const body = element.querySelector<HTMLElement>("[data-testid='panel-body']")!;
    // starts expanded
    expect(body.style.display).not.toBe("none");
    btn.click();
    expect(body.style.display).toBe("none");
    btn.click();
    expect(body.style.display).not.toBe("none");
  });

  it("setCollapsed(true) hides the body", () => {
    const { element, setCollapsed } = createPanel(container);
    const body = element.querySelector<HTMLElement>("[data-testid='panel-body']")!;
    setCollapsed(true);
    expect(body.style.display).toBe("none");
  });

  it("setContent replaces the body content", () => {
    const { setContent } = createPanel(container);
    const child = document.createElement("span");
    child.textContent = "hello";
    setContent(child);
    expect(container.querySelector("span")).not.toBeNull();
  });

  describe("night vision button", () => {
    it("renders a night-vision button in the header", () => {
      const { element } = createPanel(container, vi.fn());
      const btn = element.querySelector("[data-testid='panel-night-vision']");
      expect(btn).not.toBeNull();
    });

    it("clicking the night-vision button dispatches toggle-night-vision intent", () => {
      const dispatch = vi.fn();
      const { element } = createPanel(container, dispatch);
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-night-vision']")!;
      btn.click();
      expect(dispatch).toHaveBeenCalledWith({ type: "toggle-night-vision" } satisfies UIIntent);
    });

    it("button glows red when nightVision is true", () => {
      const { element, setNightVision } = createPanel(container, vi.fn());
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-night-vision']")!;
      setNightVision(true);
      expect(btn.style.boxShadow).toContain("red");
    });

    it("button reverts style when nightVision is false", () => {
      const { element, setNightVision } = createPanel(container, vi.fn());
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-night-vision']")!;
      setNightVision(true);
      setNightVision(false);
      expect(btn.style.boxShadow).toBe("");
    });
  });

  describe("help button", () => {
    it("renders a help button in the header", () => {
      const { element } = createPanel(container);
      const btn = element.querySelector("[data-testid='panel-help']");
      expect(btn).not.toBeNull();
    });

    it("displays the ? icon", () => {
      const { element } = createPanel(container);
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-help']")!;
      expect(btn.textContent).toBe("?");
    });

    it("clicking the help button invokes the provided onOpenHelp callback", () => {
      const onOpenHelp = vi.fn();
      const { element } = createPanel(container, vi.fn(), { onOpenHelp });
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-help']")!;
      btn.click();
      expect(onOpenHelp).toHaveBeenCalledTimes(1);
    });

    it("clicking the help button is a no-op when no callback is provided", () => {
      const { element } = createPanel(container);
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-help']")!;
      expect(() => btn.click()).not.toThrow();
    });
  });

  describe("events button", () => {
    it("renders an events (📅) button in the header", () => {
      const { element } = createPanel(container);
      const btn = element.querySelector("[data-testid='panel-events']");
      expect(btn).not.toBeNull();
    });

    it("displays the 📅 icon", () => {
      const { element } = createPanel(container);
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-events']")!;
      expect(btn.textContent).toBe("\u{1F4C5}");
    });

    it("clicking the events button invokes the provided onOpenEvents callback", () => {
      const onOpenEvents = vi.fn();
      const { element } = createPanel(container, vi.fn(), { onOpenEvents });
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-events']")!;
      btn.click();
      expect(onOpenEvents).toHaveBeenCalledTimes(1);
    });

    it("clicking the events button is a no-op when no callback is provided", () => {
      const { element } = createPanel(container);
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-events']")!;
      expect(() => btn.click()).not.toThrow();
    });
  });

  describe("copy-link button", () => {
    beforeEach(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        writable: true,
        configurable: true,
      });
    });

    it("renders a copy-link button in the header", () => {
      const { element } = createPanel(container);
      const btn = element.querySelector("[data-testid='panel-copy-link']");
      expect(btn).not.toBeNull();
    });

    it("clicking the copy-link button calls navigator.clipboard.writeText with the current URL", () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        writable: true,
        configurable: true,
      });
      const { element } = createPanel(container);
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-copy-link']")!;
      btn.click();
      expect(writeText).toHaveBeenCalledWith(window.location.href);
    });

    it("shows 'Copied!' feedback after clicking", async () => {
      const { element } = createPanel(container);
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-copy-link']")!;
      const originalText = btn.textContent;
      btn.click();
      await Promise.resolve(); // flush microtasks
      expect(btn.textContent).toBe("Copied!");
      expect(btn.textContent).not.toBe(originalText);
    });
  });
});
