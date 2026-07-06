/* SPDX-License-Identifier: Apache-2.0 */
import { BillboardCollection, Color, HorizontalOrigin, VerticalOrigin } from "cesium";
import type { Scene } from "cesium";
import type { VisibleConstellation } from "../astro";
import { collectionAt, collectionLength, setCollectionVisible } from "./cesium-collections";
import { altAzToCartesian } from "./stars";

// TODO(#350-art-assets): This layer ships with a single generated placeholder
// sprite used for every constellation. The real deliverable is one SVG per IAU
// constellation packaged under `data/art/western/`, with:
//   * per-file attribution added to `NOTICE`
//   * an ADR under `docs/adr/` recording the culture-pack licence
//     (Stellarium's western skyculture is CC-BY-SA; check compatibility with
//     Apache 2.0 before bundling)
//   * per-constellation scale/rotation metadata so each figure sits
//     roughly aligned with the stick figure
// The layer plumbing here (URL param, Settings toggle + slider, dispatch
// wiring) is stable; only the sprite resolution + attribution work remains.

export type ConstellationArtLayer = {
  update: (constellations: VisibleConstellation[], lat: number, lon: number) => void;
  setVisible: (visible: boolean) => void;
  setOpacity: (opacity: number) => void;
};

const PLACEHOLDER_SPRITE_SIZE = 96;

/**
 * Generate a single placeholder sprite used for every constellation until the
 * per-constellation art assets land (see the TODO above). It's a subtle radial
 * glow with a dashed circular hint so the layer is visible when toggled on but
 * doesn't pretend to be finished art. Real art assets will replace this with a
 * `Map<constellationId, HTMLImageElement>` lookup keyed on the ISO 88 code.
 */
function generatePlaceholderSprite(): HTMLCanvasElement {
  const size = PLACEHOLDER_SPRITE_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  let ctx: CanvasRenderingContext2D | null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }
  if (ctx === null) return canvas;

  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, "rgba(200, 180, 120, 0.35)");
  gradient.addColorStop(0.5, "rgba(200, 180, 120, 0.18)");
  gradient.addColorStop(1, "rgba(200, 180, 120, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(220, 200, 150, 0.5)";
  ctx.lineWidth = 1.2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.arc(center, center, size * 0.35, 0, Math.PI * 2);
  ctx.stroke();
  return canvas;
}

/**
 * Constellation art overlay layer (issue #350).
 *
 * Renders one billboard per visible constellation, positioned at the same
 * centroid the label layer uses. Off by default; toggled by `?art=on` and the
 * Settings-drawer switch. The URL-synced opacity slider defaults to 0.35.
 *
 * The layer follows the same shape as {@link import("./constellations").ConstellationLayer}:
 *   * `update(constellations, lat, lon)` rebuilds billboards from a fresh list
 *     of visible constellations.
 *   * `setVisible(visible)` flips the collection's show flag.
 *   * `setOpacity(alpha)` rescales the alpha channel of every billboard so the
 *     slider tracks live.
 */
export function createConstellationArtLayer(scene: Scene): ConstellationArtLayer {
  const billboards = new BillboardCollection({ scene });
  scene.primitives.add(billboards);
  const sprite = generatePlaceholderSprite();

  // Current opacity — remembered so `update()` can paint new billboards with
  // the slider's live value instead of the hard-coded default.
  let currentOpacity = 0.35;

  function update(constellations: VisibleConstellation[], lat: number, lon: number): void {
    billboards.removeAll();
    for (const constellation of constellations) {
      billboards.add({
        position: altAzToCartesian(constellation.centroid.alt, constellation.centroid.az, lat, lon),
        image: sprite,
        scale: 1.0,
        color: Color.WHITE.withAlpha(currentOpacity),
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        // Attach the VisibleConstellation as the picked id so hover / click
        // over the art can resolve back to a typed constellation payload —
        // matches the ConstellationLayer polyline pick contract.
        id: constellation,
      });
    }
  }

  function setVisible(visible: boolean): void {
    setCollectionVisible(billboards, visible);
  }

  function setOpacity(opacity: number): void {
    currentOpacity = opacity;
    const count = collectionLength(billboards);
    for (let i = 0; i < count; i++) {
      const bb = collectionAt<{ color: { alpha: number } }>(billboards, i);
      if (bb?.color !== undefined) {
        bb.color.alpha = opacity;
      }
    }
  }

  return { update, setVisible, setOpacity };
}
