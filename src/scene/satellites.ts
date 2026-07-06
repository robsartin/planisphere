/* SPDX-License-Identifier: Apache-2.0 */
import {
  BillboardCollection,
  PolylineCollection,
  Color,
  HorizontalOrigin,
  VerticalOrigin,
  Material,
} from "cesium";
import type { Scene } from "cesium";
import type { VisibleSatellite } from "../sat";
import { setCollectionVisible } from "./cesium-collections";
import { altAzToCartesian } from "./stars";

const SAT_COLOR = "#00FF88";

export type SatelliteLayer = {
  update: (satellites: VisibleSatellite[], lat: number, lon: number) => void;
  setVisible: (visible: boolean) => void;
  setOpacity: (opacity: number) => void;
};

function generateSatSprite(): HTMLCanvasElement {
  const size = 16;
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
  if (!ctx) return canvas;
  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, SAT_COLOR);
  gradient.addColorStop(0.5, SAT_COLOR);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export function createSatelliteLayer(scene: Scene): SatelliteLayer {
  const billboards = new BillboardCollection({ scene });
  const polylines = new PolylineCollection();
  scene.primitives.add(billboards);
  scene.primitives.add(polylines);
  const spriteImage = generateSatSprite();

  const trailPolylines: Array<{ material: { uniforms: { color: { alpha: number } } } }> = [];

  function update(satellites: VisibleSatellite[], lat: number, lon: number): void {
    billboards.removeAll();
    polylines.removeAll();
    trailPolylines.length = 0;

    for (const sat of satellites) {
      billboards.add({
        position: altAzToCartesian(sat.alt, sat.az, lat, lon),
        image: spriteImage,
        scale: 0.375,
        color: Color.fromCssColorString(SAT_COLOR).withAlpha(1.0),
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        id: sat,
      });

      if (sat.trail.length >= 2) {
        const positions = sat.trail.map((pt) => altAzToCartesian(pt.alt, pt.az, lat, lon));
        positions.push(altAzToCartesian(sat.alt, sat.az, lat, lon));
        const pl = polylines.add({
          positions,
          width: 1,
          material: Material.fromType("Color", {
            color: Color.fromCssColorString(SAT_COLOR).withAlpha(0.3),
          }),
        });
        trailPolylines.push(pl);
      }
    }
  }

  function setVisible(visible: boolean): void {
    setCollectionVisible(billboards, visible);
    setCollectionVisible(polylines, visible);
  }

  function setOpacity(opacity: number): void {
    for (const pl of trailPolylines) {
      if (pl?.material?.uniforms?.color !== undefined) {
        pl.material.uniforms.color.alpha = opacity;
      }
    }
  }

  return { update, setVisible, setOpacity };
}
