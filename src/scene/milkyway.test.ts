/* SPDX-License-Identifier: Apache-2.0 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMilkyWayLayer } from "./milkyway";
import type { HorizontalCoord } from "../astro/coords";

const mockPolylineAdd = vi.fn();
const mockPolylineRemoveAll = vi.fn();
const mockPolylines: Array<{ material: { uniforms: { color: { alpha: number } } } }> = [];

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
        mockPolylines.push(polyline as never);
        return polyline;
      },
      removeAll: () => {
        mockPolylineRemoveAll();
        mockPolylines.length = 0;
      },
      show: true,
    })),
    Cartesian3: MockCartesian3,
    Color: {
      WHITE: { withAlpha: (a: number) => ({ r: 1, g: 1, b: 1, alpha: a }) },
      fromCssColorString: vi.fn().mockReturnValue({
        withAlpha: (a: number) => ({ alpha: a }),
      }),
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

const SAMPLE_POINTS: HorizontalCoord[] = [
  { alt: 45, az: 180 },
  { alt: 40, az: 170 },
  { alt: 35, az: 160 },
  { alt: 30, az: 150 },
];

beforeEach(() => {
  mockPolylineAdd.mockClear();
  mockPolylineRemoveAll.mockClear();
  mockPolylines.length = 0;
});

describe("createMilkyWayLayer", () => {
  it("returns an object with update and setOpacity methods", () => {
    const layer = createMilkyWayLayer(makeMockScene() as never);
    expect(layer).toHaveProperty("update");
    expect(layer).toHaveProperty("setOpacity");
  });

  it("registers PolylineCollection with scene.primitives", () => {
    const scene = makeMockScene();
    createMilkyWayLayer(scene as never);
    expect(scene.primitives.add).toHaveBeenCalledTimes(1);
  });
});

describe("MilkyWayLayer.update", () => {
  it("adds a single polyline for the milky way points", () => {
    const layer = createMilkyWayLayer(makeMockScene() as never);
    layer.update(SAMPLE_POINTS, 33, -117);
    expect(mockPolylineRemoveAll).toHaveBeenCalledOnce();
    expect(mockPolylineAdd).toHaveBeenCalledTimes(1);
  });

  it("works with empty points array", () => {
    const layer = createMilkyWayLayer(makeMockScene() as never);
    layer.update([], 0, 0);
    expect(mockPolylineRemoveAll).toHaveBeenCalledOnce();
    expect(mockPolylineAdd).not.toHaveBeenCalled();
  });

  it("does not add a polyline for a single point", () => {
    const layer = createMilkyWayLayer(makeMockScene() as never);
    layer.update([{ alt: 45, az: 180 }], 33, -117);
    expect(mockPolylineAdd).not.toHaveBeenCalled();
  });

  it("clears previous polylines before adding new ones", () => {
    const layer = createMilkyWayLayer(makeMockScene() as never);
    layer.update(SAMPLE_POINTS, 33, -117);
    mockPolylineAdd.mockClear();
    mockPolylineRemoveAll.mockClear();
    layer.update(SAMPLE_POINTS.slice(0, 3), 33, -117);
    expect(mockPolylineRemoveAll).toHaveBeenCalledOnce();
    expect(mockPolylineAdd).toHaveBeenCalledTimes(1);
  });

  it("uses width of 3 for the polyline", () => {
    const layer = createMilkyWayLayer(makeMockScene() as never);
    layer.update(SAMPLE_POINTS, 33, -117);
    const callArg = mockPolylineAdd.mock.calls[0]![0] as { width: number };
    expect(callArg.width).toBe(3);
  });
});

describe("MilkyWayLayer.setOpacity", () => {
  it("does not throw when setOpacity is called", () => {
    const layer = createMilkyWayLayer(makeMockScene() as never);
    layer.update(SAMPLE_POINTS, 33, -117);
    expect(() => layer.setOpacity(0.5)).not.toThrow();
  });

  it("hides polylines when opacity is 0", () => {
    const layer = createMilkyWayLayer(makeMockScene() as never);
    layer.update(SAMPLE_POINTS, 33, -117);
    expect(() => layer.setOpacity(0)).not.toThrow();
  });

  it("does not throw when called before update", () => {
    const layer = createMilkyWayLayer(makeMockScene() as never);
    expect(() => layer.setOpacity(0.3)).not.toThrow();
  });
});
