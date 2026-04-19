/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi } from "vitest";
import type { Scene } from "cesium";
import { projectAltAzToScreen, screenToAltAz } from "./project";

vi.mock("cesium", () => {
  const Cartesian3Ctor = vi
    .fn()
    .mockImplementation((x: number, y: number, z: number) => ({ x, y, z }));
  (Cartesian3Ctor as unknown as { fromDegrees: ReturnType<typeof vi.fn> }).fromDegrees = vi
    .fn()
    .mockReturnValue({ x: 1, y: 2, z: 3 });
  (Cartesian3Ctor as unknown as { normalize: ReturnType<typeof vi.fn> }).normalize = vi
    .fn()
    .mockImplementation((v: { x: number; y: number; z: number }) => {
      const n = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      if (n === 0) return { x: 0, y: 0, z: 0 };
      return { x: v.x / n, y: v.y / n, z: v.z / n };
    });
  return {
    SceneTransforms: {
      worldToWindowCoordinates: vi.fn().mockReturnValue({ x: 400, y: 300 }),
    },
    Cartesian3: Cartesian3Ctor,
    Math: {
      toRadians: (d: number) => (d * Math.PI) / 180,
      toDegrees: (r: number) => (r * 180) / Math.PI,
    },
    Transforms: {
      eastNorthUpToFixedFrame: vi.fn().mockImplementation(() => ({ __enuToFixed: true })),
    },
    Matrix4: Object.assign(
      vi.fn().mockImplementation(() => ({})),
      {
        multiplyByPoint: vi.fn().mockReturnValue({ x: 10, y: 20, z: 30 }),
        // multiplyByPointAsVector ignores translation; the mock treats any matrix
        // produced by eastNorthUpToFixedFrame as identity (i.e. world-space direction
        // IS the ENU direction). That matches the test viewer pinned to (lat=0, lon=0)
        // where the canonical ENU axes in the test align with world axes.
        multiplyByPointAsVector: vi
          .fn()
          .mockImplementation((_m: unknown, v: { x: number; y: number; z: number }) => ({
            x: v.x,
            y: v.y,
            z: v.z,
          })),
        inverseTransformation: vi
          .fn()
          .mockImplementation((_m: unknown) => ({ __fixedToEnu: true })),
      },
    ),
  };
});

function makeScene(width: number, height: number): Scene {
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "clientWidth", { value: width });
  Object.defineProperty(canvas, "clientHeight", { value: height });
  return { canvas } as unknown as Scene;
}

describe("projectAltAzToScreen", () => {
  it("returns the window coordinates from SceneTransforms", () => {
    const scene = makeScene(800, 600);
    const result = projectAltAzToScreen(scene, 45, 180, 34, -118);
    expect(result).not.toBeNull();
    expect(result?.x).toBe(400);
    expect(result?.y).toBe(300);
  });

  it("marks the point on-screen when within canvas bounds", () => {
    const scene = makeScene(800, 600);
    const result = projectAltAzToScreen(scene, 45, 180, 34, -118);
    expect(result?.onScreen).toBe(true);
  });

  it("marks the point off-screen when SceneTransforms returns coords outside the canvas", async () => {
    const cesium = await import("cesium");
    (
      cesium.SceneTransforms.worldToWindowCoordinates as unknown as {
        mockReturnValueOnce: (v: unknown) => void;
      }
    ).mockReturnValueOnce({ x: -50, y: 1000 });
    const scene = makeScene(800, 600);
    const result = projectAltAzToScreen(scene, 45, 180, 34, -118);
    expect(result?.onScreen).toBe(false);
  });

  it("returns null when Cesium cannot project the point", async () => {
    const cesium = await import("cesium");
    (
      cesium.SceneTransforms.worldToWindowCoordinates as unknown as {
        mockReturnValueOnce: (v: unknown) => void;
      }
    ).mockReturnValueOnce(undefined);
    const scene = makeScene(800, 600);
    const result = projectAltAzToScreen(scene, 45, 180, 34, -118);
    expect(result).toBeNull();
  });
});

/** Build a scene whose camera.getPickRay returns a ray with direction (east, north, up). */
function makeSceneWithRay(direction: { x: number; y: number; z: number } | undefined): Scene {
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "clientWidth", { value: 800 });
  Object.defineProperty(canvas, "clientHeight", { value: 600 });
  const getPickRay = vi
    .fn()
    .mockReturnValue(
      direction === undefined ? undefined : { origin: { x: 0, y: 0, z: 0 }, direction },
    );
  return {
    canvas,
    camera: { getPickRay },
  } as unknown as Scene;
}

describe("screenToAltAz", () => {
  it("returns alt=90, az=0 (zenith) for a ray pointing straight up in ENU", () => {
    // In local ENU (east=x, north=y, up=z), "straight up" is (0, 0, 1).
    const scene = makeSceneWithRay({ x: 0, y: 0, z: 1 });
    const result = screenToAltAz(scene, 400, 300, 0, 0);
    expect(result).not.toBeNull();
    expect(result!.alt).toBeCloseTo(90, 5);
  });

  it("returns alt=0, az=0 (due north, horizon) for a ray pointing north in ENU", () => {
    const scene = makeSceneWithRay({ x: 0, y: 1, z: 0 });
    const result = screenToAltAz(scene, 400, 300, 0, 0);
    expect(result).not.toBeNull();
    expect(result!.alt).toBeCloseTo(0, 5);
    // azimuth: 0° = north
    expect(result!.az).toBeCloseTo(0, 5);
  });

  it("returns alt=0, az=90 (due east, horizon) for a ray pointing east in ENU", () => {
    const scene = makeSceneWithRay({ x: 1, y: 0, z: 0 });
    const result = screenToAltAz(scene, 400, 300, 0, 0);
    expect(result).not.toBeNull();
    expect(result!.alt).toBeCloseTo(0, 5);
    expect(result!.az).toBeCloseTo(90, 5);
  });

  it("returns alt=0, az=180 (due south) for a ray pointing south in ENU", () => {
    const scene = makeSceneWithRay({ x: 0, y: -1, z: 0 });
    const result = screenToAltAz(scene, 400, 300, 0, 0);
    expect(result).not.toBeNull();
    expect(result!.alt).toBeCloseTo(0, 5);
    expect(result!.az).toBeCloseTo(180, 5);
  });

  it("returns az normalized to [0, 360) for a ray pointing west in ENU", () => {
    const scene = makeSceneWithRay({ x: -1, y: 0, z: 0 });
    const result = screenToAltAz(scene, 400, 300, 0, 0);
    expect(result).not.toBeNull();
    expect(result!.az).toBeCloseTo(270, 5);
  });

  it("handles a 45° up-and-north ray", () => {
    const c = Math.SQRT1_2;
    const scene = makeSceneWithRay({ x: 0, y: c, z: c });
    const result = screenToAltAz(scene, 400, 300, 0, 0);
    expect(result).not.toBeNull();
    expect(result!.alt).toBeCloseTo(45, 4);
    expect(result!.az).toBeCloseTo(0, 4);
  });

  it("returns null when Cesium cannot produce a pick ray", () => {
    const scene = makeSceneWithRay(undefined);
    const result = screenToAltAz(scene, 400, 300, 0, 0);
    expect(result).toBeNull();
  });
});
