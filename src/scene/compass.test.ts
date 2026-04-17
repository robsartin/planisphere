/* SPDX-License-Identifier: Apache-2.0 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCompassLayer } from "./compass";

const mockAdd = vi.fn();
const mockRemoveAll = vi.fn();

vi.mock("cesium", () => {
  const MockCartesian3 = vi.fn().mockImplementation((x: number, y: number, z: number) => ({
    x,
    y,
    z,
  }));
  (MockCartesian3 as unknown as { fromDegrees: ReturnType<typeof vi.fn> }).fromDegrees = vi
    .fn()
    .mockReturnValue({ x: 1, y: 2, z: 3 });

  return {
    LabelCollection: vi.fn().mockImplementation(() => ({
      add: mockAdd,
      removeAll: mockRemoveAll,
    })),
    Cartesian3: MockCartesian3,
    Color: {
      WHITE: { withAlpha: (a: number) => ({ alpha: a }) },
    },
    HorizontalOrigin: { CENTER: 0 },
    VerticalOrigin: { CENTER: 0 },
    LabelStyle: { FILL: 0 },
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
  it("returns an object with an update method", () => {
    const layer = createCompassLayer(makeMockScene() as never);
    expect(layer).toHaveProperty("update");
  });

  it("registers a LabelCollection with scene.primitives", () => {
    const scene = makeMockScene();
    createCompassLayer(scene as never);
    expect(scene.primitives.add).toHaveBeenCalledOnce();
  });
});

describe("CompassLayer.update", () => {
  it("adds 8 direction labels", () => {
    const layer = createCompassLayer(makeMockScene() as never);
    layer.update(33, -117);
    expect(mockRemoveAll).toHaveBeenCalledOnce();
    expect(mockAdd).toHaveBeenCalledTimes(16);
  });

  it("cardinal directions use bold font", () => {
    const layer = createCompassLayer(makeMockScene() as never);
    layer.update(33, -117);
    const nCall = mockAdd.mock.calls[0]![0] as { text: string; font: string };
    expect(nCall.text).toBe("N");
    expect(nCall.font).toContain("bold");
  });

  it("secondary intercardinal directions use smallest font", () => {
    const layer = createCompassLayer(makeMockScene() as never);
    layer.update(33, -117);
    const nneCall = mockAdd.mock.calls[1]![0] as { text: string; font: string };
    expect(nneCall.text).toBe("NNE");
    expect(nneCall.font).toContain("12px");
  });

  it("intercardinal directions use regular font", () => {
    const layer = createCompassLayer(makeMockScene() as never);
    layer.update(33, -117);
    const neCall = mockAdd.mock.calls[2]![0] as { text: string; font: string };
    expect(neCall.text).toBe("NE");
    expect(neCall.font).toContain("14px");
  });

  it("clears previous labels before adding", () => {
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
  it("has a setVisible method", () => {
    const layer = createCompassLayer(makeMockScene() as never);
    expect(layer).toHaveProperty("setVisible");
    expect(typeof layer.setVisible).toBe("function");
  });

  it("does not throw when called with true or false", () => {
    const layer = createCompassLayer(makeMockScene() as never);
    expect(() => layer.setVisible(false)).not.toThrow();
    expect(() => layer.setVisible(true)).not.toThrow();
  });
});
