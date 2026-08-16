/* SPDX-License-Identifier: Apache-2.0 */
import { BillboardCollection, Cartesian3, Color, HorizontalOrigin, VerticalOrigin } from "cesium";
import type { Scene } from "cesium";
import type { VisibleConstellation } from "../astro";
import { collectionAt, collectionLength, setCollectionVisible } from "./cesium-collections";
import { altAzToCartesian } from "./stars";
import bundledManifest from "../../data/art/western/manifest.json";

/**
 * A single Stellarium-style alignment anchor for a constellation illustration:
 * pins the pixel `pos` in the image to the Hipparcos-catalogue star `hip`.
 * Manifest entries carry three of these, which together define the affine
 * mapping from image pixels to the celestial sphere. See ADR 018.
 */
export type ConstellationArtAnchor = {
  readonly pos: readonly [number, number];
  readonly hip: number;
};

/**
 * Manifest entry for a single IAU 88 constellation.
 *
 * When `file` is null the layer draws its placeholder sprite at the
 * constellation centroid. When `file` is set, `size` and `anchors` must
 * accompany it: the layer uses the three anchors + the current-frame alt/az
 * of the corresponding stars to project the image onto the sky. Falls back
 * to the placeholder at the centroid if any anchor's star isn't currently
 * visible.
 */
export type ConstellationArtEntry = {
  readonly file: string | null;
  readonly size?: readonly [number, number];
  readonly anchors?: readonly ConstellationArtAnchor[];
};

export type ConstellationArtManifest = {
  readonly culture: string;
  readonly version: number;
  readonly notes?: string;
  readonly source?: string;
  readonly constellations: Readonly<Record<string, ConstellationArtEntry>>;
};

/**
 * Callback the app passes each frame: given a Hipparcos number, return the
 * star's current alt/az (or undefined if not currently visible). Keeps the
 * layer decoupled from the visible-star list's shape.
 */
export type AnchorStarLookup = (hip: number) => { alt: number; az: number } | undefined;

export type ConstellationArtLayer = {
  update: (
    constellations: VisibleConstellation[],
    lookup: AnchorStarLookup,
    lat: number,
    lon: number,
  ) => void;
  setVisible: (visible: boolean) => void;
  setOpacity: (opacity: number) => void;
};

type ArtImage = HTMLImageElement | HTMLCanvasElement;

export type CreateConstellationArtLayerOptions = {
  manifest?: ConstellationArtManifest;
  loadImage?: (url: string) => ArtImage;
};

const DEFAULT_MANIFEST = bundledManifest as unknown as ConstellationArtManifest;

const PLACEHOLDER_SPRITE_SIZE = 96;

// Fixed base scale for anchored images. Stellarium ships its art at 512×512
// (a handful larger); rendering at 0.5 puts a medium constellation roughly
// at the right on-screen size for the default camera zoom. Per-constellation
// scale overrides + a zoom-aware scaling model are a follow-up (see ADR 018).
const BASE_ANCHORED_SCALE = 0.5;

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

// Vite resolves this glob to a map of source path → hashed emitted asset URL
// at build time. `eager` resolves URLs only — it does not fetch image data —
// so the per-constellation lazy loading in `loadedImage` is unaffected.
//
// The previous implementation concatenated a dynamic basename onto a literal
// directory base. Vite's asset plugin only rewrites `new URL()` when the
// ENTIRE path is a static literal, so that emitted nothing and every art
// fetch 404'd in production (#404 review).
const ART_URLS = import.meta.glob("../../data/art/western/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});

const ART_URL_BY_BASENAME: ReadonlyMap<string, string> = new Map(
  Object.entries(ART_URLS).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1), url]),
);

/**
 * Resolve a manifest basename (e.g. `"Ori.png"`) to its Vite-emitted asset
 * URL. Returns null when no such asset exists, which is what makes a missing
 * or misnamed file detectable instead of silently 404-ing at runtime.
 */
export function artAssetUrl(file: string): string | null {
  return ART_URL_BY_BASENAME.get(file) ?? null;
}

/**
 * Barycentric coordinates of Q in triangle (P0, P1, P2). Returns [u, v, w]
 * with u+v+w=1 so Q = u·P0 + v·P1 + w·P2. Returns null if the triangle
 * is degenerate (the three anchor pixels are collinear).
 */
function barycentric2D(
  q: readonly [number, number],
  p0: readonly [number, number],
  p1: readonly [number, number],
  p2: readonly [number, number],
): [number, number, number] | null {
  const x = q[0] - p0[0];
  const y = q[1] - p0[1];
  const x1 = p1[0] - p0[0];
  const y1 = p1[1] - p0[1];
  const x2 = p2[0] - p0[0];
  const y2 = p2[1] - p0[1];
  const det = x1 * y2 - x2 * y1;
  if (Math.abs(det) < 1e-9) return null;
  const v = (x * y2 - x2 * y) / det;
  const w = (x1 * y - x * y1) / det;
  const u = 1 - v - w;
  return [u, v, w];
}

/**
 * Resolve the world-space position and screen scale for an anchored
 * constellation image, given the live alt/az of each anchor star.
 *
 * Returns null when the entry can't be anchored — either because it has no
 * `file` (placeholder-only entry, e.g. Pup / Ser / Vel), or the anchors are
 * missing/collinear, or any anchor star isn't currently above the horizon.
 * Callers fall back to the placeholder at the constellation centroid.
 */
function anchoredPositionAndScale(
  entry: ConstellationArtEntry,
  lookup: AnchorStarLookup,
  lat: number,
  lon: number,
): { position: Cartesian3; scale: number } | null {
  if (entry.file === null) return null;
  if (entry.size === undefined || entry.anchors === undefined) return null;
  if (entry.anchors.length < 3) return null;

  const [a0, a1, a2] = entry.anchors as readonly [
    ConstellationArtAnchor,
    ConstellationArtAnchor,
    ConstellationArtAnchor,
  ];
  const s0 = lookup(a0.hip);
  const s1 = lookup(a1.hip);
  const s2 = lookup(a2.hip);
  if (s0 === undefined || s1 === undefined || s2 === undefined) return null;

  const [w, h] = entry.size;
  const bary = barycentric2D([w / 2, h / 2], a0.pos, a1.pos, a2.pos);
  if (bary === null) return null;
  const [u, v, ww] = bary;

  const w0 = altAzToCartesian(s0.alt, s0.az, lat, lon);
  const w1 = altAzToCartesian(s1.alt, s1.az, lat, lon);
  const w2 = altAzToCartesian(s2.alt, s2.az, lat, lon);

  // Linear combination in Cartesian3 world space. The result may not sit
  // exactly on the celestial sphere when the image centre falls outside the
  // anchor triangle — that's fine, Cesium projects world-space points onto
  // the camera regardless of whether they're on a sphere.
  const position = new Cartesian3(
    u * w0.x + v * w1.x + ww * w2.x,
    u * w0.y + v * w1.y + ww * w2.y,
    u * w0.z + v * w1.z + ww * w2.z,
  );

  return { position, scale: BASE_ANCHORED_SCALE };
}

/**
 * Constellation art overlay layer (issue #366, assets slice).
 *
 * Renders one billboard per visible constellation. When the manifest carries
 * an image + three anchor stars for the constellation, the sprite is
 * positioned via barycentric interpolation of the anchor stars' live alt/az
 * (Stellarium's alignment scheme, adapted to Cesium billboards — see ADR 018).
 * Constellations without an anchored entry, or whose anchor stars aren't
 * currently visible, fall back to the placeholder sprite at the centroid so
 * the layer never draws a wrong-positioned illustration.
 *
 * Off by default; toggled by `?art=on` and the Settings drawer. Opacity
 * defaults to 0.35 and is URL-synced.
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

  let currentOpacity = 0.35;

  function loadedImage(file: string): ArtImage | null {
    const cached = imageCache.get(file);
    if (cached !== undefined) return cached;
    const url = artAssetUrl(file);
    if (url === null) return null;
    const loaded = loadImage(url);
    imageCache.set(file, loaded);
    return loaded;
  }

  function update(
    constellations: VisibleConstellation[],
    lookup: AnchorStarLookup,
    lat: number,
    lon: number,
  ): void {
    billboards.removeAll();
    for (const constellation of constellations) {
      const entry: ConstellationArtEntry = manifest.constellations[constellation.id] ?? {
        file: null,
      };
      const anchored = anchoredPositionAndScale(entry, lookup, lat, lon);
      const position =
        anchored?.position ??
        altAzToCartesian(constellation.centroid.alt, constellation.centroid.az, lat, lon);
      const resolved = anchored !== null && entry.file !== null ? loadedImage(entry.file) : null;
      const image = resolved ?? placeholder;
      const scale = anchored?.scale ?? 1.0;
      billboards.add({
        position,
        image,
        scale,
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
