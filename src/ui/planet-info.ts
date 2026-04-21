/* SPDX-License-Identifier: Apache-2.0 */
import { ACCENT_COLOR, applyBaseText, GAP, SURFACE, TEXT_COLOR } from "./styles";
import type { CelestialBody } from "../astro/bodies";
import { computeRiseSet } from "../astro/rise-set";

/** Format a Date as HH:MM in local time. */
function formatHHMM(d: Date | null): string {
  if (d === null) return "--";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Format altitude and azimuth as a compact string. */
function formatAltAz(alt: number, az: number): string {
  return `Alt ${alt.toFixed(1)}° Az ${az.toFixed(1)}°`;
}

/**
 * Create a collapsible planet info section for the control panel.
 *
 * Renders a row per body with current Alt/Az, rise time, and set time.
 * Bodies below the horizon are shown with a "below horizon" indicator.
 * When onSelect is provided, above-horizon body names are clickable and call
 * onSelect(az, alt) to point the view at that body.
 * When onShowTrail is provided, above-horizon bodies get a "Show path" button.
 * The button flips to "Hide path" when trailBodyId equals that body's id.
 */
export function createPlanetInfo(
  bodies: CelestialBody[],
  lat: number,
  lon: number,
  time: Date,
  onSelect?: (az: number, alt: number) => void,
  onShowTrail?: (id: string) => void,
  trailBodyId?: string | null,
): HTMLElement {
  const section = document.createElement("div");
  section.style.marginBottom = GAP;

  // Header row with heading and collapse toggle
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.marginBottom = "4px";

  const heading = document.createElement("div");
  heading.dataset.testid = "planet-info-heading";
  heading.textContent = "Planet Info";
  heading.style.fontWeight = "bold";
  applyBaseText(heading);
  header.appendChild(heading);

  const toggleBtn = document.createElement("button");
  toggleBtn.dataset.testid = "planet-info-toggle";
  toggleBtn.textContent = "▾";
  toggleBtn.style.background = "none";
  toggleBtn.style.border = "none";
  toggleBtn.style.color = TEXT_COLOR;
  toggleBtn.style.cursor = "pointer";
  toggleBtn.style.fontSize = "14px";
  toggleBtn.style.padding = "0 2px";
  header.appendChild(toggleBtn);

  section.appendChild(header);

  // Collapsible body
  const body = document.createElement("div");
  body.dataset.testid = "planet-info-body";

  let collapsed = false;
  toggleBtn.addEventListener("click", () => {
    collapsed = !collapsed;
    body.style.display = collapsed ? "none" : "";
    toggleBtn.textContent = collapsed ? "▸" : "▾";
  });

  // Build a row for each body
  for (const celestialBody of bodies) {
    const riseSet = computeRiseSet(celestialBody.id, lat, lon, time);

    const row = document.createElement("div");
    row.dataset.testid = "planet-info-row";
    row.style.marginBottom = "6px";
    row.style.paddingBottom = "6px";
    row.style.borderBottom = "1px solid rgba(255,255,255,0.08)";

    // Name row
    const nameRow = document.createElement("div");
    nameRow.style.display = "flex";
    nameRow.style.justifyContent = "space-between";
    nameRow.style.alignItems = "center";

    const nameEl = document.createElement("span");
    nameEl.dataset.testid = "planet-name";
    nameEl.textContent = celestialBody.id;
    nameEl.style.color = celestialBody.color;
    nameEl.style.fontWeight = "bold";
    nameEl.style.fontSize = "12px";
    nameEl.style.fontFamily = "sans-serif";

    if (celestialBody.alt > 0 && onSelect) {
      nameEl.style.cursor = "pointer";
      nameEl.style.textDecoration = "underline";
      nameEl.addEventListener("click", () => {
        onSelect(celestialBody.az, celestialBody.alt);
      });
    }

    nameRow.appendChild(nameEl);

    // Below-horizon indicator
    if (celestialBody.alt <= 0) {
      const indicator = document.createElement("span");
      indicator.dataset.testid = "planet-below-horizon";
      indicator.textContent = "↓ below";
      indicator.style.color = "rgba(255,255,255,0.4)";
      indicator.style.fontSize = "10px";
      indicator.style.fontFamily = "sans-serif";
      nameRow.appendChild(indicator);
    }

    row.appendChild(nameRow);

    // Alt/Az row
    const altAzEl = document.createElement("div");
    altAzEl.dataset.testid = "planet-altaz";
    altAzEl.textContent = formatAltAz(celestialBody.alt, celestialBody.az);
    altAzEl.style.color = "rgba(255,255,255,0.65)";
    altAzEl.style.fontSize = "11px";
    altAzEl.style.fontFamily = "sans-serif";
    altAzEl.style.marginTop = "2px";
    row.appendChild(altAzEl);

    // Rise/Set row
    const riseSetRow = document.createElement("div");
    riseSetRow.style.display = "flex";
    riseSetRow.style.gap = "8px";
    riseSetRow.style.marginTop = "2px";

    const riseEl = document.createElement("span");
    riseEl.dataset.testid = "planet-rise";
    riseEl.textContent = `↑ ${formatHHMM(riseSet.rise)}`;
    riseEl.style.color = ACCENT_COLOR;
    riseEl.style.fontSize = "11px";
    riseEl.style.fontFamily = "sans-serif";
    riseSetRow.appendChild(riseEl);

    const setEl = document.createElement("span");
    setEl.dataset.testid = "planet-set";
    setEl.textContent = `↓ ${formatHHMM(riseSet.set)}`;
    setEl.style.color = "rgba(255,180,100,0.85)";
    setEl.style.fontSize = "11px";
    setEl.style.fontFamily = "sans-serif";
    riseSetRow.appendChild(setEl);

    row.appendChild(riseSetRow);

    if (celestialBody.alt > 0 && onShowTrail) {
      const trailBtn = document.createElement("button");
      trailBtn.dataset.testid = "planet-show-trail";
      const active = trailBodyId === celestialBody.id;
      trailBtn.textContent = active ? "Hide path" : "Show path";
      trailBtn.style.marginTop = "4px";
      trailBtn.style.padding = "2px 6px";
      trailBtn.style.fontSize = "11px";
      trailBtn.style.fontFamily = "sans-serif";
      trailBtn.style.background = active ? "rgba(100,160,255,0.25)" : SURFACE;
      trailBtn.style.color = TEXT_COLOR;
      trailBtn.style.border = "1px solid rgba(255,255,255,0.2)";
      trailBtn.style.borderRadius = "3px";
      trailBtn.style.cursor = "pointer";
      trailBtn.addEventListener("click", () => {
        onShowTrail(celestialBody.id);
      });
      row.appendChild(trailBtn);
    }

    body.appendChild(row);
  }

  section.appendChild(body);
  return section;
}
