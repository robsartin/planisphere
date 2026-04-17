/* SPDX-License-Identifier: Apache-2.0 */
import { beforeEach, describe, expect, it } from "vitest";
import { createPanel } from "./panel";

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
});
