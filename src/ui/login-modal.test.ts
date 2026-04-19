/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLoginModal } from "./login-modal";
import type { AuthError } from "../auth";
import { err, ok, type Result } from "../result";

function makeOkRequester(): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(ok(undefined) as Result<void, AuthError>);
}

describe("createLoginModal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("starts hidden", () => {
    const modal = createLoginModal({ requestMagicLink: makeOkRequester() });
    document.body.appendChild(modal.element);
    expect(modal.isOpen()).toBe(false);
    expect(modal.element.style.display).toBe("none");
  });

  it("open() shows the modal", () => {
    const modal = createLoginModal({ requestMagicLink: makeOkRequester() });
    document.body.appendChild(modal.element);
    modal.open();
    expect(modal.isOpen()).toBe(true);
    expect(modal.element.style.display).not.toBe("none");
  });

  it("close() hides the modal", () => {
    const modal = createLoginModal({ requestMagicLink: makeOkRequester() });
    document.body.appendChild(modal.element);
    modal.open();
    modal.close();
    expect(modal.isOpen()).toBe(false);
  });

  it("clicking the backdrop closes the modal", () => {
    const modal = createLoginModal({ requestMagicLink: makeOkRequester() });
    document.body.appendChild(modal.element);
    modal.open();
    const backdrop = modal.element.querySelector<HTMLElement>(
      "[data-testid='login-modal-backdrop']",
    );
    backdrop?.click();
    expect(modal.isOpen()).toBe(false);
  });

  it("Escape closes the modal", () => {
    const modal = createLoginModal({ requestMagicLink: makeOkRequester() });
    document.body.appendChild(modal.element);
    modal.open();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(modal.isOpen()).toBe(false);
  });

  it("submitting a valid email calls requestMagicLink and shows the sent state", async () => {
    const requester = vi.fn().mockResolvedValue(ok(undefined) as Result<void, AuthError>);
    const modal = createLoginModal({ requestMagicLink: requester });
    document.body.appendChild(modal.element);
    modal.open();
    const input = modal.element.querySelector<HTMLInputElement>(
      "[data-testid='login-modal-email']",
    )!;
    input.value = "alice@example.com";
    const form = modal.element.querySelector<HTMLFormElement>("[data-testid='login-modal-form']")!;
    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    // Let the microtask queue drain for the awaited requester.
    await Promise.resolve();
    await Promise.resolve();
    expect(requester).toHaveBeenCalledWith("alice@example.com");
    const sent = modal.element.querySelector("[data-testid='login-modal-sent']");
    expect(sent).not.toBeNull();
  });

  it("invalid_email error renders an inline message", async () => {
    const requester = vi
      .fn()
      .mockResolvedValue(err({ kind: "invalid_email" }) as Result<void, AuthError>);
    const modal = createLoginModal({ requestMagicLink: requester });
    document.body.appendChild(modal.element);
    modal.open();
    const input = modal.element.querySelector<HTMLInputElement>(
      "[data-testid='login-modal-email']",
    )!;
    input.value = "not-an-email";
    const form = modal.element.querySelector<HTMLFormElement>("[data-testid='login-modal-form']")!;
    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    const error = modal.element.querySelector<HTMLElement>("[data-testid='login-modal-error']");
    expect(error).not.toBeNull();
    expect(error!.textContent).toContain("valid email");
  });

  it("rate_limited error renders a 'try again shortly' message", async () => {
    const requester = vi
      .fn()
      .mockResolvedValue(err({ kind: "rate_limited" }) as Result<void, AuthError>);
    const modal = createLoginModal({ requestMagicLink: requester });
    document.body.appendChild(modal.element);
    modal.open();
    const input = modal.element.querySelector<HTMLInputElement>(
      "[data-testid='login-modal-email']",
    )!;
    input.value = "spam@example.com";
    modal.element
      .querySelector<HTMLFormElement>("[data-testid='login-modal-form']")!
      .dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    const error = modal.element.querySelector<HTMLElement>("[data-testid='login-modal-error']");
    expect(error?.textContent?.toLowerCase()).toMatch(/already sent|try again|moment/);
  });

  it("network/server error renders a generic retry message", async () => {
    const requester = vi
      .fn()
      .mockResolvedValue(err({ kind: "network" }) as Result<void, AuthError>);
    const modal = createLoginModal({ requestMagicLink: requester });
    document.body.appendChild(modal.element);
    modal.open();
    const input = modal.element.querySelector<HTMLInputElement>(
      "[data-testid='login-modal-email']",
    )!;
    input.value = "alice@example.com";
    modal.element
      .querySelector<HTMLFormElement>("[data-testid='login-modal-form']")!
      .dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    const error = modal.element.querySelector<HTMLElement>("[data-testid='login-modal-error']");
    expect(error).not.toBeNull();
  });

  it("does not call requestMagicLink for an empty email", async () => {
    const requester = vi.fn();
    const modal = createLoginModal({ requestMagicLink: requester });
    document.body.appendChild(modal.element);
    modal.open();
    const form = modal.element.querySelector<HTMLFormElement>("[data-testid='login-modal-form']")!;
    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    await Promise.resolve();
    expect(requester).not.toHaveBeenCalled();
  });

  it("open() resets to the email-entry state after a previous 'sent' state", async () => {
    const requester = vi.fn().mockResolvedValue(ok(undefined) as Result<void, AuthError>);
    const modal = createLoginModal({ requestMagicLink: requester });
    document.body.appendChild(modal.element);
    modal.open();
    const input = modal.element.querySelector<HTMLInputElement>(
      "[data-testid='login-modal-email']",
    )!;
    input.value = "alice@example.com";
    modal.element
      .querySelector<HTMLFormElement>("[data-testid='login-modal-form']")!
      .dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(modal.element.querySelector("[data-testid='login-modal-sent']")).not.toBeNull();
    modal.close();
    modal.open();
    expect(modal.element.querySelector("[data-testid='login-modal-sent']")).toBeNull();
    expect(modal.element.querySelector("[data-testid='login-modal-form']")).not.toBeNull();
  });
});
