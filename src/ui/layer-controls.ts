/* SPDX-License-Identifier: Apache-2.0 */
import { applyBaseText, ACCENT_COLOR, GAP } from "./styles";
import type { UIIntent } from "./index";
import type { LayerVisibility, LayerOpacity } from "../state/state";

type LayerDef = {
  key: keyof LayerVisibility;
  label: string;
};

type OpacityDef = {
  key: keyof LayerOpacity;
  label: string;
  parentLayer: keyof LayerVisibility;
};

const LAYERS: LayerDef[] = [
  { key: "stars", label: "Stars ☆" },
  { key: "planets", label: "Planets ☾" },
  { key: "satellites", label: "Satellites 🛰" },
  { key: "constellationLines", label: "Constellation Lines ╱" },
  { key: "constellationBoundaries", label: "Constellation Boundaries ⬡" },
  { key: "compass", label: "Compass ◎" },
];

const OPACITY_CONTROLS: OpacityDef[] = [
  {
    key: "constellationLines",
    label: "Constellation Lines opacity",
    parentLayer: "constellationLines",
  },
  {
    key: "constellationBoundaries",
    label: "Constellation Boundaries opacity",
    parentLayer: "constellationBoundaries",
  },
  { key: "satelliteTrails", label: "Satellite Trails opacity", parentLayer: "satellites" },
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

  // Map from layer key → opacity slider row element, for show/hide
  const opacityRowMap = new Map<string, HTMLElement>();

  // Build each layer toggle row
  for (const layer of LAYERS) {
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
    // Style as toggle-like accent checkbox
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
      // Show/hide associated opacity row if any
      for (const od of OPACITY_CONTROLS) {
        if (od.parentLayer === layer.key) {
          const opRow = opacityRowMap.get(od.key);
          if (opRow) opRow.style.display = checkbox.checked ? "" : "none";
        }
      }
      dispatch({ type: "toggle-layer", layer: layer.key });
    });
  }

  // Opacity heading
  const opacityHeading = document.createElement("div");
  opacityHeading.textContent = "Opacity";
  opacityHeading.style.fontWeight = "bold";
  opacityHeading.style.marginTop = "8px";
  opacityHeading.style.marginBottom = GAP;
  applyBaseText(opacityHeading);
  section.appendChild(opacityHeading);

  // Build each opacity slider row
  for (const od of OPACITY_CONTROLS) {
    const row = document.createElement("div");
    row.dataset.opacityRow = od.key;
    row.style.marginBottom = "6px";
    // Hidden if parent layer is off
    if (!visibility[od.parentLayer]) row.style.display = "none";
    opacityRowMap.set(od.key, row);

    const lbl = document.createElement("div");
    lbl.textContent = od.label;
    applyBaseText(lbl);
    lbl.style.fontSize = "12px";
    lbl.style.marginBottom = "2px";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.dataset.opacity = od.key;
    slider.min = "0";
    slider.max = "100";
    slider.step = "1";
    slider.value = String(Math.round(initialOpacity[od.key] * 100));
    slider.style.width = "100%";
    slider.style.accentColor = ACCENT_COLOR;

    slider.addEventListener("input", () => {
      const value = Number(slider.value) / 100;
      dispatch({ type: "set-opacity", layer: od.key, value });
    });

    row.appendChild(lbl);
    row.appendChild(slider);
    section.appendChild(row);
  }

  return section;
}
