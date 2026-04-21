/* SPDX-License-Identifier: Apache-2.0 */
import { createDrawer } from "./drawer";
import { el } from "./dom";
import { createEventsPanel } from "./events-panel";
import { TEXT_COLOR } from "./styles";
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

/**
 * Slide-in drawer holding the celestial-events list.
 *
 * Thin wrapper around `createEventsPanel` hosted inside the shared `createDrawer`
 * primitive. Content is refreshed via `setEvents(events)` — callers (app.ts)
 * should call this on every `set-time` / `set-observer` / `now` intent so the
 * list is current whenever the user opens the drawer.
 */
export function createEventsDrawer(options: EventsDrawerOptions): EventsDrawer {
  const { dispatch } = options;

  const panelHost = el("div", { testid: "events-drawer-panel-host" });

  // Stable content host. We rebuild its children when setEvents is called so
  // updates propagate whether the drawer is open or closed.
  const content = el("div", {
    testid: "events-drawer-content",
    children: [
      el("div", {
        text: "Upcoming Events",
        style: {
          color: TEXT_COLOR,
          fontSize: "14px",
          fontWeight: "bold",
          fontFamily: "sans-serif",
          marginBottom: "8px",
        },
      }),
      panelHost,
    ],
  });

  let currentEvents: readonly CelestialEvent[] = [];

  function render(): void {
    panelHost.replaceChildren(createEventsPanel(currentEvents, dispatch));
  }

  render();

  const drawer = createDrawer({ side: "right", width: 360, initialContent: content });
  // Root element gets a test id so the existing "mounts events drawer" test keeps working.
  drawer.element.dataset.testid = "events-drawer";
  // Internal drawer structure test ids also get an events-drawer prefix so the
  // existing events-drawer-backdrop / events-drawer-close / events-drawer-body
  // queries continue to match after swapping in the canonical primitive.
  drawer.element.querySelectorAll<HTMLElement>("[data-testid^='drawer']").forEach((node) => {
    const prevId = node.dataset.testid!;
    node.dataset.testid = `events-${prevId}`;
  });

  return {
    element: drawer.element,
    open: () => drawer.open(content),
    close: () => drawer.close(),
    isOpen: () => drawer.isOpen(),
    setEvents(events) {
      currentEvents = events;
      render();
    },
  };
}
