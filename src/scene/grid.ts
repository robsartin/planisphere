/* SPDX-License-Identifier: Apache-2.0 */
import { PolylineCollection, Color, Material } from "cesium";
import type { Scene } from "cesium";
import { setCollectionVisible } from "./cesium-collections";
import type { GridData } from "../astro/grid";
import { altAzToCartesian } from "./stars";

export type GridLayer = {
  update: (gridData: GridData, lat: number, lon: number) => void;
  setOpacity: (opacity: number) => void;
};

export function createGridLayer(scene: Scene): GridLayer {
  const polylines = new PolylineCollection();
  scene.primitives.add(polylines);

  const addedPolylines: Array<{ material: { uniforms: { color: { alpha: number } } } }> = [];
  let currentOpacity = 0.2;

  function update(gridData: GridData, lat: number, lon: number): void {
    polylines.removeAll();
    addedPolylines.length = 0;

    const allLines = [...gridData.raLines, ...gridData.decLines];

    for (const line of allLines) {
      if (line.length < 2) continue;

      const positions = line.map((pt) => altAzToCartesian(pt.alt, pt.az, lat, lon));
      const pl = polylines.add({
        positions,
        width: 1,
        material: Material.fromType("Color", {
          color: Color.WHITE.withAlpha(currentOpacity),
        }),
      });
      addedPolylines.push(pl as never);
    }
  }

  function setOpacity(opacity: number): void {
    currentOpacity = opacity;
    const show = opacity > 0;
    setCollectionVisible(polylines, show);
    for (const pl of addedPolylines) {
      if (pl?.material?.uniforms?.color !== undefined) {
        pl.material.uniforms.color.alpha = opacity;
      }
    }
  }

  return { update, setOpacity };
}
