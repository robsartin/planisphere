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
  rank: "cardinal" | "intercardinal" | "secondary";
};

const DIRECTIONS: DirectionLabel[] = [
  { text: "N", az: 0, rank: "cardinal" },
  { text: "NNE", az: 22.5, rank: "secondary" },
  { text: "NE", az: 45, rank: "intercardinal" },
  { text: "ENE", az: 67.5, rank: "secondary" },
  { text: "E", az: 90, rank: "cardinal" },
  { text: "ESE", az: 112.5, rank: "secondary" },
  { text: "SE", az: 135, rank: "intercardinal" },
  { text: "SSE", az: 157.5, rank: "secondary" },
  { text: "S", az: 180, rank: "cardinal" },
  { text: "SSW", az: 202.5, rank: "secondary" },
  { text: "SW", az: 225, rank: "intercardinal" },
  { text: "WSW", az: 247.5, rank: "secondary" },
  { text: "W", az: 270, rank: "cardinal" },
  { text: "WNW", az: 292.5, rank: "secondary" },
  { text: "NW", az: 315, rank: "intercardinal" },
  { text: "NNW", az: 337.5, rank: "secondary" },
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
        font:
          dir.rank === "cardinal"
            ? "bold 16px sans-serif"
            : dir.rank === "intercardinal"
              ? "14px sans-serif"
              : "12px sans-serif",
        fillColor: Color.WHITE.withAlpha(
          dir.rank === "cardinal" ? 0.85 : dir.rank === "intercardinal" ? 0.6 : 0.4,
        ),
        style: LabelStyle.FILL,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });
    }
  }

  return { update };
}
