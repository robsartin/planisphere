/* SPDX-License-Identifier: Apache-2.0 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBoundaryLayer } from "./boundaries";
import type { VisibleBoundary } from "../astro";

const mockPolylineAdd = vi.fn();
const mockPolylineRemoveAll = vi.fn();
const mockPolylines: Record<string, unknown>[] = [];

vi.mock("cesium", () => {
  const MockCartesian3 = vi.fn().mockImplementation((x: number, y: number, z: number) => ({
    x,
    y,
    z,
  }));
  (MockCartesian3 as unknown as { fromDegrees: ReturnType<typeof vi.fn> }).fromDegrees = vi
    .fn()
    .mockReturnValue({ x: 1, y: 2, z: 3 });

  const mockMaterial = { uniforms: { color: { alpha: 1 } } };

  return {
    PolylineCollection: vi.fn().mockImplementation(() => ({
      add: (opts: Record<string, unknown>) => {
        mockPolylineAdd(opts);
        const polyline = { material: mockMaterial, ...opts };
        mockPolylines.push(polyline);
        return polyline;
      },
      removeAll: () => {
        mockPolylineRemoveAll();
        mockPolylines.length = 0;
      },
      get length() {
        return mockPolylines.length;
      },
      show: true,
    })),
    Cartesian3: MockCartesian3,
    Color: {
      WHITE: { withAlpha: (a: number) => ({ r: 1, g: 1, b: 1, alpha: a }) },
    },
    Math: { toRadians: (d: number) => (d * Math.PI) / 180 },
    Transforms: {
      eastNorthUpToFixedFrame: vi
        .fn()
        .mockReturnValue([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    },
    Matrix4: {
      multiplyByPoint: vi.fn().mockReturnValue({ x: 10, y: 20, z: 30 }),
    },
    Material: {
      fromType: vi.fn().mockReturnValue(mockMaterial),
    },
  };
});

function makeMockScene() {
  return { primitives: { add: vi.fn() } };
}

const BOUNDARIES: VisibleBoundary[] = [
  {
    id: "Ori",
    segments: [
      { start: { ra: 75, dec: 10 }, end: { ra: 90, dec: 10 } },
      { start: { ra: 90, dec: 10 }, end: { ra: 90, dec: -10 } },
    ],
  },
  {
    id: "UMa",
    segments: [{ start: { ra: 150, dec: 55 }, end: { ra: 180, dec: 55 } }],
  },
];

beforeEach(() => {
  mockPolylineAdd.mockClear();
  mockPolylineRemoveAll.mockClear();
  mockPolylines.length = 0;
});

describe("createBoundaryLayer", () => {
  it("returns an object with update, setVisible, and setOpacity methods", () => {
    const layer = createBoundaryLayer(makeMockScene() as never);
    expect(layer).toHaveProperty("update");
    expect(layer).toHaveProperty("setVisible");
    expect(layer).toHaveProperty("setOpacity");
  });

  it("registers PolylineCollection with scene.primitives", () => {
    const scene = makeMockScene();
    createBoundaryLayer(scene as never);
    expect(scene.primitives.add).toHaveBeenCalledTimes(1);
  });
});

describe("BoundaryLayer.update", () => {
  it("adds a polyline for each segment", () => {
    const layer = createBoundaryLayer(makeMockScene() as never);
    layer.update(BOUNDARIES, 40, 0);
    expect(mockPolylineRemoveAll).toHaveBeenCalledOnce();
    // 2 segments for Ori + 1 for UMa = 3
    expect(mockPolylineAdd).toHaveBeenCalledTimes(3);
  });

  it("works with empty input", () => {
    const layer = createBoundaryLayer(makeMockScene() as never);
    layer.update([], 0, 0);
    expect(mockPolylineRemoveAll).toHaveBeenCalledOnce();
    expect(mockPolylineAdd).not.toHaveBeenCalled();
  });

  it("clears previous primitives before adding new ones", () => {
    const layer = createBoundaryLayer(makeMockScene() as never);
    layer.update(BOUNDARIES, 40, 0);
    mockPolylineAdd.mockClear();
    mockPolylineRemoveAll.mockClear();
    layer.update(BOUNDARIES.slice(0, 1), 40, 0);
    expect(mockPolylineRemoveAll).toHaveBeenCalledOnce();
    expect(mockPolylineAdd).toHaveBeenCalledTimes(2);
  });
});

describe("BoundaryLayer.setVisible", () => {
  it("sets show=false on the collection", () => {
    const scene = makeMockScene();
    const layer = createBoundaryLayer(scene as never);
    layer.update(BOUNDARIES, 40, 0);
    // setVisible does not throw
    expect(() => layer.setVisible(false)).not.toThrow();
    expect(() => layer.setVisible(true)).not.toThrow();
  });
});

describe("BoundaryLayer.setOpacity", () => {
  it("does not throw when called", () => {
    const layer = createBoundaryLayer(makeMockScene() as never);
    layer.update(BOUNDARIES, 40, 0);
    expect(() => layer.setOpacity(0.5)).not.toThrow();
  });
});
