/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDescribeSkyModal } from "./describe-sky-modal";

const SAMPLE_SUMMARY =
  "Facing east-southeast (heading 112°) from 61.2° N, 149.9° W. Jupiter is medium-high in the south, 45° up.";

describe("createDescribeSkyModal", () => {
  afterEach(() => {
    document.body.style.overflow = "";
    document.body.innerHTML = "";
  });

  it("mounts hidden and opens with the given summary text", () => {
    const modal = createDescribeSkyModal({ getSummary: () => "static" });
    document.body.appendChild(modal.element);
    expect(modal.element.style.display).toBe("none");
    expect(modal.isOpen()).toBe(false);

    modal.open(SAMPLE_SUMMARY);
    expect(modal.isOpen()).toBe(true);
    expect(modal.element.style.display).toBe("block");
    const summary = document.querySelector('[data-testid="describe-sky-summary"]');
    expect(summary?.textContent).toBe(SAMPLE_SUMMARY);
  });

  it("closes on the × button and on the backdrop click", () => {
    const modal = createDescribeSkyModal({ getSummary: () => "static" });
    document.body.appendChild(modal.element);
    modal.open(SAMPLE_SUMMARY);
    (document.querySelector("[data-testid='describe-sky-close']") as HTMLElement).click();
    expect(modal.isOpen()).toBe(false);

    modal.open(SAMPLE_SUMMARY);
    (document.querySelector("[data-testid='describe-sky-backdrop']") as HTMLElement).click();
    expect(modal.isOpen()).toBe(false);
  });

  it("Refresh button re-invokes the getSummary callback", () => {
    let calls = 0;
    const modal = createDescribeSkyModal({
      getSummary: () => {
        calls += 1;
        return `refreshed ${String(calls)}`;
      },
    });
    document.body.appendChild(modal.element);
    modal.open("initial");
    expect(calls).toBe(0);
    (document.querySelector("[data-testid='describe-sky-refresh']") as HTMLElement).click();
    expect(calls).toBe(1);
    const summary = document.querySelector('[data-testid="describe-sky-summary"]');
    expect(summary?.textContent).toBe("refreshed 1");
  });

  it("Copy button forwards the current summary to navigator.clipboard.writeText", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const modal = createDescribeSkyModal({ getSummary: () => "static" });
    document.body.appendChild(modal.element);
    modal.open(SAMPLE_SUMMARY);
    (document.querySelector("[data-testid='describe-sky-copy']") as HTMLElement).click();
    expect(writeText).toHaveBeenCalledWith(SAMPLE_SUMMARY);
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  });

  it("Copy button is a no-op when navigator.clipboard is unavailable", () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    const modal = createDescribeSkyModal({ getSummary: () => "static" });
    document.body.appendChild(modal.element);
    modal.open(SAMPLE_SUMMARY);
    expect(() => {
      (document.querySelector("[data-testid='describe-sky-copy']") as HTMLElement).click();
    }).not.toThrow();
  });

  it("marks the summary block as an ARIA live region (role=status, aria-live=polite)", () => {
    const modal = createDescribeSkyModal({ getSummary: () => "static" });
    document.body.appendChild(modal.element);
    modal.open(SAMPLE_SUMMARY);
    const summary = document.querySelector('[data-testid="describe-sky-summary"]');
    expect(summary?.getAttribute("role")).toBe("status");
    expect(summary?.getAttribute("aria-live")).toBe("polite");
    expect(summary?.getAttribute("aria-atomic")).toBe("true");
  });
});
