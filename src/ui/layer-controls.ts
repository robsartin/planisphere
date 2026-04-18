/* SPDX-License-Identifier: Apache-2.0 */
import { applyBaseText, ACCENT_COLOR, GAP } from "./styles";
import type { UIIntent } from "./index";
import type { LayerVisibility, LayerOpacity } from "../state/state";

type LayerDef = {
  key: keyof LayerVisibility;
  label: string;
};

type LineDef = {
  key: keyof LayerOpacity;
  label: string;
  defaultPct: number;
};

const TOGGLE_LAYERS: LayerDef[] = [
  { key: "stars", label: "Stars ☆" },
  { key: "planets", label: "Planets ☾" },
  { key: "satellites", label: "Satellites 🛰" },
  { key: "compass", label: "Compass ◎" },
  { key: "deepSky", label: "Deep Sky \u2726" },
];

const LINE_LAYERS: LineDef[] = [
  { key: "constellationLines", label: "Constellation Lines", defaultPct: 25 },
  { key: "constellationBoundaries", label: "Constellation Boundaries", defaultPct: 15 },
  { key: "satelliteTrails", label: "Satellite Trails", defaultPct: 30 },
  { key: "raDecGrid", label: "RA/Dec Grid", defaultPct: 20 },
  { key: "ecliptic", label: "Ecliptic", defaultPct: 40 },
  { key: "milkyWay", label: "Milky Way", defaultPct: 30 },
];

export function createLayerControls(
  initialVisibility: LayerVisibility,
  initialOpacity: LayerOpacity,
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  const visibility = { ...initialVisibility };

  const section = document.createElement("div");
  section.style.marginBottom = GAP;

  // Layers heading
  const layersHeading = document.createElement("div");
  layersHeading.textContent = "Layers";
  layersHeading.style.fontWeight = "bold";
  layersHeading.style.marginBottom = GAP;
  applyBaseText(layersHeading);
  section.appendChild(layersHeading);

  // Build each toggle layer row (stars, planets, satellites, compass)
  for (const layer of TOGGLE_LAYERS) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.marginBottom = "6px";

    const lbl = document.createElement("label");
    lbl.style.display = "flex";
    lbl.style.alignItems = "center";
    lbl.style.gap = "6px";
    lbl.style.cursor = "pointer";
    applyBaseText(lbl);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.layer = layer.key;
    checkbox.checked = visibility[layer.key];
    checkbox.style.accentColor = ACCENT_COLOR;
    checkbox.style.width = "16px";
    checkbox.style.height = "16px";

    const labelText = document.createTextNode(layer.label);

    lbl.appendChild(checkbox);
    lbl.appendChild(labelText);
    row.appendChild(lbl);
    section.appendChild(row);

    checkbox.addEventListener("change", () => {
      visibility[layer.key] = checkbox.checked;
      dispatch({ type: "toggle-layer", layer: layer.key });
    });
  }

  // Line Layers heading
  const lineHeading = document.createElement("div");
  lineHeading.textContent = "Line Layers";
  lineHeading.style.fontWeight = "bold";
  lineHeading.style.marginTop = "8px";
  lineHeading.style.marginBottom = GAP;
  applyBaseText(lineHeading);
  section.appendChild(lineHeading);

  // Build each line-layer opacity slider (no toggle, slider to 0 = off)
  for (const ld of LINE_LAYERS) {
    const row = document.createElement("div");
    row.dataset.opacityRow = ld.key;
    row.style.marginBottom = "6px";

    const lbl = document.createElement("div");
    lbl.textContent = ld.label;
    applyBaseText(lbl);
    lbl.style.fontSize = "12px";
    lbl.style.marginBottom = "2px";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.dataset.opacity = ld.key;
    slider.min = "0";
    slider.max = "100";
    slider.step = "1";
    slider.value = String(Math.round(initialOpacity[ld.key] * 100));
    slider.style.width = "100%";
    slider.style.accentColor = ACCENT_COLOR;

    slider.addEventListener("input", () => {
      const value = Number(slider.value) / 100;
      dispatch({ type: "set-opacity", layer: ld.key, value });
    });

    row.appendChild(lbl);
    row.appendChild(slider);
    section.appendChild(row);
  }

  return section;
}
