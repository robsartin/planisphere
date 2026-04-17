/* SPDX-License-Identifier: Apache-2.0 */
import {
  BillboardCollection,
  Cartesian3,
  Color,
  Math as CesiumMath,
  Matrix4,
  Transforms,
  HorizontalOrigin,
  VerticalOrigin,
} from "cesium";
import type { Scene } from "cesium";
import type { AltAzStar } from "../astro";

const SKY_RADIUS = 1e7;

export type StarLayer = {
  update: (stars: AltAzStar[], lat: number, lon: number) => void;
};

export function generateStarSprite(): HTMLCanvasElement {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  let ctx: CanvasRenderingContext2D | null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    // jsdom / test environment: getContext throws if canvas package absent
    ctx = null;
  }
  if (ctx === null) {
    // Context unavailable — return a blank canvas as fallback
    return canvas;
  }
  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.3, "rgba(255, 255, 255, 0.6)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export function altAzToCartesian(alt: number, az: number, lat: number, lon: number): Cartesian3 {
  const altRad = CesiumMath.toRadians(alt);
  const azRad = CesiumMath.toRadians(az);
  const cosAlt = Math.cos(altRad);

  // Direction in local ENU (East-North-Up) frame
  const east = cosAlt * Math.sin(azRad);
  const north = cosAlt * Math.cos(azRad);
  const up = Math.sin(altRad);

  const localDir = new Cartesian3(east * SKY_RADIUS, north * SKY_RADIUS, up * SKY_RADIUS);

  // Transform local ENU direction to ECEF via the observer's reference frame
  const observerPos = Cartesian3.fromDegrees(lon, lat, 0);
  const enuToFixed = Transforms.eastNorthUpToFixedFrame(observerPos);
  return Matrix4.multiplyByPoint(enuToFixed, localDir, new Cartesian3());
}

export function createStarLayer(scene: Scene): StarLayer {
  const billboards = new BillboardCollection({ scene });
  scene.primitives.add(billboards);
  const spriteImage = generateStarSprite();

  function update(stars: AltAzStar[], lat: number, lon: number): void {
    billboards.removeAll();
    for (const star of stars) {
      billboards.add({
        position: altAzToCartesian(star.alt, star.az, lat, lon),
        image: spriteImage,
        scale: star.size / 16,
        color: Color.WHITE.withAlpha(star.opacity),
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
      });
    }
  }

  return { update };
}
