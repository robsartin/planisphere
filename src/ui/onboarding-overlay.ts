/* SPDX-License-Identifier: Apache-2.0 */
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

  const root = document.createElement("div");
  root.dataset.testid = "onboarding-overlay";
  root.style.display = "none";
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.zIndex = "4000";
  root.style.pointerEvents = "none";
  root.style.fontFamily = FONT_FAMILY;

  // Backdrop — dim layer behind everything else. Pointer events captured by
  // the backdrop so clicks outside the card don't fall through to the scene.
  const backdrop = document.createElement("div");
  backdrop.dataset.testid = "onboarding-backdrop";
  backdrop.style.position = "absolute";
  backdrop.style.inset = "0";
  backdrop.style.background = "rgba(0,0,0,0.65)";
  backdrop.style.pointerEvents = "auto";
  backdrop.style.transition = "opacity 150ms ease";
  backdrop.style.opacity = "1";

  // Spotlight frame — 4 black (opaque) rectangles surrounding the target's
  // bounding rect to carve out a cut-out effect over the dim backdrop. Simpler
  // and more compatible than clip-path with evenodd across environments.
  const spotlight = document.createElement("div");
  spotlight.dataset.testid = "onboarding-spotlight";
  spotlight.style.position = "absolute";
  spotlight.style.inset = "0";
  spotlight.style.pointerEvents = "none";
  spotlight.style.display = "none";

  const frameTop = document.createElement("div");
  const frameBottom = document.createElement("div");
  const frameLeft = document.createElement("div");
  const frameRight = document.createElement("div");
  const ring = document.createElement("div");
  ring.dataset.testid = "onboarding-spotlight-ring";
  for (const el of [frameTop, frameBottom, frameLeft, frameRight]) {
    el.style.position = "absolute";
    el.style.background = "rgba(0,0,0,0.65)";
  }
  ring.style.position = "absolute";
  ring.style.border = `2px solid ${ACCENT_COLOR}`;
  ring.style.borderRadius = "8px";
  ring.style.boxShadow = `0 0 0 2px rgba(0, 255, 136, 0.25)`;
  ring.style.pointerEvents = "none";
  spotlight.appendChild(frameTop);
  spotlight.appendChild(frameBottom);
  spotlight.appendChild(frameLeft);
  spotlight.appendChild(frameRight);
  spotlight.appendChild(ring);

  // Instruction card — anchored relative to spotlight when present, otherwise
  // centered. Holds title, body, counter, Back/Next, Skip.
  const card = document.createElement("div");
  card.dataset.testid = "onboarding-card";
  card.style.position = "absolute";
  card.style.width = `${String(CARD_WIDTH_PX)}px`;
  card.style.maxWidth = "calc(100vw - 24px)";
  card.style.background = PANEL_BG;
  card.style.border = PANEL_BORDER;
  card.style.borderRadius = "10px";
  card.style.color = TEXT_COLOR;
  card.style.padding = "16px 18px";
  card.style.boxSizing = "border-box";
  card.style.pointerEvents = "auto";
  card.style.transition = "opacity 150ms ease";
  card.style.opacity = "1";
  card.style.boxShadow = "0 6px 24px rgba(0,0,0,0.4)";

  const counter = document.createElement("div");
  counter.dataset.testid = "onboarding-counter";
  counter.style.fontSize = "11px";
  counter.style.opacity = "0.7";
  counter.style.marginBottom = "6px";
  counter.style.letterSpacing = "0.04em";

  const title = document.createElement("div");
  title.dataset.testid = "onboarding-title";
  title.style.fontSize = "16px";
  title.style.fontWeight = "600";
  title.style.marginBottom = "6px";

  const body = document.createElement("div");
  body.dataset.testid = "onboarding-body";
  body.style.fontSize = "14px";
  body.style.lineHeight = "1.45";
  body.style.opacity = "0.9";

  const actionRow = document.createElement("div");
  actionRow.style.display = "flex";
  actionRow.style.alignItems = "center";
  actionRow.style.justifyContent = "space-between";
  actionRow.style.gap = "8px";
  actionRow.style.marginTop = "14px";

  const skipBtn = document.createElement("button");
  skipBtn.dataset.testid = "onboarding-skip";
  skipBtn.type = "button";
  skipBtn.textContent = "Skip";
  skipBtn.style.background = "transparent";
  skipBtn.style.border = "none";
  skipBtn.style.color = TEXT_COLOR;
  skipBtn.style.opacity = "0.7";
  skipBtn.style.fontSize = "12px";
  skipBtn.style.cursor = "pointer";
  skipBtn.style.padding = "6px 4px";

  const navGroup = document.createElement("div");
  navGroup.style.display = "flex";
  navGroup.style.gap = "6px";

  const backBtn = document.createElement("button");
  backBtn.dataset.testid = "onboarding-back";
  backBtn.type = "button";
  backBtn.textContent = "Back";
  backBtn.style.background = SURFACE;
  backBtn.style.border = "1px solid rgba(255,255,255,0.25)";
  backBtn.style.color = TEXT_COLOR;
  backBtn.style.borderRadius = "6px";
  backBtn.style.padding = "6px 12px";
  backBtn.style.fontSize = "13px";
  backBtn.style.cursor = "pointer";

  const nextBtn = document.createElement("button");
  nextBtn.dataset.testid = "onboarding-next";
  nextBtn.type = "button";
  nextBtn.textContent = "Next";
  nextBtn.style.background = ACCENT_COLOR;
  nextBtn.style.color = "#003322";
  nextBtn.style.border = "none";
  nextBtn.style.borderRadius = "6px";
  nextBtn.style.padding = "6px 14px";
  nextBtn.style.fontSize = "13px";
  nextBtn.style.fontWeight = "600";
  nextBtn.style.cursor = "pointer";

  navGroup.appendChild(backBtn);
  navGroup.appendChild(nextBtn);
  actionRow.appendChild(skipBtn);
  actionRow.appendChild(navGroup);

  card.appendChild(counter);
  card.appendChild(title);
  card.appendChild(body);
  card.appendChild(actionRow);

  root.appendChild(backdrop);
  root.appendChild(spotlight);
  root.appendChild(card);

  let active = false;
  let index = 0;

  function setOpenState(value: boolean): void {
    active = value;
    root.style.display = value ? "block" : "none";
  }

  function tryResolveTarget(selector: string | undefined): DOMRect | null {
    if (selector === undefined) return null;
    try {
      const el = document.querySelector<HTMLElement>(selector);
      if (el === null) return null;
      const rect = el.getBoundingClientRect();
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
