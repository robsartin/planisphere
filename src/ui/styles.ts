/* SPDX-License-Identifier: Apache-2.0 */

export const PANEL_BG = "rgba(0, 0, 0, 0.85)";
export const PANEL_BORDER = "1px solid rgba(255, 255, 255, 0.2)";
export const PANEL_RADIUS = "8px";
export const PANEL_WIDTH = "280px";
export const ACCENT_COLOR = "#00FF88";
export const TEXT_COLOR = "#ffffff";
export const FONT_SIZE = "13px";
export const FONT_FAMILY = "sans-serif";
export const GAP = "8px";

export function applyBaseText(el: HTMLElement): void {
  el.style.color = TEXT_COLOR;
  el.style.fontSize = FONT_SIZE;
  el.style.fontFamily = FONT_FAMILY;
}

export function applyButton(el: HTMLButtonElement): void {
  el.style.background = "rgba(255, 255, 255, 0.1)";
  el.style.border = "1px solid rgba(255, 255, 255, 0.3)";
  el.style.borderRadius = "4px";
  el.style.color = TEXT_COLOR;
  el.style.cursor = "pointer";
  el.style.fontSize = "12px";
  el.style.padding = "2px 6px";
}

export function applyLabel(el: HTMLElement): void {
  el.style.color = TEXT_COLOR;
  el.style.fontSize = FONT_SIZE;
  el.style.fontFamily = FONT_FAMILY;
  el.style.userSelect = "none";
}

/**
 * Build the small "Pro" pill shown next to Pro-gated UI affordances
 * when the current user isn't on the allowlist. Used by both the side
 * panel's mode-toggle and the Notebook's Insert-link button, with the
 * caller choosing the `data-testid` value so the two remain distinct
 * to tests and query-selectors.
 */
export function createProPill(testid: string): HTMLElement {
  const pill = document.createElement("span");
  pill.dataset.testid = testid;
  pill.textContent = "Pro";
  pill.style.background = "rgba(0,255,136,0.18)";
  pill.style.border = "1px solid rgba(0,255,136,0.5)";
  pill.style.borderRadius = "10px";
  pill.style.color = ACCENT_COLOR.toLowerCase();
  pill.style.fontSize = "10px";
  pill.style.fontWeight = "600";
  pill.style.letterSpacing = "0.05em";
  pill.style.padding = "1px 7px";
  pill.style.textTransform = "uppercase";
  return pill;
}
