/* SPDX-License-Identifier: Apache-2.0 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createMessierLayer } from "./messier";

const mockGetContext = vi.fn().mockReturnValue(null);
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext =
    mockGetContext as typeof HTMLCanvasElement.prototype.getContext;
});

const mockAdd = vi.fn();
const mockRemoveAll = vi.fn();
const mockPrimitivesAdd = vi.fn();

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
    HorizontalOrigin: { CENTER: 0 },
    VerticalOrigin: { CENTER: 0 },
    Color: {
      fromCssColorString: vi
        .fn()
        .mockReturnValue({ withAlpha: vi.fn().mockReturnValue("mockColor") }),
    },
    Math: { toRadians: (d: number) => (d * Math.PI) / 180 },
    Cartesian3: MockCartesian3,
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
    primitives: { add: mockPrimitivesAdd },
  };
}

const VISIBLE_OBJECTS = [
  {
    m: 42,
    name: "Orion Nebula",
    type: "nebula",
    alt: 45.0,
    az: 180.0,
    ra: 83.8221,
    dec: -5.3911,
    mag: 4.0,
  },
  {
    m: 31,
    name: "Andromeda Galaxy",
    type: "galaxy",
    alt: 60.0,
    az: 90.0,
    ra: 10.6847,
    dec: 41.2692,
    mag: 3.4,
  },
  {
    m: 13,
    name: "Great Hercules Cluster",
    type: "globular cluster",
    alt: 30.0,
    az: 270.0,
    ra: 250.4233,
    dec: 36.46,
    mag: 5.8,
  },
  {
    m: 45,
    name: "Pleiades",
    type: "open cluster",
    alt: 50.0,
    az: 120.0,
    ra: 56.85,
    dec: 24.1167,
    mag: 1.6,
  },
  {
    m: 27,
    name: "Dumbbell Nebula",
    type: "planetary nebula",
    alt: 20.0,
    az: 45.0,
    ra: 299.9017,
    dec: 22.7214,
    mag: 7.5,
  },
  {
    m: 1,
    name: "Crab Nebula",
    type: "supernova remnant",
    alt: 35.0,
    az: 200.0,
    ra: 83.8221,
    dec: 22.0145,
    mag: 8.4,
  },
  {
    m: 24,
    name: "Sagittarius Star Cloud",
    type: "other",
    alt: 15.0,
    az: 150.0,
    ra: 274.1533,
    dec: -18.4,
    mag: 4.6,
  },
];

describe("createMessierLayer", () => {
  it("creates a layer without throwing", () => {
    const scene = makeMockScene();
    expect(() => createMessierLayer(scene as never)).not.toThrow();
  });

  it("adds a BillboardCollection to the scene", () => {
    mockPrimitivesAdd.mockClear();
    const scene = makeMockScene();
    createMessierLayer(scene as never);
    expect(mockPrimitivesAdd).toHaveBeenCalledOnce();
  });

  it("update adds a billboard for each visible object", () => {
    mockAdd.mockClear();
    const scene = makeMockScene();
    const layer = createMessierLayer(scene as never);
    layer.update(VISIBLE_OBJECTS, 40, -74);
    expect(mockAdd).toHaveBeenCalledTimes(VISIBLE_OBJECTS.length);
  });

  it("update sets the id to the VisibleMessier object for tooltip pick", () => {
    mockAdd.mockClear();
    const scene = makeMockScene();
    const layer = createMessierLayer(scene as never);
    layer.update(VISIBLE_OBJECTS, 40, -74);
    const call = mockAdd.mock.calls[0]![0] as { id: unknown };
    expect(call.id).toMatchObject({ m: 42, name: "Orion Nebula" });
  });

  it("update clears previous billboards before adding new ones", () => {
    mockRemoveAll.mockClear();
    mockAdd.mockClear();
    const scene = makeMockScene();
    const layer = createMessierLayer(scene as never);
    layer.update(VISIBLE_OBJECTS, 40, -74);
    layer.update(VISIBLE_OBJECTS, 40, -74);
    expect(mockRemoveAll).toHaveBeenCalledTimes(2);
  });

  it("setVisible sets the show property on the billboard collection", () => {
    const scene = makeMockScene();
    const layer = createMessierLayer(scene as never);
    expect(() => layer.setVisible(false)).not.toThrow();
    expect(() => layer.setVisible(true)).not.toThrow();
  });

  it("setOpacity does not throw", () => {
    const scene = makeMockScene();
    const layer = createMessierLayer(scene as never);
    expect(() => layer.setOpacity(0.5)).not.toThrow();
  });
});
