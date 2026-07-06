/* SPDX-License-Identifier: Apache-2.0 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createCompassLayer } from "./compass";

const mockGetContext = vi.fn().mockReturnValue(null);
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext =
    mockGetContext as typeof HTMLCanvasElement.prototype.getContext;
});

const mockAdd = vi.fn().mockReturnValue({ show: true });
const mockRemoveAll = vi.fn();

vi.mock("cesium", () => {
  const MockCartesian3 = vi.fn(function (x: number, y: number, z: number) {
    return {
      x,
      y,
      z,
    };
  });
  (MockCartesian3 as unknown as { fromDegrees: ReturnType<typeof vi.fn> }).fromDegrees = vi
    .fn()
    .mockReturnValue({ x: 1, y: 2, z: 3 });

  return {
    BillboardCollection: vi.fn(function () {
      return {
        add: mockAdd,
        removeAll: mockRemoveAll,
        length: 0,
        get: vi.fn().mockReturnValue({ show: true }),
      };
    }),
    Cartesian3: MockCartesian3,
    HorizontalOrigin: { CENTER: 0 },
    VerticalOrigin: { CENTER: 0 },
    Math: { toRadians: (d: number) => (d * Math.PI) / 180 },
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

function makeMockScene() {
  return { primitives: { add: vi.fn() } };
}

beforeEach(() => {
  mockAdd.mockClear();
  mockRemoveAll.mockClear();
});

describe("createCompassLayer", () => {
  it("returns an object with update and setVisible methods", () => {
    const layer = createCompassLayer(makeMockScene() as never);
    expect(layer).toHaveProperty("update");
    expect(layer).toHaveProperty("setVisible");
  });

  it("registers a BillboardCollection with scene.primitives", () => {
    const scene = makeMockScene();
    createCompassLayer(scene as never);
    expect(scene.primitives.add).toHaveBeenCalledOnce();
  });
});

describe("CompassLayer.update", () => {
  it("adds 16 direction billboards", () => {
    const layer = createCompassLayer(makeMockScene() as never);
    layer.update(33, -117);
    expect(mockRemoveAll).toHaveBeenCalledOnce();
    expect(mockAdd).toHaveBeenCalledTimes(16);
  });

  it("clears previous billboards before adding", () => {
    const layer = createCompassLayer(makeMockScene() as never);
    layer.update(33, -117);
    mockAdd.mockClear();
    mockRemoveAll.mockClear();
    layer.update(40, -74);
    expect(mockRemoveAll).toHaveBeenCalledOnce();
    expect(mockAdd).toHaveBeenCalledTimes(16);
  });
});

describe("CompassLayer.setVisible", () => {
  it("does not throw when called", () => {
    const layer = createCompassLayer(makeMockScene() as never);
    expect(() => layer.setVisible(false)).not.toThrow();
    expect(() => layer.setVisible(true)).not.toThrow();
  });
});
