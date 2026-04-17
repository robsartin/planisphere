/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";
import { createStarLayer, generateStarSprite } from "./stars";
import type { AltAzStar } from "../astro";

// jsdom does not implement HTMLCanvasElement.prototype.getContext; stub it out
// so tests run without noisy "not implemented" errors. Default: returns null
// (fallback path). Individual tests can override to exercise the drawing path.
const mockGetContext = vi.fn().mockReturnValue(null);
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext =
    mockGetContext as typeof HTMLCanvasElement.prototype.getContext;
});

const mockAdd = vi.fn().mockReturnValue({ show: true, position: null, scale: 1, color: null });
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
    BillboardCollection: vi.fn().mockImplementation(() => ({
      add: mockAdd,
      removeAll: mockRemoveAll,
      length: 0,
    })),
    Cartesian3: MockCartesian3,
    Color: {
      WHITE: { withAlpha: (a: number) => ({ red: 1, green: 1, blue: 1, alpha: a }) },
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
  };
});

function makeMockScene() {
  return {
    primitives: { add: vi.fn() },
  };
}

const STARS: AltAzStar[] = [
  {
    hip: 32349,
    ra: 101.29,
    dec: -16.72,
    alt: 45,
    az: 180,
    mag: -1.46,
    name: "Sirius",
    size: 16,
    opacity: 1.0,
  },
  {
    hip: 69673,
    ra: 279.23,
    dec: 38.78,
    alt: 70,
    az: 90,
    mag: 0.03,
    name: "Vega",
    size: 14,
    opacity: 0.95,
  },
  { hip: 99999, ra: 0, dec: 0, alt: 10, az: 270, mag: 5.8, size: 3, opacity: 0.42 },
];

beforeEach(() => {
  mockAdd.mockClear();
  mockRemoveAll.mockClear();
});

describe("generateStarSprite", () => {
  it("returns a canvas element when getContext returns null (fallback path)", () => {
    mockGetContext.mockReturnValueOnce(null);
    const canvas = generateStarSprite();
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.width).toBe(32);
    expect(canvas.height).toBe(32);
  });

  it("draws a radial gradient when getContext returns a 2d context", () => {
    const mockGradient = {
      addColorStop: vi.fn(),
    };
    const mockCtx = {
      createRadialGradient: vi.fn().mockReturnValue(mockGradient),
      fillRect: vi.fn(),
      fillStyle: null as unknown,
    };
    mockGetContext.mockReturnValueOnce(mockCtx);
    const canvas = generateStarSprite();
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(mockCtx.createRadialGradient).toHaveBeenCalledOnce();
    expect(mockGradient.addColorStop).toHaveBeenCalledTimes(3);
    expect(mockCtx.fillRect).toHaveBeenCalledOnce();
  });
});

describe("createStarLayer", () => {
  it("returns an object with an update method", () => {
    const scene = makeMockScene();
    const layer = createStarLayer(scene as never);
    expect(layer).toBeDefined();
    expect(layer).toHaveProperty("update");
    expect(typeof layer.update).toBe("function");
  });

  it("registers a BillboardCollection with scene.primitives", () => {
    const scene = makeMockScene();
    createStarLayer(scene as never);
    expect(scene.primitives.add).toHaveBeenCalledOnce();
  });
});

describe("StarLayer.update", () => {
  it("adds a billboard for each visible star", () => {
    const scene = makeMockScene();
    const layer = createStarLayer(scene as never);
    layer.update(STARS, 33, -117);
    expect(mockRemoveAll).toHaveBeenCalledOnce();
    expect(mockAdd).toHaveBeenCalledTimes(3);
  });

  it("clears existing billboards before adding new ones", () => {
    const scene = makeMockScene();
    const layer = createStarLayer(scene as never);
    layer.update(STARS, 33, -117);
    mockAdd.mockClear();
    mockRemoveAll.mockClear();
    layer.update(STARS.slice(0, 1), 33, -117);
    expect(mockRemoveAll).toHaveBeenCalledOnce();
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });

  it("passes scale derived from star size", () => {
    const scene = makeMockScene();
    const layer = createStarLayer(scene as never);
    layer.update(STARS, 33, -117);
    const firstCall = mockAdd.mock.calls[0];
    expect(firstCall).toBeDefined();
    const callArgs = firstCall![0] as { scale: number };
    // Sirius has size 16 → scale = 16/16 = 1.0
    expect(callArgs.scale).toBeCloseTo(1.0);
  });

  it("passes color with star's opacity", () => {
    const scene = makeMockScene();
    const layer = createStarLayer(scene as never);
    layer.update(STARS, 33, -117);
    const firstCall = mockAdd.mock.calls[0];
    expect(firstCall).toBeDefined();
    const callArgs = firstCall![0] as { color: { alpha: number } };
    expect(callArgs.color.alpha).toBeCloseTo(1.0);
  });

  it("works with empty star list (no billboards added)", () => {
    const scene = makeMockScene();
    const layer = createStarLayer(scene as never);
    layer.update([], 0, 0);
    expect(mockRemoveAll).toHaveBeenCalledOnce();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("passes position to each billboard", () => {
    const scene = makeMockScene();
    const layer = createStarLayer(scene as never);
    layer.update(STARS, 33, -117);
    const firstCall = mockAdd.mock.calls[0];
    expect(firstCall).toBeDefined();
    const callArgs = firstCall![0] as { position: unknown };
    expect(callArgs.position).toBeDefined();
  });
});

describe("StarLayer.setVisible", () => {
  it("has a setVisible method", () => {
    const layer = createStarLayer(makeMockScene() as never);
    expect(layer).toHaveProperty("setVisible");
    expect(typeof layer.setVisible).toBe("function");
  });

  it("does not throw when called with true or false", () => {
    const layer = createStarLayer(makeMockScene() as never);
    expect(() => layer.setVisible(false)).not.toThrow();
    expect(() => layer.setVisible(true)).not.toThrow();
  });
});
