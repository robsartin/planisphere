/* SPDX-License-Identifier: Apache-2.0 */
import citiesJson from "../../data/cities.json";
import { el } from "./dom";
import { ACCENT_COLOR, FONT_FAMILY, PANEL_BG, PANEL_BORDER, SURFACE, TEXT_COLOR } from "./styles";
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
  document.head.appendChild(
    el("style", { testid: "location-picker-styles", text: OVERLAY_STYLES }),
  );
  stylesInjected = true;
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

const NUMBER_INPUT_STYLE: Partial<CSSStyleDeclaration> = {
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: "6px",
  color: TEXT_COLOR,
  fontSize: "14px",
  padding: "8px",
  width: "100%",
  boxSizing: "border-box",
};

const FIELD_LABEL_STYLE: Partial<CSSStyleDeclaration> = {
  fontSize: "12px",
  opacity: "0.8",
};

const CITY_PILL_STYLE: Partial<CSSStyleDeclaration> = {
  background: SURFACE,
  border: "1px solid rgba(255,255,255,0.25)",
  borderRadius: "999px",
  color: TEXT_COLOR,
  fontSize: "12px",
  padding: "6px 12px",
  cursor: "pointer",
  fontFamily: FONT_FAMILY,
};

export function createLocationPickerOverlay(
  opts: LocationPickerOverlayOptions,
): LocationPickerOverlay {
  injectStylesOnce();
  let currentLat = opts.initialLat;
  let currentLon = opts.initialLon;

  function makeNumberField(
    label: string,
    field: "picker-lat" | "picker-lon",
    value: number,
    min: number,
    max: number,
  ): { wrapper: HTMLElement; input: HTMLInputElement } {
    const input = el("input", {
      type: "number",
      dataset: { field },
      style: NUMBER_INPUT_STYLE,
    });
    input.value = String(value);
    input.min = String(min);
    input.max = String(max);
    input.step = "0.01";

    const wrapper = el("div", {
      style: { display: "flex", flexDirection: "column", gap: "4px" },
      children: [el("label", { text: label, style: FIELD_LABEL_STYLE }), input],
    });
    return { wrapper, input };
  }

  const latField = makeNumberField("Latitude", "picker-lat", currentLat, LAT_MIN, LAT_MAX);
  const lonField = makeNumberField("Longitude", "picker-lon", currentLon, LON_MIN, LON_MAX);

  const setBtn = el("button", {
    testid: "location-picker-set",
    type: "button",
    text: "Set location",
    style: {
      background: "rgba(255,255,255,0.12)",
      border: "1px solid rgba(255,255,255,0.4)",
      borderRadius: "6px",
      color: TEXT_COLOR,
      padding: "8px 14px",
      fontSize: "14px",
      cursor: "pointer",
      fontWeight: "600",
    },
  });

  const latLonRow = el("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr auto",
      gap: "8px",
      alignItems: "end",
    },
    children: [latField.wrapper, lonField.wrapper, setBtn],
  });

  const useMyLocationBtn = el("button", {
    testid: "location-picker-use-my-location",
    type: "button",
    text: "📍 Use my location",
    style: {
      background: ACCENT_COLOR,
      color: "#003322",
      border: "none",
      borderRadius: "8px",
      padding: "12px 16px",
      fontSize: "15px",
      fontWeight: "600",
      cursor: "pointer",
    },
  });

  const citiesGrid = el("div", {
    style: { display: "flex", flexWrap: "wrap", gap: "6px" },
    children: CITIES.map((city) => {
      const pill = el("button", {
        testid: "location-picker-city",
        type: "button",
        text: city.name,
        attrs: { title: `${city.name}, ${city.country}` },
        style: CITY_PILL_STYLE,
      });
      pill.addEventListener("click", () => {
        opts.dispatch({ type: "set-observer", lat: city.lat, lon: city.lon });
        doClose();
      });
      return pill;
    }),
  });

  const body = el("div", {
    style: {
      overflowY: "auto",
      padding: "16px",
      flex: "1 1 auto",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
    },
    children: [
      useMyLocationBtn,
      latLonRow,
      el("div", {
        text: "Quick picks",
        style: { fontSize: "12px", opacity: "0.8", marginTop: "4px" },
      }),
      citiesGrid,
    ],
  });

  const closeBtn = el("button", {
    testid: "location-picker-close",
    type: "button",
    text: "×",
    attrs: { title: "Close (Esc)" },
    style: {
      background: "rgba(255,255,255,0.1)",
      border: "1px solid rgba(255,255,255,0.3)",
      borderRadius: "4px",
      color: TEXT_COLOR,
      cursor: "pointer",
      fontSize: "18px",
      lineHeight: "1",
      padding: "2px 10px",
    },
  });

  const header = el("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 16px",
      borderBottom: "1px solid rgba(255,255,255,0.15)",
      flexShrink: "0",
    },
    children: [
      el("div", {
        text: "Set observer location",
        style: { fontWeight: "600", fontSize: "15px" },
      }),
      closeBtn,
    ],
  });

  const panel = el("div", {
    testid: "location-picker-panel",
    style: {
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: "min(520px, 92vw)",
      maxHeight: "min(80vh, calc(100vh - 24px))",
      background: PANEL_BG,
      border: PANEL_BORDER,
      borderRadius: "10px",
      color: TEXT_COLOR,
      fontFamily: FONT_FAMILY,
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
    },
    children: [header, body],
  });

  const backdrop = el("div", {
    testid: "location-picker-backdrop",
    style: { position: "absolute", inset: "0", background: "rgba(0,0,0,0.6)" },
  });

  const root = el("div", {
    testid: "location-picker",
    style: { display: "none", position: "fixed", inset: "0", zIndex: "2100" },
    children: [backdrop, panel],
  });

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
