/* SPDX-License-Identifier: Apache-2.0 */
import { createDrawer } from "./drawer";
import { el } from "./dom";
import { createPlanetInfo } from "./planet-info";
import { TEXT_COLOR } from "./styles";
import type { CelestialBody } from "../astro/bodies";
import type { UIIntent } from "./index";

export type TonightDrawer = {
  element: HTMLElement;
  open(): void;
  close(): void;
  isOpen(): boolean;
  setBodies(
    bodies: CelestialBody[],
    lat: number,
    lon: number,
    time: Date,
    trailBodyId: string | null,
  ): void;
};

export type TonightDrawerOptions = {
  dispatch: (intent: UIIntent) => void;
};

/**
 * Slide-in drawer holding the Planet Info list.
 *
 * Replaces the always-on side-panel Planet Info section (milestone 1G). Thin
 * wrapper around `createPlanetInfo` hosted inside the shared `createDrawer`
 * primitive. Content is refreshed via `setBodies(...)` — callers (app.ts)
 * should call this on every `set-time` / `set-observer` / `show-trail` /
 * `hide-trail` / `now` intent so the list is current whenever the user opens
 * the drawer.
 */
export function createTonightDrawer(options: TonightDrawerOptions): TonightDrawer {
  const { dispatch } = options;

  const panelHost = el("div", { testid: "tonight-drawer-panel-host" });

  // Stable content host. Children are rebuilt when setBodies is called so
  // updates propagate whether the drawer is open or closed.
  const content = el("div", {
    testid: "tonight-drawer-content",
    children: [
      el("div", {
        testid: "tonight-drawer-title",
        text: "Tonight's sky",
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

  type Snapshot = {
    bodies: CelestialBody[];
    lat: number;
    lon: number;
    time: Date;
    trailBodyId: string | null;
  };
  let current: Snapshot | null = null;

  function render(): void {
    if (current === null) {
      panelHost.replaceChildren();
      return;
    }
    panelHost.replaceChildren(
      createPlanetInfo(
        current.bodies,
        current.lat,
        current.lon,
        current.time,
        (az, alt) => {
          dispatch({ type: "set-view", az, alt });
        },
        (id) => {
          if (current !== null && current.trailBodyId === id) {
            dispatch({ type: "hide-trail" });
          } else {
            dispatch({ type: "show-trail", objectKind: "body", id });
          }
        },
        current.trailBodyId,
      ),
    );
  }

  const drawer = createDrawer({ side: "right", width: 360, initialContent: content });
  drawer.element.dataset.testid = "tonight-drawer";
  // Prefix the inner drawer-* test ids so the tonight-drawer-{close,backdrop,body,header,panel}
  // selectors are unique (events + settings drawers have the same pattern on the page).
  drawer.element.querySelectorAll<HTMLElement>("[data-testid^='drawer']").forEach((node) => {
    const prev = node.dataset.testid!;
    node.dataset.testid = `tonight-${prev}`;
  });

  return {
    element: drawer.element,
    open: () => drawer.open(content),
    close: () => drawer.close(),
    isOpen: () => drawer.isOpen(),
    setBodies(bodies, lat, lon, time, trailBodyId) {
      current = { bodies, lat, lon, time, trailBodyId };
      render();
    },
  };
}
