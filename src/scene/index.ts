/* SPDX-License-Identifier: Apache-2.0 */
export { type SceneInitError, createViewer } from "./viewer";
export {
  initCamera,
  setCameraView,
  setCameraViewAnimated,
  setupTrackballControls,
  setupGestures,
  getCameraHeadingDeg,
  CAMERA_ANIM_DURATION_MS,
  DRAG_INERTIA_DECAY_MS,
} from "./camera";
export type { GestureHandle, GestureOptions, AzAltPosition } from "./camera";
export {
  clampFov,
  easeOutCubic,
  inertiaDelta,
  interpolateAzAlt,
  FOV_MIN_DEG,
  FOV_MAX_DEG,
} from "./animation-math";
export type { AzAlt } from "./animation-math";
export { type StarLayer, createStarLayer } from "./stars";
export { type Tooltip, createTooltip } from "./tooltip";
export { type BodyLayer, createBodyLayer } from "./bodies";
export {
  type ConstellationLayer,
  type ConstellationNameOverrides,
  createConstellationLayer,
} from "./constellations";
export { type CompassLayer, createCompassLayer } from "./compass";
export { type SatelliteLayer, createSatelliteLayer } from "./satellites";
export { type BoundaryLayer, createBoundaryLayer } from "./boundaries";
export { type GridLayer, createGridLayer } from "./grid";
export { type EclipticLayer, createEclipticLayer } from "./ecliptic";
export { type MessierLayer, createMessierLayer } from "./messier";
export { type MilkyWayLayer, createMilkyWayLayer } from "./milkyway";
export { type TrailLayer, createTrailLayer } from "./trail-layer";
export { type ReticleLayer, createReticleLayer, computeReticleRadiusPx } from "./reticle";
