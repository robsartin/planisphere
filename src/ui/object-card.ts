/* SPDX-License-Identifier: Apache-2.0 */
import type { AltAzStar, CelestialBody, VisibleMessier, VisibleConstellation } from "../astro";
import type { VisibleSatellite } from "../sat";
import type { UIIntent } from "./index";
import { computeRiseSet } from "../astro/rise-set";
import { TEXT_MUTED } from "./styles";

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

const CARD_STYLE =
  "position:absolute;width:240px;background:rgba(10,20,40,0.96);color:#fff;" +
  "font:12px/1.45 sans-serif;padding:10px 12px 10px 12px;border-radius:6px;" +
  "border:1px solid rgba(100,160,255,0.8);z-index:1200;pointer-events:auto;" +
  "box-shadow:0 4px 16px rgba(0,0,0,0.5);transition:opacity 150ms ease;" +
  "box-sizing:border-box";

const CLOSE_BTN_STYLE =
  "background:none;border:none;color:rgba(255,255,255,0.7);cursor:pointer;" +
  "font:16px/1 sans-serif;padding:0;margin:0 0 0 8px;line-height:1";

const ACTION_BTN_STYLE =
  "background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);" +
  "border-radius:3px;color:#fff;cursor:pointer;font:11px/1.3 sans-serif;" +
  "padding:3px 8px;margin:0";

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
  return `${sign}${String(d)}\u00B0 ${String(m)}\u2032`;
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
          ? `M${String(data.messier.m)} \u2014 ${data.messier.name}`
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
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.justifyContent = "space-between";
  row.style.color = "rgba(255,255,255,0.85)";
  row.style.marginTop = "2px";
  const l = document.createElement("span");
  l.textContent = label;
  l.style.color = TEXT_MUTED;
  const v = document.createElement("span");
  v.textContent = value;
  row.appendChild(l);
  row.appendChild(v);
  container.appendChild(row);
}

function buildAttributes(data: ObjectCardData): HTMLElement {
  const wrap = document.createElement("div");
  wrap.dataset.testid = "object-card-attrs";
  wrap.style.marginTop = "6px";
  wrap.style.fontFamily = "monospace";
  wrap.style.fontSize = "11px";

  switch (data.kind) {
    case "star": {
      const s = data.star;
      appendAttrRow(wrap, "Alt / Az", `${s.alt.toFixed(1)}\u00B0 / ${s.az.toFixed(1)}\u00B0`);
      appendAttrRow(wrap, "RA / Dec", `${formatRa(s.ra)} ${formatDec(s.dec)}`);
      appendAttrRow(wrap, "Magnitude", s.mag.toFixed(2));
      break;
    }
    case "body": {
      const b = data.body;
      appendAttrRow(wrap, "Alt / Az", `${b.alt.toFixed(1)}\u00B0 / ${b.az.toFixed(1)}\u00B0`);
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
      appendAttrRow(wrap, "Alt / Az", `${sat.alt.toFixed(1)}\u00B0 / ${sat.az.toFixed(1)}\u00B0`);
      appendAttrRow(wrap, "Height", `${String(Math.round(sat.height))} km`);
      appendAttrRow(wrap, "Velocity", `${sat.velocity.toFixed(2)} km/s`);
      appendAttrRow(wrap, "NORAD ID", String(sat.noradId));
      break;
    }
    case "messier": {
      const m = data.messier;
      appendAttrRow(wrap, "Alt / Az", `${m.alt.toFixed(1)}\u00B0 / ${m.az.toFixed(1)}\u00B0`);
      appendAttrRow(wrap, "RA / Dec", `${formatRa(m.ra)} ${formatDec(m.dec)}`);
      appendAttrRow(wrap, "Magnitude", m.mag.toFixed(1));
      break;
    }
    case "constellation": {
      const c = data.constellation;
      appendAttrRow(
        wrap,
        "Centroid Alt / Az",
        `${c.centroid.alt.toFixed(1)}\u00B0 / ${c.centroid.az.toFixed(1)}\u00B0`,
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
  const row = document.createElement("div");
  row.dataset.testid = "object-card-actions";
  row.style.display = "flex";
  row.style.flexWrap = "wrap";
  row.style.gap = "4px";
  row.style.marginTop = "8px";

  const id = objectIdForData(data);

  const pinBtn = document.createElement("button");
  pinBtn.dataset.testid = "object-card-pin";
  pinBtn.textContent = "Pin";
  pinBtn.style.cssText = ACTION_BTN_STYLE;
  pinBtn.addEventListener("click", () => {
    dispatch({ type: "pin-object", id });
  });
  row.appendChild(pinBtn);

  if (data.kind === "body") {
    const trailBtn = document.createElement("button");
    trailBtn.dataset.testid = "object-card-trail";
    trailBtn.textContent = "Trail";
    trailBtn.style.cssText = ACTION_BTN_STYLE;
    trailBtn.addEventListener("click", () => {
      dispatch({ type: "show-trail", objectKind: "body", id: data.body.id });
    });
    row.appendChild(trailBtn);
  }

  if (upcomingEvent !== undefined && (data.kind === "body" || data.kind === "satellite")) {
    const peakBtn = document.createElement("button");
    peakBtn.dataset.testid = "object-card-go-to-peak";
    peakBtn.textContent = "Go to peak";
    peakBtn.style.cssText = ACTION_BTN_STYLE;
    peakBtn.addEventListener("click", () => {
      dispatch({ type: "set-time", time: upcomingEvent.when });
      dispatch({ type: "set-view", az: upcomingEvent.viewAz, alt: upcomingEvent.viewAlt });
    });
    row.appendChild(peakBtn);
  }

  const copyBtn = document.createElement("button");
  copyBtn.dataset.testid = "object-card-copy-link";
  copyBtn.textContent = "Copy link";
  copyBtn.style.cssText = ACTION_BTN_STYLE;
  copyBtn.addEventListener("click", () => {
    // The app frames the object in URL state via vaz/valt on set-view, then copy-link
    // serializes current state. Dispatch set-view first when we have a position, then copy.
    const pos = dataPosition(data);
    if (pos) {
      dispatch({ type: "set-view", az: pos.az, alt: pos.alt });
    }
    dispatch({ type: "copy-link" });
  });
  row.appendChild(copyBtn);

  return row;
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
  const root = document.createElement("div");
  root.dataset.testid = "object-card";
  root.style.cssText = CARD_STYLE;

  const applyPosition = (x: number, y: number): void => {
    const pos = smartPosition(x, y, props.viewportWidth, props.viewportHeight);
    root.style.left = `${String(pos.left)}px`;
    root.style.top = `${String(pos.top)}px`;
  };
  applyPosition(props.screenX, props.screenY);

  // Header: title + close button
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "flex-start";

  const { title, subtitle } = cardTitleForData(props.data);
  const headerText = document.createElement("div");
  headerText.style.flex = "1 1 auto";
  headerText.style.minWidth = "0";
  const titleEl = document.createElement("div");
  titleEl.dataset.testid = "object-card-title";
  titleEl.textContent = title;
  titleEl.style.fontWeight = "bold";
  titleEl.style.fontSize = "13px";
  titleEl.style.overflow = "hidden";
  titleEl.style.textOverflow = "ellipsis";
  titleEl.style.whiteSpace = "nowrap";
  headerText.appendChild(titleEl);

  const subtitleEl = document.createElement("div");
  subtitleEl.dataset.testid = "object-card-subtitle";
  subtitleEl.textContent = subtitle;
  subtitleEl.style.fontSize = "10px";
  subtitleEl.style.color = TEXT_MUTED;
  subtitleEl.style.marginTop = "1px";
  headerText.appendChild(subtitleEl);

  header.appendChild(headerText);

  const closeBtn = document.createElement("button");
  closeBtn.dataset.testid = "object-card-close";
  closeBtn.type = "button";
  closeBtn.textContent = "\u00D7";
  closeBtn.title = "Close";
  closeBtn.style.cssText = CLOSE_BTN_STYLE;
  if (props.onClose) {
    const fn = props.onClose;
    closeBtn.addEventListener("click", () => {
      fn();
    });
  }
  header.appendChild(closeBtn);

  root.appendChild(header);

  const attrs = buildAttributes(props.data);
  root.appendChild(attrs);

  const actions = buildActions(props.data, props.dispatch, props.upcomingEvent);
  root.appendChild(actions);

  let belowEl: HTMLElement | null = null;

  return {
    element: root,
    update(u: ObjectCardUpdate): void {
      applyPosition(u.screenX, u.screenY);
      if (u.belowHorizon) {
        if (belowEl === null) {
          const el = document.createElement("div");
          el.dataset.testid = "object-card-below-horizon";
          el.textContent = "\u2193 Below horizon";
          el.style.marginTop = "4px";
          el.style.color = "rgba(255,180,100,0.9)";
          el.style.fontSize = "10px";
          root.appendChild(el);
          belowEl = el;
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
