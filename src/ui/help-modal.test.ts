/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHelpModal } from "./help-modal";

describe("createHelpModal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.body.style.overflow = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.body.style.overflow = "";
  });

  it("returns an object with element, open, close, isOpen", () => {
    const modal = createHelpModal();
    expect(modal).toHaveProperty("element");
    expect(typeof modal.open).toBe("function");
    expect(typeof modal.close).toBe("function");
    expect(typeof modal.isOpen).toBe("function");
  });

  it("is hidden initially", () => {
    const modal = createHelpModal();
    document.body.appendChild(modal.element);
    expect(modal.isOpen()).toBe(false);
    expect(modal.element.style.display).toBe("none");
  });

  it("open() makes it visible", () => {
    const modal = createHelpModal();
    document.body.appendChild(modal.element);
    modal.open();
    expect(modal.isOpen()).toBe(true);
    expect(modal.element.style.display).not.toBe("none");
  });

  it("close() hides it", () => {
    const modal = createHelpModal();
    document.body.appendChild(modal.element);
    modal.open();
    modal.close();
    expect(modal.isOpen()).toBe(false);
    expect(modal.element.style.display).toBe("none");
  });

  it("renders the bundled user guide with a known heading", () => {
    const modal = createHelpModal();
    document.body.appendChild(modal.element);
    modal.open();
    const content = modal.element.querySelector("[data-testid='help-modal-content']");
    expect(content).not.toBeNull();
    expect(content!.innerHTML).toContain("Getting Started");
  });

  it("close button (×) closes the modal", () => {
    const modal = createHelpModal();
    document.body.appendChild(modal.element);
    modal.open();
    const btn = modal.element.querySelector<HTMLButtonElement>(
      "[data-testid='help-modal-close']",
    );
    expect(btn).not.toBeNull();
    btn!.click();
    expect(modal.isOpen()).toBe(false);
  });

  it("clicking the backdrop closes the modal", () => {
    const modal = createHelpModal();
    document.body.appendChild(modal.element);
    modal.open();
    const backdrop = modal.element.querySelector<HTMLElement>(
      "[data-testid='help-modal-backdrop']",
    );
    expect(backdrop).not.toBeNull();
    backdrop!.click();
    expect(modal.isOpen()).toBe(false);
  });

  it("clicking the content panel does NOT close the modal", () => {
    const modal = createHelpModal();
    document.body.appendChild(modal.element);
    modal.open();
    const content = modal.element.querySelector<HTMLElement>(
      "[data-testid='help-modal-content']",
    );
    content!.click();
    expect(modal.isOpen()).toBe(true);
  });

  it("Escape key closes the modal when open", () => {
    const modal = createHelpModal();
    document.body.appendChild(modal.element);
    modal.open();
    const evt = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(evt);
    expect(modal.isOpen()).toBe(false);
  });

  it("Escape key is a no-op when the modal is closed", () => {
    const modal = createHelpModal();
    document.body.appendChild(modal.element);
    expect(modal.isOpen()).toBe(false);
    const evt = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(evt);
    expect(modal.isOpen()).toBe(false);
  });

  it("prevents background scroll while open", () => {
    const modal = createHelpModal();
    document.body.appendChild(modal.element);
    modal.open();
    expect(document.body.style.overflow).toBe("hidden");
    modal.close();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("only renders markdown once (content cached across open/close cycles)", () => {
    const modal = createHelpModal();
    document.body.appendChild(modal.element);
    modal.open();
    const content = modal.element.querySelector<HTMLElement>(
      "[data-testid='help-modal-content']",
    )!;
    const firstHtml = content.innerHTML;
    modal.close();
    modal.open();
    expect(content.innerHTML).toBe(firstHtml);
  });
});
