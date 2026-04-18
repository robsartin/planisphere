/* SPDX-License-Identifier: Apache-2.0 */
import { applyBaseText, GAP, TEXT_COLOR } from "./styles";
import type { CelestialEvent } from "../astro/events";
import type { UIIntent } from "./index";

/** Format a Date as "YYYY-MM-DD HH:MM" in local time. */
function formatLocal(d: Date): string {
  const y = d.getFullYear();
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
  }
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
  const section = document.createElement("div");
  section.style.marginBottom = GAP;

  // Header
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.marginBottom = "4px";

  const heading = document.createElement("div");
  heading.dataset.testid = "events-heading";
  heading.textContent = "Upcoming Events";
  heading.style.fontWeight = "bold";
  applyBaseText(heading);
  header.appendChild(heading);

  const toggleBtn = document.createElement("button");
  toggleBtn.dataset.testid = "events-toggle";
  toggleBtn.textContent = "\u25BE";
  toggleBtn.style.background = "none";
  toggleBtn.style.border = "none";
  toggleBtn.style.color = TEXT_COLOR;
  toggleBtn.style.cursor = "pointer";
  toggleBtn.style.fontSize = "14px";
  toggleBtn.style.padding = "0 2px";
  header.appendChild(toggleBtn);

  section.appendChild(header);

  // Body
  const body = document.createElement("div");
  body.dataset.testid = "events-body";

  let collapsed = false;
  toggleBtn.addEventListener("click", () => {
    collapsed = !collapsed;
    body.style.display = collapsed ? "none" : "";
    toggleBtn.textContent = collapsed ? "\u25B8" : "\u25BE";
  });

  if (events.length === 0) {
    const empty = document.createElement("div");
    empty.dataset.testid = "events-empty";
    empty.textContent = "No upcoming events.";
    empty.style.color = "rgba(255,255,255,0.6)";
    empty.style.fontSize = "12px";
    empty.style.fontFamily = "sans-serif";
    empty.style.padding = "4px 0";
    body.appendChild(empty);
  } else {
    for (const event of events) {
      const row = document.createElement("div");
      row.dataset.testid = "event-row";
      row.style.marginBottom = "8px";
      row.style.paddingBottom = "6px";
      row.style.borderBottom = "1px solid rgba(255,255,255,0.08)";

      const titleRow = document.createElement("div");
      titleRow.style.display = "flex";
      titleRow.style.justifyContent = "space-between";
      titleRow.style.alignItems = "center";

      const titleEl = document.createElement("span");
      titleEl.dataset.testid = "event-title";
      titleEl.textContent = event.title;
      titleEl.style.color = kindColor(event.kind);
      titleEl.style.fontWeight = "bold";
      titleEl.style.fontSize = "12px";
      titleEl.style.fontFamily = "sans-serif";
      titleRow.appendChild(titleEl);

      const gotoBtn = document.createElement("button");
      gotoBtn.dataset.testid = "event-goto";
      gotoBtn.textContent = "Go to";
      gotoBtn.style.padding = "2px 6px";
      gotoBtn.style.fontSize = "11px";
      gotoBtn.style.fontFamily = "sans-serif";
      gotoBtn.style.background = "rgba(255,255,255,0.08)";
      gotoBtn.style.color = TEXT_COLOR;
      gotoBtn.style.border = "1px solid rgba(255,255,255,0.2)";
      gotoBtn.style.borderRadius = "3px";
      gotoBtn.style.cursor = "pointer";
      gotoBtn.addEventListener("click", () => {
        dispatch({ type: "set-time", time: event.when });
      });
      titleRow.appendChild(gotoBtn);
      row.appendChild(titleRow);

      const dateEl = document.createElement("div");
      dateEl.dataset.testid = "event-date";
      dateEl.textContent = formatLocal(event.when);
      dateEl.style.color = "rgba(255,255,255,0.7)";
      dateEl.style.fontSize = "11px";
      dateEl.style.fontFamily = "sans-serif";
      dateEl.style.marginTop = "2px";
      row.appendChild(dateEl);

      const descEl = document.createElement("div");
      descEl.dataset.testid = "event-description";
      descEl.textContent = event.description;
      descEl.style.color = "rgba(255,255,255,0.55)";
      descEl.style.fontSize = "11px";
      descEl.style.fontFamily = "sans-serif";
      descEl.style.marginTop = "2px";
      row.appendChild(descEl);

      body.appendChild(row);
    }
  }

  section.appendChild(body);
  return section;
}
