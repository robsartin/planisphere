/* SPDX-License-Identifier: Apache-2.0 */
import { applyBaseText, ACCENT_COLOR } from "./styles";
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

function appendToggleRow(
  section: HTMLElement,
  layer: LayerDef,
  initialChecked: boolean,
  dispatch: (intent: UIIntent) => void,
): void {
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
  checkbox.checked = initialChecked;
  checkbox.style.accentColor = ACCENT_COLOR;
  checkbox.style.width = "16px";
  checkbox.style.height = "16px";

  lbl.appendChild(checkbox);
  lbl.appendChild(document.createTextNode(layer.label));
  row.appendChild(lbl);
  section.appendChild(row);

  checkbox.addEventListener("change", () => {
    dispatch({ type: "toggle-layer", layer: layer.key });
  });
}

function appendOpacityRow(
  section: HTMLElement,
  ld: LineDef,
  initialValue: number,
  dispatch: (intent: UIIntent) => void,
): void {
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
  slider.value = String(Math.round(initialValue * 100));
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

/**
 * Build a simple container holding one visibility checkbox per toggle layer.
 * Shared by the legacy side-panel composer and the 1E settings drawer.
 */
export function createVisibilitySection(
  visibility: LayerVisibility,
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  const section = document.createElement("div");
  for (const layer of TOGGLE_LAYERS) {
    appendToggleRow(section, layer, visibility[layer.key], dispatch);
  }
  return section;
}

/**
 * Build a container of opacity sliders — one per line layer.
 * Shared by the legacy composer and the 1E settings drawer.
 */
export function createOpacitySection(
  opacity: LayerOpacity,
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  const section = document.createElement("div");
  for (const ld of LINE_LAYERS) {
    appendOpacityRow(section, ld, opacity[ld.key], dispatch);
  }
  return section;
}

/**
 * Build the magnitude-filter slider with its live-updating label.
 */
export function createMagnitudeFilterSection(
  initialMagLimit: number,
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  const section = document.createElement("div");
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
  return section;
}

/**
 * Build the constellation-names language dropdown.
 */
export function createLanguageSection(
  initialLanguage: Language,
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  const section = document.createElement("div");
  const row = document.createElement("div");
  row.style.marginBottom = "6px";

  const select = document.createElement("select");
  select.dataset.language = "";
  select.style.width = "100%";
  applyBaseText(select);
  select.style.fontSize = "12px";

  for (const code of LANGUAGES) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = LANGUAGE_LABELS[code];
    if (code === initialLanguage) option.selected = true;
    select.appendChild(option);
  }

  select.addEventListener("change", () => {
    const value = select.value as Language;
    dispatch({ type: "set-language", language: value });
  });

  row.appendChild(select);
  section.appendChild(row);
  return section;
}

/**
 * Build the asterism-stick-figure skyculture dropdown.
 */
export function createSkycultureSection(
  initialSkyculture: SkycultureId,
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  const section = document.createElement("div");
  const row = document.createElement("div");
  row.style.marginBottom = "6px";

  const select = document.createElement("select");
  select.dataset.skyculture = "";
  select.style.width = "100%";
  applyBaseText(select);
  select.style.fontSize = "12px";

  for (const id of SKYCULTURES) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = SKYCULTURE_LABELS[id];
    if (id === initialSkyculture) option.selected = true;
    select.appendChild(option);
  }

  select.addEventListener("change", () => {
    const value = select.value as SkycultureId;
    dispatch({ type: "set-skyculture", id: value });
  });

  row.appendChild(select);
  section.appendChild(row);
  return section;
}
