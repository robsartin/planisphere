/* SPDX-License-Identifier: Apache-2.0 */
import { el } from "./dom";
import { FOV_PRESETS, type FovPresetId, isFovPresetId } from "../astro/fov-presets";
import type { CelestialEvent } from "../astro/events";
import type { UIIntent } from "./index";

export type EmptySkyPopoverOptions = {
  readonly dispatch: (intent: UIIntent) => void;
  readonly initialFov: FovPresetId;
  /** Supplier for the current upcoming-events list. Called on each `open()` so the
   *  popover always renders the freshest events. Omit (or return []) to hide the
   *  upcoming-events section entirely and fall back to the standalone empty-sky UI. */
  readonly getEvents?: () => readonly CelestialEvent[];
  /** Supplier for the "now" reference used to format relative-time chips ("in 42 min",
   *  "in 3d 14h"). Should be the app's viewing time (`state.timeUtc`) — the same value
   *  the events were computed against. Defaults to real wall-clock time when omitted. */
  readonly getNow?: () => Date;
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

const EVENTS_SECTION_STYLE: Partial<CSSStyleDeclaration> = {
  marginTop: "8px",
  paddingTop: "8px",
  borderTop: "1px solid rgba(255,255,255,0.12)",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const EVENTS_HEADING_STYLE: Partial<CSSStyleDeclaration> = {
  color: "rgba(255,255,255,0.6)",
  font: "11px sans-serif",
  textTransform: "uppercase",
  letterSpacing: "0.4px",
};

const EVENT_ROW_STYLE: Partial<CSSStyleDeclaration> = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "6px",
  padding: "4px 6px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "4px",
  cursor: "pointer",
  textAlign: "left",
  color: "#fff",
  font: "11px sans-serif",
};

const EVENT_TITLE_STYLE: Partial<CSSStyleDeclaration> = {
  flex: "1",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const EVENT_CHIP_STYLE: Partial<CSSStyleDeclaration> = {
  flexShrink: "0",
  padding: "1px 6px",
  background: "rgba(100,160,255,0.25)",
  border: "1px solid rgba(100,160,255,0.5)",
  borderRadius: "8px",
  color: "rgba(255,255,255,0.9)",
  font: "10px sans-serif",
};

const MAX_EVENT_ROWS = 3;

/** Format a millisecond delta as a short relative-time chip. Examples:
 *  - "in 42 min" (< 1 hour)
 *  - "in 5h 12m" (< 1 day)
 *  - "in 3d 14h" (>= 1 day)
 *  Negative deltas (past events) collapse to "now". */
export function formatRelative(fromMs: number, toMs: number): string {
  const deltaMs = toMs - fromMs;
  if (deltaMs <= 0) return "now";
  const totalMinutes = Math.round(deltaMs / 60000);
  if (totalMinutes < 60) return `in ${String(totalMinutes)} min`;
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    const mins = totalMinutes - totalHours * 60;
    return `in ${String(totalHours)}h ${String(mins)}m`;
  }
  const days = Math.floor(totalHours / 24);
  const hours = totalHours - days * 24;
  return `in ${String(days)}d ${String(hours)}h`;
}

/** Extract the aim direction from an event when one is available. ISS pass events
 *  carry peakAz/peakAlt; the other kinds carry optional viewAz/viewAlt. */
function viewFromEvent(event: CelestialEvent): { az: number; alt: number } | null {
  if (event.kind === "iss-pass") {
    return { az: event.peakAzDeg, alt: event.peakAltDeg };
  }
  if (event.viewAz !== undefined && event.viewAlt !== undefined) {
    return { az: event.viewAz, alt: event.viewAlt };
  }
  return null;
}

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

  // Upcoming-events section — rebuilt on every open() from opts.getEvents().
  // Hidden entirely when no events are supplied or the list is empty, so the
  // fallback "Empty sky" copy stays the whole story.
  const eventsHost = el("div", { testid: "empty-sky-popover-events-host" });
  eventsHost.style.display = "none";

  // Card — floating panel with readout, "Look here", upcoming events, FOV select, close.
  const card = el("div", {
    testid: "empty-sky-popover-card",
    style: CARD_STYLE,
    children: [header, readout, actionRow, eventsHost, fovRow],
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

  function buildEventRow(event: CelestialEvent, nowMs: number): HTMLElement {
    const chip = el("span", {
      testid: "empty-sky-popover-event-chip",
      text: formatRelative(nowMs, event.when.getTime()),
      style: EVENT_CHIP_STYLE,
    });
    const title = el("span", {
      testid: "empty-sky-popover-event-title",
      text: event.title,
      style: EVENT_TITLE_STYLE,
    });
    const row = el("button", {
      testid: "empty-sky-popover-event-row",
      type: "button",
      style: EVENT_ROW_STYLE,
      children: [title, chip],
    });
    row.addEventListener("click", () => {
      opts.dispatch({ type: "set-time", time: event.when });
      const view = viewFromEvent(event);
      if (view !== null) {
        opts.dispatch({ type: "set-view", az: view.az, alt: view.alt });
      }
      closePopover();
    });
    return row;
  }

  function renderEvents(): void {
    const supplier = opts.getEvents;
    if (!supplier) {
      eventsHost.replaceChildren();
      eventsHost.style.display = "none";
      return;
    }
    const upcoming = [...supplier()].sort((a, b) => a.when.getTime() - b.when.getTime());
    const shown = upcoming.slice(0, MAX_EVENT_ROWS);
    if (shown.length === 0) {
      eventsHost.replaceChildren();
      eventsHost.style.display = "none";
      return;
    }
    const nowMs = (opts.getNow ? opts.getNow() : new Date()).getTime();
    const section = el("div", {
      testid: "empty-sky-popover-events",
      style: EVENTS_SECTION_STYLE,
      children: [
        el("div", { text: "Upcoming", style: EVENTS_HEADING_STYLE }),
        ...shown.map((event) => buildEventRow(event, nowMs)),
      ],
    });
    eventsHost.replaceChildren(section);
    eventsHost.style.display = "";
  }

  function openPopover(alt: number, az: number, screenX: number, screenY: number): void {
    currentAlt = alt;
    currentAz = az;
    setReadout(alt, az);
    renderEvents();
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
