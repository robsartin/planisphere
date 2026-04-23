/* SPDX-License-Identifier: Apache-2.0 */
import type { AltAzStar, CelestialBody, VisibleMessier, VisibleConstellation } from "../astro";
import type { VisibleSatellite } from "../sat";
import type { UIIntent } from "./index";
import { computeRiseSet } from "../astro/rise-set";
import { el } from "./dom";
import { SURFACE, TEXT_COLOR, TEXT_MUTED } from "./styles";

export type ObjectCardData =
  | { readonly kind: "star"; readonly star: AltAzStar }
  | {
      readonly kind: "body";
      readonly body: CelestialBody;
      readonly observer?: { readonly lat: number; readonly lon: number };
      readonly time?: Date;
    }
  | { readonly kind: "satellite"; readonly satellite: VisibleSatellite }
  | { readonly kind: "messier"; readonly messier: VisibleMessier }
  | { readonly kind: "constellation"; readonly constellation: VisibleConstellation };

/** Upcoming event usable by the "Go to peak" action. Passed in from the caller so
 *  the card doesn't have to know how to query the events subsystem. */
export type UpcomingEvent = {
  readonly when: Date;
  readonly viewAz: number;
  readonly viewAlt: number;
};

export type ObjectCardProps = {
  readonly data: ObjectCardData;
  readonly screenX: number;
  readonly screenY: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly dispatch: (intent: UIIntent) => void;
  readonly onClose?: () => void;
  /** Optional — when provided, the card shows a "Go to peak" action that jumps
   *  time + view to the event instant. */
  readonly upcomingEvent?: UpcomingEvent;
};

export type ObjectCardUpdate = {
  readonly screenX: number;
  readonly screenY: number;
  readonly belowHorizon: boolean;
};

export type ObjectCard = {
  readonly element: HTMLElement;
  update(u: ObjectCardUpdate): void;
  setActive(active: boolean): void;
  destroy(): void;
};

const CARD_WIDTH_PX = 240;
const CARD_OFFSET_PX = 16;
const ESTIMATED_HEIGHT_PX = 150;

const CARD_STYLE: Partial<CSSStyleDeclaration> = {
  position: "absolute",
  width: `${String(CARD_WIDTH_PX)}px`,
  background: "rgba(10,20,40,0.96)",
  color: TEXT_COLOR,
  font: "12px/1.45 sans-serif",
  padding: "10px 12px",
  borderRadius: "6px",
  border: "1px solid rgba(100,160,255,0.8)",
  zIndex: "1200",
  pointerEvents: "auto",
  boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
  transition: "opacity 150ms ease",
  boxSizing: "border-box",
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

const ACTION_BTN_STYLE: Partial<CSSStyleDeclaration> = {
  background: SURFACE,
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "3px",
  color: TEXT_COLOR,
  cursor: "pointer",
  font: "11px/1.3 sans-serif",
  padding: "3px 8px",
  margin: "0",
};

function formatRa(raDeg: number): string {
  const hours = raDeg / 15;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h)}h ${String(m)}m`;
}

function formatDec(dec: number): string {
  const sign = dec >= 0 ? "+" : "-";
  const abs = Math.abs(dec);
  const d = Math.floor(abs);
  const m = Math.round((abs - d) * 60);
  return `${sign}${String(d)}° ${String(m)}′`;
}

function formatHHMM(d: Date | null): string {
  if (d === null) return "--";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Compute card left/top so the card stays fully on-screen. Prefers right-of-click,
 *  flips left if it would overflow; same for top-vs-bottom. */
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

function cardTitleForData(data: ObjectCardData): { title: string; subtitle: string } {
  switch (data.kind) {
    case "star": {
      const name = data.star.name ?? `HIP ${String(data.star.hip)}`;
      return { title: name, subtitle: "Star" };
    }
    case "body":
      return { title: data.body.id, subtitle: "Solar system body" };
    case "satellite":
      return {
        title: data.satellite.name,
        subtitle: `Satellite · NORAD ${String(data.satellite.noradId)}`,
      };
    case "messier": {
      const mLabel =
        data.messier.name.length > 0
          ? `M${String(data.messier.m)} — ${data.messier.name}`
          : `M${String(data.messier.m)}`;
      return { title: mLabel, subtitle: `Deep-sky (${data.messier.type})` };
    }
    case "constellation":
      return { title: data.constellation.name, subtitle: "Constellation" };
  }
}

function objectIdForData(data: ObjectCardData): string {
  switch (data.kind) {
    case "star":
      return data.star.name ?? `HIP ${String(data.star.hip)}`;
    case "body":
      return data.body.id;
    case "satellite":
      return data.satellite.name;
    case "messier":
      return `M${String(data.messier.m)}`;
    case "constellation":
      return data.constellation.id;
  }
}

function appendAttrRow(container: HTMLElement, label: string, value: string): void {
  container.append(
    el("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        color: "rgba(255,255,255,0.85)",
        marginTop: "2px",
      },
      children: [
        el("span", { text: label, style: { color: TEXT_MUTED } }),
        el("span", { text: value }),
      ],
    }),
  );
}

function buildAttributes(data: ObjectCardData): HTMLElement {
  const wrap = el("div", {
    testid: "object-card-attrs",
    style: { marginTop: "6px", fontFamily: "monospace", fontSize: "11px" },
  });

  switch (data.kind) {
    case "star": {
      const s = data.star;
      appendAttrRow(wrap, "Alt / Az", `${s.alt.toFixed(1)}° / ${s.az.toFixed(1)}°`);
      appendAttrRow(wrap, "RA / Dec", `${formatRa(s.ra)} ${formatDec(s.dec)}`);
      appendAttrRow(wrap, "Magnitude", s.mag.toFixed(2));
      break;
    }
    case "body": {
      const b = data.body;
      appendAttrRow(wrap, "Alt / Az", `${b.alt.toFixed(1)}° / ${b.az.toFixed(1)}°`);
      appendAttrRow(wrap, "RA / Dec", `${formatRa(b.ra)} ${formatDec(b.dec)}`);
      appendAttrRow(wrap, "Magnitude", b.mag.toFixed(2));
      if (b.illumination !== undefined) {
        appendAttrRow(wrap, "Illuminated", `${Math.round(b.illumination * 100)}%`);
      }
      if (data.observer && data.time) {
        const rs = computeRiseSet(b.id, data.observer.lat, data.observer.lon, data.time);
        appendAttrRow(wrap, "Rise / Set", `${formatHHMM(rs.rise)} / ${formatHHMM(rs.set)}`);
      }
      break;
    }
    case "satellite": {
      const sat = data.satellite;
      appendAttrRow(wrap, "Alt / Az", `${sat.alt.toFixed(1)}° / ${sat.az.toFixed(1)}°`);
      appendAttrRow(wrap, "Height", `${String(Math.round(sat.height))} km`);
      appendAttrRow(wrap, "Velocity", `${sat.velocity.toFixed(2)} km/s`);
      appendAttrRow(wrap, "NORAD ID", String(sat.noradId));
      break;
    }
    case "messier": {
      const m = data.messier;
      appendAttrRow(wrap, "Alt / Az", `${m.alt.toFixed(1)}° / ${m.az.toFixed(1)}°`);
      appendAttrRow(wrap, "RA / Dec", `${formatRa(m.ra)} ${formatDec(m.dec)}`);
      appendAttrRow(wrap, "Magnitude", m.mag.toFixed(1));
      break;
    }
    case "constellation": {
      const c = data.constellation;
      appendAttrRow(
        wrap,
        "Centroid Alt / Az",
        `${c.centroid.alt.toFixed(1)}° / ${c.centroid.az.toFixed(1)}°`,
      );
      appendAttrRow(wrap, "Visible lines", String(c.lines.length));
      break;
    }
  }

  return wrap;
}

function buildActions(
  data: ObjectCardData,
  dispatch: (i: UIIntent) => void,
  upcomingEvent: UpcomingEvent | undefined,
): HTMLElement {
  const id = objectIdForData(data);

  const pinBtn = el("button", {
    testid: "object-card-pin",
    text: "Pin",
    style: ACTION_BTN_STYLE,
    on: {
      click: () => {
        dispatch({ type: "pin-object", id });
      },
    },
  });

  const trailBtn =
    data.kind === "body"
      ? el("button", {
          testid: "object-card-trail",
          text: "Trail",
          style: ACTION_BTN_STYLE,
          on: {
            click: () => {
              dispatch({ type: "show-trail", objectKind: "body", id: data.body.id });
            },
          },
        })
      : null;

  const peakBtn =
    upcomingEvent !== undefined && (data.kind === "body" || data.kind === "satellite")
      ? el("button", {
          testid: "object-card-go-to-peak",
          text: "Go to peak",
          style: ACTION_BTN_STYLE,
          on: {
            click: () => {
              dispatch({ type: "set-time", time: upcomingEvent.when });
              dispatch({ type: "set-view", az: upcomingEvent.viewAz, alt: upcomingEvent.viewAlt });
            },
          },
        })
      : null;

  const copyBtn = el("button", {
    testid: "object-card-copy-link",
    text: "Copy link",
    style: ACTION_BTN_STYLE,
    on: {
      click: () => {
        // The app frames the object in URL state via vaz/valt on set-view, then copy-link
        // serializes current state. Dispatch set-view first when we have a position, then copy.
        const pos = dataPosition(data);
        if (pos) {
          dispatch({ type: "set-view", az: pos.az, alt: pos.alt });
        }
        dispatch({ type: "copy-link" });
      },
    },
  });

  return el("div", {
    testid: "object-card-actions",
    style: { display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" },
    children: [pinBtn, trailBtn, peakBtn, copyBtn],
  });
}

function dataPosition(data: ObjectCardData): { alt: number; az: number } | null {
  switch (data.kind) {
    case "star":
      return { alt: data.star.alt, az: data.star.az };
    case "body":
      return { alt: data.body.alt, az: data.body.az };
    case "satellite":
      return { alt: data.satellite.alt, az: data.satellite.az };
    case "messier":
      return { alt: data.messier.alt, az: data.messier.az };
    case "constellation":
      return { alt: data.constellation.centroid.alt, az: data.constellation.centroid.az };
  }
}

export function createObjectCard(props: ObjectCardProps): ObjectCard {
  const { title, subtitle } = cardTitleForData(props.data);

  const closeBtn = el("button", {
    testid: "object-card-close",
    type: "button",
    text: "×",
    attrs: { title: "Close" },
    style: CLOSE_BTN_STYLE,
  });
  if (props.onClose) {
    const fn = props.onClose;
    closeBtn.addEventListener("click", () => {
      fn();
    });
  }

  const header = el("div", {
    style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
    children: [
      el("div", {
        style: { flex: "1 1 auto", minWidth: "0" },
        children: [
          el("div", {
            testid: "object-card-title",
            text: title,
            style: {
              fontWeight: "bold",
              fontSize: "13px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
          }),
          el("div", {
            testid: "object-card-subtitle",
            text: subtitle,
            style: { fontSize: "10px", color: TEXT_MUTED, marginTop: "1px" },
          }),
        ],
      }),
      closeBtn,
    ],
  });

  const root = el("div", {
    testid: "object-card",
    style: CARD_STYLE,
    children: [
      header,
      buildAttributes(props.data),
      buildActions(props.data, props.dispatch, props.upcomingEvent),
    ],
  });

  const applyPosition = (x: number, y: number): void => {
    const pos = smartPosition(x, y, props.viewportWidth, props.viewportHeight);
    root.style.left = `${String(pos.left)}px`;
    root.style.top = `${String(pos.top)}px`;
  };
  applyPosition(props.screenX, props.screenY);

  let belowEl: HTMLElement | null = null;

  return {
    element: root,
    update(u: ObjectCardUpdate): void {
      applyPosition(u.screenX, u.screenY);
      if (u.belowHorizon) {
        if (belowEl === null) {
          belowEl = el("div", {
            testid: "object-card-below-horizon",
            text: "↓ Below horizon",
            style: { marginTop: "4px", color: "rgba(255,180,100,0.9)", fontSize: "10px" },
          });
          root.append(belowEl);
        }
      } else if (belowEl !== null) {
        belowEl.remove();
        belowEl = null;
      }
    },
    setActive(active: boolean): void {
      root.style.opacity = active ? "1" : "0.65";
    },
    destroy(): void {
      root.remove();
    },
  };
}
