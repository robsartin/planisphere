/* SPDX-License-Identifier: Apache-2.0 */
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

const ROOT_STYLE =
  "position:absolute;top:0;left:0;width:0;height:0;pointer-events:none;z-index:1200";

const CARD_STYLE =
  "position:absolute;width:240px;background:rgba(10,20,40,0.96);color:#fff;" +
  "font:12px/1.45 sans-serif;padding:10px 12px;border-radius:6px;" +
  "border:1px solid rgba(100,160,255,0.8);pointer-events:auto;" +
  "box-shadow:0 4px 16px rgba(0,0,0,0.5);box-sizing:border-box";

const RETICLE_STYLE =
  `position:absolute;width:${String(RETICLE_SIZE_PX)}px;height:${String(RETICLE_SIZE_PX)}px;` +
  "transform:translate(-50%,-50%);border:1.5px solid rgba(255,200,80,0.9);" +
  "border-radius:50%;pointer-events:none;box-shadow:0 0 8px rgba(255,200,80,0.35)";

const CLOSE_BTN_STYLE =
  "background:none;border:none;color:rgba(255,255,255,0.7);cursor:pointer;" +
  "font:16px/1 sans-serif;padding:0;margin:0 0 0 8px;line-height:1";

const LOOK_HERE_BTN_STYLE =
  "background:rgba(100,160,255,0.2);border:1px solid rgba(100,160,255,0.7);" +
  "border-radius:3px;color:#fff;cursor:pointer;font:11px/1.3 sans-serif;" +
  "padding:4px 10px;margin:0";

const FOV_ROW_STYLE = "display:flex;align-items:center;gap:6px;margin-top:8px";

const FOV_LABEL_STYLE = "color:rgba(255,255,255,0.6);font:11px sans-serif";

const FOV_SELECT_STYLE =
  "flex:1;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);" +
  "border-radius:4px;padding:3px;font:11px sans-serif";

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
  const root = document.createElement("div");
  root.dataset.testid = "empty-sky-popover-root";
  root.style.cssText = ROOT_STYLE;
  root.style.display = "none";

  // Reticle — tiny crosshair circle at the click point.
  const reticle = document.createElement("div");
  reticle.dataset.testid = "empty-sky-popover-reticle";
  reticle.style.cssText = RETICLE_STYLE;
  root.appendChild(reticle);

  // Card — floating panel with readout, "Look here", FOV select, and close button.
  const card = document.createElement("div");
  card.dataset.testid = "empty-sky-popover-card";
  card.style.cssText = CARD_STYLE;
  root.appendChild(card);

  // Header: title + close button
  const header = document.createElement("div");
  header.style.cssText = "display:flex;justify-content:space-between;align-items:flex-start";

  const title = document.createElement("div");
  title.textContent = "Empty sky";
  title.style.cssText = "font-weight:bold;font-size:13px";
  header.appendChild(title);

  const closeBtn = document.createElement("button");
  closeBtn.dataset.testid = "empty-sky-popover-close";
  closeBtn.type = "button";
  closeBtn.textContent = "\u00D7";
  closeBtn.title = "Close";
  closeBtn.style.cssText = CLOSE_BTN_STYLE;
  header.appendChild(closeBtn);

  card.appendChild(header);

  // Readout — live alt/az text.
  const readout = document.createElement("div");
  readout.dataset.testid = "empty-sky-popover-readout";
  readout.style.cssText =
    "margin-top:4px;color:rgba(255,255,255,0.85);font:11px monospace;font-family:monospace";
  card.appendChild(readout);

  // "Look here" action row.
  const actionRow = document.createElement("div");
  actionRow.style.cssText = "margin-top:8px;display:flex;gap:6px";

  const lookHereBtn = document.createElement("button");
  lookHereBtn.dataset.testid = "empty-sky-popover-look-here";
  lookHereBtn.type = "button";
  lookHereBtn.textContent = "Look here";
  lookHereBtn.style.cssText = LOOK_HERE_BTN_STYLE;
  actionRow.appendChild(lookHereBtn);

  card.appendChild(actionRow);

  // FOV preset selector — same options as the settings-drawer dropdown.
  const fovRow = document.createElement("div");
  fovRow.style.cssText = FOV_ROW_STYLE;

  const fovLabel = document.createElement("label");
  fovLabel.textContent = "FOV";
  fovLabel.style.cssText = FOV_LABEL_STYLE;
  fovRow.appendChild(fovLabel);

  const fovSelect = document.createElement("select");
  fovSelect.dataset.fov = "preset";
  fovSelect.style.cssText = FOV_SELECT_STYLE;
  for (const preset of FOV_PRESETS) {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.label;
    fovSelect.appendChild(option);
  }
  fovSelect.value = opts.initialFov;
  fovRow.appendChild(fovSelect);
  card.appendChild(fovRow);

  // Internal state — track the latest click so "Look here" knows where to aim.
  let open = false;
  let currentAlt = 0;
  let currentAz = 0;

  function setReadout(alt: number, az: number): void {
    readout.textContent = `Alt ${alt.toFixed(1)}\u00B0  Az ${az.toFixed(1)}\u00B0`;
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
    const value = fovSelect.value;
    if (!isFovPresetId(value)) return;
    opts.dispatch({ type: "set-fov", preset: value });
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
