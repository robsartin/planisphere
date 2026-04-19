/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createOnboardingOverlay,
  ONBOARDING_STORAGE_KEY,
  type OnboardingStep,
} from "./onboarding-overlay";

const STEPS: readonly OnboardingStep[] = [
  { title: "Step 1", body: "Tap a star or planet to pin it." },
  {
    title: "Step 2",
    body: "Drag the time bar to move through time.",
    selector: "[data-testid='hud-scrub']",
    position: "top",
  },
  {
    title: "Step 3",
    body: "Tap the icons in the corner for settings, events, and tonight's planets.",
  },
  { title: "Step 4", body: "Press Cmd+K anytime to jump anywhere." },
];

describe("createOnboardingOverlay", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.body.style.overflow = "";
    globalThis.localStorage?.removeItem(ONBOARDING_STORAGE_KEY);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.body.style.overflow = "";
    globalThis.localStorage?.removeItem(ONBOARDING_STORAGE_KEY);
  });

  it("returns an object with element, start, replay, dismiss, isActive", () => {
    const overlay = createOnboardingOverlay({ steps: STEPS });
    expect(overlay).toHaveProperty("element");
    expect(typeof overlay.start).toBe("function");
    expect(typeof overlay.replay).toBe("function");
    expect(typeof overlay.dismiss).toBe("function");
    expect(typeof overlay.isActive).toBe("function");
  });

  it("is hidden (inactive) initially", () => {
    const overlay = createOnboardingOverlay({ steps: STEPS });
    document.body.appendChild(overlay.element);
    expect(overlay.isActive()).toBe(false);
    expect(overlay.element.style.display).toBe("none");
  });

  it("start() shows the first step", () => {
    const overlay = createOnboardingOverlay({ steps: STEPS });
    document.body.appendChild(overlay.element);
    overlay.start();
    expect(overlay.isActive()).toBe(true);
    expect(overlay.element.style.display).not.toBe("none");
    const card = overlay.element.querySelector<HTMLElement>("[data-testid='onboarding-card']");
    expect(card).not.toBeNull();
    expect(card!.textContent).toContain("Step 1");
    expect(card!.textContent).toContain("Tap a star or planet to pin it.");
  });

  it("renders a step counter like '1 / 4'", () => {
    const overlay = createOnboardingOverlay({ steps: STEPS });
    document.body.appendChild(overlay.element);
    overlay.start();
    const counter = overlay.element.querySelector<HTMLElement>(
      "[data-testid='onboarding-counter']",
    );
    expect(counter).not.toBeNull();
    expect(counter!.textContent).toMatch(/1\s*\/\s*4/);
  });

  it("Next button advances to step 2 (and counter updates)", () => {
    const overlay = createOnboardingOverlay({ steps: STEPS });
    document.body.appendChild(overlay.element);
    overlay.start();
    const nextBtn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-testid='onboarding-next']",
    )!;
    expect(nextBtn).not.toBeNull();
    nextBtn.click();
    const card = overlay.element.querySelector<HTMLElement>("[data-testid='onboarding-card']")!;
    expect(card.textContent).toContain("Step 2");
    const counter = overlay.element.querySelector<HTMLElement>(
      "[data-testid='onboarding-counter']",
    )!;
    expect(counter.textContent).toMatch(/2\s*\/\s*4/);
  });

  it("Back button rewinds to the previous step", () => {
    const overlay = createOnboardingOverlay({ steps: STEPS });
    document.body.appendChild(overlay.element);
    overlay.start();
    const nextBtn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-testid='onboarding-next']",
    )!;
    nextBtn.click();
    nextBtn.click();
    const backBtn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-testid='onboarding-back']",
    )!;
    expect(backBtn).not.toBeNull();
    backBtn.click();
    const card = overlay.element.querySelector<HTMLElement>("[data-testid='onboarding-card']")!;
    expect(card.textContent).toContain("Step 2");
  });

  it("Back button is disabled on the first step", () => {
    const overlay = createOnboardingOverlay({ steps: STEPS });
    document.body.appendChild(overlay.element);
    overlay.start();
    const backBtn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-testid='onboarding-back']",
    )!;
    expect(backBtn.disabled).toBe(true);
  });

  it("on the final step the Next button is labelled 'Got it' / 'Let's go'", () => {
    const overlay = createOnboardingOverlay({ steps: STEPS });
    document.body.appendChild(overlay.element);
    overlay.start();
    const nextBtn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-testid='onboarding-next']",
    )!;
    nextBtn.click();
    nextBtn.click();
    nextBtn.click();
    // Now on step 4/4
    expect(nextBtn.textContent).toMatch(/let'?s go|got it/i);
  });

  it("clicking Next on the final step dismisses + persists to localStorage", () => {
    const overlay = createOnboardingOverlay({ steps: STEPS });
    document.body.appendChild(overlay.element);
    overlay.start();
    const nextBtn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-testid='onboarding-next']",
    )!;
    nextBtn.click();
    nextBtn.click();
    nextBtn.click();
    nextBtn.click();
    expect(overlay.isActive()).toBe(false);
    expect(globalThis.localStorage?.getItem(ONBOARDING_STORAGE_KEY)).toBe("dismissed");
  });

  it("Skip button dismisses + persists to localStorage", () => {
    const overlay = createOnboardingOverlay({ steps: STEPS });
    document.body.appendChild(overlay.element);
    overlay.start();
    const skipBtn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-testid='onboarding-skip']",
    )!;
    expect(skipBtn).not.toBeNull();
    skipBtn.click();
    expect(overlay.isActive()).toBe(false);
    expect(globalThis.localStorage?.getItem(ONBOARDING_STORAGE_KEY)).toBe("dismissed");
  });

  it("Escape dismisses the overlay when active", () => {
    const overlay = createOnboardingOverlay({ steps: STEPS });
    document.body.appendChild(overlay.element);
    overlay.start();
    const evt = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(evt);
    expect(overlay.isActive()).toBe(false);
    expect(globalThis.localStorage?.getItem(ONBOARDING_STORAGE_KEY)).toBe("dismissed");
  });

  it("Escape is a no-op when the overlay is not active", () => {
    const overlay = createOnboardingOverlay({ steps: STEPS });
    document.body.appendChild(overlay.element);
    const evt = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(evt);
    expect(overlay.isActive()).toBe(false);
    // Did not write to storage just from Escape alone.
    expect(globalThis.localStorage?.getItem(ONBOARDING_STORAGE_KEY)).toBeNull();
  });

  it("dismiss() hides the overlay and persists", () => {
    const overlay = createOnboardingOverlay({ steps: STEPS });
    document.body.appendChild(overlay.element);
    overlay.start();
    overlay.dismiss();
    expect(overlay.isActive()).toBe(false);
    expect(globalThis.localStorage?.getItem(ONBOARDING_STORAGE_KEY)).toBe("dismissed");
  });

  it("replay() resets to step 1 and shows again regardless of stored flag", () => {
    globalThis.localStorage?.setItem(ONBOARDING_STORAGE_KEY, "dismissed");
    const overlay = createOnboardingOverlay({ steps: STEPS });
    document.body.appendChild(overlay.element);
    overlay.replay();
    expect(overlay.isActive()).toBe(true);
    const card = overlay.element.querySelector<HTMLElement>("[data-testid='onboarding-card']")!;
    expect(card.textContent).toContain("Step 1");
    const counter = overlay.element.querySelector<HTMLElement>(
      "[data-testid='onboarding-counter']",
    )!;
    expect(counter.textContent).toMatch(/1\s*\/\s*4/);
  });

  it("replay() after an in-progress run restarts from step 1", () => {
    const overlay = createOnboardingOverlay({ steps: STEPS });
    document.body.appendChild(overlay.element);
    overlay.start();
    const nextBtn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-testid='onboarding-next']",
    )!;
    nextBtn.click();
    nextBtn.click();
    // Now on step 3. Replay — should land on step 1.
    overlay.replay();
    const card = overlay.element.querySelector<HTMLElement>("[data-testid='onboarding-card']")!;
    expect(card.textContent).toContain("Step 1");
  });

  it("gracefully falls back to a centered card when step.selector matches nothing", () => {
    const stepsWithMissing: readonly OnboardingStep[] = [
      {
        title: "Missing",
        body: "No selector match",
        selector: "[data-testid='does-not-exist']",
      },
    ];
    const overlay = createOnboardingOverlay({ steps: stepsWithMissing });
    document.body.appendChild(overlay.element);
    expect(() => overlay.start()).not.toThrow();
    expect(overlay.isActive()).toBe(true);
    const card = overlay.element.querySelector<HTMLElement>("[data-testid='onboarding-card']")!;
    expect(card).not.toBeNull();
  });

  it("uses an evenly-visible spotlight when step.selector matches", () => {
    const target = document.createElement("div");
    target.dataset.testid = "tour-target";
    document.body.appendChild(target);
    const stepsWithTarget: readonly OnboardingStep[] = [
      {
        title: "Pointed",
        body: "Look here",
        selector: "[data-testid='tour-target']",
      },
    ];
    const overlay = createOnboardingOverlay({ steps: stepsWithTarget });
    document.body.appendChild(overlay.element);
    overlay.start();
    // Spotlight frame should be present whenever a target element was resolved
    const spotlight = overlay.element.querySelector<HTMLElement>(
      "[data-testid='onboarding-spotlight']",
    );
    expect(spotlight).not.toBeNull();
  });

  it("has a high z-index (above drawers + help modal)", () => {
    const overlay = createOnboardingOverlay({ steps: STEPS });
    expect(Number(overlay.element.style.zIndex)).toBeGreaterThanOrEqual(4000);
  });

  it("start() is a no-op when the storage flag is dismissed (pass-through)", () => {
    // Note: per the milestone spec, `start()` itself does not consult storage —
    // the bootstrap code checks the flag and decides whether to call start().
    // Here we verify start() does not reset the flag.
    globalThis.localStorage?.setItem(ONBOARDING_STORAGE_KEY, "dismissed");
    const overlay = createOnboardingOverlay({ steps: STEPS });
    document.body.appendChild(overlay.element);
    overlay.start();
    // Regardless of prior flag, start() shows the overlay — the bootstrap is
    // responsible for gating. Flag should still be "dismissed" (start does not
    // clear it) until a full walkthrough or explicit dismiss completes.
    expect(globalThis.localStorage?.getItem(ONBOARDING_STORAGE_KEY)).toBe("dismissed");
  });

  it("throws-free even if the steps list is empty (degenerate case)", () => {
    const overlay = createOnboardingOverlay({ steps: [] });
    document.body.appendChild(overlay.element);
    // No steps = no tour to show — start() should be a quiet no-op.
    expect(() => overlay.start()).not.toThrow();
    expect(overlay.isActive()).toBe(false);
  });

  it("carves out a spotlight frame around a target with a non-zero bounding rect", () => {
    const target = document.createElement("div");
    target.dataset.testid = "tour-target";
    // Stub getBoundingClientRect to simulate a real layout.
    target.getBoundingClientRect = (): DOMRect =>
      ({
        left: 100,
        top: 200,
        right: 300,
        bottom: 260,
        width: 200,
        height: 60,
        x: 100,
        y: 200,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    document.body.appendChild(target);

    const overlay = createOnboardingOverlay({
      steps: [
        {
          title: "T",
          body: "B",
          selector: "[data-testid='tour-target']",
          position: "bottom",
        },
      ],
    });
    document.body.appendChild(overlay.element);
    overlay.start();

    const spotlight = overlay.element.querySelector<HTMLElement>(
      "[data-testid='onboarding-spotlight']",
    )!;
    expect(spotlight.style.display).toBe("block");
    const ring = overlay.element.querySelector<HTMLElement>(
      "[data-testid='onboarding-spotlight-ring']",
    )!;
    expect(ring).not.toBeNull();
    // Ring should be positioned roughly where the target was.
    expect(ring.style.width).not.toBe("");
    expect(ring.style.height).not.toBe("");
  });

  it.each(["top", "right", "left", "bottom"] as const)(
    "positions the card for position=%s without throwing",
    (position) => {
      const target = document.createElement("div");
      target.dataset.testid = "tour-target";
      target.getBoundingClientRect = (): DOMRect =>
        ({
          left: 400,
          top: 300,
          right: 500,
          bottom: 360,
          width: 100,
          height: 60,
          x: 400,
          y: 300,
          toJSON() {
            return {};
          },
        }) as DOMRect;
      document.body.appendChild(target);

      const overlay = createOnboardingOverlay({
        steps: [
          {
            title: "T",
            body: "B",
            selector: "[data-testid='tour-target']",
            position,
          },
        ],
      });
      document.body.appendChild(overlay.element);
      expect(() => overlay.start()).not.toThrow();
      const card = overlay.element.querySelector<HTMLElement>("[data-testid='onboarding-card']")!;
      // Card should be positioned (left/top non-empty).
      expect(card.style.left).not.toBe("");
      expect(card.style.top).not.toBe("");
    },
  );

  it("swallows exceptions from document.querySelector on an invalid selector", () => {
    const overlay = createOnboardingOverlay({
      steps: [
        {
          title: "T",
          body: "B",
          // Deliberately malformed selector — querySelector will throw SyntaxError.
          selector: "[[::not valid::]]",
        },
      ],
    });
    document.body.appendChild(overlay.element);
    expect(() => overlay.start()).not.toThrow();
    expect(overlay.isActive()).toBe(true);
  });
});
