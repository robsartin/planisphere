/* SPDX-License-Identifier: Apache-2.0 */
import { BillboardCollection, Color, HorizontalOrigin, VerticalOrigin } from "cesium";
import type { Scene } from "cesium";
import type { VisibleMessier } from "../astro/messier";
import { altAzToCartesian } from "./stars";

export type MessierLayer = {
  update: (objects: VisibleMessier[], lat: number, lon: number) => void;
  setVisible: (visible: boolean) => void;
  setOpacity: (opacity: number) => void;
};

const SYMBOL_SIZE = 10;

type SymbolSpec = {
  color: string;
  draw: (ctx: CanvasRenderingContext2D, c: number, r: number) => void;
};

function symbolSpec(type: string): SymbolSpec {
  switch (type) {
    case "open cluster":
      return {
        color: "#FFE566",
        draw(ctx, c, r) {
          ctx.beginPath();
          ctx.arc(c, c, r - 1, 0, Math.PI * 2);
          ctx.strokeStyle = "#FFE566";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        },
      };
    case "globular cluster":
      return {
        color: "#FFE566",
        draw(ctx, c, r) {
          ctx.beginPath();
          ctx.arc(c, c, r - 1, 0, Math.PI * 2);
          ctx.strokeStyle = "#FFE566";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(c, 1);
          ctx.lineTo(c, SYMBOL_SIZE - 1);
          ctx.moveTo(1, c);
          ctx.lineTo(SYMBOL_SIZE - 1, c);
          ctx.strokeStyle = "#FFE566";
          ctx.lineWidth = 1;
          ctx.stroke();
        },
      };
    case "galaxy":
      return {
        color: "#88CCFF",
        draw(ctx, c, r) {
          ctx.beginPath();
          ctx.ellipse(c, c, r - 1, (r - 1) * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = "#88CCFF";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        },
      };
    case "nebula":
      return {
        color: "#66FF88",
        draw(ctx, c, _r) {
          const half = SYMBOL_SIZE * 0.4;
          ctx.beginPath();
          ctx.rect(c - half, c - half, half * 2, half * 2);
          ctx.strokeStyle = "#66FF88";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        },
      };
    case "planetary nebula":
      return {
        color: "#66FF88",
        draw(ctx, c, r) {
          // Small circle with outer ring hint
          ctx.beginPath();
          ctx.arc(c, c, r - 2, 0, Math.PI * 2);
          ctx.strokeStyle = "#66FF88";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(c, c, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = "#66FF88";
          ctx.fill();
        },
      };
    case "supernova remnant":
      return {
        color: "#FF8866",
        draw(ctx, c, _r) {
          // Diamond
          const h = SYMBOL_SIZE * 0.45;
          ctx.beginPath();
          ctx.moveTo(c, c - h);
          ctx.lineTo(c + h, c);
          ctx.lineTo(c, c + h);
          ctx.lineTo(c - h, c);
          ctx.closePath();
          ctx.strokeStyle = "#FF8866";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        },
      };
    default:
      return {
        color: "#FFFFFF",
        draw(ctx, c, _r) {
          // Diamond
          const h = SYMBOL_SIZE * 0.45;
          ctx.beginPath();
          ctx.moveTo(c, c - h);
          ctx.lineTo(c + h, c);
          ctx.lineTo(c, c + h);
          ctx.lineTo(c - h, c);
          ctx.closePath();
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        },
      };
  }
}

function generateMessierSprite(type: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = SYMBOL_SIZE;
  canvas.height = SYMBOL_SIZE;
  let ctx: CanvasRenderingContext2D | null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }
  if (!ctx) return canvas;
  const spec = symbolSpec(type);
  const center = SYMBOL_SIZE / 2;
  const radius = SYMBOL_SIZE / 2;
  spec.draw(ctx, center, radius);
  return canvas;
}

const TYPES = [
  "open cluster",
  "globular cluster",
  "galaxy",
  "nebula",
  "planetary nebula",
  "supernova remnant",
  "other",
];

export function createMessierLayer(scene: Scene): MessierLayer {
  const billboards = new BillboardCollection({ scene });
  scene.primitives.add(billboards);

  // Pre-generate one sprite canvas per type
  const sprites = new Map<string, HTMLCanvasElement>(
    TYPES.map((t) => [t, generateMessierSprite(t)]),
  );

  function getSprite(type: string): HTMLCanvasElement {
    return sprites.get(type) ?? sprites.get("other")!;
  }

  function update(objects: VisibleMessier[], lat: number, lon: number): void {
    billboards.removeAll();
    for (const obj of objects) {
      const spec = symbolSpec(obj.type);
      billboards.add({
        position: altAzToCartesian(obj.alt, obj.az, lat, lon),
        image: getSprite(obj.type),
        scale: 1.0,
        color: Color.fromCssColorString(spec.color).withAlpha(0.9),
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        id: obj,
      });
    }
  }

  function setVisible(visible: boolean): void {
    (billboards as unknown as { show: boolean }).show = visible;
  }

  function setOpacity(opacity: number): void {
    // Billboard alpha is set per-billboard at add time; update all existing billboards
    const count = (billboards as unknown as { length: number }).length ?? 0;
    for (let i = 0; i < count; i++) {
      const bb = (
        billboards as unknown as { get: (i: number) => { color: { alpha: number } } }
      ).get(i);
      if (bb?.color !== undefined) {
        bb.color.alpha = opacity;
      }
    }
  }

  return { update, setVisible, setOpacity };
}
