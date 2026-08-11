/* SPDX-License-Identifier: Apache-2.0 */
import {
  BillboardCollection,
  Color,
  Math as CesiumMath,
  HorizontalOrigin,
  VerticalOrigin,
} from "cesium";
import type { Scene } from "cesium";
import type { VisibleConstellation } from "../astro";
import { collectionAt, collectionLength, setCollectionVisible } from "./cesium-collections";
import { altAzToCartesian } from "./stars";
import bundledManifest from "../../data/art/western/manifest.json";

/**
 * Manifest entry for a single Western/IAU 88 constellation.
 *
 * `file` is the SVG basename under `data/art/western/`, or `null` when no
 * asset is available (the layer falls back to the placeholder sprite).
 * Transforms are applied when the sprite is drawn:
 *   * `scale` multiplies the billboard's base scale
 *   * `rotationDeg` rotates about the sprite centre (CCW positive)
 *   * `offsetAlt` / `offsetAz` shift the anchor from the constellation
 *     centroid, in degrees.
 * See ADR 017.
 */
export type ConstellationArtEntry = {
  file: string | null;
  scale: number;
  rotationDeg: number;
  offsetAlt: number;
  offsetAz: number;
};

export type ConstellationArtManifest = {
  culture: string;
  version: number;
  notes?: string;
  constellations: Record<string, ConstellationArtEntry>;
};

export type ConstellationArtLayer = {
  update: (constellations: VisibleConstellation[], lat: number, lon: number) => void;
  setVisible: (visible: boolean) => void;
  setOpacity: (opacity: number) => void;
};

type ArtImage = HTMLImageElement | HTMLCanvasElement;

export type CreateConstellationArtLayerOptions = {
  manifest?: ConstellationArtManifest;
  loadImage?: (url: string) => ArtImage;
};

const DEFAULT_MANIFEST = bundledManifest as ConstellationArtManifest;

const IDENTITY_ENTRY: ConstellationArtEntry = {
  file: null,
  scale: 1.0,
  rotationDeg: 0.0,
  offsetAlt: 0.0,
  offsetAz: 0.0,
};

const PLACEHOLDER_SPRITE_SIZE = 96;

/**
 * Generate the fallback sprite used when a constellation has no bundled art
 * file (either its manifest entry has `file: null` or no entry exists). It's
 * a subtle radial glow with a dashed circular hint so the layer is visible
 * when toggled on but doesn't pretend to be finished art.
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

function defaultLoadImage(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

// Vite's asset plugin rewrites `new URL(<literal>, import.meta.url)` refs to
// hashed bundle URLs at build time — but only when the first argument is a
// literal string. Keeping the *base* as a literal here (and concatenating the
// dynamic basename separately) is what makes the rewrite fire correctly.
const ASSET_BASE = new URL("../../data/art/western/", import.meta.url).href;

function resolveAssetUrl(file: string): string {
  return ASSET_BASE + file;
}

/**
 * Constellation art overlay layer (issue #350, manifest scaffolding #366).
 *
 * Renders one billboard per visible constellation, positioned at the same
 * centroid the label layer uses (optionally offset via the manifest entry).
 * Off by default; toggled by `?art=on` and the Settings-drawer switch.
 * The URL-synced opacity slider defaults to 0.35.
 *
 * The layer reads per-constellation art metadata from the bundled
 * `data/art/western/manifest.json`. When an entry's `file` is populated,
 * the sprite is loaded via {@link CreateConstellationArtLayerOptions.loadImage};
 * when it's `null` (or the entry is missing), the fallback placeholder
 * canvas is used. See ADR 017 for the manifest schema and rollout plan.
 */
export function createConstellationArtLayer(
  scene: Scene,
  options: CreateConstellationArtLayerOptions = {},
): ConstellationArtLayer {
  const manifest = options.manifest ?? DEFAULT_MANIFEST;
  const loadImage = options.loadImage ?? defaultLoadImage;

  const billboards = new BillboardCollection({ scene });
  scene.primitives.add(billboards);
  const placeholder = generatePlaceholderSprite();
  const imageCache = new Map<string, ArtImage>();

  // Current opacity — remembered so `update()` can paint new billboards with
  // the slider's live value instead of the hard-coded default.
  let currentOpacity = 0.35;

  function spriteFor(entry: ConstellationArtEntry): ArtImage {
    if (entry.file === null) return placeholder;
    const cached = imageCache.get(entry.file);
    if (cached !== undefined) return cached;
    const loaded = loadImage(resolveAssetUrl(entry.file));
    imageCache.set(entry.file, loaded);
    return loaded;
  }

  function update(constellations: VisibleConstellation[], lat: number, lon: number): void {
    billboards.removeAll();
    for (const constellation of constellations) {
      const entry = manifest.constellations[constellation.id] ?? IDENTITY_ENTRY;
      const alt = constellation.centroid.alt + entry.offsetAlt;
      const az = constellation.centroid.az + entry.offsetAz;
      billboards.add({
        position: altAzToCartesian(alt, az, lat, lon),
        image: spriteFor(entry),
        scale: entry.scale,
        rotation: CesiumMath.toRadians(entry.rotationDeg),
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
