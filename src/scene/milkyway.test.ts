/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";
import { createMilkyWayLayer } from "./milkyway";
import type { HorizontalCoord } from "../astro/coords";

// jsdom does not implement HTMLCanvasElement.prototype.getContext; stub it out
// so tests run without noisy "not implemented" errors. Default: returns null
// (fallback path). Individual tests can override to exercise the drawing path.
const mockGetContext = vi.fn().mockReturnValue(null);
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext =
    mockGetContext as typeof HTMLCanvasElement.prototype.getContext;
});

const mockBillboardAdd = vi.fn().mockReturnValue({ show: true });
const mockRemoveAll = vi.fn();
let mockLength = 0;
const mockGet = vi.fn().mockImplementation((i: number) => {
  void i;
  return { show: true };
});

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
      removeAll: mockRemoveAll,
      get length() {
        return mockLength;
      },
      get: mockGet,
    })),
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
  return {
    primitives: { add: vi.fn() },
  };
}

const POINTS: HorizontalCoord[] = [
  { alt: 45, az: 180 },
  { alt: 30, az: 90 },
  { alt: 60, az: 270 },
];

beforeEach(() => {
  mockBillboardAdd.mockClear();
  mockRemoveAll.mockClear();
  mockGet.mockClear();
  mockLength = 0;
});

describe("createMilkyWayLayer", () => {
  it("returns an object with update and setOpacity methods", () => {
    const scene = makeMockScene();
    const layer = createMilkyWayLayer(scene as never);
    expect(layer).toBeDefined();
    expect(layer).toHaveProperty("update");
    expect(layer).toHaveProperty("setOpacity");
    expect(typeof layer.update).toBe("function");
    expect(typeof layer.setOpacity).toBe("function");
  });

  it("registers a BillboardCollection with scene.primitives", () => {
    const scene = makeMockScene();
    createMilkyWayLayer(scene as never);
    expect(scene.primitives.add).toHaveBeenCalledOnce();
  });
});

describe("MilkyWayLayer.update", () => {
  it("adds a billboard for each point", () => {
    const scene = makeMockScene();
    const layer = createMilkyWayLayer(scene as never);
    layer.update(POINTS, 37, -122);
    expect(mockRemoveAll).toHaveBeenCalledOnce();
    expect(mockBillboardAdd).toHaveBeenCalledTimes(3);
  });

  it("clears existing billboards before adding new ones", () => {
    const scene = makeMockScene();
    const layer = createMilkyWayLayer(scene as never);
    layer.update(POINTS, 37, -122);
    mockBillboardAdd.mockClear();
    mockRemoveAll.mockClear();
    layer.update(POINTS.slice(0, 1), 37, -122);
    expect(mockRemoveAll).toHaveBeenCalledOnce();
    expect(mockBillboardAdd).toHaveBeenCalledTimes(1);
  });

  it("empty input results in no billboards added", () => {
    const scene = makeMockScene();
    const layer = createMilkyWayLayer(scene as never);
    layer.update([], 37, -122);
    expect(mockRemoveAll).toHaveBeenCalledOnce();
    expect(mockBillboardAdd).not.toHaveBeenCalled();
  });

  it("passes position to each billboard", () => {
    const scene = makeMockScene();
    const layer = createMilkyWayLayer(scene as never);
    layer.update(POINTS, 37, -122);
    const firstCall = mockBillboardAdd.mock.calls[0];
    expect(firstCall).toBeDefined();
    const callArgs = firstCall![0] as { position: unknown };
    expect(callArgs.position).toBeDefined();
  });

  it("passes scale 8 to each billboard for the glow effect", () => {
    const scene = makeMockScene();
    const layer = createMilkyWayLayer(scene as never);
    layer.update(POINTS, 37, -122);
    const firstCall = mockBillboardAdd.mock.calls[0];
    expect(firstCall).toBeDefined();
    const callArgs = firstCall![0] as { scale: number };
    expect(callArgs.scale).toBe(8);
  });
});

describe("MilkyWayLayer.setOpacity", () => {
  it("hides all billboards when opacity is 0", () => {
    const scene = makeMockScene();
    const layer = createMilkyWayLayer(scene as never);
    const fakeBillboards = [{ show: true }, { show: true }];
    mockLength = fakeBillboards.length;
    mockGet.mockImplementation((i: number) => fakeBillboards[i]);
    layer.update(POINTS.slice(0, 2), 37, -122);
    layer.setOpacity(0);
    for (const bb of fakeBillboards) {
      expect(bb.show).toBe(false);
    }
  });

  it("shows all billboards when opacity is greater than 0", () => {
    const scene = makeMockScene();
    const layer = createMilkyWayLayer(scene as never);
    const fakeBillboards = [{ show: false }, { show: false }];
    mockLength = fakeBillboards.length;
    mockGet.mockImplementation((i: number) => fakeBillboards[i]);
    layer.update(POINTS.slice(0, 2), 37, -122);
    layer.setOpacity(0.5);
    for (const bb of fakeBillboards) {
      expect(bb.show).toBe(true);
    }
  });

  it("does not throw when called before update", () => {
    const scene = makeMockScene();
    const layer = createMilkyWayLayer(scene as never);
    expect(() => layer.setOpacity(0.3)).not.toThrow();
  });
});
