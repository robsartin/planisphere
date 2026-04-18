/* SPDX-License-Identifier: Apache-2.0 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTrailLayer } from "./trail-layer";
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

  const makeMaterial = (): { uniforms: { color: { alpha: number } } } => ({
    uniforms: { color: { alpha: 1 } },
  });

  return {
    PolylineCollection: vi.fn().mockImplementation(() => ({
      add: (opts: Record<string, unknown>) => {
        mockPolylineAdd(opts);
        const polyline = { material: makeMaterial(), ...opts };
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
      fromType: vi.fn().mockImplementation(() => ({ uniforms: { color: { alpha: 1 } } })),
    },
  };
});

function makeMockScene() {
  return { primitives: { add: vi.fn() } };
}

const SAMPLE: HorizontalCoord[] = [
  { alt: 45, az: 180 },
  { alt: 40, az: 190 },
  { alt: 35, az: 200 },
  { alt: 30, az: 210 },
];

beforeEach(() => {
  mockPolylineAdd.mockClear();
  mockPolylineRemoveAll.mockClear();
  mockPolylines.length = 0;
});

describe("createTrailLayer", () => {
  it("returns an object with show, hide, and setPoints methods", () => {
    const layer = createTrailLayer(makeMockScene() as never);
    expect(layer).toHaveProperty("show");
    expect(layer).toHaveProperty("hide");
    expect(layer).toHaveProperty("setPoints");
  });

  it("registers PolylineCollection with scene.primitives", () => {
    const scene = makeMockScene();
    createTrailLayer(scene as never);
    expect(scene.primitives.add).toHaveBeenCalledTimes(1);
  });

  it("setPoints adds a single polyline for sample points", () => {
    const layer = createTrailLayer(makeMockScene() as never);
    layer.setPoints(SAMPLE, 33, -117);
    expect(mockPolylineRemoveAll).toHaveBeenCalledOnce();
    expect(mockPolylineAdd).toHaveBeenCalledTimes(1);
  });

  it("setPoints with empty array adds no polyline", () => {
    const layer = createTrailLayer(makeMockScene() as never);
    layer.setPoints([], 0, 0);
    expect(mockPolylineAdd).not.toHaveBeenCalled();
  });

  it("setPoints with a single point adds no polyline", () => {
    const layer = createTrailLayer(makeMockScene() as never);
    layer.setPoints([{ alt: 45, az: 180 }], 33, -117);
    expect(mockPolylineAdd).not.toHaveBeenCalled();
  });

  it("setPoints clears previous polyline before adding new one", () => {
    const layer = createTrailLayer(makeMockScene() as never);
    layer.setPoints(SAMPLE, 33, -117);
    mockPolylineAdd.mockClear();
    mockPolylineRemoveAll.mockClear();
    layer.setPoints(SAMPLE.slice(0, 3), 33, -117);
    expect(mockPolylineRemoveAll).toHaveBeenCalledOnce();
    expect(mockPolylineAdd).toHaveBeenCalledTimes(1);
  });

  it("hide() does not throw", () => {
    const layer = createTrailLayer(makeMockScene() as never);
    layer.setPoints(SAMPLE, 33, -117);
    expect(() => layer.hide()).not.toThrow();
  });

  it("show() does not throw", () => {
    const layer = createTrailLayer(makeMockScene() as never);
    layer.setPoints(SAMPLE, 33, -117);
    layer.hide();
    expect(() => layer.show()).not.toThrow();
  });

  it("hide() before setPoints does not throw", () => {
    const layer = createTrailLayer(makeMockScene() as never);
    expect(() => layer.hide()).not.toThrow();
  });

  it("uses a dashed material so trail is visually distinct", () => {
    const layer = createTrailLayer(makeMockScene() as never);
    layer.setPoints(SAMPLE, 33, -117);
    // The polyline should have been configured with a Material (dashed or polyline-specific).
    // At minimum, the add call should include a material option.
    const call = mockPolylineAdd.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(call).toBeDefined();
    expect(call!.material).toBeDefined();
  });
});
