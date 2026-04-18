/* SPDX-License-Identifier: Apache-2.0 */
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
];

export function createLocationControls(
  initialLat: number,
  initialLon: number,
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  let currentLat = initialLat;
  let currentLon = initialLon;

  const section = document.createElement("div");
  section.style.marginBottom = GAP;

  const heading = document.createElement("div");
  heading.textContent = "Location";
  heading.style.fontWeight = "bold";
  heading.style.marginBottom = GAP;
  applyBaseText(heading);
  section.appendChild(heading);

  function makeNumberInput(
    label: string,
    field: "lat" | "lon",
    value: number,
    min: number,
    max: number,
  ): HTMLElement {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "6px";
    row.style.marginBottom = "4px";

    const lbl = document.createElement("label");
    lbl.textContent = label;
    lbl.style.color = "#fff";
    lbl.style.fontSize = "12px";
    lbl.style.width = "30px";
    lbl.style.fontFamily = "sans-serif";

    const input = document.createElement("input");
    input.type = "number";
    input.dataset.field = field;
    input.value = String(value);
    input.min = String(min);
    input.max = String(max);
    input.step = "0.01";
    input.style.flex = "1";
    input.style.background = "rgba(255,255,255,0.1)";
    input.style.border = "1px solid rgba(255,255,255,0.3)";
    input.style.borderRadius = "4px";
    input.style.color = "#fff";
    input.style.fontSize = "12px";
    input.style.padding = "4px";

    input.addEventListener("change", () => {
      if (input.value === "") return;
      const n = Number(input.value);
      if (!Number.isFinite(n)) return;
      if (field === "lat") currentLat = n;
      else currentLon = n;
      dispatch({ type: "set-observer", lat: currentLat, lon: currentLon });
    });

    row.appendChild(lbl);
    row.appendChild(input);
    return row;
  }

  section.appendChild(makeNumberInput("Lat", "lat", initialLat, -90, 90));
  section.appendChild(makeNumberInput("Lon", "lon", initialLon, -180, 180));

  // Preset dropdown
  const presetLabel = document.createElement("div");
  presetLabel.textContent = "City preset";
  presetLabel.style.color = "#fff";
  presetLabel.style.fontSize = "12px";
  presetLabel.style.marginTop = "6px";
  presetLabel.style.marginBottom = "4px";
  presetLabel.style.fontFamily = "sans-serif";
  section.appendChild(presetLabel);

  const select = document.createElement("select");
  select.style.width = "100%";
  select.style.background = "rgba(255,255,255,0.1)";
  select.style.border = "1px solid rgba(255,255,255,0.3)";
  select.style.borderRadius = "4px";
  select.style.color = "#fff";
  select.style.fontSize = "12px";
  select.style.padding = "4px";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "— Select city —";
  select.appendChild(placeholder);

  for (const city of PRESET_CITIES) {
    const opt = document.createElement("option");
    opt.value = JSON.stringify({ lat: city.lat, lon: city.lon });
    opt.textContent = city.name;
    select.appendChild(opt);
  }

  select.addEventListener("change", () => {
    if (!select.value) return;
    try {
      const { lat, lon } = JSON.parse(select.value) as { lat: number; lon: number };
      currentLat = lat;
      currentLon = lon;
      // Update inputs
      const latInput = section.querySelector<HTMLInputElement>("input[data-field='lat']");
      const lonInput = section.querySelector<HTMLInputElement>("input[data-field='lon']");
      if (latInput) latInput.value = String(lat);
      if (lonInput) lonInput.value = String(lon);
      dispatch({ type: "set-observer", lat, lon });
    } catch {
      // ignore malformed value
    }
  });

  section.appendChild(select);

  return section;
}
