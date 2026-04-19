/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDrawer } from "./drawer";

describe("createDrawer", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns an object with element, open, close, and isOpen", () => {
    const drawer = createDrawer({ side: "right", width: "320px" });
    expect(drawer).toHaveProperty("element");
    expect(typeof drawer.open).toBe("function");
    expect(typeof drawer.close).toBe("function");
    expect(typeof drawer.isOpen).toBe("function");
  });

  it("is hidden initially (not open)", () => {
    const drawer = createDrawer({ side: "right", width: "320px" });
    document.body.appendChild(drawer.element);
    expect(drawer.isOpen()).toBe(false);
  });

  it("open(content) shows the drawer and mounts the content", () => {
    const drawer = createDrawer({ side: "right", width: "320px" });
    document.body.appendChild(drawer.element);
    const content = document.createElement("div");
    content.textContent = "hello";
    content.dataset.testid = "drawer-probe";
    drawer.open(content);
    expect(drawer.isOpen()).toBe(true);
    expect(drawer.element.querySelector("[data-testid='drawer-probe']")).not.toBeNull();
  });

  it("close() hides the drawer", () => {
    const drawer = createDrawer({ side: "right", width: "320px" });
    document.body.appendChild(drawer.element);
    drawer.open(document.createElement("div"));
    drawer.close();
    expect(drawer.isOpen()).toBe(false);
  });

  it("open() replaces previous content when called again", () => {
    const drawer = createDrawer({ side: "right", width: "320px" });
    document.body.appendChild(drawer.element);
    const a = document.createElement("div");
    a.dataset.testid = "a";
    const b = document.createElement("div");
    b.dataset.testid = "b";
    drawer.open(a);
    drawer.open(b);
    expect(drawer.element.querySelector("[data-testid='a']")).toBeNull();
    expect(drawer.element.querySelector("[data-testid='b']")).not.toBeNull();
  });

  it("close button (×) in the drawer closes it", () => {
    const drawer = createDrawer({ side: "right", width: "320px" });
    document.body.appendChild(drawer.element);
    drawer.open(document.createElement("div"));
    const btn = drawer.element.querySelector<HTMLButtonElement>("[data-testid='drawer-close']");
    expect(btn).not.toBeNull();
    btn!.click();
    expect(drawer.isOpen()).toBe(false);
  });

  it("Escape key closes the drawer when open", () => {
    const drawer = createDrawer({ side: "right", width: "320px" });
    document.body.appendChild(drawer.element);
    drawer.open(document.createElement("div"));
    const evt = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(evt);
    expect(drawer.isOpen()).toBe(false);
  });

  it("Escape key is a no-op when drawer is closed", () => {
    const drawer = createDrawer({ side: "right", width: "320px" });
    document.body.appendChild(drawer.element);
    const onClose = vi.fn();
    const drawer2 = createDrawer({ side: "right", width: "320px", onClose });
    document.body.appendChild(drawer2.element);
    const evt = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(evt);
    expect(drawer.isOpen()).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("backdrop click closes the drawer", () => {
    const drawer = createDrawer({ side: "right", width: "320px" });
    document.body.appendChild(drawer.element);
    drawer.open(document.createElement("div"));
    const backdrop = drawer.element.querySelector<HTMLElement>("[data-testid='drawer-backdrop']");
    expect(backdrop).not.toBeNull();
    backdrop!.click();
    expect(drawer.isOpen()).toBe(false);
  });

  it("clicking inside the drawer panel does NOT close it", () => {
    const drawer = createDrawer({ side: "right", width: "320px" });
    document.body.appendChild(drawer.element);
    const content = document.createElement("div");
    content.dataset.testid = "inside";
    drawer.open(content);
    const inside = drawer.element.querySelector<HTMLElement>("[data-testid='inside']")!;
    inside.click();
    expect(drawer.isOpen()).toBe(true);
  });

  it("onClose callback is fired when the drawer closes via close()", () => {
    const onClose = vi.fn();
    const drawer = createDrawer({ side: "right", width: "320px", onClose });
    document.body.appendChild(drawer.element);
    drawer.open(document.createElement("div"));
    drawer.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("onClose fires when closed via Escape", () => {
    const onClose = vi.fn();
    const drawer = createDrawer({ side: "right", width: "320px", onClose });
    document.body.appendChild(drawer.element);
    drawer.open(document.createElement("div"));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("onClose fires when closed via backdrop click", () => {
    const onClose = vi.fn();
    const drawer = createDrawer({ side: "right", width: "320px", onClose });
    document.body.appendChild(drawer.element);
    drawer.open(document.createElement("div"));
    drawer.element
      .querySelector<HTMLElement>("[data-testid='drawer-backdrop']")!
      .click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("onClose does NOT fire when closed while already closed (no-op close)", () => {
    const onClose = vi.fn();
    const drawer = createDrawer({ side: "right", width: "320px", onClose });
    document.body.appendChild(drawer.element);
    drawer.close();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("accepts numeric width (interpreted as px)", () => {
    const drawer = createDrawer({ side: "right", width: 400 });
    document.body.appendChild(drawer.element);
    drawer.open(document.createElement("div"));
    const panel = drawer.element.querySelector<HTMLElement>("[data-testid='drawer-panel']")!;
    expect(panel.style.width).toBe("400px");
  });

  it("supports side='left' by positioning the panel on the left", () => {
    const drawer = createDrawer({ side: "left", width: "280px" });
    document.body.appendChild(drawer.element);
    drawer.open(document.createElement("div"));
    const panel = drawer.element.querySelector<HTMLElement>("[data-testid='drawer-panel']")!;
    // Panel should be anchored to left edge for side='left'
    expect(panel.style.left).toBe("0px");
  });
});
