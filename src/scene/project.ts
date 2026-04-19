/* SPDX-License-Identifier: Apache-2.0 */
import { Cartesian3, Math as CesiumMath, Matrix4, SceneTransforms, Transforms } from "cesium";
import type { Cartesian2, Scene } from "cesium";
import { altAzToCartesian } from "./stars";

export type ScreenProjection = {
  readonly x: number;
  readonly y: number;
  readonly onScreen: boolean;
};

export type AltAz = {
  readonly alt: number;
  readonly az: number;
};

/**
 * Project a local horizontal direction (alt/az) to window coordinates in the Cesium viewer.
 *
 * Returns `null` if Cesium cannot produce window coordinates (for example when the point
 * is behind the camera). The `onScreen` flag is `true` when the projected point sits
 * inside the scene canvas; cards using this result can hide themselves off-screen.
 *
 * We re-use `altAzToCartesian` (already exported from `scene/stars`) so projection uses
 * the same world-space frame as every other layer — guaranteed pixel-consistent with the
 * billboards the user clicked.
 */
export function projectAltAzToScreen(
  scene: Scene,
  alt: number,
  az: number,
  lat: number,
  lon: number,
): ScreenProjection | null {
  const world = altAzToCartesian(alt, az, lat, lon);
  const win = SceneTransforms.worldToWindowCoordinates(scene, world);
  if (win === undefined) return null;
  const canvas = scene.canvas as HTMLCanvasElement | undefined;
  const width = canvas?.clientWidth ?? Number.POSITIVE_INFINITY;
  const height = canvas?.clientHeight ?? Number.POSITIVE_INFINITY;
  const onScreen = win.x >= 0 && win.x <= width && win.y >= 0 && win.y <= height;
  return { x: win.x, y: win.y, onScreen };
}

/**
 * Invert the screen projection: take a pixel on the canvas and return the
 * direction in local horizontal coordinates (alt/az) the camera is looking
 * through that pixel.
 *
 * Uses Cesium's `camera.getPickRay` to build a world-space ray, then rotates
 * the ray's direction into the observer's ENU frame by applying the inverse
 * of `eastNorthUpToFixedFrame`. In ENU we treat x=east, y=north, z=up, and
 * read alt = asin(up), az = atan2(east, north) normalized to [0, 360).
 *
 * Returns `null` when the pick ray is unavailable (e.g. behind-the-camera
 * coordinates in some projections) — the caller can treat that as "outside
 * the sky dome".
 */
export function screenToAltAz(
  scene: Scene,
  screenX: number,
  screenY: number,
  lat: number,
  lon: number,
): AltAz | null {
  const ray = scene.camera.getPickRay({ x: screenX, y: screenY } as Cartesian2);
  if (ray === undefined) return null;

  const observerPos = Cartesian3.fromDegrees(lon, lat, 0);
  const enuToFixed = Transforms.eastNorthUpToFixedFrame(observerPos);
  const fixedToEnu = Matrix4.inverseTransformation(enuToFixed, new Matrix4());

  // Transform the ray direction as a vector (no translation) so it stays a
  // direction in the ENU frame. Normalize to make the following trigonometry
  // numerically well-behaved regardless of what Cesium returned.
  const enuDir = Matrix4.multiplyByPointAsVector(fixedToEnu, ray.direction, new Cartesian3());
  const norm = Cartesian3.normalize(enuDir, new Cartesian3());

  // Clamp to [-1, 1] against floating-point drift so asin stays in domain.
  const up = Math.max(-1, Math.min(1, norm.z));
  const altRad = Math.asin(up);

  // atan2(east, north) gives the compass-style azimuth: 0 = north, 90 = east.
  const azRad = Math.atan2(norm.x, norm.y);
  const azDeg = CesiumMath.toDegrees(azRad);
  const az = ((azDeg % 360) + 360) % 360;

  return { alt: CesiumMath.toDegrees(altRad), az };
}
