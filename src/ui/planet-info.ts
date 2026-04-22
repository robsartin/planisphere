/* SPDX-License-Identifier: Apache-2.0 */
import { el } from "./dom";
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

const ALT_AZ_STYLE: Partial<CSSStyleDeclaration> = {
  color: "rgba(255,255,255,0.65)",
  fontSize: "11px",
  fontFamily: "sans-serif",
  marginTop: "2px",
};

const RISE_SET_STYLE: Partial<CSSStyleDeclaration> = {
  fontSize: "11px",
  fontFamily: "sans-serif",
};

const BELOW_HORIZON_STYLE: Partial<CSSStyleDeclaration> = {
  color: "rgba(255,255,255,0.4)",
  fontSize: "10px",
  fontFamily: "sans-serif",
};

function buildRow(
  celestialBody: CelestialBody,
  lat: number,
  lon: number,
  time: Date,
  onSelect?: (az: number, alt: number) => void,
  onShowTrail?: (id: string) => void,
  trailBodyId?: string | null,
): HTMLElement {
  const riseSet = computeRiseSet(celestialBody.id, lat, lon, time);

  const nameEl = el("span", {
    testid: "planet-name",
    text: celestialBody.id,
    style: {
      color: celestialBody.color,
      fontWeight: "bold",
      fontSize: "12px",
      fontFamily: "sans-serif",
    },
  });
  if (celestialBody.alt > 0 && onSelect) {
    nameEl.style.cursor = "pointer";
    nameEl.style.textDecoration = "underline";
    nameEl.addEventListener("click", () => {
      onSelect(celestialBody.az, celestialBody.alt);
    });
  }

  const nameRow = el("div", {
    style: { display: "flex", justifyContent: "space-between", alignItems: "center" },
    children: [
      nameEl,
      celestialBody.alt <= 0
        ? el("span", {
            testid: "planet-below-horizon",
            text: "↓ below",
            style: BELOW_HORIZON_STYLE,
          })
        : null,
    ],
  });

  const altAzEl = el("div", {
    testid: "planet-altaz",
    text: formatAltAz(celestialBody.alt, celestialBody.az),
    style: ALT_AZ_STYLE,
  });

  const riseSetRow = el("div", {
    style: { display: "flex", gap: "8px", marginTop: "2px" },
    children: [
      el("span", {
        testid: "planet-rise",
        text: `↑ ${formatHHMM(riseSet.rise)}`,
        style: { ...RISE_SET_STYLE, color: ACCENT_COLOR },
      }),
      el("span", {
        testid: "planet-set",
        text: `↓ ${formatHHMM(riseSet.set)}`,
        style: { ...RISE_SET_STYLE, color: "rgba(255,180,100,0.85)" },
      }),
    ],
  });

  let trailBtn: HTMLElement | null = null;
  if (celestialBody.alt > 0 && onShowTrail) {
    const active = trailBodyId === celestialBody.id;
    trailBtn = el("button", {
      testid: "planet-show-trail",
      text: active ? "Hide path" : "Show path",
      style: {
        marginTop: "4px",
        padding: "2px 6px",
        fontSize: "11px",
        fontFamily: "sans-serif",
        background: active ? "rgba(100,160,255,0.25)" : SURFACE,
        color: TEXT_COLOR,
        border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: "3px",
        cursor: "pointer",
      },
    });
    trailBtn.addEventListener("click", () => {
      onShowTrail(celestialBody.id);
    });
  }

  return el("div", {
    testid: "planet-info-row",
    style: {
      marginBottom: "6px",
      paddingBottom: "6px",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
    },
    children: [nameRow, altAzEl, riseSetRow, trailBtn],
  });
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
  const heading = el("div", {
    testid: "planet-info-heading",
    text: "Planet Info",
    style: { fontWeight: "bold" },
  });
  applyBaseText(heading);

  const toggleBtn = el("button", {
    testid: "planet-info-toggle",
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

  const body = el("div", {
    testid: "planet-info-body",
    children: bodies.map((b) => buildRow(b, lat, lon, time, onSelect, onShowTrail, trailBodyId)),
  });

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
