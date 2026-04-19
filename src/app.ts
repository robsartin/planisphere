/* SPDX-License-Identifier: Apache-2.0 */
import { parseStateFromSearchParams, serializeStateToSearchParams } from "./state";
import type { AppState, LayerVisibility } from "./state/state";
import {
  parseCatalog,
  filterVisibleStars,
  computeBodyPositions,
  parseConstellations,
  filterVisibleConstellations,
  parseBoundaries,
  filterVisibleBoundaries,
  computeRaDecGrid,
  computeEclipticLine,
  parseMessier,
  filterVisibleMessier,
  computeMilkyWayPoints,
  computeBodyTrail,
  parseConstellationNames,
  parseAsterismSet,
  filterVisibleAsterisms,
} from "./astro";
import type {
  StarRecord,
  Language,
  ConstellationNameMap,
  SkycultureId,
  AsterismSet,
} from "./astro";
import { AstroWorkerClient } from "./workers/astro-worker-client";
import { buildRaDecArray, buildAltAzStars } from "./workers/star-builder";
import {
  createViewer,
  initCamera,
  setupTrackballControls,
  setupGestures,
  createStarLayer,
  createBodyLayer,
  createTooltip,
  createConstellationLayer,
  createCompassLayer,
  createSatelliteLayer,
  createBoundaryLayer,
  createGridLayer,
  createEclipticLayer,
  createMessierLayer,
  createMilkyWayLayer,
  createTrailLayer,
  createReticleLayer,
  setCameraView,
  getCameraHeadingDeg,
} from "./scene";
import type { AzAltPosition } from "./scene";
import type {
  StarLayer,
  BodyLayer,
  ConstellationLayer,
  BoundaryLayer,
  SatelliteLayer,
  CompassLayer,
  GridLayer,
  EclipticLayer,
  MessierLayer,
  MilkyWayLayer,
  TrailLayer,
  ReticleLayer,
} from "./scene";
import { fetchTle, parseTle, propagateSatellites } from "./sat";
import type { SatelliteRecord, TleParseError } from "./sat";
import type { Result } from "./result";
import {
  createPanel,
  createLocationControls,
  createLayerControls,
  createViewControls,
  createPlanetInfo,
  createSearch,
  createFovControls,
  createEventsPanel,
  createHelpModal,
  createBottomHud,
  createCommandPalette,
} from "./ui";
import type { BottomHud } from "./ui";
import type {
  CommandPalette,
  PaletteSources,
  PaletteObjectSource,
  PaletteEventSource,
  PaletteSettingSource,
  PalettePlaceSource,
  PaletteObjectType,
} from "./ui";
import { computeUpcomingEvents } from "./astro/events";
import type { CelestialEvent } from "./astro/events";
import type { UIIntent } from "./ui";
import { buildSearchIndex, searchObjects } from "./astro/search";
import type { SearchIndex, SearchResultType } from "./astro/search";
import rawStars from "../data/stars.json";
import rawConstellations from "../data/constellations.json";
import rawBoundaries from "../data/boundaries.json";
import rawMessier from "../data/messier.json";
import rawCities from "../data/cities.json";
import rawNamesEn from "../data/constellation-names/en.json";
import rawNamesZh from "../data/constellation-names/zh.json";
import rawNamesAr from "../data/constellation-names/ar.json";
import rawNamesEl from "../data/constellation-names/el.json";
import rawAsterismsWestern from "../data/asterisms/western.json";
import rawAsterismsChinese from "../data/asterisms/chinese.json";
import rawAsterismsIndian from "../data/asterisms/indian.json";
import rawAsterismsNorseEdda from "../data/asterisms/norse_edda.json";
import rawAsterismsHawaiian from "../data/asterisms/hawaiian_starlines.json";
import rawAsterismsMaori from "../data/asterisms/maori.json";

const CONSTELLATION_NAMES_RAW: Partial<Record<Language, unknown>> = {
  en: rawNamesEn,
  zh: rawNamesZh,
  ar: rawNamesAr,
  el: rawNamesEl,
};

function loadNameOverridesForLanguage(lang: Language): ConstellationNameMap | null {
  if (lang === "la") return null;
  const raw = CONSTELLATION_NAMES_RAW[lang];
  if (raw === undefined) return null;
  const parsed = parseConstellationNames(raw);
  if (!parsed.ok) {
    console.warn(`Constellation names for '${lang}' invalid: ${parsed.error.kind}`);
    return null;
  }
  return parsed.value;
}

const ASTERISM_SETS_RAW: Record<SkycultureId, unknown> = {
  western: rawAsterismsWestern,
  chinese: rawAsterismsChinese,
  indian: rawAsterismsIndian,
  norse_edda: rawAsterismsNorseEdda,
  hawaiian_starlines: rawAsterismsHawaiian,
  maori: rawAsterismsMaori,
};

function loadAsterismSet(id: SkycultureId): AsterismSet | null {
  const parsed = parseAsterismSet(ASTERISM_SETS_RAW[id]);
  if (!parsed.ok) {
    console.warn(`Asterism set '${id}' invalid: ${parsed.error.kind}`);
    return null;
  }
  return parsed.value;
}

type CityRecord = {
  readonly name: string;
  readonly country: string;
  readonly lat: number;
  readonly lon: number;
};

const RECENTS_STORAGE_KEY = "planisphere.palette.recents.v1";
const RECENTS_MAX = 10;

function mapSearchTypeToPaletteType(t: SearchResultType): PaletteObjectType {
  // The existing search index only knows star/constellation/body/satellite.
  // Messier isn't in the index yet, but we keep the union forward-compatible.
  switch (t) {
    case "star":
      return "star";
    case "constellation":
      return "constellation";
    case "body":
      return "body";
    case "satellite":
      return "satellite";
  }
}

function buildPaletteObjects(index: SearchIndex): PaletteObjectSource[] {
  const out: PaletteObjectSource[] = [];
  for (const entry of index.entries) {
    out.push({ id: entry.name, label: entry.name, type: mapSearchTypeToPaletteType(entry.type) });
  }
  return out;
}

function buildPaletteEvents(events: readonly CelestialEvent[]): PaletteEventSource[] {
  return events.map((e) => ({
    id: `${e.kind}-${String(e.when.getTime())}`,
    label: e.title,
    description: e.description,
    when: e.when,
    ...(e.kind === "iss-pass"
      ? { viewAz: e.peakAzDeg, viewAlt: e.peakAltDeg }
      : e.viewAz !== undefined && e.viewAlt !== undefined
        ? { viewAz: e.viewAz, viewAlt: e.viewAlt }
        : {}),
  }));
}

const CITIES_RAW = rawCities as readonly CityRecord[];

function buildPalettePlaces(): PalettePlaceSource[] {
  return CITIES_RAW.map((c) => ({
    id: `${c.name}-${c.country}`,
    label: c.name,
    country: c.country,
    lat: c.lat,
    lon: c.lon,
  }));
}

function buildPaletteSettings(): PaletteSettingSource[] {
  return [
    {
      id: "toggle-night-vision",
      label: "Toggle night vision",
      hint: "Flip the red overlay on/off",
      intent: { type: "toggle-night-vision" },
    },
    {
      id: "copy-link",
      label: "Copy link",
      hint: "Copy this sky to clipboard",
      intent: { type: "copy-link" },
    },
    {
      id: "fov-naked",
      label: "Naked-eye FOV",
      hint: "Reticle preset: none",
      intent: { type: "set-fov", preset: "off" },
    },
    {
      id: "fov-binoculars",
      label: "2\u00d7 binoculars FOV",
      hint: "Reticle preset: binoculars",
      intent: { type: "set-fov", preset: "binoculars" },
    },
    {
      id: "fov-small-scope",
      label: "Small telescope FOV",
      hint: "Reticle preset: small scope",
      intent: { type: "set-fov", preset: "small-scope" },
    },
    {
      id: "lang-en",
      label: "Language: English",
      intent: { type: "set-language", language: "en" },
    },
    {
      id: "lang-la",
      label: "Language: Latin (IAU default)",
      intent: { type: "set-language", language: "la" },
    },
    {
      id: "now",
      label: "Now (time + location)",
      hint: "Jump to current time and geolocated observer",
      intent: { type: "now" },
    },
  ];
}

function buildPaletteSources(
  index: SearchIndex,
  events: readonly CelestialEvent[],
): Omit<PaletteSources, "recents"> {
  return {
    objects: buildPaletteObjects(index),
    events: buildPaletteEvents(events),
    places: buildPalettePlaces(),
    settings: buildPaletteSettings(),
  };
}

function loadRecents(): PaletteSettingSource[] {
  try {
    const raw = globalThis.localStorage?.getItem(RECENTS_STORAGE_KEY);
    if (raw === null || raw === undefined) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: PaletteSettingSource[] = [];
    for (const entry of parsed) {
      if (typeof entry !== "object" || entry === null) continue;
      const e = entry as Record<string, unknown>;
      if (typeof e.id !== "string" || typeof e.label !== "string") continue;
      const rec: PaletteSettingSource = { id: e.id, label: e.label };
      out.push(rec);
    }
    return out.slice(0, RECENTS_MAX);
  } catch {
    return [];
  }
}

function persistRecents(recents: readonly PaletteSettingSource[]): void {
  try {
    const payload = recents.slice(0, RECENTS_MAX).map((r) => ({ id: r.id, label: r.label }));
    globalThis.localStorage?.setItem(RECENTS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage quota / disabled — ignore.
  }
}

function setupCommandPalette(
  getPaletteSources: () => Omit<PaletteSources, "recents">,
  handleIntent: (intent: UIIntent) => void,
): CommandPalette {
  let recents: PaletteSettingSource[] = loadRecents();

  const palette = createCommandPalette({
    getSources: () => ({ ...getPaletteSources(), recents }),
    dispatch: handleIntent,
    onRecentSelected: (entry) => {
      recents = [entry, ...recents.filter((r) => r.id !== entry.id)].slice(0, RECENTS_MAX);
      persistRecents(recents);
    },
  });

  document.addEventListener("keydown", (e) => {
    const isMod = e.metaKey || e.ctrlKey;
    if (!isMod) return;
    if (e.key !== "k" && e.key !== "K") return;
    e.preventDefault();
    if (palette.isOpen()) {
      palette.close();
    } else {
      palette.open();
    }
  });

  return palette;
}

type Layers = {
  star: StarLayer;
  body: BodyLayer;
  constellation: ConstellationLayer;
  boundary: BoundaryLayer;
  satellite: SatelliteLayer | null;
  compass: CompassLayer;
  grid: GridLayer;
  ecliptic: EclipticLayer;
  messier: MessierLayer;
  milkyWay: MilkyWayLayer;
  trail: TrailLayer;
  reticle: ReticleLayer | null;
};

const TRAIL_DURATION_HOURS = 4;
const TRAIL_STEP_MINUTES = 5;

function applyLayerVisibility(layers: Layers, visibility: LayerVisibility): void {
  layers.star.setVisible(visibility.stars);
  layers.body.setVisible(visibility.planets);
  layers.compass.setVisible(visibility.compass);
  layers.messier.setVisible(visibility.deepSky);
  if (layers.satellite) layers.satellite.setVisible(visibility.satellites);
}

type ParsedData = {
  stars: ReturnType<typeof parseCatalog>;
  constellations: ReturnType<typeof parseConstellations>;
  boundaries: ReturnType<typeof parseBoundaries>;
  messierObjects: ReturnType<typeof parseMessier>;
  satelliteRecords: Result<SatelliteRecord[], TleParseError> | null;
  activeAsterisms: AsterismSet | null;
};

let rerenderTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Try to create an AstroWorkerClient. Returns null if workers are unavailable
 * (e.g. test environment, old browsers, or bundler restrictions).
 */
function tryCreateWorker(): AstroWorkerClient | null {
  try {
    return new AstroWorkerClient();
  } catch {
    return null;
  }
}

function rerenderSatellites(
  layers: Layers,
  data: ParsedData,
  lat: number,
  lon: number,
  time: Date,
): void {
  if (!data.satelliteRecords?.ok || !layers.satellite) return;
  const visibleSats = propagateSatellites(data.satelliteRecords.value, lat, lon, time, true);
  layers.satellite.update(visibleSats, lat, lon);
}

function updateConstellationLayer(
  layers: Layers,
  data: ParsedData,
  visibleStars: ReturnType<typeof filterVisibleStars>,
  lat: number,
  lon: number,
): void {
  if (data.activeAsterisms !== null) {
    const visible = filterVisibleAsterisms(data.activeAsterisms, visibleStars);
    layers.constellation.update(visible, lat, lon);
    return;
  }
  if (data.constellations.ok) {
    const visible = filterVisibleConstellations(data.constellations.value, visibleStars);
    layers.constellation.update(visible, lat, lon);
  }
}

function doRerender(state: AppState, layers: Layers, data: ParsedData): void {
  if (!data.stars.ok) return;
  const { observer, timeUtc } = state;

  const visibleStars = filterVisibleStars(
    data.stars.value,
    observer.lat,
    observer.lon,
    timeUtc,
    state.magLimit,
  );
  layers.star.update(visibleStars, observer.lat, observer.lon);

  const bodies = computeBodyPositions(observer.lat, observer.lon, timeUtc, true);
  layers.body.update(bodies, observer.lat, observer.lon);

  updateConstellationLayer(layers, data, visibleStars, observer.lat, observer.lon);

  if (data.boundaries.ok) {
    const visibleBoundaries = filterVisibleBoundaries(
      data.boundaries.value,
      observer.lat,
      observer.lon,
      timeUtc,
    );
    layers.boundary.update(visibleBoundaries, observer.lat, observer.lon);
  }

  rerenderSatellites(layers, data, observer.lat, observer.lon, timeUtc);

  if (data.messierObjects.ok) {
    const visibleMessier = filterVisibleMessier(
      data.messierObjects.value,
      observer.lat,
      observer.lon,
      timeUtc,
    );
    layers.messier.update(visibleMessier, observer.lat, observer.lon);
  }

  const gridData = computeRaDecGrid(observer.lat, observer.lon, timeUtc);
  layers.grid.update(gridData, observer.lat, observer.lon);

  const eclipticPoints = computeEclipticLine(observer.lat, observer.lon, timeUtc);
  layers.ecliptic.update(eclipticPoints, observer.lat, observer.lon);

  const milkyWayPoints = computeMilkyWayPoints(observer.lat, observer.lon, timeUtc);
  layers.milkyWay.update(milkyWayPoints, observer.lat, observer.lon);

  layers.compass.update(observer.lat, observer.lon);

  applyLayerVisibility(layers, state.layers);
  layers.constellation.setOpacity(state.opacity.constellationLines * 0.25);
  layers.boundary.setOpacity(state.opacity.constellationBoundaries * 0.15);
  layers.grid.setOpacity(state.opacity.raDecGrid);
  layers.ecliptic.setOpacity(state.opacity.ecliptic);
  layers.milkyWay.setOpacity(state.opacity.milkyWay);
  if (layers.satellite) layers.satellite.setOpacity(state.opacity.satelliteTrails * 0.3);
}

/**
 * Worker-accelerated rerender for subsequent renders (after initial).
 *
 * Offloads the hot alt/az math for stars to the worker. Grid/ecliptic/boundaries use
 * fastRaDecToAltAz on the main thread (they're much smaller datasets).
 * Falls back to synchronous doRerender if the worker promise rejects.
 */
async function doRerenderWithWorker(
  state: AppState,
  layers: Layers,
  data: ParsedData,
  worker: AstroWorkerClient,
  catalog: StarRecord[],
  capturedState: AppState,
): Promise<void> {
  if (!data.stars.ok) return;
  const { observer, timeUtc } = capturedState;

  // Kick off worker computation for stars (largest dataset, ~5000 entries)
  const raDecs = buildRaDecArray(catalog);
  const workerPromise = worker.computeAltAz(raDecs, observer.lat, observer.lon, timeUtc);

  // On the main thread, compute smaller datasets and solar system bodies (need precise ephemeris)
  const bodies = computeBodyPositions(observer.lat, observer.lon, timeUtc, true);
  layers.body.update(bodies, observer.lat, observer.lon);

  rerenderSatellites(layers, data, observer.lat, observer.lon, timeUtc);

  const gridData = computeRaDecGrid(observer.lat, observer.lon, timeUtc);
  layers.grid.update(gridData, observer.lat, observer.lon);

  const eclipticPoints = computeEclipticLine(observer.lat, observer.lon, timeUtc);
  layers.ecliptic.update(eclipticPoints, observer.lat, observer.lon);

  const milkyWayPoints = computeMilkyWayPoints(observer.lat, observer.lon, timeUtc);
  layers.milkyWay.update(milkyWayPoints, observer.lat, observer.lon);

  if (data.boundaries.ok) {
    const visibleBoundaries = filterVisibleBoundaries(
      data.boundaries.value,
      observer.lat,
      observer.lon,
      timeUtc,
    );
    layers.boundary.update(visibleBoundaries, observer.lat, observer.lon);
  }

  if (data.messierObjects.ok) {
    const visibleMessier = filterVisibleMessier(
      data.messierObjects.value,
      observer.lat,
      observer.lon,
      timeUtc,
    );
    layers.messier.update(visibleMessier, observer.lat, observer.lon);
  }

  layers.compass.update(observer.lat, observer.lon);

  // Apply the current state's opacity/visibility (fast, no computation)
  applyLayerVisibility(layers, capturedState.layers);
  layers.constellation.setOpacity(capturedState.opacity.constellationLines * 0.25);
  layers.boundary.setOpacity(capturedState.opacity.constellationBoundaries * 0.15);
  layers.grid.setOpacity(capturedState.opacity.raDecGrid);
  layers.ecliptic.setOpacity(capturedState.opacity.ecliptic);
  layers.milkyWay.setOpacity(capturedState.opacity.milkyWay);
  if (layers.satellite) layers.satellite.setOpacity(capturedState.opacity.satelliteTrails * 0.3);

  // Wait for worker result, then update stars + constellations
  try {
    const { altAzs, visibleIndices } = await workerPromise;
    // Check that state hasn't changed since we started (avoid stale updates)
    if (capturedState !== state) return;
    const visibleStars = buildAltAzStars(catalog, altAzs, visibleIndices, capturedState.magLimit);
    layers.star.update(visibleStars, observer.lat, observer.lon);
    updateConstellationLayer(layers, data, visibleStars, observer.lat, observer.lon);
  } catch {
    // Worker failed — fall back to synchronous star computation
    const visibleStars = filterVisibleStars(
      catalog,
      observer.lat,
      observer.lon,
      timeUtc,
      capturedState.magLimit,
    );
    layers.star.update(visibleStars, observer.lat, observer.lon);
    updateConstellationLayer(layers, data, visibleStars, observer.lat, observer.lon);
  }
}

function updateUrl(state: AppState): void {
  const params = serializeStateToSearchParams(state);
  const url = `${globalThis.location.pathname}?${params.toString()}`;
  globalThis.history.replaceState(null, "", url);
}

export async function bootstrap(
  root: HTMLElement | null,
  params: URLSearchParams = new URLSearchParams(globalThis.location?.search ?? ""),
): Promise<void> {
  if (!root) return;

  const errorDiv = root.querySelector<HTMLElement>("#error");

  const stateResult = parseStateFromSearchParams(params);
  if (!stateResult.ok) {
    showError(errorDiv, `State error: ${stateResult.error.kind}`);
    return;
  }
  let state = stateResult.value;

  const catalogResult = parseCatalog(rawStars);
  if (!catalogResult.ok) {
    showError(errorDiv, `Catalog error: ${catalogResult.error.message}`);
    return;
  }

  const viewerResult = createViewer("cesium-container");
  if (!viewerResult.ok) {
    showError(errorDiv, `Scene error: ${viewerResult.error.message}`);
    return;
  }
  const viewer = viewerResult.value;

  setCameraView(
    viewer.camera,
    state.observer.lat,
    state.observer.lon,
    state.view.az,
    state.view.alt,
  );
  setupTrackballControls(viewer);

  // Create all layers
  const cesiumContainerEl = document.getElementById("cesium-container");
  const layers: Layers = {
    star: createStarLayer(viewer.scene),
    body: createBodyLayer(viewer.scene),
    constellation: createConstellationLayer(viewer.scene),
    boundary: createBoundaryLayer(viewer.scene),
    satellite: null,
    compass: createCompassLayer(viewer.scene),
    grid: createGridLayer(viewer.scene),
    ecliptic: createEclipticLayer(viewer.scene),
    messier: createMessierLayer(viewer.scene),
    milkyWay: createMilkyWayLayer(viewer.scene),
    trail: createTrailLayer(viewer.scene),
    reticle: cesiumContainerEl ? createReticleLayer(viewer.scene, cesiumContainerEl) : null,
  };

  // Apply initial reticle preset from URL state
  layers.reticle?.setPreset(state.fov);

  // Current trail selection (ephemeral — not URL-persisted)
  let trailBodyId: string | null = null;

  function rerenderTrail(s: AppState): void {
    if (trailBodyId === null) {
      layers.trail.hide();
      return;
    }
    const result = computeBodyTrail(
      trailBodyId,
      s.observer.lat,
      s.observer.lon,
      s.timeUtc,
      TRAIL_DURATION_HOURS,
      TRAIL_STEP_MINUTES,
    );
    if (!result.ok) {
      layers.trail.hide();
      return;
    }
    layers.trail.setPoints(result.value, s.observer.lat, s.observer.lon);
    layers.trail.show();
  }

  // Parse static data once
  const constellationResult = parseConstellations(rawConstellations);
  const boundaryResult = parseBoundaries(rawBoundaries);
  if (!boundaryResult.ok) {
    console.warn(`Boundary load warning: ${boundaryResult.error.message}`);
  }
  const messierResult = parseMessier(rawMessier);
  if (!messierResult.ok) {
    console.warn(`Messier catalog load warning: ${messierResult.error.message}`);
  }

  const data: ParsedData = {
    stars: catalogResult,
    constellations: constellationResult,
    boundaries: boundaryResult,
    messierObjects: messierResult,
    satelliteRecords: null,
    activeAsterisms: state.skyculture === "western" ? null : loadAsterismSet(state.skyculture),
  };

  // Apply initial constellation name overrides based on language
  layers.constellation.setNameOverrides(loadNameOverridesForLanguage(state.language));

  // Initial render (synchronous, no debounce — ensures immediate display)
  doRerender(state, layers, data);

  // Initialise worker for subsequent rerenders (falls back to sync if unavailable)
  const worker = tryCreateWorker();
  const catalog = catalogResult.value;

  // scheduleRerender debounces rapid state changes, then runs rerender
  function scheduleRerender(capturedState: AppState): void {
    if (rerenderTimer !== null) clearTimeout(rerenderTimer);
    rerenderTimer = setTimeout(() => {
      rerenderTimer = null;
      if (worker !== null) {
        // Worker path: star math off main thread
        void doRerenderWithWorker(state, layers, data, worker, catalog, capturedState);
      } else {
        // Fallback: synchronous (also used in test environment)
        doRerender(capturedState, layers, data);
      }
    }, 50);
  }

  // Satellite layer (async)
  let satelliteRecords: SatelliteRecord[] = [];
  const tleResult = await fetchTle();
  if (tleResult.ok) {
    const satResult = parseTle(tleResult.value);
    if (satResult.ok) {
      satelliteRecords = satResult.value;
      data.satelliteRecords = satResult;
      const satLayer = createSatelliteLayer(viewer.scene);
      layers.satellite = satLayer;
      const visibleSats = propagateSatellites(
        satResult.value,
        state.observer.lat,
        state.observer.lon,
        state.timeUtc,
        true,
      );
      satLayer.update(visibleSats, state.observer.lat, state.observer.lon);
      satLayer.setVisible(state.layers.satellites);
      satLayer.setOpacity(state.opacity.satelliteTrails * 0.3);
    } else {
      console.warn(`TLE parse warning: ${satResult.error.message}`);
    }
  }

  // Build search index after all data (including satellites) is loaded
  const BODY_NAMES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
  let searchIndex: SearchIndex = buildSearchIndex(
    catalog,
    constellationResult.ok ? constellationResult.value : [],
    BODY_NAMES,
    satelliteRecords,
    state.observer.lat,
    state.observer.lon,
    state.timeUtc,
  );

  // Tooltip
  const cesiumContainer = document.getElementById("cesium-container");
  if (cesiumContainer) {
    createTooltip(viewer, cesiumContainer);
  }

  // Gesture polish (Plan 07 1J):
  //   - scroll-wheel / pinch zoom → adjust camera FOV in-place (not persisted
  //     as a free-form value in URL state; the FOV preset reticle stays what
  //     the user last chose, and the reticle layer rerenders after zoom so
  //     its displayed angular size matches the new camera vFOV).
  //   - double-tap empty sky → animated return to zenith.
  //   - double-tap on an object → animated center on its current az/alt.
  function resolveObjectAt(x: number, y: number): AzAltPosition | null {
    const picker = viewer.scene as unknown as { pick?: (pos: { x: number; y: number }) => unknown };
    if (typeof picker.pick !== "function") return null;
    const picked = picker.pick({ x, y }) as { id?: { az?: unknown; alt?: unknown } } | undefined;
    const id = picked?.id;
    if (!id || typeof id.az !== "number" || typeof id.alt !== "number") return null;
    return { az: id.az, alt: id.alt };
  }

  setupGestures(viewer, {
    getObserver: () => ({ lat: state.observer.lat, lon: state.observer.lon }),
    resolveObjectAt,
    onZoom: () => layers.reticle?.render(),
  });

  // Planet info wrapper — holds the current planet-info section, refreshed on time/observer changes
  const planetInfoWrapper = document.createElement("div");

  // Events panel wrapper — celestial event alerts (conjunctions / lunar eclipses / meteor showers).
  // Cached: only recomputed on observer / time changes (events shift forward as `now` advances).
  const eventsWrapper = document.createElement("div");
  let cachedEvents: readonly CelestialEvent[] = [];

  function refreshEvents(s: AppState): void {
    const result = computeUpcomingEvents(
      s.timeUtc,
      { lat: s.observer.lat, lon: s.observer.lon },
      satelliteRecords,
    );
    cachedEvents = result.ok ? result.value : [];
    eventsWrapper.replaceChildren(createEventsPanel(cachedEvents, handleIntent));
  }

  function refreshPlanetInfo(s: AppState): void {
    const bodies = computeBodyPositions(s.observer.lat, s.observer.lon, s.timeUtc, false);
    planetInfoWrapper.replaceChildren(
      createPlanetInfo(
        bodies,
        s.observer.lat,
        s.observer.lon,
        s.timeUtc,
        (az, alt) => {
          handleIntent({ type: "set-view", az, alt });
        },
        (id) => {
          if (trailBodyId === id) {
            handleIntent({ type: "hide-trail" });
          } else {
            handleIntent({ type: "show-trail", objectKind: "body", id });
          }
        },
        trailBodyId,
      ),
    );
  }

  function rebuildSearchIndex(s: AppState): void {
    searchIndex = buildSearchIndex(
      catalog,
      constellationResult.ok ? constellationResult.value : [],
      BODY_NAMES,
      satelliteRecords,
      s.observer.lat,
      s.observer.lon,
      s.timeUtc,
    );
  }

  let bottomHud: BottomHud | null = null;

  // Intent handler
  function handleIntent(intent: UIIntent): void {
    switch (intent.type) {
      case "set-time": {
        state = { ...state, timeUtc: intent.time };
        scheduleRerender(state);
        refreshPlanetInfo(state);
        refreshEvents(state);
        rebuildSearchIndex(state);
        rerenderTrail(state);
        bottomHud?.setTime(intent.time);
        updateUrl(state);
        break;
      }
      case "set-observer": {
        state = { ...state, observer: { lat: intent.lat, lon: intent.lon } };
        initCamera(viewer.camera, intent.lat, intent.lon);
        scheduleRerender(state);
        refreshPlanetInfo(state);
        refreshEvents(state);
        rebuildSearchIndex(state);
        rerenderTrail(state);
        bottomHud?.setObserver(intent.lat, intent.lon);
        updateUrl(state);
        break;
      }
      case "toggle-layer": {
        const newLayers = { ...state.layers, [intent.layer]: !state.layers[intent.layer] };
        state = { ...state, layers: newLayers };
        applyLayerVisibility(layers, state.layers);
        updateUrl(state);
        break;
      }
      case "set-opacity": {
        const newOpacity = { ...state.opacity, [intent.layer]: intent.value };
        state = { ...state, opacity: newOpacity };
        layers.constellation.setOpacity(state.opacity.constellationLines * 0.25);
        layers.boundary.setOpacity(state.opacity.constellationBoundaries * 0.15);
        layers.grid.setOpacity(state.opacity.raDecGrid);
        layers.ecliptic.setOpacity(state.opacity.ecliptic);
        layers.milkyWay.setOpacity(state.opacity.milkyWay);
        if (layers.satellite) layers.satellite.setOpacity(state.opacity.satelliteTrails * 0.3);
        updateUrl(state);
        break;
      }
      case "set-view": {
        state = { ...state, view: { az: intent.az, alt: intent.alt } };
        setCameraView(viewer.camera, state.observer.lat, state.observer.lon, intent.az, intent.alt);
        updateUrl(state);
        break;
      }
      case "toggle-night-vision": {
        state = { ...state, nightVision: !state.nightVision };
        document.body.classList.toggle("night-vision", state.nightVision);
        nightVisionPanel?.setNightVision(state.nightVision);
        updateUrl(state);
        break;
      }
      case "set-mag-limit": {
        state = { ...state, magLimit: intent.value };
        scheduleRerender(state);
        updateUrl(state);
        break;
      }
      case "show-trail": {
        trailBodyId = intent.id;
        rerenderTrail(state);
        refreshPlanetInfo(state);
        break;
      }
      case "hide-trail": {
        trailBodyId = null;
        layers.trail.hide();
        refreshPlanetInfo(state);
        break;
      }
      case "set-language": {
        // Name overrides are only defined for the Western (IAU) asterism set, so a
        // language change implies Western skyculture — otherwise the labels stay in
        // the non-Western culture's native names and the user's choice is ignored.
        state = { ...state, language: intent.language, skyculture: "western" };
        data.activeAsterisms = null;
        layers.constellation.setNameOverrides(loadNameOverridesForLanguage(state.language));
        scheduleRerender(state);
        updateUrl(state);
        break;
      }
      case "set-skyculture": {
        state = { ...state, skyculture: intent.id };
        data.activeAsterisms = intent.id === "western" ? null : loadAsterismSet(intent.id);
        scheduleRerender(state);
        updateUrl(state);
        break;
      }
      case "set-fov": {
        state = { ...state, fov: intent.preset };
        layers.reticle?.setPreset(intent.preset);
        updateUrl(state);
        break;
      }
      case "pin-object": {
        // The scene layer currently pins via click; from the palette we can't
        // reach into the canvas picker directly, so we mirror the on-screen
        // search's behavior: aim the camera at the object. The pinned tooltip
        // stays a scene-level affordance (mouse click) until we expose a
        // pin-by-id API on the scene layer.
        const entry = searchIndex.entries.find(
          (e) => e.name === intent.id || e.nameLower === intent.id.toLowerCase(),
        );
        if (entry !== undefined) {
          state = { ...state, view: { az: entry.az, alt: entry.alt } };
          setCameraView(
            viewer.camera,
            state.observer.lat,
            state.observer.lon,
            entry.az,
            entry.alt,
          );
          updateUrl(state);
        }
        break;
      }
      case "copy-link": {
        // Fire-and-forget: clipboard is optional; failure is silent.
        const href = globalThis.location?.href ?? "";
        const clipboard = navigator.clipboard as { writeText?: (s: string) => Promise<void> } | undefined;
        if (clipboard !== undefined && typeof clipboard.writeText === "function") {
          void clipboard.writeText(href).catch(() => {
            // Clipboard access denied — nothing we can do.
          });
        }
        break;
      }
      case "now": {
        const now = new Date();
        state = { ...state, timeUtc: now };
        scheduleRerender(state);
        refreshPlanetInfo(state);
        refreshEvents(state);
        rebuildSearchIndex(state);
        rerenderTrail(state);
        bottomHud?.setTime(now);
        updateUrl(state);
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude: lat, longitude: lon } = position.coords;
              state = { ...state, observer: { lat, lon } };
              initCamera(viewer.camera, lat, lon);
              scheduleRerender(state);
              refreshPlanetInfo(state);
              refreshEvents(state);
              rebuildSearchIndex(state);
              rerenderTrail(state);
              bottomHud?.setObserver(lat, lon);
              updateUrl(state);
            },
            () => {
              // Geolocation denied or failed — time already set, keep current location
            },
          );
        }
        break;
      }
      case "open-location-picker": {
        // Milestone 1B (#193) will replace this stub with the real overlay.
        console.warn("[planisphere] open-location-picker intent — picker not yet implemented");
        break;
      }
      case "toggle-animation": {
        // Plan 08 / issue #136 will wire the actual play/pause animator.
        // TODO(#136): start/stop the time-advance loop here.
        break;
      }
    }
  }

  // Apply initial night vision state from URL
  if (state.nightVision) {
    document.body.classList.add("night-vision");
  }

  // Help modal — created once at bootstrap, appended to <body> so it overlays everything.
  const helpModal = createHelpModal();
  document.body.appendChild(helpModal.element);

  // Bottom HUD — ambient bar with time, location chip, and compass. Replaces the
  // side-panel Time section (milestone 1A of Plan 07). Appended to <body> so it
  // sits above the cesium canvas independently of the side panel.
  bottomHud = createBottomHud(
    {
      timeUtc: state.timeUtc,
      lat: state.observer.lat,
      lon: state.observer.lon,
    },
    handleIntent,
  );
  document.body.appendChild(bottomHud.element);
  bottomHud.setCompass(getCameraHeadingDeg(viewer.camera));

  // Poll the camera heading on each animation frame so the compass chip mirrors
  // drag-rotation of the view. Cesium's camera doesn't emit a change event.
  const raf =
    typeof globalThis.requestAnimationFrame === "function"
      ? globalThis.requestAnimationFrame.bind(globalThis)
      : null;
  if (raf !== null) {
    const tickCompass = (): void => {
      bottomHud?.setCompass(getCameraHeadingDeg(viewer.camera));
      raf(tickCompass);
    };
    raf(tickCompass);
  }

  // Command palette (⌘K / Ctrl+K) — bootstrap once, keyboard-triggered.
  const palette = setupCommandPalette(
    () => buildPaletteSources(searchIndex, cachedEvents),
    handleIntent,
  );
  document.body.appendChild(palette.element);

  // Build UI panel
  let nightVisionPanel: ReturnType<typeof createPanel> | null = null;
  const panelRoot = document.getElementById("ui-panel-root");
  if (panelRoot) {
    const panel = createPanel(panelRoot, handleIntent, {
      onOpenHelp: () => helpModal.open(),
    });
    nightVisionPanel = panel;
    if (state.nightVision) {
      panel.setNightVision(true);
    }

    const uiContainer = document.createElement("div");

    // Search box — at the top of the panel
    const searchEl = createSearch((query) => searchObjects(searchIndex, query), handleIntent);
    uiContainer.appendChild(searchEl);

    // Events panel sits right after search because Go-to jumps the time cursor;
    // putting it above the location/layer blocks keeps it above the fold for
    // typical panel heights.
    refreshEvents(state);
    uiContainer.appendChild(eventsWrapper);

    const locationEl = createLocationControls(state.observer.lat, state.observer.lon, handleIntent);
    uiContainer.appendChild(locationEl);

    const viewEl = createViewControls(0, 89.9, handleIntent);
    uiContainer.appendChild(viewEl);

    const fovEl = createFovControls(state.fov, handleIntent);
    uiContainer.appendChild(fovEl);

    const layerEl = createLayerControls(
      state.layers,
      state.opacity,
      handleIntent,
      state.magLimit,
      state.language,
      state.skyculture,
    );
    uiContainer.appendChild(layerEl);

    refreshPlanetInfo(state);
    uiContainer.appendChild(planetInfoWrapper);

    panel.setContent(uiContainer);
  }
}

function showError(el: HTMLElement | null, message: string): void {
  if (!el) return;
  el.textContent = message;
  el.style.display = "block";
}
