/* SPDX-License-Identifier: Apache-2.0 */
import { BillboardCollection, HorizontalOrigin, VerticalOrigin } from "cesium";
import type { Scene } from "cesium";
import type { CelestialBody } from "../astro";
import { altAzToCartesian } from "./stars";

export type BodyLayer = {
  update: (bodies: CelestialBody[], lat: number, lon: number) => void;
  setVisible: (visible: boolean) => void;
};

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext("2d");
  } catch {
    // jsdom / test environment: getContext throws if canvas package absent
    return null;
  }
}

export function generateSunSprite(): HTMLCanvasElement {
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = getContext(canvas);
  if (!ctx) return canvas;
  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, "rgba(255, 255, 50, 1)");
  gradient.addColorStop(0.1, "rgba(255, 230, 0, 0.95)");
  gradient.addColorStop(0.25, "rgba(255, 215, 0, 0.7)");
  gradient.addColorStop(0.5, "rgba(255, 200, 0, 0.25)");
  gradient.addColorStop(1, "rgba(255, 180, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export function generateMoonSprite(illumination: number, phaseAngle: number): HTMLCanvasElement {
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = getContext(canvas);
  if (!ctx) return canvas;
  const center = size / 2;
  const radius = center - 2;

  ctx.fillStyle = "#E8E8E0";
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgba(0,0,0,1)";

  const shadowWidth = radius * (1 - illumination * 2);
  const waxing = phaseAngle < 180;

  ctx.beginPath();
  if (waxing) {
    ctx.ellipse(center, center, Math.abs(shadowWidth), radius, 0, -Math.PI / 2, Math.PI / 2);
    ctx.arc(center, center, radius, Math.PI / 2, -Math.PI / 2, false);
  } else {
    ctx.ellipse(center, center, Math.abs(shadowWidth), radius, 0, Math.PI / 2, -Math.PI / 2);
    ctx.arc(center, center, radius, -Math.PI / 2, Math.PI / 2, false);
  }
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  return canvas;
}

export function generatePlanetSprite(color: string): HTMLCanvasElement {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = getContext(canvas);
  if (!ctx) return canvas;
  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function spriteForBody(body: CelestialBody): HTMLCanvasElement {
  if (body.id === "Sun") return generateSunSprite();
  if (body.id === "Moon") return generateMoonSprite(body.illumination ?? 0.5, body.phaseAngle ?? 0);
  return generatePlanetSprite(body.color);
}

export function createBodyLayer(scene: Scene): BodyLayer {
  const billboards = new BillboardCollection({ scene });
  scene.primitives.add(billboards);

  function update(bodies: CelestialBody[], lat: number, lon: number): void {
    billboards.removeAll();
    for (const body of bodies) {
      billboards.add({
        position: altAzToCartesian(body.alt, body.az, lat, lon),
        image: spriteForBody(body),
        scale: body.size / 16,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        id: body,
      });
    }
  }

  function setVisible(visible: boolean): void {
    (billboards as unknown as { show: boolean }).show = visible;
  }

  return { update, setVisible };
}
