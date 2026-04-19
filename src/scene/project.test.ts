/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi } from "vitest";
import type { Scene } from "cesium";
import { projectAltAzToScreen } from "./project";

vi.mock("cesium", () => {
  const Cartesian3Ctor = vi
    .fn()
    .mockImplementation((x: number, y: number, z: number) => ({ x, y, z }));
  (Cartesian3Ctor as unknown as { fromDegrees: ReturnType<typeof vi.fn> }).fromDegrees = vi
    .fn()
    .mockReturnValue({ x: 1, y: 2, z: 3 });
  return {
    SceneTransforms: {
      worldToWindowCoordinates: vi.fn().mockReturnValue({ x: 400, y: 300 }),
    },
    Cartesian3: Cartesian3Ctor,
    Math: {
      toRadians: (d: number) => (d * Math.PI) / 180,
    },
    Transforms: {
      eastNorthUpToFixedFrame: vi
        .fn()
        .mockReturnValue([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    },
    Matrix4: {
      multiplyByPoint: vi.fn().mockReturnValue({ x: 10, y: 20, z: 30 }),
    },
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
