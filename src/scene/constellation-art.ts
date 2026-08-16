/* SPDX-License-Identifier: Apache-2.0 */
import {
  BillboardCollection,
  BoundingSphere,
  Color,
  ComponentDatatype,
  Geometry,
  GeometryAttribute,
  GeometryAttributes,
  GeometryInstance,
  HorizontalOrigin,
  Material,
  MaterialAppearance,
  Primitive,
  PrimitiveCollection,
  PrimitiveType,
  VerticalOrigin,
} from "cesium";
import type { Cartesian3, Matrix4, Scene } from "cesium";
import type { VisibleConstellation } from "../astro";
import { collectionAt, collectionLength, setCollectionVisible } from "./cesium-collections";
import { anchorModelMatrix } from "./constellation-art-affine";
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

export type CreateConstellationArtLayerOptions = {
  manifest?: ConstellationArtManifest;
};

const DEFAULT_MANIFEST = bundledManifest as unknown as ConstellationArtManifest;

const PLACEHOLDER_SPRITE_SIZE = 96;

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

// Vite resolves this glob to a map of source path → hashed emitted asset URL
// at build time. `eager` resolves URLs only — it does not fetch image data;
// the texture itself is fetched by Cesium when a material first uses the URL.
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
 * Resolve the world-space affine for an anchored illustration, given the live
 * alt/az of each anchor star. Returns null when the entry cannot be anchored:
 * no `file` (placeholder-only entry, e.g. Pup / Ser / Vel), missing anchors or
 * size, any anchor star below the horizon, or a degenerate anchor triangle.
 */
function anchoredMatrix(
  entry: ConstellationArtEntry,
  lookup: AnchorStarLookup,
  lat: number,
  lon: number,
): Matrix4 | null {
  if (entry.file === null) return null;
  if (entry.size === undefined || entry.anchors === undefined) return null;
  if (entry.anchors.length < 3) return null;

  const world: Cartesian3[] = [];
  for (const a of entry.anchors.slice(0, 3)) {
    const s = lookup(a.hip);
    if (s === undefined) return null;
    world.push(altAzToCartesian(s.alt, s.az, lat, lon));
  }

  return anchorModelMatrix(entry.anchors, world, entry.size);
}

// Unit quad in model space, wound image top-left → top-right → bottom-right →
// bottom-left. The modelMatrix maps it onto the sky; see
// constellation-art-affine.ts for the mapping convention.
const QUAD_POSITIONS = new Float64Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
// Image space runs y-down, texture space runs t-up, so t is flipped.
const QUAD_ST = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]);
// The quad is flat in model space, so every vertex normal is model +Z — the
// column the affine fills with the world-space unit normal. MaterialAppearance's
// textured vertex shader declares `in vec3 normal`, and Primitive's
// validateShaderMatching throws if the geometry does not supply it.
const QUAD_NORMALS = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3]);

function buildQuad(constellation: VisibleConstellation): GeometryInstance {
  const attributes = new GeometryAttributes();
  attributes.position = new GeometryAttribute({
    componentDatatype: ComponentDatatype.DOUBLE,
    componentsPerAttribute: 3,
    values: QUAD_POSITIONS.slice(),
  });
  attributes.normal = new GeometryAttribute({
    componentDatatype: ComponentDatatype.FLOAT,
    componentsPerAttribute: 3,
    values: QUAD_NORMALS.slice(),
  });
  attributes.st = new GeometryAttribute({
    componentDatatype: ComponentDatatype.FLOAT,
    componentsPerAttribute: 2,
    values: QUAD_ST.slice(),
  });

  return new GeometryInstance({
    geometry: new Geometry({
      attributes,
      indices: QUAD_INDICES.slice(),
      primitiveType: PrimitiveType.TRIANGLES,
      boundingSphere: BoundingSphere.fromVertices(Array.from(QUAD_POSITIONS)),
    }),
    // Matches the ConstellationLayer polyline pick contract so hover / click
    // over the art resolves back to a typed constellation payload.
    id: constellation,
  });
}

/**
 * Custom fabric rather than `Material.fromType("Image")` so the layer owns a
 * scalar `alpha` uniform that `setOpacity` can drive directly on a live
 * material. `texture(...)` (not `texture2D`) matches the GLSL 300 es form
 * Cesium 1.144's own built-in materials use.
 */
function buildMaterial(image: string, alpha: number): Material {
  return new Material({
    fabric: {
      type: "ConstellationArt",
      uniforms: { image, alpha },
      components: {
        diffuse: "texture(image, materialInput.st).rgb",
        alpha: "texture(image, materialInput.st).a * alpha",
      },
    },
    translucent: true,
  });
}

/**
 * Constellation art overlay layer (issue #366, assets slice).
 *
 * When the manifest carries an image + three anchor stars for a constellation,
 * the illustration is drawn as a textured world-space quad whose model matrix
 * is the exact affine Stellarium's anchors define — position, scale, rotation
 * and shear (see ADR 018). It therefore turns with the sky and holds its
 * angular extent through zoom.
 *
 * Constellations without an anchored entry, whose anchor stars aren't
 * currently visible, or whose art asset was never emitted fall back to a
 * screen-aligned placeholder billboard at the centroid, so the layer never
 * draws a wrong-positioned illustration.
 *
 * Off by default; toggled by `?art=on` and the Settings drawer. Opacity
 * defaults to 0.35 and is URL-synced.
 */
export function createConstellationArtLayer(
  scene: Scene,
  options: CreateConstellationArtLayerOptions = {},
): ConstellationArtLayer {
  const manifest = options.manifest ?? DEFAULT_MANIFEST;

  const billboards = new BillboardCollection({ scene });
  scene.primitives.add(billboards);
  const primitives = new PrimitiveCollection();
  scene.primitives.add(primitives);
  const placeholder = generatePlaceholderSprite();

  let currentOpacity = 0.35;

  function update(
    constellations: VisibleConstellation[],
    lookup: AnchorStarLookup,
    lat: number,
    lon: number,
  ): void {
    billboards.removeAll();
    primitives.removeAll();

    for (const constellation of constellations) {
      const entry: ConstellationArtEntry = manifest.constellations[constellation.id] ?? {
        file: null,
      };
      const modelMatrix = anchoredMatrix(entry, lookup, lat, lon);
      const url = entry.file !== null ? artAssetUrl(entry.file) : null;

      if (modelMatrix !== null && url !== null) {
        primitives.add(
          new Primitive({
            geometryInstances: buildQuad(constellation),
            appearance: new MaterialAppearance({
              material: buildMaterial(url, currentOpacity),
              translucent: true,
              flat: true,
            }),
            asynchronous: false,
            modelMatrix,
          }),
        );
        continue;
      }

      billboards.add({
        position: altAzToCartesian(constellation.centroid.alt, constellation.centroid.az, lat, lon),
        image: placeholder,
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
    setCollectionVisible(primitives, visible);
  }

  function setOpacity(opacity: number): void {
    currentOpacity = opacity;
    const billboardCount = collectionLength(billboards);
    for (let i = 0; i < billboardCount; i++) {
      const bb = collectionAt<{ color: { alpha: number } }>(billboards, i);
      if (bb?.color !== undefined) {
        bb.color.alpha = opacity;
      }
    }
    const primitiveCount = collectionLength(primitives);
    for (let i = 0; i < primitiveCount; i++) {
      const p = collectionAt<{ appearance?: { material?: { uniforms?: { alpha: number } } } }>(
        primitives,
        i,
      );
      const uniforms = p?.appearance?.material?.uniforms;
      if (uniforms !== undefined) {
        uniforms.alpha = opacity;
      }
    }
  }

  return { update, setVisible, setOpacity };
}
