/* SPDX-License-Identifier: Apache-2.0 */
import { BillboardCollection, HorizontalOrigin, VerticalOrigin } from "cesium";
import type { Scene } from "cesium";
import type { HorizontalCoord } from "../astro/coords";
import { altAzToCartesian } from "./stars";

export type MilkyWayLayer = {
  update: (points: HorizontalCoord[], lat: number, lon: number) => void;
  setOpacity: (opacity: number) => void;
};

function generateGlowSprite(size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, "rgba(180, 200, 230, 0.35)");
  gradient.addColorStop(0.2, "rgba(180, 200, 230, 0.25)");
  gradient.addColorStop(0.5, "rgba(170, 190, 220, 0.12)");
  gradient.addColorStop(0.8, "rgba(160, 180, 210, 0.04)");
  gradient.addColorStop(1, "rgba(160, 180, 210, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export function createMilkyWayLayer(scene: Scene): MilkyWayLayer {
  const billboards = new BillboardCollection({ scene });
  scene.primitives.add(billboards);
  const sprite = generateGlowSprite(128);

  function update(points: HorizontalCoord[], lat: number, lon: number): void {
    billboards.removeAll();
    for (const pt of points) {
      billboards.add({
        position: altAzToCartesian(pt.alt, pt.az, lat, lon),
        image: sprite,
        scale: 8,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });
    }
  }

  function setOpacity(opacity: number): void {
    for (let i = 0; i < billboards.length; i++) {
      const bb = billboards.get(i);
      bb.show = opacity > 0;
    }
  }

  return { update, setOpacity };
}
