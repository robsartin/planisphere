/* SPDX-License-Identifier: Apache-2.0 */
import { el } from "./dom";
import { applyBaseText, GAP, SURFACE, TEXT_COLOR, TEXT_MUTED } from "./styles";
import type { CelestialEvent } from "../astro/events";
import type { UIIntent } from "./index";

/**
 * Extract a view direction (az, alt) from a celestial event when one is present.
 *
 * ISS pass events carry `peakAzDeg/peakAltDeg`; the other kinds (conjunction, lunar
 * eclipse, meteor-shower) carry optional `viewAz/viewAlt`. Returns null when no
 * direction is available, in which case the Go-to button only dispatches set-time
 * and leaves the camera wherever it was.
 */
function viewFromEvent(event: CelestialEvent): { az: number; alt: number } | null {
  if (event.kind === "iss-pass") {
    return { az: event.peakAzDeg, alt: event.peakAltDeg };
  }
  if (event.viewAz !== undefined && event.viewAlt !== undefined) {
    return { az: event.viewAz, alt: event.viewAlt };
  }
  return null;
}

/** Format a Date as "YYYY-MM-DD HH:MM" in local time. */
function formatLocal(d: Date): string {
  const y = String(d.getFullYear());
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${dd} ${h}:${mi}`;
}

function kindColor(kind: CelestialEvent["kind"]): string {
  switch (kind) {
    case "conjunction":
      return "#9fd8ff";
    case "lunar-eclipse":
      return "#ffb088";
    case "meteor-shower-peak":
      return "#b6ff8e";
    case "iss-pass":
      return "#ffe08a";
  }
}

const DATE_STYLE: Partial<CSSStyleDeclaration> = {
  color: "rgba(255,255,255,0.7)",
  fontSize: "11px",
  fontFamily: "sans-serif",
  marginTop: "2px",
};

const DESC_STYLE: Partial<CSSStyleDeclaration> = {
  color: TEXT_MUTED,
  fontSize: "11px",
  fontFamily: "sans-serif",
  marginTop: "2px",
};

const GOTO_BTN_STYLE: Partial<CSSStyleDeclaration> = {
  padding: "2px 6px",
  fontSize: "11px",
  fontFamily: "sans-serif",
  background: SURFACE,
  color: TEXT_COLOR,
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "3px",
  cursor: "pointer",
};

function buildEventRow(event: CelestialEvent, dispatch: (intent: UIIntent) => void): HTMLElement {
  const gotoBtn = el("button", {
    testid: "event-goto",
    text: "Go to",
    style: GOTO_BTN_STYLE,
  });
  gotoBtn.addEventListener("click", () => {
    dispatch({ type: "set-time", time: event.when });
    // Aim the camera at the event's view direction when one is available, so
    // the subject is actually in the user's field of view rather than the
    // camera staying at whatever direction it was last pointed.
    const view = viewFromEvent(event);
    if (view !== null) {
      dispatch({ type: "set-view", az: view.az, alt: view.alt });
    }
  });

  const titleEl = el("span", {
    testid: "event-title",
    text: event.title,
    style: {
      color: kindColor(event.kind),
      fontWeight: "bold",
      fontSize: "12px",
      fontFamily: "sans-serif",
    },
  });

  const titleRow = el("div", {
    style: { display: "flex", justifyContent: "space-between", alignItems: "center" },
    children: [titleEl, gotoBtn],
  });

  // Grey out eclipsed ISS passes so the user can see the pass exists but knows
  // the satellite itself will be invisible (in Earth's shadow at peak).
  const eclipsed = event.kind === "iss-pass" && event.eclipsed;

  return el("div", {
    testid: "event-row",
    style: {
      marginBottom: "8px",
      paddingBottom: "6px",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      ...(eclipsed ? { opacity: "0.5" } : {}),
    },
    children: [
      titleRow,
      el("div", { testid: "event-date", text: formatLocal(event.when), style: DATE_STYLE }),
      el("div", { testid: "event-description", text: event.description, style: DESC_STYLE }),
    ],
  });
}

/**
 * Create the celestial-events side panel.
 *
 * Renders each event with its title, local date, and a "Go to" button that dispatches
 * a set-time intent. Empty state shows a short placeholder.
 */
export function createEventsPanel(
  events: readonly CelestialEvent[],
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  const heading = el("div", {
    testid: "events-heading",
    text: "Upcoming Events",
    style: { fontWeight: "bold" },
  });
  applyBaseText(heading);

  const toggleBtn = el("button", {
    testid: "events-toggle",
    text: "▾",
    style: {
      background: "none",
      border: "none",
      color: TEXT_COLOR,
      cursor: "pointer",
      fontSize: "14px",
      padding: "0 2px",
    },
  });

  const bodyChildren: HTMLElement[] =
    events.length === 0
      ? [
          el("div", {
            testid: "events-empty",
            text: "No upcoming events.",
            style: {
              color: "rgba(255,255,255,0.6)",
              fontSize: "12px",
              fontFamily: "sans-serif",
              padding: "4px 0",
            },
          }),
        ]
      : events.map((event) => buildEventRow(event, dispatch));

  const body = el("div", { testid: "events-body", children: bodyChildren });

  let collapsed = false;
  toggleBtn.addEventListener("click", () => {
    collapsed = !collapsed;
    body.style.display = collapsed ? "none" : "";
    toggleBtn.textContent = collapsed ? "▸" : "▾";
  });

  return el("div", {
    style: { marginBottom: GAP },
    children: [
      el("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "4px",
        },
        children: [heading, toggleBtn],
      }),
      body,
    ],
  });
}
