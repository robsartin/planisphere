/* SPDX-License-Identifier: Apache-2.0 */
import {
  PolylineCollection,
  LabelCollection,
  Color,
  HorizontalOrigin,
  VerticalOrigin,
  LabelStyle,
  Material,
} from "cesium";
import type { Scene } from "cesium";
import type { VisibleConstellation } from "../astro";
import { altAzToCartesian } from "./stars";

export type ConstellationLayer = {
  update: (constellations: VisibleConstellation[], lat: number, lon: number) => void;
};

export function createConstellationLayer(scene: Scene): ConstellationLayer {
  const polylines = new PolylineCollection();
  const labels = new LabelCollection({ scene });
  scene.primitives.add(polylines);
  scene.primitives.add(labels);

  function update(constellations: VisibleConstellation[], lat: number, lon: number): void {
    polylines.removeAll();
    labels.removeAll();

    for (const constellation of constellations) {
      for (const line of constellation.lines) {
        const startPos = altAzToCartesian(line.start.alt, line.start.az, lat, lon);
        const endPos = altAzToCartesian(line.end.alt, line.end.az, lat, lon);
        polylines.add({
          positions: [startPos, endPos],
          width: 1,
          material: Material.fromType("Color", {
            color: Color.WHITE.withAlpha(0.25),
          }),
        });
      }

      const centroidPos = altAzToCartesian(
        constellation.centroid.alt,
        constellation.centroid.az,
        lat,
        lon,
      );
      labels.add({
        position: centroidPos,
        text: constellation.name,
        font: "12px sans-serif",
        fillColor: Color.WHITE.withAlpha(0.6),
        style: LabelStyle.FILL,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });
    }
  }

  return { update };
}
