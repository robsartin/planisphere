/* SPDX-License-Identifier: Apache-2.0 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createPlansModal } from "./plans-modal";
import type { Plan } from "../plans";

const SAMPLE: Plan = {
  slug: "2026-04",
  title: "April — Lyrids",
  month: "2026-04",
  hemisphere: "both",
  summary: "Meteors.",
  author: "Rob",
  publishedAt: "2026-04-01T00:00:00.000Z",
  bodyMd: "# Body\n\nProse.",
  objects: [{ kind: "messier", id: "31", label: "Andromeda Galaxy (M31)" }],
};

describe("plans modal", () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let modal: ReturnType<typeof createPlansModal>;

  beforeEach(() => {
    dispatch = vi.fn();
    modal = createPlansModal({ dispatch });
    document.body.appendChild(modal.element);
  });
  afterEach(() => {
    modal.element.remove();
    document.body.style.overflow = "";
  });

  test("hidden when no plan is set", () => {
    expect(modal.element.hidden).toBe(true);
  });

  test("opens on setPlan, shows title + summary + body + chip", () => {
    modal.setPlan(SAMPLE);
    expect(modal.element.hidden).toBe(false);
    expect(modal.element.textContent).toContain("April — Lyrids");
    expect(modal.element.textContent).toContain("Meteors.");
    expect(modal.element.textContent).toContain("Prose.");
    expect(modal.element.textContent).toContain("Andromeda Galaxy (M31)");
    expect(document.body.style.overflow).toBe("hidden");
  });

  test("X button dispatches set-active-plan with null", () => {
    modal.setPlan(SAMPLE);
    const x = modal.element.querySelector<HTMLElement>("[data-plans-modal-close]");
    x?.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "set-active-plan", slug: null });
  });

  test("backdrop click dispatches close", () => {
    modal.setPlan(SAMPLE);
    const backdrop = modal.element.querySelector<HTMLElement>("[data-plans-modal-backdrop]");
    backdrop?.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "set-active-plan", slug: null });
  });

  test("ESC key dispatches close", () => {
    modal.setPlan(SAMPLE);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "set-active-plan", slug: null });
  });

  test("ESC does nothing when closed", () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("setPlan(null) hides and restores scroll lock", () => {
    modal.setPlan(SAMPLE);
    expect(document.body.style.overflow).toBe("hidden");
    modal.setPlan(null);
    expect(modal.element.hidden).toBe(true);
    expect(document.body.style.overflow).toBe("");
  });

  test("setError shows error copy; X still dispatches close", () => {
    modal.setError("2026-04", "not_found");
    expect(modal.element.hidden).toBe(false);
    expect(modal.element.textContent).toMatch(/couldn.t find/i);
    const x = modal.element.querySelector<HTMLElement>("[data-plans-modal-close]");
    x?.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "set-active-plan", slug: null });
  });

  test("chip click dispatches close + open-object-card with center coords", () => {
    modal.setPlan(SAMPLE);
    const chip = modal.element.querySelector<HTMLElement>("[data-plans-chip]");
    chip?.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "set-active-plan", slug: null });
    const openCardCall = dispatch.mock.calls.find(
      (c) => (c[0] as { type: string }).type === "open-object-card",
    );
    expect(openCardCall).toBeDefined();
    expect((openCardCall?.[0] as { objectKind: string }).objectKind).toBe("messier");
  });

  test("planet chip maps kind 'planet' to 'body' for the card intent", () => {
    modal.setPlan({
      ...SAMPLE,
      objects: [{ kind: "planet", id: "jupiter", label: "Jupiter" }],
    });
    const chip = modal.element.querySelector<HTMLElement>("[data-plans-chip]");
    chip?.click();
    const openCardCall = dispatch.mock.calls.find(
      (c) => (c[0] as { type: string }).type === "open-object-card",
    );
    expect(openCardCall).toBeDefined();
    expect((openCardCall?.[0] as { objectKind: string }).objectKind).toBe("body");
    expect((openCardCall?.[0] as { id: string }).id).toBe("jupiter");
  });
});
