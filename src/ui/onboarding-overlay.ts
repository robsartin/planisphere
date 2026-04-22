/* SPDX-License-Identifier: Apache-2.0 */
import { el } from "./dom";
import { ACCENT_COLOR, FONT_FAMILY, PANEL_BG, PANEL_BORDER, SURFACE, TEXT_COLOR } from "./styles";

export const ONBOARDING_STORAGE_KEY = "planisphere.onboarding.v1";

export type OnboardingStepPosition = "center" | "bottom" | "top" | "right" | "left";

export type OnboardingStep = {
  readonly title: string;
  readonly body: string;
  /** Optional CSS selector for the element the step should highlight. When the
   *  selector doesn't resolve, the step falls back to a centered card. */
  readonly selector?: string;
  /** Where to anchor the instruction card relative to the spotlight. Defaults
   *  to `center` (when no selector) or `bottom` (when a selector resolves). */
  readonly position?: OnboardingStepPosition;
};

export type OnboardingOverlay = {
  readonly element: HTMLElement;
  start(): void;
  replay(): void;
  dismiss(): void;
  isActive(): boolean;
};

export type OnboardingOverlayOptions = {
  readonly steps: readonly OnboardingStep[];
};

const SPOTLIGHT_PAD = 8;
const CARD_WIDTH_PX = 320;
const CARD_GAP_PX = 16;

const FRAME_STYLE: Partial<CSSStyleDeclaration> = {
  position: "absolute",
  background: "rgba(0,0,0,0.65)",
};

function persistDismissed(): void {
  try {
    globalThis.localStorage?.setItem(ONBOARDING_STORAGE_KEY, "dismissed");
  } catch {
    // Storage quota / disabled — ignore.
  }
}

function clampIntoViewport(
  left: number,
  top: number,
  w: number,
  h: number,
  vw: number,
  vh: number,
): { left: number; top: number } {
  const pad = 8;
  let x = left;
  let y = top;
  if (x + w > vw - pad) x = vw - w - pad;
  if (x < pad) x = pad;
  if (y + h > vh - pad) y = vh - h - pad;
  if (y < pad) y = pad;
  return { left: x, top: y };
}

export function createOnboardingOverlay(opts: OnboardingOverlayOptions): OnboardingOverlay {
  const steps = opts.steps;

  const counter = el("div", {
    testid: "onboarding-counter",
    style: {
      fontSize: "11px",
      opacity: "0.7",
      marginBottom: "6px",
      letterSpacing: "0.04em",
    },
  });

  const title = el("div", {
    testid: "onboarding-title",
    style: { fontSize: "16px", fontWeight: "600", marginBottom: "6px" },
  });

  const body = el("div", {
    testid: "onboarding-body",
    style: { fontSize: "14px", lineHeight: "1.45", opacity: "0.9" },
  });

  const skipBtn = el("button", {
    testid: "onboarding-skip",
    type: "button",
    text: "Skip",
    style: {
      background: "transparent",
      border: "none",
      color: TEXT_COLOR,
      opacity: "0.7",
      fontSize: "12px",
      cursor: "pointer",
      padding: "6px 4px",
    },
  });

  const backBtn = el("button", {
    testid: "onboarding-back",
    type: "button",
    text: "Back",
    style: {
      background: SURFACE,
      border: "1px solid rgba(255,255,255,0.25)",
      color: TEXT_COLOR,
      borderRadius: "6px",
      padding: "6px 12px",
      fontSize: "13px",
      cursor: "pointer",
    },
  });

  const nextBtn = el("button", {
    testid: "onboarding-next",
    type: "button",
    text: "Next",
    style: {
      background: ACCENT_COLOR,
      color: "#003322",
      border: "none",
      borderRadius: "6px",
      padding: "6px 14px",
      fontSize: "13px",
      fontWeight: "600",
      cursor: "pointer",
    },
  });

  const actionRow = el("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "8px",
      marginTop: "14px",
    },
    children: [
      skipBtn,
      el("div", { style: { display: "flex", gap: "6px" }, children: [backBtn, nextBtn] }),
    ],
  });

  const card = el("div", {
    testid: "onboarding-card",
    style: {
      position: "absolute",
      width: `${String(CARD_WIDTH_PX)}px`,
      maxWidth: "calc(100vw - 24px)",
      background: PANEL_BG,
      border: PANEL_BORDER,
      borderRadius: "10px",
      color: TEXT_COLOR,
      padding: "16px 18px",
      boxSizing: "border-box",
      pointerEvents: "auto",
      transition: "opacity 150ms ease",
      opacity: "1",
      boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
    },
    children: [counter, title, body, actionRow],
  });

  const frameTop = el("div", { style: FRAME_STYLE });
  const frameBottom = el("div", { style: FRAME_STYLE });
  const frameLeft = el("div", { style: FRAME_STYLE });
  const frameRight = el("div", { style: FRAME_STYLE });
  const ring = el("div", {
    testid: "onboarding-spotlight-ring",
    style: {
      position: "absolute",
      border: `2px solid ${ACCENT_COLOR}`,
      borderRadius: "8px",
      boxShadow: "0 0 0 2px rgba(0, 255, 136, 0.25)",
      pointerEvents: "none",
    },
  });

  // Spotlight frame — 4 black (opaque) rectangles surrounding the target's
  // bounding rect to carve out a cut-out effect over the dim backdrop. Simpler
  // and more compatible than clip-path with evenodd across environments.
  const spotlight = el("div", {
    testid: "onboarding-spotlight",
    style: {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      display: "none",
    },
    children: [frameTop, frameBottom, frameLeft, frameRight, ring],
  });

  // Backdrop — dim layer behind everything else. Pointer events captured by
  // the backdrop so clicks outside the card don't fall through to the scene.
  const backdrop = el("div", {
    testid: "onboarding-backdrop",
    style: {
      position: "absolute",
      inset: "0",
      background: "rgba(0,0,0,0.65)",
      pointerEvents: "auto",
      transition: "opacity 150ms ease",
      opacity: "1",
    },
  });

  const root = el("div", {
    testid: "onboarding-overlay",
    style: {
      display: "none",
      position: "fixed",
      inset: "0",
      zIndex: "4000",
      pointerEvents: "none",
      fontFamily: FONT_FAMILY,
    },
    children: [backdrop, spotlight, card],
  });

  let active = false;
  let index = 0;

  function setOpenState(value: boolean): void {
    active = value;
    root.style.display = value ? "block" : "none";
  }

  function tryResolveTarget(selector: string | undefined): DOMRect | null {
    if (selector === undefined) return null;
    try {
      const target = document.querySelector<HTMLElement>(selector);
      if (target === null) return null;
      const rect = target.getBoundingClientRect();
      // jsdom returns 0-sized rects — treat as "not really visible", fall back.
      if (rect.width === 0 && rect.height === 0) return null;
      return rect;
    } catch {
      return null;
    }
  }

  function layoutSpotlight(rect: DOMRect | null): void {
    if (rect === null) {
      spotlight.style.display = "none";
      backdrop.style.opacity = "1";
      return;
    }
    const vw =
      typeof window !== "undefined" ? window.innerWidth : document.documentElement.clientWidth;
    const vh =
      typeof window !== "undefined" ? window.innerHeight : document.documentElement.clientHeight;

    const x = Math.max(0, rect.left - SPOTLIGHT_PAD);
    const y = Math.max(0, rect.top - SPOTLIGHT_PAD);
    const w = Math.min(vw, rect.width + SPOTLIGHT_PAD * 2);
    const h = Math.min(vh, rect.height + SPOTLIGHT_PAD * 2);

    // The full backdrop div is hidden (the 4 frame divs create the cut-out).
    backdrop.style.opacity = "0";
    spotlight.style.display = "block";

    frameTop.style.left = "0";
    frameTop.style.top = "0";
    frameTop.style.right = "0";
    frameTop.style.height = `${String(y)}px`;

    frameBottom.style.left = "0";
    frameBottom.style.top = `${String(y + h)}px`;
    frameBottom.style.right = "0";
    frameBottom.style.bottom = "0";

    frameLeft.style.top = `${String(y)}px`;
    frameLeft.style.left = "0";
    frameLeft.style.width = `${String(x)}px`;
    frameLeft.style.height = `${String(h)}px`;

    frameRight.style.top = `${String(y)}px`;
    frameRight.style.right = "0";
    frameRight.style.left = `${String(x + w)}px`;
    frameRight.style.height = `${String(h)}px`;

    ring.style.left = `${String(x)}px`;
    ring.style.top = `${String(y)}px`;
    ring.style.width = `${String(w)}px`;
    ring.style.height = `${String(h)}px`;
  }

  function layoutCard(rect: DOMRect | null, position: OnboardingStepPosition): void {
    const vw =
      typeof window !== "undefined" ? window.innerWidth : document.documentElement.clientWidth;
    const vh =
      typeof window !== "undefined" ? window.innerHeight : document.documentElement.clientHeight;
    // Measure card height by briefly showing at offscreen — but for simplicity
    // we just use an estimated height and let layout adjust via clamp.
    const estH = 180;

    if (rect === null || position === "center") {
      const left = Math.max(12, vw / 2 - CARD_WIDTH_PX / 2);
      const top = Math.max(12, vh / 2 - estH / 2);
      card.style.left = `${String(left)}px`;
      card.style.top = `${String(top)}px`;
      return;
    }

    let left = rect.left;
    let top = rect.top;
    switch (position) {
      case "bottom":
        left = rect.left + rect.width / 2 - CARD_WIDTH_PX / 2;
        top = rect.bottom + CARD_GAP_PX;
        break;
      case "top":
        left = rect.left + rect.width / 2 - CARD_WIDTH_PX / 2;
        top = rect.top - estH - CARD_GAP_PX;
        break;
      case "right":
        left = rect.right + CARD_GAP_PX;
        top = rect.top + rect.height / 2 - estH / 2;
        break;
      case "left":
        left = rect.left - CARD_WIDTH_PX - CARD_GAP_PX;
        top = rect.top + rect.height / 2 - estH / 2;
        break;
    }
    const clamped = clampIntoViewport(left, top, CARD_WIDTH_PX, estH, vw, vh);
    card.style.left = `${String(clamped.left)}px`;
    card.style.top = `${String(clamped.top)}px`;
  }

  function renderStep(): void {
    if (steps.length === 0) return;
    const step = steps[index];
    if (step === undefined) return;
    counter.textContent = `${String(index + 1)} / ${String(steps.length)}`;
    title.textContent = step.title;
    body.textContent = step.body;

    const rect = tryResolveTarget(step.selector);
    const position: OnboardingStepPosition = step.position ?? (rect !== null ? "bottom" : "center");
    layoutSpotlight(rect);
    layoutCard(rect, position);

    backBtn.disabled = index === 0;
    backBtn.style.opacity = index === 0 ? "0.4" : "1";
    backBtn.style.cursor = index === 0 ? "default" : "pointer";

    const isLast = index === steps.length - 1;
    nextBtn.textContent = isLast ? "Let's go" : "Next";
  }

  function doStart(): void {
    if (steps.length === 0) return;
    index = 0;
    setOpenState(true);
    renderStep();
  }

  function doReplay(): void {
    if (steps.length === 0) return;
    index = 0;
    setOpenState(true);
    renderStep();
  }

  function doDismiss(): void {
    setOpenState(false);
    persistDismissed();
  }

  function goNext(): void {
    if (index >= steps.length - 1) {
      doDismiss();
      return;
    }
    index += 1;
    renderStep();
  }

  function goBack(): void {
    if (index === 0) return;
    index -= 1;
    renderStep();
  }

  nextBtn.addEventListener("click", goNext);
  backBtn.addEventListener("click", goBack);
  skipBtn.addEventListener("click", doDismiss);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && active) {
      doDismiss();
    }
  });

  return {
    element: root,
    start: doStart,
    replay: doReplay,
    dismiss: doDismiss,
    isActive: () => active,
  };
}
