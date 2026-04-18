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
} from "./astro";
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
} from "./scene";
import { fetchTle, parseTle, propagateSatellites } from "./sat";
import {
  createPanel,
  createTimeControls,
  createLocationControls,
  createLayerControls,
  createViewControls,
} from "./ui";
import type { UIIntent } from "./ui";
import rawStars from "../data/stars.json";
import rawConstellations from "../data/constellations.json";
import rawBoundaries from "../data/boundaries.json";

type Layers = {
  star: StarLayer;
  body: BodyLayer;
  constellation: ConstellationLayer;
  boundary: BoundaryLayer;
  satellite: SatelliteLayer | null;
  compass: CompassLayer;
  grid: GridLayer;
  ecliptic: EclipticLayer;
};

function applyLayerVisibility(layers: Layers, visibility: LayerVisibility): void {
  layers.star.setVisible(visibility.stars);
  layers.body.setVisible(visibility.planets);
  layers.compass.setVisible(visibility.compass);
  if (layers.satellite) layers.satellite.setVisible(visibility.satellites);
}

function rerender(
  state: AppState,
  layers: Layers,
  catalogResult: ReturnType<typeof parseCatalog>,
): void {
  if (!catalogResult.ok) return;
  const { observer, timeUtc } = state;

  const visibleStars = filterVisibleStars(catalogResult.value, observer.lat, observer.lon, timeUtc);
  layers.star.update(visibleStars, observer.lat, observer.lon);

  const bodies = computeBodyPositions(observer.lat, observer.lon, timeUtc, true);
  layers.body.update(bodies, observer.lat, observer.lon);

  const constellationResult = parseConstellations(rawConstellations);
  if (constellationResult.ok) {
    const visibleConstellations = filterVisibleConstellations(
      constellationResult.value,
      visibleStars,
    );
    layers.constellation.update(visibleConstellations, observer.lat, observer.lon);
  }

  const boundaryResult = parseBoundaries(rawBoundaries);
  if (boundaryResult.ok) {
    const visibleBoundaries = filterVisibleBoundaries(
      boundaryResult.value,
      observer.lat,
      observer.lon,
      timeUtc,
    );
    layers.boundary.update(visibleBoundaries, observer.lat, observer.lon);
  } else {
    console.warn(`Boundary load warning: ${boundaryResult.error.message}`);
  }

  const gridData = computeRaDecGrid(observer.lat, observer.lon, timeUtc);
  layers.grid.update(gridData, observer.lat, observer.lon);

  const eclipticPoints = computeEclipticLine(observer.lat, observer.lon, timeUtc);
  layers.ecliptic.update(eclipticPoints, observer.lat, observer.lon);

  layers.compass.update(observer.lat, observer.lon);

  applyLayerVisibility(layers, state.layers);
  layers.constellation.setOpacity(state.opacity.constellationLines * 0.25);
  layers.boundary.setOpacity(state.opacity.constellationBoundaries * 0.15);
  layers.grid.setOpacity(state.opacity.raDecGrid);
  layers.ecliptic.setOpacity(state.opacity.ecliptic);
  if (layers.satellite) layers.satellite.setOpacity(state.opacity.satelliteTrails * 0.3);
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

  initCamera(viewer.camera, state.observer.lat, state.observer.lon);
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
  };

  // Initial render
  rerender(state, layers, catalogResult);

  // Satellite layer (async)
  const tleResult = await fetchTle();
  if (tleResult.ok) {
    const satResult = parseTle(tleResult.value);
    if (satResult.ok) {
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

  // Tooltip
  const cesiumContainer = document.getElementById("cesium-container");
  if (cesiumContainer) {
    createTooltip(viewer, cesiumContainer);
  }

  // Intent handler
  function handleIntent(intent: UIIntent): void {
    switch (intent.type) {
      case "set-time": {
        state = { ...state, timeUtc: intent.time };
        rerender(state, layers, catalogResult);
        updateUrl(state);
        break;
      }
      case "set-observer": {
        state = { ...state, observer: { lat: intent.lat, lon: intent.lon } };
        initCamera(viewer.camera, intent.lat, intent.lon);
        rerender(state, layers, catalogResult);
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
        if (layers.satellite) layers.satellite.setOpacity(state.opacity.satelliteTrails * 0.3);
        updateUrl(state);
        break;
      }
      case "set-view": {
        setCameraView(viewer.camera, state.observer.lat, state.observer.lon, intent.az, intent.alt);
        break;
      }
    }
  }

  // Build UI panel
  const panelRoot = document.getElementById("ui-panel-root");
  if (panelRoot) {
    const panel = createPanel(panelRoot);

    const uiContainer = document.createElement("div");

    const timeEl = createTimeControls(state.timeUtc, handleIntent);
    uiContainer.appendChild(timeEl);

    const locationEl = createLocationControls(state.observer.lat, state.observer.lon, handleIntent);
    uiContainer.appendChild(locationEl);

    const viewEl = createViewControls(0, 89.9, handleIntent);
    uiContainer.appendChild(viewEl);

    const layerEl = createLayerControls(state.layers, state.opacity, handleIntent);
    uiContainer.appendChild(layerEl);

    panel.setContent(uiContainer);
  }
}

function showError(el: HTMLElement | null, message: string): void {
  if (!el) return;
  el.textContent = message;
  el.style.display = "block";
}
