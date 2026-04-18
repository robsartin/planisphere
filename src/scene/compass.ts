/* SPDX-License-Identifier: Apache-2.0 */
import { BillboardCollection, HorizontalOrigin, VerticalOrigin } from "cesium";
import type { Scene } from "cesium";
import { altAzToCartesian } from "./stars";

export type CompassLayer = {
  update: (lat: number, lon: number) => void;
  setVisible: (visible: boolean) => void;
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

function renderTextToCanvas(
  text: string,
  fontSize: number,
  bold: boolean,
  alpha: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.clearRect(0, 0, 64, 32);
  ctx.font = `${bold ? "bold " : ""}${String(fontSize)}px sans-serif`;
  ctx.fillStyle = `rgba(255, 255, 255, ${String(alpha)})`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 32, 16);
  return canvas;
}

export function createCompassLayer(scene: Scene): CompassLayer {
  const billboards = new BillboardCollection({ scene });
  scene.primitives.add(billboards);

  function update(lat: number, lon: number): void {
    billboards.removeAll();
    for (const dir of DIRECTIONS) {
      const position = altAzToCartesian(5, dir.az, lat, lon);
      const fontSize = dir.rank === "cardinal" ? 16 : dir.rank === "intercardinal" ? 14 : 12;
      const bold = dir.rank === "cardinal";
      const alpha = dir.rank === "cardinal" ? 0.85 : dir.rank === "intercardinal" ? 0.6 : 0.4;
      billboards.add({
        position,
        image: renderTextToCanvas(dir.text, fontSize, bold, alpha),
        scale: 1,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });
    }
  }

  function setVisible(visible: boolean): void {
    for (let i = 0; i < billboards.length; i++) {
      const bb = billboards.get(i);
      bb.show = visible;
    }
  }

  return { update, setVisible };
}
