/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { Cartesian3, Cartesian4, Matrix4 } from "cesium";
import { anchorModelMatrix } from "./constellation-art-affine";
import type { ConstellationArtAnchor } from "./constellation-art";

const SIZE: readonly [number, number] = [512, 512];

function anchor(x: number, y: number, hip: number): ConstellationArtAnchor {
  return { pos: [x, y], hip };
}

/** Map a unit-quad corner through the matrix. */
function corner(m: Matrix4, s: number, t: number): Cartesian3 {
  return Matrix4.multiplyByPoint(m, new Cartesian3(s, t, 0), new Cartesian3());
}

function expectClose(actual: Cartesian3, x: number, y: number, z: number): void {
  expect(actual.x).toBeCloseTo(x, 6);
  expect(actual.y).toBeCloseTo(y, 6);
  expect(actual.z).toBeCloseTo(z, 6);
}

describe("anchorModelMatrix", () => {
  it("maps the unit quad onto an axis-aligned world rectangle", () => {
    // Anchor pixels at the image's top-left, top-right, and bottom-left,
    // mapped to a 10x20 rectangle in the world XY plane. The unit quad's
    // corners must land exactly on that rectangle's corners.
    const anchors = [anchor(0, 0, 1), anchor(512, 0, 2), anchor(0, 512, 3)];
    const world = [new Cartesian3(0, 0, 0), new Cartesian3(10, 0, 0), new Cartesian3(0, 20, 0)];

    const m = anchorModelMatrix(anchors, world, SIZE);
    expect(m).not.toBeNull();
    if (m === null) return;

    expectClose(corner(m, 0, 0), 0, 0, 0);
    expectClose(corner(m, 1, 0), 10, 0, 0);
    expectClose(corner(m, 0, 1), 0, 20, 0);
    expectClose(corner(m, 1, 1), 10, 20, 0);
  });

  it("preserves shear — the reason this is a Primitive and not a billboard", () => {
    // Same anchor pixels, but the world triangle is sheared: the "down" edge
    // leans +5 in x. A similarity transform cannot express this; the affine
    // must carry it through to the far corner.
    const anchors = [anchor(0, 0, 1), anchor(512, 0, 2), anchor(0, 512, 3)];
    const world = [new Cartesian3(0, 0, 0), new Cartesian3(10, 0, 0), new Cartesian3(5, 20, 0)];

    const m = anchorModelMatrix(anchors, world, SIZE);
    expect(m).not.toBeNull();
    if (m === null) return;

    expectClose(corner(m, 0, 1), 5, 20, 0);
    expectClose(corner(m, 1, 1), 15, 20, 0);
  });

  it("handles anchors that are not at the image corners", () => {
    // Real Stellarium anchors sit on stars, anywhere in the image. Anchors at
    // pixel (128,128) and (384,128) span half the width, so the full-width
    // world displacement must be twice their world separation.
    const anchors = [anchor(128, 128, 1), anchor(384, 128, 2), anchor(128, 384, 3)];
    const world = [new Cartesian3(1, 1, 0), new Cartesian3(3, 1, 0), new Cartesian3(1, 5, 0)];

    const m = anchorModelMatrix(anchors, world, SIZE);
    expect(m).not.toBeNull();
    if (m === null) return;

    // Pixel (128,128) is at unit-quad (0.25, 0.25) and must map to its world anchor.
    expectClose(corner(m, 0.25, 0.25), 1, 1, 0);
    expectClose(corner(m, 0.75, 0.25), 3, 1, 0);
    expectClose(corner(m, 0.25, 0.75), 1, 5, 0);
  });

  it("returns null when the three anchor pixels are collinear", () => {
    const anchors = [anchor(0, 0, 1), anchor(256, 256, 2), anchor(512, 512, 3)];
    const world = [new Cartesian3(0, 0, 0), new Cartesian3(1, 1, 0), new Cartesian3(2, 2, 0)];
    expect(anchorModelMatrix(anchors, world, SIZE)).toBeNull();
  });

  it("returns null when fewer than three anchors are supplied", () => {
    const anchors = [anchor(0, 0, 1), anchor(512, 0, 2)];
    const world = [new Cartesian3(0, 0, 0), new Cartesian3(10, 0, 0)];
    expect(anchorModelMatrix(anchors, world, SIZE)).toBeNull();
  });

  it("returns null when fewer than three world positions are supplied", () => {
    const anchors = [anchor(0, 0, 1), anchor(512, 0, 2), anchor(0, 512, 3)];
    const world = [new Cartesian3(0, 0, 0), new Cartesian3(10, 0, 0)];
    expect(anchorModelMatrix(anchors, world, SIZE)).toBeNull();
  });

  it("produces a non-singular matrix (third column is a real normal)", () => {
    const anchors = [anchor(0, 0, 1), anchor(512, 0, 2), anchor(0, 512, 3)];
    const world = [new Cartesian3(0, 0, 0), new Cartesian3(10, 0, 0), new Cartesian3(0, 20, 0)];
    const m = anchorModelMatrix(anchors, world, SIZE);
    expect(m).not.toBeNull();
    if (m === null) return;
    // A singular model matrix collapses the quad; guard against it explicitly.
    expect(Math.abs(Matrix4.getMaximumScale(m))).toBeGreaterThan(0);
    const normal = Matrix4.getColumn(m, 2, new Cartesian4());
    expect(Cartesian3.magnitude(Cartesian3.fromCartesian4(normal, new Cartesian3()))).toBeCloseTo(
      1,
      6,
    );
  });

  it("returns null when an anchor element is missing despite a length-3 array", () => {
    // Defensive guard for a sparse array — TypeScript's type says
    // ConstellationArtAnchor, but a caller passing loosely-typed data could
    // still produce a hole. Cast through unknown to construct that shape.
    const anchors = [
      anchor(0, 0, 1),
      undefined,
      anchor(0, 512, 3),
    ] as unknown as ConstellationArtAnchor[];
    const world = [new Cartesian3(0, 0, 0), new Cartesian3(10, 0, 0), new Cartesian3(0, 20, 0)];
    expect(anchorModelMatrix(anchors, world, SIZE)).toBeNull();
  });

  it("returns null when a world position element is missing despite a length-3 array", () => {
    const anchors = [anchor(0, 0, 1), anchor(512, 0, 2), anchor(0, 512, 3)];
    const world = [
      new Cartesian3(0, 0, 0),
      undefined,
      new Cartesian3(0, 20, 0),
    ] as unknown as Cartesian3[];
    expect(anchorModelMatrix(anchors, world, SIZE)).toBeNull();
  });

  it("returns null when the three world positions are collinear even though the anchor pixels are not", () => {
    // Anchor pixels form a valid right triangle, but the world positions all
    // sit on the same line — the two world basis vectors are parallel, so
    // their cross product (the matrix's normal column) collapses to zero.
    const anchors = [anchor(0, 0, 1), anchor(512, 0, 2), anchor(0, 512, 3)];
    const world = [new Cartesian3(0, 0, 0), new Cartesian3(1, 0, 0), new Cartesian3(2, 0, 0)];
    expect(anchorModelMatrix(anchors, world, SIZE)).toBeNull();
  });
});
