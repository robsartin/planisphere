/* SPDX-License-Identifier: Apache-2.0 */
import { el } from "./dom";
import { FOV_PRESETS, type FovPresetId, isFovPresetId } from "../astro/fov-presets";
import type { UIIntent } from "./index";

export type EmptySkyPopoverOptions = {
  readonly dispatch: (intent: UIIntent) => void;
  readonly initialFov: FovPresetId;
};

export type EmptySkyPopover = {
  readonly element: HTMLElement;
  open(alt: number, az: number, screenX: number, screenY: number): void;
  close(): void;
  isOpen(): boolean;
};

const CARD_WIDTH_PX = 240;
const CARD_OFFSET_PX = 16;
const ESTIMATED_HEIGHT_PX = 160;
const RETICLE_SIZE_PX = 28;

const ROOT_STYLE: Partial<CSSStyleDeclaration> = {
  position: "absolute",
  top: "0",
  left: "0",
  width: "0",
  height: "0",
  pointerEvents: "none",
  zIndex: "1200",
  display: "none",
};

const CARD_STYLE: Partial<CSSStyleDeclaration> = {
  position: "absolute",
  width: `${String(CARD_WIDTH_PX)}px`,
  background: "rgba(10,20,40,0.96)",
  color: "#fff",
  font: "12px/1.45 sans-serif",
  padding: "10px 12px",
  borderRadius: "6px",
  border: "1px solid rgba(100,160,255,0.8)",
  pointerEvents: "auto",
  boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
  boxSizing: "border-box",
};

const RETICLE_STYLE: Partial<CSSStyleDeclaration> = {
  position: "absolute",
  width: `${String(RETICLE_SIZE_PX)}px`,
  height: `${String(RETICLE_SIZE_PX)}px`,
  transform: "translate(-50%,-50%)",
  border: "1.5px solid rgba(255,200,80,0.9)",
  borderRadius: "50%",
  pointerEvents: "none",
  boxShadow: "0 0 8px rgba(255,200,80,0.35)",
};

const CLOSE_BTN_STYLE: Partial<CSSStyleDeclaration> = {
  background: "none",
  border: "none",
  color: "rgba(255,255,255,0.7)",
  cursor: "pointer",
  font: "16px/1 sans-serif",
  padding: "0",
  margin: "0 0 0 8px",
  lineHeight: "1",
};

const LOOK_HERE_BTN_STYLE: Partial<CSSStyleDeclaration> = {
  background: "rgba(100,160,255,0.2)",
  border: "1px solid rgba(100,160,255,0.7)",
  borderRadius: "3px",
  color: "#fff",
  cursor: "pointer",
  font: "11px/1.3 sans-serif",
  padding: "4px 10px",
  margin: "0",
};

const FOV_ROW_STYLE: Partial<CSSStyleDeclaration> = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  marginTop: "8px",
};

const FOV_LABEL_STYLE: Partial<CSSStyleDeclaration> = {
  color: "rgba(255,255,255,0.6)",
  font: "11px sans-serif",
};

const FOV_SELECT_STYLE: Partial<CSSStyleDeclaration> = {
  flex: "1",
  background: "rgba(255,255,255,0.1)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "4px",
  padding: "3px",
  font: "11px sans-serif",
};

/** Smart edge-flip placement matching the object-card idiom. */
function smartPosition(
  screenX: number,
  screenY: number,
  viewportWidth: number,
  viewportHeight: number,
): { left: number; top: number } {
  let left = screenX + CARD_OFFSET_PX;
  if (left + CARD_WIDTH_PX > viewportWidth) {
    left = screenX - CARD_OFFSET_PX - CARD_WIDTH_PX;
  }
  if (left < 4) left = 4;

  let top = screenY + CARD_OFFSET_PX;
  if (top + ESTIMATED_HEIGHT_PX > viewportHeight) {
    top = screenY - CARD_OFFSET_PX - ESTIMATED_HEIGHT_PX;
  }
  if (top < 4) top = 4;

  return { left, top };
}

function viewport(): { width: number; height: number } {
  return {
    width: window.innerWidth || 0,
    height: window.innerHeight || 0,
  };
}

export function createEmptySkyPopover(opts: EmptySkyPopoverOptions): EmptySkyPopover {
  // Reticle — tiny crosshair circle at the click point.
  const reticle = el("div", {
    testid: "empty-sky-popover-reticle",
    style: RETICLE_STYLE,
  });

  // Header: title + close button
  const closeBtn = el("button", {
    testid: "empty-sky-popover-close",
    type: "button",
    text: "×",
    attrs: { title: "Close" },
    style: CLOSE_BTN_STYLE,
  });

  const header = el("div", {
    style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
    children: [
      el("div", { text: "Empty sky", style: { fontWeight: "bold", fontSize: "13px" } }),
      closeBtn,
    ],
  });

  // Readout — live alt/az text.
  const readout = el("div", {
    testid: "empty-sky-popover-readout",
    style: {
      marginTop: "4px",
      color: "rgba(255,255,255,0.85)",
      font: "11px monospace",
      fontFamily: "monospace",
    },
  });

  // "Look here" action row.
  const lookHereBtn = el("button", {
    testid: "empty-sky-popover-look-here",
    type: "button",
    text: "Look here",
    style: LOOK_HERE_BTN_STYLE,
  });

  const actionRow = el("div", {
    style: { marginTop: "8px", display: "flex", gap: "6px" },
    children: [lookHereBtn],
  });

  // FOV preset selector — same options as the settings-drawer dropdown.
  const fovSelect = el("select", {
    dataset: { fov: "preset" },
    style: FOV_SELECT_STYLE,
    children: FOV_PRESETS.map((preset) => {
      const option = el("option", { text: preset.label });
      option.value = preset.id;
      return option;
    }),
  });
  fovSelect.value = opts.initialFov;

  const fovRow = el("div", {
    style: FOV_ROW_STYLE,
    children: [el("label", { text: "FOV", style: FOV_LABEL_STYLE }), fovSelect],
  });

  // Card — floating panel with readout, "Look here", FOV select, and close button.
  const card = el("div", {
    testid: "empty-sky-popover-card",
    style: CARD_STYLE,
    children: [header, readout, actionRow, fovRow],
  });

  const root = el("div", {
    testid: "empty-sky-popover-root",
    style: ROOT_STYLE,
    children: [reticle, card],
  });

  // Internal state — track the latest click so "Look here" knows where to aim.
  let open = false;
  let currentAlt = 0;
  let currentAz = 0;

  function setReadout(alt: number, az: number): void {
    readout.textContent = `Alt ${alt.toFixed(1)}°  Az ${az.toFixed(1)}°`;
  }

  function placeReticle(x: number, y: number): void {
    reticle.style.left = `${String(x)}px`;
    reticle.style.top = `${String(y)}px`;
  }

  function placeCard(x: number, y: number): void {
    const vp = viewport();
    const pos = smartPosition(x, y, vp.width, vp.height);
    card.style.left = `${String(pos.left)}px`;
    card.style.top = `${String(pos.top)}px`;
  }

  function show(): void {
    open = true;
    root.style.display = "block";
  }

  function hide(): void {
    open = false;
    root.style.display = "none";
  }

  function openPopover(alt: number, az: number, screenX: number, screenY: number): void {
    currentAlt = alt;
    currentAz = az;
    setReadout(alt, az);
    placeReticle(screenX, screenY);
    placeCard(screenX, screenY);
    show();
  }

  function closePopover(): void {
    hide();
  }

  closeBtn.addEventListener("click", () => {
    closePopover();
  });

  lookHereBtn.addEventListener("click", () => {
    opts.dispatch({ type: "set-view", az: currentAz, alt: currentAlt });
    closePopover();
  });

  fovSelect.addEventListener("change", () => {
    if (!isFovPresetId(fovSelect.value)) return;
    opts.dispatch({ type: "set-fov", preset: fovSelect.value });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!open) return;
    closePopover();
  });

  return {
    element: root,
    open: openPopover,
    close: closePopover,
    isOpen: () => open,
  };
}
