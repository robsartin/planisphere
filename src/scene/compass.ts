/* SPDX-License-Identifier: Apache-2.0 */
import { LabelCollection, Color, HorizontalOrigin, VerticalOrigin, LabelStyle } from "cesium";
import type { Scene } from "cesium";
import { altAzToCartesian } from "./stars";

export type CompassLayer = {
  update: (lat: number, lon: number) => void;
};

type DirectionLabel = {
  text: string;
  az: number;
  bold: boolean;
};

const DIRECTIONS: DirectionLabel[] = [
  { text: "N", az: 0, bold: true },
  { text: "NE", az: 45, bold: false },
  { text: "E", az: 90, bold: true },
  { text: "SE", az: 135, bold: false },
  { text: "S", az: 180, bold: true },
  { text: "SW", az: 225, bold: false },
  { text: "W", az: 270, bold: true },
  { text: "NW", az: 315, bold: false },
];

export function createCompassLayer(scene: Scene): CompassLayer {
  const labels = new LabelCollection({ scene });
  scene.primitives.add(labels);

  function update(lat: number, lon: number): void {
    labels.removeAll();
    for (const dir of DIRECTIONS) {
      const position = altAzToCartesian(2, dir.az, lat, lon);
      labels.add({
        position,
        text: dir.text,
        font: dir.bold ? "bold 16px sans-serif" : "14px sans-serif",
        fillColor: Color.WHITE.withAlpha(dir.bold ? 0.85 : 0.6),
        style: LabelStyle.FILL,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });
    }
  }

  return { update };
}
