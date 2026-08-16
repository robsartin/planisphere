/* SPDX-License-Identifier: Apache-2.0 */
import { Cartesian3, Matrix4 } from "cesium";
import type { ConstellationArtAnchor } from "./constellation-art";

/**
 * Build the model matrix mapping a unit quad to the world-space parallelogram
 * that Stellarium's three anchors define for a constellation illustration.
 *
 * The image-pixel → world mapping is affine, so it is exactly representable
 * as a 4x4 matrix — position, scale, rotation AND shear. That exactness is
 * why the art is drawn as a textured Primitive rather than a screen-aligned
 * billboard, which can express none of the last three. See ADR 018.
 *
 * Unit-quad convention: (0,0) is the image's top-left pixel (0,0) and (1,1)
 * is its bottom-right pixel (w,h).
 *
 * `scale` uniformly shrinks (or grows) the quad **about its own centre**, so
 * the art stays centred on the same patch of sky. It is a presentation knob,
 * not part of Stellarium's alignment: at 1 the quad is exactly the size the
 * anchors dictate. Values below 1 pull the illustration in from its anchor
 * stars, which reads better at the default zoom — see ART_SCALE in
 * constellation-art.ts. Shear is preserved either way.
 *
 * Returns null when the transform is undefined — fewer than three anchors,
 * fewer than three resolved world positions, or three collinear anchor pixels
 * (a degenerate triangle). Callers fall back to the placeholder sprite.
 */
export function anchorModelMatrix(
  anchors: readonly ConstellationArtAnchor[],
  world: readonly Cartesian3[],
  size: readonly [number, number],
  scale = 1,
): Matrix4 | null {
  if (anchors.length < 3 || world.length < 3) return null;

  const [a0, a1, a2] = anchors;
  const [w0, w1, w2] = world;
  if (a0 === undefined || a1 === undefined || a2 === undefined) return null;
  if (w0 === undefined || w1 === undefined || w2 === undefined) return null;

  const [width, height] = size;

  // Pixel-space basis rooted at anchor 0.
  const e1x = a1.pos[0] - a0.pos[0];
  const e1y = a1.pos[1] - a0.pos[1];
  const e2x = a2.pos[0] - a0.pos[0];
  const e2y = a2.pos[1] - a0.pos[1];

  const det = e1x * e2y - e2x * e1y;
  if (Math.abs(det) < 1e-9) return null;

  // World-space basis for the same two pixel directions.
  const d1 = Cartesian3.subtract(w1, w0, new Cartesian3());
  const d2 = Cartesian3.subtract(w2, w0, new Cartesian3());

  // Solve for the world displacement of one pixel step along x and along y.
  // [px, py] in pixel space decomposes as α·e1 + β·e2, so the world
  // displacement is α·d1 + β·d2. Applying that to the unit vectors (1,0) and
  // (0,1) gives the per-pixel world basis.
  const perPixel = (px: number, py: number): Cartesian3 => {
    const alpha = (px * e2y - e2x * py) / det;
    const beta = (e1x * py - px * e1y) / det;
    const a = Cartesian3.multiplyByScalar(d1, alpha, new Cartesian3());
    const b = Cartesian3.multiplyByScalar(d2, beta, new Cartesian3());
    return Cartesian3.add(a, b, new Cartesian3());
  };

  // Columns 0 and 1: world displacement across the image's full width/height.
  const colX = perPixel(width, 0);
  const colY = perPixel(0, height);

  // Column 3: world position of the image's (0,0) corner — anchor 0 walked
  // back by its own pixel offset.
  const originOffset = perPixel(-a0.pos[0], -a0.pos[1]);
  const origin = Cartesian3.add(w0, originOffset, new Cartesian3());

  // Scale about the quad's centre rather than its (0,0) corner. The centre is
  // origin + (colX + colY)/2; holding it fixed while the basis shrinks means
  // pushing the origin out by half the size the quad loses.
  if (scale !== 1) {
    const inset = (1 - scale) / 2;
    Cartesian3.add(
      origin,
      Cartesian3.add(
        Cartesian3.multiplyByScalar(colX, inset, new Cartesian3()),
        Cartesian3.multiplyByScalar(colY, inset, new Cartesian3()),
        new Cartesian3(),
      ),
      origin,
    );
    Cartesian3.multiplyByScalar(colX, scale, colX);
    Cartesian3.multiplyByScalar(colY, scale, colY);
  }

  // Column 2 carries no geometric meaning — the quad is flat — but a zero
  // column would make the matrix singular, so use the unit normal.
  const normal = Cartesian3.cross(colX, colY, new Cartesian3());
  const normalMag = Cartesian3.magnitude(normal);
  if (normalMag < 1e-12) return null;
  Cartesian3.divideByScalar(normal, normalMag, normal);

  // Matrix4.fromColumnMajorArray takes columns in order: X, Y, Z, translation.
  return Matrix4.fromColumnMajorArray([
    colX.x,
    colX.y,
    colX.z,
    0,
    colY.x,
    colY.y,
    colY.z,
    0,
    normal.x,
    normal.y,
    normal.z,
    0,
    origin.x,
    origin.y,
    origin.z,
    1,
  ]);
}
