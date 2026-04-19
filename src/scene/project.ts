/* SPDX-License-Identifier: Apache-2.0 */
import { SceneTransforms } from "cesium";
import type { Scene } from "cesium";
import { altAzToCartesian } from "./stars";

export type ScreenProjection = {
  readonly x: number;
  readonly y: number;
  readonly onScreen: boolean;
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
