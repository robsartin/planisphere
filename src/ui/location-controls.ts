/* SPDX-License-Identifier: Apache-2.0 */
import { el } from "./dom";
import { applyBaseText, GAP } from "./styles";
import type { UIIntent } from "./index";

type City = { name: string; lat: number; lon: number };

const PRESET_CITIES: City[] = [
  { name: "New York", lat: 40.71, lon: -74.01 },
  { name: "London", lat: 51.51, lon: -0.13 },
  { name: "Tokyo", lat: 35.69, lon: 139.69 },
  { name: "Sydney", lat: -33.87, lon: 151.21 },
  { name: "São Paulo", lat: -23.55, lon: -46.63 },
  { name: "Cape Town", lat: -33.93, lon: 18.42 },
  { name: "Los Angeles", lat: 34.05, lon: -118.24 },
  { name: "Mumbai", lat: 19.08, lon: 72.88 },
  { name: "Austin", lat: 30.27, lon: -97.74 },
  { name: "Peoria", lat: 40.69, lon: -89.59 },
  { name: "Madison", lat: 43.07, lon: -89.4 },
  { name: "Seattle", lat: 47.61, lon: -122.33 },
  { name: "Boston", lat: 42.36, lon: -71.06 },
  { name: "Raleigh", lat: 35.78, lon: -78.64 },
  { name: "Deerfield", lat: 42.54, lon: -72.61 },
];

const NUMBER_INPUT_STYLE: Partial<CSSStyleDeclaration> = {
  flex: "1",
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: "4px",
  color: "#fff",
  fontSize: "12px",
  padding: "4px",
};

const SELECT_STYLE: Partial<CSSStyleDeclaration> = {
  width: "100%",
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: "4px",
  color: "#fff",
  fontSize: "12px",
  padding: "4px",
};

const LABEL_STYLE: Partial<CSSStyleDeclaration> = {
  color: "#fff",
  fontSize: "12px",
  width: "30px",
  fontFamily: "sans-serif",
};

const PRESET_LABEL_STYLE: Partial<CSSStyleDeclaration> = {
  color: "#fff",
  fontSize: "12px",
  marginTop: "6px",
  marginBottom: "4px",
  fontFamily: "sans-serif",
};

export function createLocationControls(
  initialLat: number,
  initialLon: number,
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  let currentLat = initialLat;
  let currentLon = initialLon;

  function makeNumberInput(
    label: string,
    field: "lat" | "lon",
    value: number,
    min: number,
    max: number,
  ): HTMLElement {
    const input = el("input", {
      type: "number",
      dataset: { field },
      style: NUMBER_INPUT_STYLE,
    });
    input.value = String(value);
    input.min = String(min);
    input.max = String(max);
    input.step = "0.01";
    input.addEventListener("change", () => {
      if (input.value === "") return;
      const n = Number(input.value);
      if (!Number.isFinite(n)) return;
      if (field === "lat") currentLat = n;
      else currentLon = n;
      dispatch({ type: "set-observer", lat: currentLat, lon: currentLon });
    });

    return el("div", {
      style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" },
      children: [el("label", { text: label, style: LABEL_STYLE }), input],
    });
  }

  const placeholder = el("option", { text: "— Select city —" });
  placeholder.value = "";

  const cityOptions = PRESET_CITIES.map((city) => {
    const opt = el("option", { text: city.name });
    opt.value = JSON.stringify({ lat: city.lat, lon: city.lon });
    return opt;
  });

  const select = el("select", {
    style: SELECT_STYLE,
    children: [placeholder, ...cityOptions],
  });

  const heading = el("div", {
    text: "Location",
    style: { fontWeight: "bold", marginBottom: GAP },
  });
  applyBaseText(heading);

  const section = el("div", {
    style: { marginBottom: GAP },
    children: [
      heading,
      makeNumberInput("Lat", "lat", initialLat, -90, 90),
      makeNumberInput("Lon", "lon", initialLon, -180, 180),
      el("div", { text: "City preset", style: PRESET_LABEL_STYLE }),
      select,
    ],
  });

  select.addEventListener("change", () => {
    if (!select.value) return;
    try {
      const { lat, lon } = JSON.parse(select.value) as { lat: number; lon: number };
      currentLat = lat;
      currentLon = lon;
      const latInput = section.querySelector<HTMLInputElement>("input[data-field='lat']");
      const lonInput = section.querySelector<HTMLInputElement>("input[data-field='lon']");
      if (latInput) latInput.value = String(lat);
      if (lonInput) lonInput.value = String(lon);
      dispatch({ type: "set-observer", lat, lon });
    } catch {
      // ignore malformed value
    }
  });

  return section;
}
