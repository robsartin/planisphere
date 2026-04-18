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
} from "./astro";
import type { StarRecord, Language, ConstellationNameMap } from "./astro";
import { AstroWorkerClient } from "./workers/astro-worker-client";
import { buildRaDecArray, buildAltAzStars } from "./workers/star-builder";
import {
  createViewer,
  initCamera,
  setupTrackballControls,
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
  setCameraView,
} from "./scene";
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
} from "./scene";
import { fetchTle, parseTle, propagateSatellites } from "./sat";
import type { SatelliteRecord, TleParseError } from "./sat";
import type { Result } from "./result";
import {
  createPanel,
  createTimeControls,
  createLocationControls,
  createLayerControls,
  createViewControls,
  createPlanetInfo,
  createSearch,
} from "./ui";
import type { UIIntent } from "./ui";
import { buildSearchIndex, searchObjects } from "./astro/search";
import type { SearchIndex } from "./astro/search";
import rawStars from "../data/stars.json";
import rawConstellations from "../data/constellations.json";
import rawBoundaries from "../data/boundaries.json";
import rawMessier from "../data/messier.json";
import rawNamesEn from "../data/constellation-names/en.json";
import rawNamesZh from "../data/constellation-names/zh.json";
import rawNamesAr from "../data/constellation-names/ar.json";
import rawNamesEl from "../data/constellation-names/el.json";

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

  if (data.constellations.ok) {
    const visibleConstellations = filterVisibleConstellations(
      data.constellations.value,
      visibleStars,
    );
    layers.constellation.update(visibleConstellations, observer.lat, observer.lon);
  }

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

    if (data.constellations.ok) {
      const visibleConstellations = filterVisibleConstellations(
        data.constellations.value,
        visibleStars,
      );
      layers.constellation.update(visibleConstellations, observer.lat, observer.lon);
    }
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
    if (data.constellations.ok) {
      const visibleConstellations = filterVisibleConstellations(
        data.constellations.value,
        visibleStars,
      );
      layers.constellation.update(visibleConstellations, observer.lat, observer.lon);
    }
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
  };

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

  // Planet info wrapper — holds the current planet-info section, refreshed on time/observer changes
  const planetInfoWrapper = document.createElement("div");

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

  // Intent handler
  function handleIntent(intent: UIIntent): void {
    switch (intent.type) {
      case "set-time": {
        state = { ...state, timeUtc: intent.time };
        scheduleRerender(state);
        refreshPlanetInfo(state);
        rebuildSearchIndex(state);
        rerenderTrail(state);
        updateUrl(state);
        break;
      }
      case "set-observer": {
        state = { ...state, observer: { lat: intent.lat, lon: intent.lon } };
        initCamera(viewer.camera, intent.lat, intent.lon);
        scheduleRerender(state);
        refreshPlanetInfo(state);
        rebuildSearchIndex(state);
        rerenderTrail(state);
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
        state = { ...state, language: intent.language };
        layers.constellation.setNameOverrides(loadNameOverridesForLanguage(state.language));
        // Only constellation labels need updating, but we rebuild to pick up new text
        scheduleRerender(state);
        updateUrl(state);
        break;
      }
      case "now": {
        const now = new Date();
        state = { ...state, timeUtc: now };
        scheduleRerender(state);
        refreshPlanetInfo(state);
        rebuildSearchIndex(state);
        rerenderTrail(state);
        updateUrl(state);
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude: lat, longitude: lon } = position.coords;
              state = { ...state, observer: { lat, lon } };
              initCamera(viewer.camera, lat, lon);
              scheduleRerender(state);
              refreshPlanetInfo(state);
              rebuildSearchIndex(state);
              rerenderTrail(state);
              updateUrl(state);
            },
            () => {
              // Geolocation denied or failed — time already set, keep current location
            },
          );
        }
        break;
      }
    }
  }

  // Apply initial night vision state from URL
  if (state.nightVision) {
    document.body.classList.add("night-vision");
  }

  // Build UI panel
  let nightVisionPanel: ReturnType<typeof createPanel> | null = null;
  const panelRoot = document.getElementById("ui-panel-root");
  if (panelRoot) {
    const panel = createPanel(panelRoot, handleIntent);
    nightVisionPanel = panel;
    if (state.nightVision) {
      panel.setNightVision(true);
    }

    const uiContainer = document.createElement("div");

    // Search box — at the top of the panel
    const searchEl = createSearch((query) => searchObjects(searchIndex, query), handleIntent);
    uiContainer.appendChild(searchEl);

    const timeEl = createTimeControls(state.timeUtc, handleIntent);
    uiContainer.appendChild(timeEl);

    const locationEl = createLocationControls(state.observer.lat, state.observer.lon, handleIntent);
    uiContainer.appendChild(locationEl);

    const viewEl = createViewControls(0, 89.9, handleIntent);
    uiContainer.appendChild(viewEl);

    const layerEl = createLayerControls(
      state.layers,
      state.opacity,
      handleIntent,
      state.magLimit,
      state.language,
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
