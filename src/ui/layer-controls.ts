/* SPDX-License-Identifier: Apache-2.0 */
import { applyBaseText, ACCENT_COLOR, GAP } from "./styles";
import type { UIIntent } from "./index";
import type { LayerVisibility, LayerOpacity } from "../state/state";
import { LANGUAGES, type Language } from "../astro/constellation-names";
import { SKYCULTURES, type SkycultureId } from "../astro/skycultures";

const LANGUAGE_LABELS: Record<Language, string> = {
  la: "Latin",
  en: "English",
  zh: "中文",
  ar: "العربية",
  el: "Ελληνικά",
};

const SKYCULTURE_LABELS: Record<SkycultureId, string> = {
  western: "Western (IAU)",
  chinese: "Chinese (Xingguan) 星官",
  indian: "Indian (Vedic) वैदिक",
  norse_edda: "Norse (Edda)",
  hawaiian_starlines: "Hawaiian Starlines",
  maori: "Māori",
};

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
  initialMagLimit = 6.0,
  initialLanguage: Language = "la",
  initialSkyculture: SkycultureId = "western",
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

  // Magnitude limit slider
  const magHeading = document.createElement("div");
  magHeading.textContent = "Star Filter";
  magHeading.style.fontWeight = "bold";
  magHeading.style.marginTop = "8px";
  magHeading.style.marginBottom = GAP;
  applyBaseText(magHeading);
  section.appendChild(magHeading);

  const magRow = document.createElement("div");
  magRow.style.marginBottom = "6px";

  const magLabel = document.createElement("div");
  magLabel.dataset.magLabel = "";
  magLabel.textContent = `Mag \u2264 ${initialMagLimit.toFixed(1)}`;
  applyBaseText(magLabel);
  magLabel.style.fontSize = "12px";
  magLabel.style.marginBottom = "2px";

  const magSlider = document.createElement("input");
  magSlider.type = "range";
  magSlider.dataset.mag = "limit";
  magSlider.min = "1";
  magSlider.max = "6";
  magSlider.step = "0.5";
  magSlider.value = String(initialMagLimit);
  magSlider.style.width = "100%";
  magSlider.style.accentColor = ACCENT_COLOR;

  magSlider.addEventListener("input", () => {
    const value = Number(magSlider.value);
    magLabel.textContent = `Mag \u2264 ${value.toFixed(1)}`;
    dispatch({ type: "set-mag-limit", value });
  });

  magRow.appendChild(magLabel);
  magRow.appendChild(magSlider);
  section.appendChild(magRow);

  // Language dropdown (constellation label language)
  const langHeading = document.createElement("div");
  langHeading.textContent = "Constellation Names";
  langHeading.style.fontWeight = "bold";
  langHeading.style.marginTop = "8px";
  langHeading.style.marginBottom = GAP;
  applyBaseText(langHeading);
  section.appendChild(langHeading);

  const langRow = document.createElement("div");
  langRow.style.marginBottom = "6px";

  const langSelect = document.createElement("select");
  langSelect.dataset.language = "";
  langSelect.style.width = "100%";
  applyBaseText(langSelect);
  langSelect.style.fontSize = "12px";

  for (const code of LANGUAGES) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = LANGUAGE_LABELS[code];
    if (code === initialLanguage) option.selected = true;
    langSelect.appendChild(option);
  }

  langSelect.addEventListener("change", () => {
    const value = langSelect.value as Language;
    dispatch({ type: "set-language", language: value });
  });

  langRow.appendChild(langSelect);
  section.appendChild(langRow);

  // Skyculture dropdown (asterism stick-figure set)
  const skyHeading = document.createElement("div");
  skyHeading.textContent = "Skyculture";
  skyHeading.style.fontWeight = "bold";
  skyHeading.style.marginTop = "8px";
  skyHeading.style.marginBottom = GAP;
  applyBaseText(skyHeading);
  section.appendChild(skyHeading);

  const skyRow = document.createElement("div");
  skyRow.style.marginBottom = "6px";

  const skySelect = document.createElement("select");
  skySelect.dataset.skyculture = "";
  skySelect.style.width = "100%";
  applyBaseText(skySelect);
  skySelect.style.fontSize = "12px";

  for (const id of SKYCULTURES) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = SKYCULTURE_LABELS[id];
    if (id === initialSkyculture) option.selected = true;
    skySelect.appendChild(option);
  }

  skySelect.addEventListener("change", () => {
    const value = skySelect.value as SkycultureId;
    dispatch({ type: "set-skyculture", id: value });
  });

  skyRow.appendChild(skySelect);
  section.appendChild(skyRow);

  return section;
}
