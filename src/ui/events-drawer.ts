/* SPDX-License-Identifier: Apache-2.0 */
import { createEventsPanel } from "./events-panel";
import { PANEL_BG, PANEL_BORDER, TEXT_COLOR } from "./styles";
import type { CelestialEvent } from "../astro/events";
import type { UIIntent } from "./index";

export type EventsDrawer = {
  element: HTMLElement;
  open(): void;
  close(): void;
  isOpen(): boolean;
  setEvents(events: readonly CelestialEvent[]): void;
};

export type EventsDrawerOptions = {
  dispatch: (intent: UIIntent) => void;
};

// TODO: consolidate with settings drawer primitive (issue #196).
// When #196 lands `src/ui/drawer.ts` exporting a generic `createDrawer`,
// replace this inline implementation with an import from there.
type Drawer = {
  element: HTMLElement;
  body: HTMLElement;
  open(): void;
  close(): void;
  isOpen(): boolean;
};

function createDrawer(title: string, testidPrefix: string): Drawer {
  const root = document.createElement("div");
  root.dataset.testid = `${testidPrefix}`;
  root.style.display = "none";
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.zIndex = "1500";

  const backdrop = document.createElement("div");
  backdrop.dataset.testid = `${testidPrefix}-backdrop`;
  backdrop.style.position = "absolute";
  backdrop.style.inset = "0";
  backdrop.style.background = "rgba(0,0,0,0.4)";

  const panel = document.createElement("aside");
  panel.dataset.testid = `${testidPrefix}-panel`;
  panel.style.position = "absolute";
  panel.style.top = "0";
  panel.style.right = "0";
  panel.style.height = "100vh";
  // Responsive: full viewport on narrow screens, 360px on wider ones. `min` keeps
  // the drawer from exceeding the viewport on phones while sizing to 360 on desktop.
  panel.style.width = "min(100vw, 360px)";
  panel.style.background = PANEL_BG;
  panel.style.borderLeft = PANEL_BORDER;
  panel.style.boxSizing = "border-box";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.padding = "8px 12px";
  header.style.borderBottom = "1px solid rgba(255,255,255,0.15)";
  header.style.flexShrink = "0";

  const titleEl = document.createElement("span");
  titleEl.textContent = title;
  titleEl.style.color = TEXT_COLOR;
  titleEl.style.fontSize = "14px";
  titleEl.style.fontWeight = "bold";
  titleEl.style.fontFamily = "sans-serif";

  const closeBtn = document.createElement("button");
  closeBtn.dataset.testid = `${testidPrefix}-close`;
  closeBtn.textContent = "×";
  closeBtn.title = "Close (Esc)";
  closeBtn.style.background = "rgba(255,255,255,0.1)";
  closeBtn.style.border = "1px solid rgba(255,255,255,0.3)";
  closeBtn.style.borderRadius = "4px";
  closeBtn.style.color = TEXT_COLOR;
  closeBtn.style.cursor = "pointer";
  closeBtn.style.fontSize = "18px";
  closeBtn.style.lineHeight = "1";
  closeBtn.style.padding = "2px 10px";

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  const body = document.createElement("div");
  body.dataset.testid = `${testidPrefix}-body`;
  body.style.overflowY = "auto";
  body.style.padding = "12px";
  body.style.flex = "1 1 auto";

  panel.appendChild(header);
  panel.appendChild(body);
  root.appendChild(backdrop);
  root.appendChild(panel);

  let open = false;

  function doOpen(): void {
    open = true;
    root.style.display = "block";
  }

  function doClose(): void {
    open = false;
    root.style.display = "none";
  }

  backdrop.addEventListener("click", doClose);
  closeBtn.addEventListener("click", doClose);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) {
      doClose();
    }
  });

  return {
    element: root,
    body,
    open: doOpen,
    close: doClose,
    isOpen: () => open,
  };
}

/**
 * Slide-in drawer holding the celestial-events list.
 *
 * The drawer is a thin container around `createEventsPanel`: same rows, same
 * Go-to button, same empty state. Opened via the 📅 icon on the side panel.
 * Content is refreshed via `setEvents(events)` — callers (app.ts) should call
 * this on every `set-time` / `set-observer` / `now` intent so the list is
 * current whenever the user opens the drawer.
 */
export function createEventsDrawer(options: EventsDrawerOptions): EventsDrawer {
  const drawer = createDrawer("Upcoming Events", "events-drawer");
  const { dispatch } = options;

  let currentEvents: readonly CelestialEvent[] = [];

  function render(): void {
    drawer.body.replaceChildren(createEventsPanel(currentEvents, dispatch));
  }

  // Render once with the empty list so the drawer shows "no upcoming events"
  // even before the first refresh call.
  render();

  return {
    element: drawer.element,
    open: () => drawer.open(),
    close: () => drawer.close(),
    isOpen: () => drawer.isOpen(),
    setEvents(events) {
      currentEvents = events;
      render();
    },
  };
}
