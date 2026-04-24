/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPanel } from "./panel";
import { setUser } from "../features";
import type { UIIntent } from "./index";

describe("createPanel", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    globalThis.localStorage?.clear();
  });

  afterEach(() => {
    globalThis.localStorage?.clear();
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

  describe("tonight button", () => {
    it("renders a tonight (♀) button in the header", () => {
      const { element } = createPanel(container);
      const btn = element.querySelector("[data-testid='panel-tonight']");
      expect(btn).not.toBeNull();
    });

    it("displays the ♀ icon", () => {
      const { element } = createPanel(container);
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-tonight']")!;
      expect(btn.textContent).toBe("\u2640");
    });

    it("clicking the tonight button invokes the provided onOpenTonight callback", () => {
      const onOpenTonight = vi.fn();
      const { element } = createPanel(container, vi.fn(), { onOpenTonight });
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-tonight']")!;
      btn.click();
      expect(onOpenTonight).toHaveBeenCalledTimes(1);
    });

    it("clicking the tonight button is a no-op when no callback is provided", () => {
      const { element } = createPanel(container);
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-tonight']")!;
      expect(() => btn.click()).not.toThrow();
    });
  });

  describe("plans button", () => {
    it("renders a plans button in the header", () => {
      const { element } = createPanel(container);
      const btn = element.querySelector("[data-testid='panel-plans']");
      expect(btn).not.toBeNull();
    });

    it("clicking the plans button invokes onOpenPlans", () => {
      const onOpenPlans = vi.fn();
      const { element } = createPanel(container, vi.fn(), { onOpenPlans });
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-plans']")!;
      btn.click();
      expect(onOpenPlans).toHaveBeenCalledTimes(1);
    });

    it("clicking the plans button is a no-op when no callback is provided", () => {
      const { element } = createPanel(container);
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-plans']")!;
      expect(() => btn.click()).not.toThrow();
    });
  });

  describe("settings button", () => {
    it("renders a settings button in the header", () => {
      const { element } = createPanel(container);
      const btn = element.querySelector("[data-testid='panel-settings']");
      expect(btn).not.toBeNull();
    });

    it("displays the gear icon", () => {
      const { element } = createPanel(container);
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-settings']")!;
      expect(btn.textContent).toBe("\u2699");
    });

    it("clicking the settings button invokes onOpenSettings", () => {
      const onOpenSettings = vi.fn();
      const { element } = createPanel(container, vi.fn(), { onOpenSettings });
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-settings']")!;
      btn.click();
      expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });

    it("clicking the settings button is a no-op when no callback is provided", () => {
      const { element } = createPanel(container);
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-settings']")!;
      expect(() => btn.click()).not.toThrow();
    });
  });

  describe("mode-toggle button", () => {
    it("renders a mode-toggle button in the header", () => {
      const { element } = createPanel(container);
      const btn = element.querySelector("[data-testid='panel-mode']");
      expect(btn).not.toBeNull();
    });

    it("renders the 🌃 icon while in planetarium mode", () => {
      const { element } = createPanel(container, vi.fn(), { mode: "planetarium" });
      const icon = element.querySelector<HTMLElement>("[data-testid='panel-mode-icon']")!;
      expect(icon.textContent).toBe("\u{1F303}");
    });

    it("renders the 📓 icon while in notebook mode", () => {
      const { element } = createPanel(container, vi.fn(), { mode: "notebook" });
      const icon = element.querySelector<HTMLElement>("[data-testid='panel-mode-icon']")!;
      expect(icon.textContent).toBe("\u{1F4D3}");
    });

    it("defaults the icon to 🌃 when no mode is provided (planetarium default)", () => {
      const { element } = createPanel(container, vi.fn());
      const icon = element.querySelector<HTMLElement>("[data-testid='panel-mode-icon']")!;
      expect(icon.textContent).toBe("\u{1F303}");
    });

    it("clicking in planetarium mode dispatches set-mode notebook (Pro user)", () => {
      setUser("rob.sartin@gmail.com");
      const dispatch = vi.fn();
      const { element } = createPanel(container, dispatch, { mode: "planetarium" });
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-mode']")!;
      btn.click();
      expect(dispatch).toHaveBeenCalledWith({
        type: "set-mode",
        mode: "notebook",
      } satisfies UIIntent);
    });

    it("clicking in planetarium mode invokes onProRequired instead of dispatching when non-Pro", () => {
      const dispatch = vi.fn();
      const onProRequired = vi.fn();
      const { element } = createPanel(container, dispatch, {
        mode: "planetarium",
        onProRequired,
      });
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-mode']")!;
      btn.click();
      expect(onProRequired).toHaveBeenCalledTimes(1);
      expect(dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "set-mode" }) as unknown as UIIntent,
      );
    });

    it("clicking in notebook mode ALWAYS dispatches set-mode planetarium (exit is free)", () => {
      // Even a non-Pro user (e.g. edge case where they're somehow in notebook
      // mode via stale URL) can always exit back to planetarium.
      const dispatch = vi.fn();
      const onProRequired = vi.fn();
      const { element } = createPanel(container, dispatch, {
        mode: "notebook",
        onProRequired,
      });
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-mode']")!;
      btn.click();
      expect(onProRequired).not.toHaveBeenCalled();
      expect(dispatch).toHaveBeenCalledWith({
        type: "set-mode",
        mode: "planetarium",
      } satisfies UIIntent);
    });

    it("clicking in notebook mode dispatches set-mode planetarium", () => {
      const dispatch = vi.fn();
      const { element } = createPanel(container, dispatch, { mode: "notebook" });
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='panel-mode']")!;
      btn.click();
      expect(dispatch).toHaveBeenCalledWith({
        type: "set-mode",
        mode: "planetarium",
      } satisfies UIIntent);
    });

    it("setMode updates the button icon", () => {
      const { element, setMode } = createPanel(container, vi.fn(), { mode: "planetarium" });
      const icon = element.querySelector<HTMLElement>("[data-testid='panel-mode-icon']")!;
      expect(icon.textContent).toBe("\u{1F303}");
      setMode("notebook");
      expect(icon.textContent).toBe("\u{1F4D3}");
      setMode("planetarium");
      expect(icon.textContent).toBe("\u{1F303}");
    });
  });

  describe("mode-toggle Pro pill", () => {
    beforeEach(() => {
      globalThis.localStorage?.clear();
    });

    afterEach(() => {
      globalThis.localStorage?.clear();
    });

    it("renders a 'Pro' pill inside the mode-toggle button when the user is not Pro", () => {
      const { element } = createPanel(container, vi.fn());
      const pill = element.querySelector<HTMLElement>("[data-testid='panel-mode-pro']");
      expect(pill).not.toBeNull();
      expect(pill!.textContent).toMatch(/pro/i);
    });

    it("does not render the 'Pro' pill when the user is Pro", () => {
      setUser("rob.sartin@gmail.com");
      const { element } = createPanel(container, vi.fn());
      const pill = element.querySelector<HTMLElement>("[data-testid='panel-mode-pro']");
      expect(pill).toBeNull();
    });
  });

  describe("layout regressions (issue #228)", () => {
    it("allows the header button group to wrap so the row of icons cannot force horizontal overflow", () => {
      // Post-Phase-1 the header carries 7+ icon buttons. With PANEL_WIDTH
      // fixed at 280px, a single non-wrapping row overflows and makes the
      // panel appear wider at the top than at its body. The header row
      // (or its btn group) must permit flex wrapping.
      const { element } = createPanel(container);
      const header = element.querySelector<HTMLElement>("[data-testid='panel-header']")!;
      const btnGroup = header.children[1] as HTMLElement;
      const headerWraps = header.style.flexWrap === "wrap";
      const btnGroupWraps = btnGroup.style.flexWrap === "wrap";
      expect(headerWraps || btnGroupWraps).toBe(true);
    });

    it("does not impose an overflow-y:auto that would render a spurious scrollbar on short content", () => {
      // After Phase 1 the body content is short (search + location + view +
      // fov). A panel-wide overflow-y:auto combined with max-height:80vh is
      // sized for the pre-Phase-1 content and renders an unwanted scrollbar.
      const { element } = createPanel(container);
      expect(element.style.overflowY).not.toBe("auto");
    });

    it("does not clamp the panel to a viewport-relative max-height larger than its content", () => {
      // Let block layout size the panel to its content; the old 80vh cap is
      // left over from when the panel carried the events/time/layers UIs.
      const { element } = createPanel(container);
      expect(element.style.maxHeight).toBe("");
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
