/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmailGateModal } from "./email-gate-modal";
import { PRO_EMAIL_ALLOWLIST, USER_STORAGE_KEY, getUser } from "../features";

describe("createEmailGateModal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.body.style.overflow = "";
    globalThis.localStorage?.clear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.body.style.overflow = "";
    globalThis.localStorage?.clear();
  });

  it("exposes element, open, close, isOpen", () => {
    const modal = createEmailGateModal({ onGranted: vi.fn() });
    expect(modal).toHaveProperty("element");
    expect(typeof modal.open).toBe("function");
    expect(typeof modal.close).toBe("function");
    expect(typeof modal.isOpen).toBe("function");
  });

  it("is hidden initially", () => {
    const modal = createEmailGateModal({ onGranted: vi.fn() });
    document.body.appendChild(modal.element);
    expect(modal.isOpen()).toBe(false);
    expect(modal.element.style.display).toBe("none");
  });

  it("open() makes it visible, close() hides it", () => {
    const modal = createEmailGateModal({ onGranted: vi.fn() });
    document.body.appendChild(modal.element);
    modal.open();
    expect(modal.isOpen()).toBe(true);
    expect(modal.element.style.display).not.toBe("none");
    modal.close();
    expect(modal.isOpen()).toBe(false);
    expect(modal.element.style.display).toBe("none");
  });

  it("clicking the backdrop closes the modal", () => {
    const modal = createEmailGateModal({ onGranted: vi.fn() });
    document.body.appendChild(modal.element);
    modal.open();
    const backdrop = modal.element.querySelector<HTMLElement>(
      "[data-testid='email-gate-backdrop']",
    )!;
    backdrop.click();
    expect(modal.isOpen()).toBe(false);
  });

  it("pressing Escape closes the modal", () => {
    const modal = createEmailGateModal({ onGranted: vi.fn() });
    document.body.appendChild(modal.element);
    modal.open();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(modal.isOpen()).toBe(false);
  });

  it("Escape is a no-op when the modal is closed", () => {
    const modal = createEmailGateModal({ onGranted: vi.fn() });
    document.body.appendChild(modal.element);
    // Never opened.
    expect(() =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    ).not.toThrow();
    expect(modal.isOpen()).toBe(false);
  });

  it("cancel button closes the modal", () => {
    const modal = createEmailGateModal({ onGranted: vi.fn() });
    document.body.appendChild(modal.element);
    modal.open();
    const cancel = modal.element.querySelector<HTMLButtonElement>(
      "[data-testid='email-gate-cancel']",
    )!;
    cancel.click();
    expect(modal.isOpen()).toBe(false);
  });

  it("Continue with an allowlisted email invokes onGranted and closes the modal", () => {
    const onGranted = vi.fn();
    const modal = createEmailGateModal({ onGranted });
    document.body.appendChild(modal.element);
    modal.open();
    // Grab the allowlisted email from the shared set so the test doesn't hardcode it.
    const proEmail = [...PRO_EMAIL_ALLOWLIST][0];
    expect(proEmail).toBeDefined();
    const input = modal.element.querySelector<HTMLInputElement>(
      "[data-testid='email-gate-input']",
    )!;
    input.value = proEmail!;
    const continueBtn = modal.element.querySelector<HTMLButtonElement>(
      "[data-testid='email-gate-continue']",
    )!;
    continueBtn.click();
    expect(onGranted).toHaveBeenCalledTimes(1);
    expect(modal.isOpen()).toBe(false);
    // Side effect: the email is persisted through setUser.
    expect(getUser().email).toBe(proEmail);
  });

  it("Continue normalises the email (trims + lowercases) before matching the allowlist", () => {
    const onGranted = vi.fn();
    const modal = createEmailGateModal({ onGranted });
    document.body.appendChild(modal.element);
    modal.open();
    const input = modal.element.querySelector<HTMLInputElement>(
      "[data-testid='email-gate-input']",
    )!;
    input.value = "  ROB.SARTIN@Gmail.COM  ";
    const continueBtn = modal.element.querySelector<HTMLButtonElement>(
      "[data-testid='email-gate-continue']",
    )!;
    continueBtn.click();
    expect(onGranted).toHaveBeenCalledTimes(1);
  });

  it("Continue with a non-allowlisted email swaps to the request-access state", () => {
    const onGranted = vi.fn();
    const modal = createEmailGateModal({ onGranted });
    document.body.appendChild(modal.element);
    modal.open();
    const input = modal.element.querySelector<HTMLInputElement>(
      "[data-testid='email-gate-input']",
    )!;
    input.value = "stranger@example.com";
    const continueBtn = modal.element.querySelector<HTMLButtonElement>(
      "[data-testid='email-gate-continue']",
    )!;
    continueBtn.click();
    expect(onGranted).not.toHaveBeenCalled();
    expect(modal.isOpen()).toBe(true); // stays open so the user can read the CTA
    // Request-access state visible.
    expect(modal.element.querySelector("[data-testid='email-gate-request-state']")).not.toBeNull();
    // Initial form state hidden.
    expect(modal.element.querySelector("[data-testid='email-gate-form']")).toBeNull();
  });

  it("the request-access state includes a mailto button pointing at rob.sartin@gmail.com", () => {
    const modal = createEmailGateModal({ onGranted: vi.fn() });
    document.body.appendChild(modal.element);
    modal.open();
    const input = modal.element.querySelector<HTMLInputElement>(
      "[data-testid='email-gate-input']",
    )!;
    input.value = "stranger@example.com";
    modal.element.querySelector<HTMLButtonElement>("[data-testid='email-gate-continue']")!.click();
    const mailto = modal.element.querySelector<HTMLAnchorElement>(
      "[data-testid='email-gate-mailto']",
    );
    expect(mailto).not.toBeNull();
    expect(mailto!.href.startsWith("mailto:rob.sartin@gmail.com")).toBe(true);
  });

  it("Continue with a blank email does not call onGranted and does not persist", () => {
    const onGranted = vi.fn();
    const modal = createEmailGateModal({ onGranted });
    document.body.appendChild(modal.element);
    modal.open();
    const continueBtn = modal.element.querySelector<HTMLButtonElement>(
      "[data-testid='email-gate-continue']",
    )!;
    continueBtn.click();
    expect(onGranted).not.toHaveBeenCalled();
    expect(globalThis.localStorage.getItem(USER_STORAGE_KEY)).toBeNull();
    expect(modal.isOpen()).toBe(true);
  });

  it("reopening after a miss resets the modal back to the form state", () => {
    const modal = createEmailGateModal({ onGranted: vi.fn() });
    document.body.appendChild(modal.element);
    modal.open();
    const input = modal.element.querySelector<HTMLInputElement>(
      "[data-testid='email-gate-input']",
    )!;
    input.value = "stranger@example.com";
    modal.element.querySelector<HTMLButtonElement>("[data-testid='email-gate-continue']")!.click();
    // In request-access state now.
    expect(modal.element.querySelector("[data-testid='email-gate-request-state']")).not.toBeNull();
    modal.close();
    modal.open();
    // Back to the form state.
    expect(modal.element.querySelector("[data-testid='email-gate-form']")).not.toBeNull();
    expect(modal.element.querySelector("[data-testid='email-gate-request-state']")).toBeNull();
  });
});
