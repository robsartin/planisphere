/* SPDX-License-Identifier: Apache-2.0 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createConstellationLayer } from "./constellations";
import type { VisibleConstellation } from "../astro";

const mockPolylineAdd = vi.fn();
const mockPolylineRemoveAll = vi.fn();
const mockLabelAdd = vi.fn();
const mockLabelRemoveAll = vi.fn();

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
    PolylineCollection: vi.fn().mockImplementation(() => ({
      add: mockPolylineAdd,
      removeAll: mockPolylineRemoveAll,
    })),
    LabelCollection: vi.fn().mockImplementation(() => ({
      add: mockLabelAdd,
      removeAll: mockLabelRemoveAll,
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
    Material: {
      fromType: vi.fn().mockReturnValue({}),
    },
  };
});

function makeMockScene() {
  return { primitives: { add: vi.fn() } };
}

const CONSTELLATIONS: VisibleConstellation[] = [
  {
    id: "Ori",
    name: "Orion",
    lines: [
      { start: { alt: 45, az: 180 }, end: { alt: 30, az: 170 } },
      { start: { alt: 30, az: 170 }, end: { alt: 20, az: 165 } },
    ],
    centroid: { alt: 31.7, az: 171.7 },
  },
  {
    id: "UMa",
    name: "Ursa Major",
    lines: [{ start: { alt: 60, az: 350 }, end: { alt: 58, az: 348 } }],
    centroid: { alt: 59, az: 349 },
  },
];

beforeEach(() => {
  mockPolylineAdd.mockClear();
  mockPolylineRemoveAll.mockClear();
  mockLabelAdd.mockClear();
  mockLabelRemoveAll.mockClear();
});

describe("createConstellationLayer", () => {
  it("returns an object with an update method", () => {
    const layer = createConstellationLayer(makeMockScene() as never);
    expect(layer).toHaveProperty("update");
  });

  it("registers collections with scene.primitives", () => {
    const scene = makeMockScene();
    createConstellationLayer(scene as never);
    expect(scene.primitives.add).toHaveBeenCalledTimes(2);
  });
});

describe("ConstellationLayer.update", () => {
  it("adds a polyline for each visible line segment", () => {
    const layer = createConstellationLayer(makeMockScene() as never);
    layer.update(CONSTELLATIONS, 33, -117);
    expect(mockPolylineRemoveAll).toHaveBeenCalledOnce();
    expect(mockPolylineAdd).toHaveBeenCalledTimes(3);
  });

  it("adds a label for each visible constellation", () => {
    const layer = createConstellationLayer(makeMockScene() as never);
    layer.update(CONSTELLATIONS, 33, -117);
    expect(mockLabelRemoveAll).toHaveBeenCalledOnce();
    expect(mockLabelAdd).toHaveBeenCalledTimes(2);
  });

  it("works with empty input", () => {
    const layer = createConstellationLayer(makeMockScene() as never);
    layer.update([], 0, 0);
    expect(mockPolylineRemoveAll).toHaveBeenCalledOnce();
    expect(mockLabelRemoveAll).toHaveBeenCalledOnce();
    expect(mockPolylineAdd).not.toHaveBeenCalled();
    expect(mockLabelAdd).not.toHaveBeenCalled();
  });

  it("clears previous primitives before adding", () => {
    const layer = createConstellationLayer(makeMockScene() as never);
    layer.update(CONSTELLATIONS, 33, -117);
    mockPolylineAdd.mockClear();
    mockLabelAdd.mockClear();
    mockPolylineRemoveAll.mockClear();
    mockLabelRemoveAll.mockClear();
    layer.update(CONSTELLATIONS.slice(0, 1), 33, -117);
    expect(mockPolylineRemoveAll).toHaveBeenCalledOnce();
    expect(mockLabelRemoveAll).toHaveBeenCalledOnce();
    expect(mockPolylineAdd).toHaveBeenCalledTimes(2);
    expect(mockLabelAdd).toHaveBeenCalledTimes(1);
  });
});

describe("ConstellationLayer.setVisible", () => {
  it("has setVisible and setOpacity methods", () => {
    const layer = createConstellationLayer(makeMockScene() as never);
    expect(layer).toHaveProperty("setVisible");
    expect(layer).toHaveProperty("setOpacity");
  });

  it("does not throw when setVisible is called", () => {
    const layer = createConstellationLayer(makeMockScene() as never);
    expect(() => layer.setVisible(false)).not.toThrow();
    expect(() => layer.setVisible(true)).not.toThrow();
  });

  it("does not throw when setOpacity is called", () => {
    const layer = createConstellationLayer(makeMockScene() as never);
    layer.update(CONSTELLATIONS, 33, -117);
    expect(() => layer.setOpacity(0.5)).not.toThrow();
  });
});

describe("ConstellationLayer.setNameOverrides", () => {
  it("has a setNameOverrides method", () => {
    const layer = createConstellationLayer(makeMockScene() as never);
    expect(layer).toHaveProperty("setNameOverrides");
  });

  it("uses the override map when rendering labels (e.g. Ori → 猎户座)", () => {
    const layer = createConstellationLayer(makeMockScene() as never);
    layer.setNameOverrides({ Ori: "猎户座", UMa: "大熊座" });
    layer.update(CONSTELLATIONS, 33, -117);
    const calls = mockLabelAdd.mock.calls.map((c) => (c[0] as { text: string }).text);
    expect(calls).toContain("猎户座");
    expect(calls).toContain("大熊座");
  });

  it("falls back to the Latin name when an override is missing", () => {
    const layer = createConstellationLayer(makeMockScene() as never);
    layer.setNameOverrides({ Ori: "猎户座" });
    layer.update(CONSTELLATIONS, 33, -117);
    const calls = mockLabelAdd.mock.calls.map((c) => (c[0] as { text: string }).text);
    expect(calls).toContain("猎户座");
    // UMa has no override, keep Latin name
    expect(calls).toContain("Ursa Major");
  });

  it("setNameOverrides(null) reverts to Latin names", () => {
    const layer = createConstellationLayer(makeMockScene() as never);
    layer.setNameOverrides({ Ori: "猎户座" });
    layer.update(CONSTELLATIONS, 33, -117);
    mockLabelAdd.mockClear();
    layer.setNameOverrides(null);
    layer.update(CONSTELLATIONS, 33, -117);
    const calls = mockLabelAdd.mock.calls.map((c) => (c[0] as { text: string }).text);
    expect(calls).toContain("Orion");
    expect(calls).toContain("Ursa Major");
  });
});
