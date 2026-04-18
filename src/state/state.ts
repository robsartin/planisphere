/* SPDX-License-Identifier: Apache-2.0 */
import { err, ok, type Result } from "../result";
import { LANGUAGES, type Language } from "../astro/constellation-names";
import { type FovPresetId, parseFovPreset } from "../astro/fov-presets";

export type Observer = { readonly lat: number; readonly lon: number };

export type LayerVisibility = {
  readonly stars: boolean;
  readonly planets: boolean;
  readonly satellites: boolean;
  readonly compass: boolean;
  readonly deepSky: boolean;
};

export type LayerOpacity = {
  readonly constellationLines: number; // 0–1
  readonly constellationBoundaries: number; // 0–1
  readonly satelliteTrails: number; // 0–1
  readonly raDecGrid: number; // 0–1
  readonly ecliptic: number; // 0–1
  readonly milkyWay: number; // 0–1
};

export type ViewDirection = {
  readonly az: number;
  readonly alt: number;
};

export type AppState = {
  readonly observer: Observer;
  readonly timeUtc: Date;
  readonly layers: LayerVisibility;
  readonly opacity: LayerOpacity;
  readonly view: ViewDirection;
  readonly nightVision: boolean;
  readonly magLimit: number; // 1.0–6.0, default 6.0
  readonly language: Language;
  readonly fov: FovPresetId; // telescope FOV reticle preset, default "off"
};

export type StateParseError =
  | { kind: "lat-not-a-number"; raw: string }
  | { kind: "lat-out-of-range"; value: number }
  | { kind: "lon-not-a-number"; raw: string }
  | { kind: "lon-out-of-range"; value: number }
  | { kind: "time-invalid"; raw: string };

const ALL_LAYER_KEYS: readonly (keyof LayerVisibility)[] = [
  "stars",
  "planets",
  "satellites",
  "compass",
  "deepSky",
];

export const DEFAULT_LAYERS: LayerVisibility = {
  stars: true,
  planets: true,
  satellites: true,
  compass: true,
  deepSky: true,
};

export const DEFAULT_OPACITY: LayerOpacity = {
  constellationLines: 1.0,
  constellationBoundaries: 1.0,
  satelliteTrails: 1.0,
  raDecGrid: 0.2,
  ecliptic: 0.4,
  milkyWay: 0.3,
};

export const DEFAULT_VIEW: ViewDirection = { az: 0, alt: 89.9 };

export const DEFAULT_MAG_LIMIT = 6.0;

export const DEFAULT_LANGUAGE: Language = "la";
export const DEFAULT_FOV: FovPresetId = "off";

export const DEFAULT_STATE: AppState = {
  observer: { lat: 0, lon: 0 },
  timeUtc: new Date("2026-04-15T00:00:00.000Z"),
  layers: DEFAULT_LAYERS,
  opacity: DEFAULT_OPACITY,
  view: DEFAULT_VIEW,
  nightVision: false,
  magLimit: DEFAULT_MAG_LIMIT,
  language: DEFAULT_LANGUAGE,
  fov: DEFAULT_FOV,
};

function parseLat(raw: string): Result<number, StateParseError> {
  const n = Number(raw);
  if (!Number.isFinite(n)) return err({ kind: "lat-not-a-number", raw });
  if (n < -90 || n > 90) return err({ kind: "lat-out-of-range", value: n });
  return ok(n);
}

function parseLon(raw: string): Result<number, StateParseError> {
  const n = Number(raw);
  if (!Number.isFinite(n)) return err({ kind: "lon-not-a-number", raw });
  if (n < -180 || n > 180) return err({ kind: "lon-out-of-range", value: n });
  return ok(n);
}

function parseTime(raw: string): Result<Date, StateParseError> {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return err({ kind: "time-invalid", raw });
  return ok(d);
}

function parseLayerVisibility(raw: string | null): LayerVisibility {
  if (raw === null) return DEFAULT_LAYERS;
  const keys = new Set(raw.split(",").map((k) => k.trim()));
  return {
    stars: keys.has("stars"),
    planets: keys.has("planets"),
    satellites: keys.has("satellites"),
    compass: keys.has("compass"),
    deepSky: keys.has("deepSky"),
  };
}

function parseOpacity(raw: string | null, defaultValue: number): number {
  if (raw === null) return defaultValue;
  const n = Number(raw);
  if (!Number.isFinite(n)) return defaultValue;
  return Math.min(1, Math.max(0, n / 100));
}

function parseMagLimit(raw: string | null): number {
  if (raw === null) return DEFAULT_MAG_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_MAG_LIMIT;
  return Math.min(6.0, Math.max(1.0, n));
}

function parseLanguage(raw: string | null): Language {
  if (raw === null) return DEFAULT_LANGUAGE;
  return (LANGUAGES as readonly string[]).includes(raw) ? (raw as Language) : DEFAULT_LANGUAGE;
}

export function parseStateFromSearchParams(
  params: URLSearchParams,
): Result<AppState, StateParseError> {
  let lat = DEFAULT_STATE.observer.lat;
  let lon = DEFAULT_STATE.observer.lon;
  // Default to real "now" rather than the frozen DEFAULT_STATE.timeUtc so events
  // and the sky open on the current moment when no ?t param is supplied.
  let timeUtc = new Date();

  const rawLat = params.get("lat");
  if (rawLat !== null) {
    const r = parseLat(rawLat);
    if (!r.ok) return r;
    lat = r.value;
  }

  const rawLon = params.get("lon");
  if (rawLon !== null) {
    const r = parseLon(rawLon);
    if (!r.ok) return r;
    lon = r.value;
  }

  const rawT = params.get("t");
  if (rawT !== null) {
    const r = parseTime(rawT);
    if (!r.ok) return r;
    timeUtc = r.value;
  }

  const layers = parseLayerVisibility(params.get("layers"));

  const opacity: LayerOpacity = {
    constellationLines: parseOpacity(params.get("op_cl"), DEFAULT_OPACITY.constellationLines),
    constellationBoundaries: parseOpacity(
      params.get("op_cb"),
      DEFAULT_OPACITY.constellationBoundaries,
    ),
    satelliteTrails: parseOpacity(params.get("op_st"), DEFAULT_OPACITY.satelliteTrails),
    raDecGrid: parseOpacity(params.get("op_grid"), DEFAULT_OPACITY.raDecGrid),
    ecliptic: parseOpacity(params.get("op_ecl"), DEFAULT_OPACITY.ecliptic),
    milkyWay: parseOpacity(params.get("op_mw"), DEFAULT_OPACITY.milkyWay),
  };

  const rawVaz = params.get("vaz");
  const rawValt = params.get("valt");
  const viewAz =
    rawVaz !== null && Number.isFinite(Number(rawVaz)) ? Number(rawVaz) : DEFAULT_VIEW.az;
  const viewAlt =
    rawValt !== null && Number.isFinite(Number(rawValt)) ? Number(rawValt) : DEFAULT_VIEW.alt;

  const nightVision = params.get("nv") === "1";
  const rawMag = params.get("mag");
  const magLimit = parseMagLimit(rawMag);
  const language = parseLanguage(params.get("lang"));
  const fov = parseFovPreset(params.get("fov"));

  return ok({
    observer: { lat, lon },
    timeUtc,
    layers,
    opacity,
    view: { az: viewAz, alt: viewAlt },
    nightVision,
    magLimit,
    language,
    fov,
  });
}

export function serializeStateToSearchParams(state: AppState): URLSearchParams {
  const params = new URLSearchParams();
  params.set("lat", String(state.observer.lat));
  params.set("lon", String(state.observer.lon));
  params.set("t", state.timeUtc.toISOString());

  // Only write layers param if not all visible
  const visibleKeys = ALL_LAYER_KEYS.filter((k) => state.layers[k]);
  if (visibleKeys.length < ALL_LAYER_KEYS.length) {
    params.set("layers", visibleKeys.join(","));
  }

  if (state.opacity.constellationLines !== 1.0) {
    params.set("op_cl", String(Math.round(state.opacity.constellationLines * 100)));
  }
  if (state.opacity.constellationBoundaries !== 1.0) {
    params.set("op_cb", String(Math.round(state.opacity.constellationBoundaries * 100)));
  }
  if (state.opacity.satelliteTrails !== 1.0) {
    params.set("op_st", String(Math.round(state.opacity.satelliteTrails * 100)));
  }
  if (state.opacity.raDecGrid !== DEFAULT_OPACITY.raDecGrid) {
    params.set("op_grid", String(Math.round(state.opacity.raDecGrid * 100)));
  }
  if (state.opacity.ecliptic !== DEFAULT_OPACITY.ecliptic) {
    params.set("op_ecl", String(Math.round(state.opacity.ecliptic * 100)));
  }
  if (state.opacity.milkyWay !== DEFAULT_OPACITY.milkyWay) {
    params.set("op_mw", String(Math.round(state.opacity.milkyWay * 100)));
  }

  if (state.view.az !== DEFAULT_VIEW.az || state.view.alt !== DEFAULT_VIEW.alt) {
    params.set("vaz", String(Math.round(state.view.az * 10) / 10));
    params.set("valt", String(Math.round(state.view.alt * 10) / 10));
  }

  if (state.nightVision) {
    params.set("nv", "1");
  }

  if (state.magLimit !== DEFAULT_MAG_LIMIT) {
    // Serialize with one decimal place to keep URLs clean (e.g. "4" or "3.5")
    const formatted = Number.isInteger(state.magLimit)
      ? String(state.magLimit)
      : String(state.magLimit);
    params.set("mag", formatted);
  }

  if (state.language !== DEFAULT_LANGUAGE) {
    params.set("lang", state.language);
  }

  if (state.fov !== DEFAULT_FOV) {
    params.set("fov", state.fov);
  }

  return params;
}
