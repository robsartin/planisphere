/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi } from "vitest";
import { createEmptySkyPopover } from "./empty-sky-popover";
import type { UIIntent } from "./index";

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
