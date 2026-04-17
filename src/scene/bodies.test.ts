/* SPDX-License-Identifier: Apache-2.0 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBodyLayer,
  generateSunSprite,
  generateMoonSprite,
  generatePlanetSprite,
} from "./bodies";
import type { CelestialBody } from "../astro";

const mockGetContext = vi.fn().mockReturnValue(null);
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext =
    mockGetContext as typeof HTMLCanvasElement.prototype.getContext;
});

const mockAdd = vi.fn().mockReturnValue({ show: true });
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
      fromCssColorString: vi.fn().mockReturnValue({
        withAlpha: (a: number) => ({ alpha: a }),
      }),
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
  return { primitives: { add: vi.fn() } };
}

const BODIES: CelestialBody[] = [
  { id: "Sun", alt: 45, az: 180, ra: 80, dec: 20, mag: -26.74, size: 24, color: "#FDB813" },
  {
    id: "Moon",
    alt: 60,
    az: 120,
    ra: 100,
    dec: -5,
    mag: -12.7,
    size: 20,
    color: "#E8E8E0",
    illumination: 0.75,
    phaseAngle: 90,
  },
  { id: "Venus", alt: 20, az: 260, ra: 300, dec: -20, mag: -4.0, size: 10, color: "#FFFFCC" },
];

function makeMockCtx() {
  const mockGradient = { addColorStop: vi.fn() };
  return {
    createRadialGradient: vi.fn().mockReturnValue(mockGradient),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    fillStyle: null as unknown,
    globalCompositeOperation: null as unknown,
    gradient: mockGradient,
  };
}

beforeEach(() => {
  mockAdd.mockClear();
  mockRemoveAll.mockClear();
});

describe("sprite generators (with 2d context)", () => {
  it("generateSunSprite draws a radial gradient when context available", () => {
    const ctx = makeMockCtx();
    mockGetContext.mockReturnValueOnce(ctx);
    const canvas = generateSunSprite();
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.width).toBe(96);
    expect(ctx.createRadialGradient).toHaveBeenCalledOnce();
    expect(ctx.gradient.addColorStop).toHaveBeenCalledTimes(5);
    expect(ctx.fillRect).toHaveBeenCalledOnce();
  });

  it("generateMoonSprite draws crescent (waxing) when context available", () => {
    const ctx = makeMockCtx();
    mockGetContext.mockReturnValueOnce(ctx);
    // phaseAngle < 180 → waxing path
    const canvas = generateMoonSprite(0.75, 90);
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.width).toBe(48);
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.ellipse).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it("generateMoonSprite draws crescent (waning) when context available", () => {
    const ctx = makeMockCtx();
    mockGetContext.mockReturnValueOnce(ctx);
    // phaseAngle >= 180 → waning path
    const canvas = generateMoonSprite(0.25, 270);
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(ctx.ellipse).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it("generatePlanetSprite draws a radial gradient when context available", () => {
    const ctx = makeMockCtx();
    mockGetContext.mockReturnValueOnce(ctx);
    const canvas = generatePlanetSprite("#CC4422");
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.width).toBe(32);
    expect(ctx.createRadialGradient).toHaveBeenCalledOnce();
    expect(ctx.gradient.addColorStop).toHaveBeenCalledTimes(3);
    expect(ctx.fillRect).toHaveBeenCalledOnce();
  });

  it("all sprite functions return blank canvas when getContext returns null", () => {
    mockGetContext.mockReturnValue(null);
    expect(generateSunSprite()).toBeInstanceOf(HTMLCanvasElement);
    expect(generateMoonSprite(0.5, 90)).toBeInstanceOf(HTMLCanvasElement);
    expect(generatePlanetSprite("#fff")).toBeInstanceOf(HTMLCanvasElement);
  });
});

describe("createBodyLayer", () => {
  it("returns an object with an update method", () => {
    const layer = createBodyLayer(makeMockScene() as never);
    expect(layer).toHaveProperty("update");
  });

  it("registers a BillboardCollection with scene.primitives", () => {
    const scene = makeMockScene();
    createBodyLayer(scene as never);
    expect(scene.primitives.add).toHaveBeenCalledOnce();
  });
});

describe("BodyLayer.update", () => {
  it("adds a billboard for each body", () => {
    const layer = createBodyLayer(makeMockScene() as never);
    layer.update(BODIES, 33, -117);
    expect(mockRemoveAll).toHaveBeenCalledOnce();
    expect(mockAdd).toHaveBeenCalledTimes(3);
  });

  it("Sun billboard has the largest scale", () => {
    const layer = createBodyLayer(makeMockScene() as never);
    layer.update(BODIES, 33, -117);
    const sunCall = mockAdd.mock.calls[0]![0] as { scale: number };
    const venusCall = mockAdd.mock.calls[2]![0] as { scale: number };
    expect(sunCall.scale).toBeGreaterThan(venusCall.scale);
  });

  it("works with empty body list", () => {
    const layer = createBodyLayer(makeMockScene() as never);
    layer.update([], 0, 0);
    expect(mockRemoveAll).toHaveBeenCalledOnce();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("clears previous billboards before adding new ones", () => {
    const layer = createBodyLayer(makeMockScene() as never);
    layer.update(BODIES, 33, -117);
    mockAdd.mockClear();
    mockRemoveAll.mockClear();
    layer.update(BODIES.slice(0, 1), 33, -117);
    expect(mockRemoveAll).toHaveBeenCalledOnce();
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });
});
