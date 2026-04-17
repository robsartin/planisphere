/* SPDX-License-Identifier: Apache-2.0 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSatelliteLayer } from "./satellites";
import type { VisibleSatellite } from "../sat";

const mockGetContext = vi.fn().mockReturnValue(null);
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext =
    mockGetContext as typeof HTMLCanvasElement.prototype.getContext;
});

const mockBillboardAdd = vi.fn().mockReturnValue({ show: true });
const mockBillboardRemoveAll = vi.fn();
const mockPolylineAdd = vi.fn();
const mockPolylineRemoveAll = vi.fn();

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
    BillboardCollection: vi.fn().mockImplementation(() => ({
      add: mockBillboardAdd,
      removeAll: mockBillboardRemoveAll,
      length: 0,
    })),
    PolylineCollection: vi.fn().mockImplementation(() => ({
      add: mockPolylineAdd,
      removeAll: mockPolylineRemoveAll,
    })),
    Cartesian3: MockCartesian3,
    Color: {
      fromCssColorString: vi.fn().mockReturnValue({ withAlpha: (a: number) => ({ alpha: a }) }),
    },
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
    Material: { fromType: vi.fn().mockReturnValue({}) },
  };
});

function makeMockScene() {
  return { primitives: { add: vi.fn() } };
}

const SATS: VisibleSatellite[] = [
  {
    name: "ISS (ZARYA)",
    noradId: 25544,
    alt: 45,
    az: 200,
    height: 420,
    velocity: 7.66,
    trail: [
      { alt: 40, az: 195 },
      { alt: 42, az: 197 },
      { alt: 44, az: 199 },
    ],
  },
  {
    name: "HUBBLE",
    noradId: 20580,
    alt: 30,
    az: 150,
    height: 540,
    velocity: 7.59,
    trail: [{ alt: 28, az: 148 }],
  },
];

beforeEach(() => {
  mockBillboardAdd.mockClear();
  mockBillboardRemoveAll.mockClear();
  mockPolylineAdd.mockClear();
  mockPolylineRemoveAll.mockClear();
});

describe("createSatelliteLayer", () => {
  it("returns an object with an update method", () => {
    const layer = createSatelliteLayer(makeMockScene() as never);
    expect(layer).toHaveProperty("update");
  });

  it("registers collections with scene.primitives", () => {
    const scene = makeMockScene();
    createSatelliteLayer(scene as never);
    expect(scene.primitives.add).toHaveBeenCalledTimes(2);
  });
});

describe("SatelliteLayer.update", () => {
  it("adds a billboard for each satellite", () => {
    const layer = createSatelliteLayer(makeMockScene() as never);
    layer.update(SATS, 33, -117);
    expect(mockBillboardRemoveAll).toHaveBeenCalledOnce();
    expect(mockBillboardAdd).toHaveBeenCalledTimes(2);
  });

  it("adds a polyline for each satellite trail", () => {
    const layer = createSatelliteLayer(makeMockScene() as never);
    layer.update(SATS, 33, -117);
    expect(mockPolylineRemoveAll).toHaveBeenCalledOnce();
    // Only the first satellite has >= 2 trail points
    expect(mockPolylineAdd).toHaveBeenCalledTimes(1);
  });

  it("works with empty input", () => {
    const layer = createSatelliteLayer(makeMockScene() as never);
    layer.update([], 0, 0);
    expect(mockBillboardAdd).not.toHaveBeenCalled();
    expect(mockPolylineAdd).not.toHaveBeenCalled();
  });

  it("clears previous before adding", () => {
    const layer = createSatelliteLayer(makeMockScene() as never);
    layer.update(SATS, 33, -117);
    mockBillboardAdd.mockClear();
    mockPolylineAdd.mockClear();
    mockBillboardRemoveAll.mockClear();
    mockPolylineRemoveAll.mockClear();
    layer.update(SATS.slice(0, 1), 33, -117);
    expect(mockBillboardRemoveAll).toHaveBeenCalledOnce();
    expect(mockPolylineRemoveAll).toHaveBeenCalledOnce();
    expect(mockBillboardAdd).toHaveBeenCalledTimes(1);
    // First satellite has >= 2 trail points, so polyline is added
    expect(mockPolylineAdd).toHaveBeenCalledTimes(1);
  });
});
