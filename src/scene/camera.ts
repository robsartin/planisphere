/* SPDX-License-Identifier: Apache-2.0 */
import { Cartesian3, Math as CesiumMath } from "cesium";
import type { Camera } from "cesium";

export function initCamera(camera: Camera, lat: number, lon: number): void {
  setCameraView(camera, lat, lon, 0, 89.9);
}

export function setCameraView(
  camera: Camera,
  lat: number,
  lon: number,
  azDeg: number,
  altDeg: number,
): void {
  const height = 1.7;
  const clampedAlt = Math.min(89.9, Math.max(0, altDeg));
  camera.setView({
    destination: Cartesian3.fromDegrees(lon, lat, height),
    orientation: {
      heading: CesiumMath.toRadians(azDeg),
      pitch: CesiumMath.toRadians(clampedAlt),
      roll: 0,
    },
  });
}
