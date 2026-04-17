/* SPDX-License-Identifier: Apache-2.0 */

export const PANEL_BG = "rgba(0, 0, 0, 0.85)";
export const PANEL_BORDER = "1px solid rgba(255, 255, 255, 0.2)";
export const PANEL_RADIUS = "8px";
export const PANEL_WIDTH = "280px";
export const PANEL_MAX_HEIGHT = "80vh";
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
