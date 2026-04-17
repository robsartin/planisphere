/* SPDX-License-Identifier: Apache-2.0 */
import { parseStateFromSearchParams } from "./state";
import {
  parseCatalog,
  filterVisibleStars,
  computeBodyPositions,
  parseConstellations,
  filterVisibleConstellations,
} from "./astro";
import {
  createViewer,
  initCamera,
  createStarLayer,
  createBodyLayer,
  createTooltip,
  createConstellationLayer,
  createCompassLayer,
  createSatelliteLayer,
} from "./scene";
import { fetchTle, parseTle, propagateSatellites } from "./sat";
import rawStars from "../data/stars.json";
import rawConstellations from "../data/constellations.json";

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
  const { observer, timeUtc } = stateResult.value;

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

  initCamera(viewer.camera, observer.lat, observer.lon);

  const visibleStars = filterVisibleStars(catalogResult.value, observer.lat, observer.lon, timeUtc);
  const starLayer = createStarLayer(viewer.scene);
  starLayer.update(visibleStars, observer.lat, observer.lon);

  const bodies = computeBodyPositions(observer.lat, observer.lon, timeUtc, true);
  const bodyLayer = createBodyLayer(viewer.scene);
  bodyLayer.update(bodies, observer.lat, observer.lon);

  const constellationResult = parseConstellations(rawConstellations);
  if (constellationResult.ok) {
    const visibleConstellations = filterVisibleConstellations(
      constellationResult.value,
      visibleStars,
    );
    const constellationLayer = createConstellationLayer(viewer.scene);
    constellationLayer.update(visibleConstellations, observer.lat, observer.lon);
  } else {
    console.warn(`Constellation load warning: ${constellationResult.error.message}`);
  }

  const compassLayer = createCompassLayer(viewer.scene);
  compassLayer.update(observer.lat, observer.lon);

  const tleResult = await fetchTle();
  if (tleResult.ok) {
    const satResult = parseTle(tleResult.value);
    if (satResult.ok) {
      const visibleSats = propagateSatellites(
        satResult.value,
        observer.lat,
        observer.lon,
        timeUtc,
        true,
      );
      const satLayer = createSatelliteLayer(viewer.scene);
      satLayer.update(visibleSats, observer.lat, observer.lon);
    } else {
      console.warn(`TLE parse warning: ${satResult.error.message}`);
    }
  }

  const cesiumContainer = document.getElementById("cesium-container");
  if (cesiumContainer) {
    createTooltip(viewer, cesiumContainer);
  }
}

function showError(el: HTMLElement | null, message: string): void {
  if (!el) return;
  el.textContent = message;
  el.style.display = "block";
}
