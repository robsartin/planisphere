/* SPDX-License-Identifier: Apache-2.0 */
import citiesJson from "../../data/cities.json";
import { ACCENT_COLOR, FONT_FAMILY, PANEL_BG, PANEL_BORDER, TEXT_COLOR } from "./styles";
import type { UIIntent } from "./index";

export type LocationPickerOverlay = {
  readonly element: HTMLElement;
  open(): void;
  close(): void;
  isOpen(): boolean;
};

export type LocationPickerOverlayOptions = {
  readonly dispatch: (intent: UIIntent) => void;
  readonly initialLat: number;
  readonly initialLon: number;
};

type City = {
  readonly name: string;
  readonly country: string;
  readonly lat: number;
  readonly lon: number;
};

/** ~20 evenly-distributed quick-pick cities, sliced from the bundled city list. */
const QUICK_PICK_COUNT = 24;
const CITIES: readonly City[] = (citiesJson as readonly City[]).slice(0, QUICK_PICK_COUNT);

const LAT_MIN = -90;
const LAT_MAX = 90;
const LON_MIN = -180;
const LON_MAX = 180;

/**
 * Responsive styles — on narrow viewports the centered modal becomes a
 * full-screen bottom-sheet so the city grid / numeric inputs stay reachable
 * without letterboxing. Injected once (idempotent) so multiple overlays share
 * the same rule.
 */
const OVERLAY_STYLES = `
@media (max-width: 520px) {
  [data-testid='location-picker-panel'] {
    width: 100vw !important;
    max-width: 100vw !important;
    height: 100vh !important;
    max-height: 100vh !important;
    top: 0 !important;
    left: 0 !important;
    transform: none !important;
    border-radius: 0 !important;
  }
}
`;

let stylesInjected = false;

function injectStylesOnce(): void {
  if (stylesInjected) return;
  // jsdom test env may not expose document.head until a full DOM is present.
  if (typeof document === "undefined" || !document.head) return;
  const style = document.createElement("style");
  style.dataset.testid = "location-picker-styles";
  style.textContent = OVERLAY_STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export function createLocationPickerOverlay(
  opts: LocationPickerOverlayOptions,
): LocationPickerOverlay {
  injectStylesOnce();
  let currentLat = opts.initialLat;
  let currentLon = opts.initialLon;

  const root = document.createElement("div");
  root.dataset.testid = "location-picker";
  root.style.display = "none";
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.zIndex = "2100";

  const backdrop = document.createElement("div");
  backdrop.dataset.testid = "location-picker-backdrop";
  backdrop.style.position = "absolute";
  backdrop.style.inset = "0";
  backdrop.style.background = "rgba(0,0,0,0.6)";

  const panel = document.createElement("div");
  panel.dataset.testid = "location-picker-panel";
  panel.style.position = "absolute";
  panel.style.left = "50%";
  panel.style.top = "50%";
  panel.style.transform = "translate(-50%, -50%)";
  panel.style.width = "min(520px, 92vw)";
  panel.style.maxHeight = "min(80vh, calc(100vh - 24px))";
  panel.style.background = PANEL_BG;
  panel.style.border = PANEL_BORDER;
  panel.style.borderRadius = "10px";
  panel.style.color = TEXT_COLOR;
  panel.style.fontFamily = FONT_FAMILY;
  panel.style.boxSizing = "border-box";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";

  // Header
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.padding = "12px 16px";
  header.style.borderBottom = "1px solid rgba(255,255,255,0.15)";
  header.style.flexShrink = "0";

  const title = document.createElement("div");
  title.textContent = "Set observer location";
  title.style.fontWeight = "600";
  title.style.fontSize = "15px";

  const closeBtn = document.createElement("button");
  closeBtn.dataset.testid = "location-picker-close";
  closeBtn.type = "button";
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

  header.appendChild(title);
  header.appendChild(closeBtn);

  // Scrollable body
  const body = document.createElement("div");
  body.style.overflowY = "auto";
  body.style.padding = "16px";
  body.style.flex = "1 1 auto";
  body.style.display = "flex";
  body.style.flexDirection = "column";
  body.style.gap = "14px";

  // "Use my location" big button
  const useMyLocationBtn = document.createElement("button");
  useMyLocationBtn.dataset.testid = "location-picker-use-my-location";
  useMyLocationBtn.type = "button";
  useMyLocationBtn.textContent = "\u{1F4CD} Use my location";
  useMyLocationBtn.style.background = ACCENT_COLOR;
  useMyLocationBtn.style.color = "#003322";
  useMyLocationBtn.style.border = "none";
  useMyLocationBtn.style.borderRadius = "8px";
  useMyLocationBtn.style.padding = "12px 16px";
  useMyLocationBtn.style.fontSize = "15px";
  useMyLocationBtn.style.fontWeight = "600";
  useMyLocationBtn.style.cursor = "pointer";

  // Numeric lat/lon row
  const latLonRow = document.createElement("div");
  latLonRow.style.display = "grid";
  latLonRow.style.gridTemplateColumns = "1fr 1fr auto";
  latLonRow.style.gap = "8px";
  latLonRow.style.alignItems = "end";

  function makeNumberField(
    label: string,
    field: "picker-lat" | "picker-lon",
    value: number,
    min: number,
    max: number,
  ): { wrapper: HTMLElement; input: HTMLInputElement } {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.gap = "4px";

    const lbl = document.createElement("label");
    lbl.textContent = label;
    lbl.style.fontSize = "12px";
    lbl.style.opacity = "0.8";

    const input = document.createElement("input");
    input.type = "number";
    input.dataset.field = field;
    input.value = String(value);
    input.min = String(min);
    input.max = String(max);
    input.step = "0.01";
    input.style.background = "rgba(255,255,255,0.1)";
    input.style.border = "1px solid rgba(255,255,255,0.3)";
    input.style.borderRadius = "6px";
    input.style.color = TEXT_COLOR;
    input.style.fontSize = "14px";
    input.style.padding = "8px";
    input.style.width = "100%";
    input.style.boxSizing = "border-box";

    wrapper.appendChild(lbl);
    wrapper.appendChild(input);
    return { wrapper, input };
  }

  const latField = makeNumberField("Latitude", "picker-lat", currentLat, LAT_MIN, LAT_MAX);
  const lonField = makeNumberField("Longitude", "picker-lon", currentLon, LON_MIN, LON_MAX);

  const setBtn = document.createElement("button");
  setBtn.dataset.testid = "location-picker-set";
  setBtn.type = "button";
  setBtn.textContent = "Set location";
  setBtn.style.background = "rgba(255,255,255,0.12)";
  setBtn.style.border = "1px solid rgba(255,255,255,0.4)";
  setBtn.style.borderRadius = "6px";
  setBtn.style.color = TEXT_COLOR;
  setBtn.style.padding = "8px 14px";
  setBtn.style.fontSize = "14px";
  setBtn.style.cursor = "pointer";
  setBtn.style.fontWeight = "600";

  latLonRow.appendChild(latField.wrapper);
  latLonRow.appendChild(lonField.wrapper);
  latLonRow.appendChild(setBtn);

  // City pills
  const citiesHeader = document.createElement("div");
  citiesHeader.textContent = "Quick picks";
  citiesHeader.style.fontSize = "12px";
  citiesHeader.style.opacity = "0.8";
  citiesHeader.style.marginTop = "4px";

  const citiesGrid = document.createElement("div");
  citiesGrid.style.display = "flex";
  citiesGrid.style.flexWrap = "wrap";
  citiesGrid.style.gap = "6px";

  for (const city of CITIES) {
    const pill = document.createElement("button");
    pill.dataset.testid = "location-picker-city";
    pill.type = "button";
    pill.textContent = city.name;
    pill.title = `${city.name}, ${city.country}`;
    pill.style.background = "rgba(255,255,255,0.08)";
    pill.style.border = "1px solid rgba(255,255,255,0.25)";
    pill.style.borderRadius = "999px";
    pill.style.color = TEXT_COLOR;
    pill.style.fontSize = "12px";
    pill.style.padding = "6px 12px";
    pill.style.cursor = "pointer";
    pill.style.fontFamily = FONT_FAMILY;
    pill.addEventListener("click", () => {
      opts.dispatch({ type: "set-observer", lat: city.lat, lon: city.lon });
      doClose();
    });
    citiesGrid.appendChild(pill);
  }

  body.appendChild(useMyLocationBtn);
  body.appendChild(latLonRow);
  body.appendChild(citiesHeader);
  body.appendChild(citiesGrid);

  panel.appendChild(header);
  panel.appendChild(body);
  root.appendChild(backdrop);
  root.appendChild(panel);

  let open = false;

  function setOpenState(value: boolean): void {
    open = value;
    root.style.display = value ? "block" : "none";
    document.body.style.overflow = value ? "hidden" : "";
  }

  function doOpen(): void {
    // Prefill inputs with the currently-known observer values each time we open,
    // so repeated opens don't preserve stale edits.
    latField.input.value = String(currentLat);
    lonField.input.value = String(currentLon);
    setOpenState(true);
  }

  function doClose(): void {
    setOpenState(false);
  }

  // Close affordances
  backdrop.addEventListener("click", doClose);
  closeBtn.addEventListener("click", doClose);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) {
      doClose();
    }
  });

  useMyLocationBtn.addEventListener("click", () => {
    opts.dispatch({ type: "now" });
    doClose();
  });

  setBtn.addEventListener("click", () => {
    const latRaw = latField.input.value.trim();
    const lonRaw = lonField.input.value.trim();
    if (latRaw === "" || lonRaw === "") return;
    const latN = Number(latRaw);
    const lonN = Number(lonRaw);
    if (!Number.isFinite(latN) || !Number.isFinite(lonN)) return;
    const lat = clamp(latN, LAT_MIN, LAT_MAX);
    const lon = clamp(lonN, LON_MIN, LON_MAX);
    currentLat = lat;
    currentLon = lon;
    opts.dispatch({ type: "set-observer", lat, lon });
    doClose();
  });

  return {
    element: root,
    open: doOpen,
    close: doClose,
    isOpen: () => open,
  };
}
