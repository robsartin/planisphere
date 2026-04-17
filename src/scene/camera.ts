/* SPDX-License-Identifier: Apache-2.0 */
import { Cartesian3, Math as CesiumMath } from "cesium";
import type { Camera } from "cesium";

export function initCamera(camera: Camera, lat: number, lon: number): void {
  const height = 1.7;
  camera.setView({
    destination: Cartesian3.fromDegrees(lon, lat, height),
    orientation: {
      heading: CesiumMath.toRadians(0),
      pitch: CesiumMath.toRadians(89.9),
      roll: 0,
    },
  });
}
