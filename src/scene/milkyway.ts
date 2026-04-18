/* SPDX-License-Identifier: Apache-2.0 */
import { PolylineCollection, Color, Material } from "cesium";
import type { Scene } from "cesium";
import type { HorizontalCoord } from "../astro/coords";
import { altAzToCartesian } from "./stars";

export type MilkyWayLayer = {
  update: (points: HorizontalCoord[], lat: number, lon: number) => void;
  setOpacity: (opacity: number) => void;
};

// Milky Way color: soft blue-white
const MILKY_WAY_COLOR = Color.fromCssColorString("#B0C4DE");

export function createMilkyWayLayer(scene: Scene): MilkyWayLayer {
  const polylines = new PolylineCollection();
  scene.primitives.add(polylines);

  const addedPolylines: Array<{ material: { uniforms: { color: { alpha: number } } } }> = [];
  let currentOpacity = 0.3;

  function update(points: HorizontalCoord[], lat: number, lon: number): void {
    polylines.removeAll();
    addedPolylines.length = 0;

    if (points.length < 2) return;

    const positions = points.map((pt) => altAzToCartesian(pt.alt, pt.az, lat, lon));
    const pl = polylines.add({
      positions,
      width: 3,
      material: Material.fromType("Color", {
        color: MILKY_WAY_COLOR.withAlpha(currentOpacity),
      }),
    });
    addedPolylines.push(pl as never);
  }

  function setOpacity(opacity: number): void {
    currentOpacity = opacity;
    const show = opacity > 0;
    (polylines as unknown as { show: boolean }).show = show;
    for (const pl of addedPolylines) {
      if (pl?.material?.uniforms?.color !== undefined) {
        pl.material.uniforms.color.alpha = opacity;
      }
    }
  }

  return { update, setOpacity };
}
