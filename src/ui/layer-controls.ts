/* SPDX-License-Identifier: Apache-2.0 */
import { el } from "./dom";
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
  { key: "deepSky", label: "Deep Sky ✦" },
];

const LINE_LAYERS: LineDef[] = [
  { key: "constellationLines", label: "Constellation Lines", defaultPct: 25 },
  { key: "constellationBoundaries", label: "Constellation Boundaries", defaultPct: 15 },
  { key: "satelliteTrails", label: "Satellite Trails", defaultPct: 30 },
  { key: "raDecGrid", label: "RA/Dec Grid", defaultPct: 20 },
  { key: "ecliptic", label: "Ecliptic", defaultPct: 40 },
  { key: "milkyWay", label: "Milky Way", defaultPct: 30 },
];

const SLIDER_LABEL_STYLE: Partial<CSSStyleDeclaration> = {
  fontSize: "12px",
  marginBottom: "2px",
};

const SLIDER_STYLE: Partial<CSSStyleDeclaration> = {
  width: "100%",
  accentColor: ACCENT_COLOR,
};

function buildToggleRow(
  layer: LayerDef,
  initialChecked: boolean,
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  const checkbox = el("input", {
    type: "checkbox",
    dataset: { layer: layer.key },
    style: { accentColor: ACCENT_COLOR, width: "16px", height: "16px" },
  });
  checkbox.checked = initialChecked;
  checkbox.addEventListener("change", () => {
    dispatch({ type: "toggle-layer", layer: layer.key });
  });

  const lbl = el("label", {
    style: { display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" },
    children: [checkbox, document.createTextNode(layer.label)],
  });
  applyBaseText(lbl);

  return el("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "6px",
    },
    children: [lbl],
  });
}

function buildOpacityRow(
  ld: LineDef,
  initialValue: number,
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  const lbl = el("div", { text: ld.label, style: SLIDER_LABEL_STYLE });
  applyBaseText(lbl);

  const slider = el("input", {
    type: "range",
    dataset: { opacity: ld.key },
    style: SLIDER_STYLE,
  });
  slider.min = "0";
  slider.max = "100";
  slider.step = "1";
  slider.value = String(Math.round(initialValue * 100));
  slider.addEventListener("input", () => {
    dispatch({ type: "set-opacity", layer: ld.key, value: Number(slider.value) / 100 });
  });

  return el("div", {
    dataset: { opacityRow: ld.key },
    style: { marginBottom: "6px" },
    children: [lbl, slider],
  });
}

/**
 * Build a simple container holding one visibility checkbox per toggle layer.
 * Shared by the legacy side-panel composer and the 1E settings drawer.
 */
export function createVisibilitySection(
  visibility: LayerVisibility,
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  return el("div", {
    children: TOGGLE_LAYERS.map((layer) => buildToggleRow(layer, visibility[layer.key], dispatch)),
  });
}

/**
 * Build a container of opacity sliders — one per line layer.
 * Shared by the legacy composer and the 1E settings drawer.
 */
export function createOpacitySection(
  opacity: LayerOpacity,
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  return el("div", {
    children: LINE_LAYERS.map((ld) => buildOpacityRow(ld, opacity[ld.key], dispatch)),
  });
}

/**
 * Build the magnitude-filter slider with its live-updating label.
 */
export function createMagnitudeFilterSection(
  initialMagLimit: number,
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  const magLabel = el("div", {
    dataset: { magLabel: "" },
    text: `Mag ≤ ${initialMagLimit.toFixed(1)}`,
    style: SLIDER_LABEL_STYLE,
  });
  applyBaseText(magLabel);

  const magSlider = el("input", {
    type: "range",
    dataset: { mag: "limit" },
    style: SLIDER_STYLE,
  });
  magSlider.min = "1";
  magSlider.max = "6";
  magSlider.step = "0.5";
  magSlider.value = String(initialMagLimit);
  magSlider.addEventListener("input", () => {
    const value = Number(magSlider.value);
    magLabel.textContent = `Mag ≤ ${value.toFixed(1)}`;
    dispatch({ type: "set-mag-limit", value });
  });

  return el("div", {
    children: [el("div", { style: { marginBottom: "6px" }, children: [magLabel, magSlider] })],
  });
}

function buildSelectRow<T extends string>(
  ids: readonly T[],
  labels: Record<T, string>,
  initial: T,
  datasetKey: "language" | "skyculture",
  onChange: (value: T) => void,
): HTMLElement {
  const select = el("select", {
    dataset: { [datasetKey]: "" },
    style: { width: "100%", fontSize: "12px" },
    children: ids.map((id) => {
      const option = el("option", { text: labels[id] });
      option.value = id;
      if (id === initial) option.selected = true;
      return option;
    }),
  });
  applyBaseText(select);
  select.addEventListener("change", () => {
    onChange(select.value as T);
  });

  return el("div", {
    children: [el("div", { style: { marginBottom: "6px" }, children: [select] })],
  });
}

/**
 * Build the constellation-names language dropdown.
 */
export function createLanguageSection(
  initialLanguage: Language,
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  return buildSelectRow(LANGUAGES, LANGUAGE_LABELS, initialLanguage, "language", (language) => {
    dispatch({ type: "set-language", language });
  });
}

/**
 * Build the asterism-stick-figure skyculture dropdown.
 */
export function createSkycultureSection(
  initialSkyculture: SkycultureId,
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  return buildSelectRow(SKYCULTURES, SKYCULTURE_LABELS, initialSkyculture, "skyculture", (id) => {
    dispatch({ type: "set-skyculture", id });
  });
}
