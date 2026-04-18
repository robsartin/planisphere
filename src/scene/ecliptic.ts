/* SPDX-License-Identifier: Apache-2.0 */
import { PolylineCollection, Color, Material } from "cesium";
import type { Scene } from "cesium";
import type { HorizontalCoord } from "../astro/coords";
import { altAzToCartesian } from "./stars";

export type EclipticLayer = {
  update: (points: HorizontalCoord[], lat: number, lon: number) => void;
  setOpacity: (opacity: number) => void;
};

// Ecliptic color: warm yellow
const ECLIPTIC_COLOR = Color.fromCssColorString("#FFD700");

export function createEclipticLayer(scene: Scene): EclipticLayer {
  const polylines = new PolylineCollection();
  scene.primitives.add(polylines);

  const addedPolylines: Array<{ material: { uniforms: { color: { alpha: number } } } }> = [];
  let currentOpacity = 0.4;

  function update(points: HorizontalCoord[], lat: number, lon: number): void {
    polylines.removeAll();
    addedPolylines.length = 0;

    if (points.length < 2) return;

    const positions = points.map((pt) => altAzToCartesian(pt.alt, pt.az, lat, lon));
    const pl = polylines.add({
      positions,
      width: 2,
      material: Material.fromType("Color", {
        color: ECLIPTIC_COLOR.withAlpha(currentOpacity),
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
