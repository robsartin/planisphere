/* SPDX-License-Identifier: Apache-2.0 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createConstellationArtLayer,
  type AnchorStarLookup,
  type ConstellationArtManifest,
} from "./constellation-art";
import type { VisibleConstellation } from "../astro";

const mockGetContext = vi.fn().mockReturnValue(null);
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext =
    mockGetContext as typeof HTMLCanvasElement.prototype.getContext;
});

const mockAdd = vi.fn();
const mockRemoveAll = vi.fn();
const mockPrimitivesAdd = vi.fn();
const mockGet = vi.fn();
let mockBillboardShow = true;
let mockBillboardLength = 0;

vi.mock("cesium", () => {
  const MockCartesian3 = vi.fn(function (x: number, y: number, z: number) {
    return { x, y, z };
  });
  (MockCartesian3 as unknown as { fromDegrees: ReturnType<typeof vi.fn> }).fromDegrees = vi
    .fn()
    .mockReturnValue({ x: 1, y: 2, z: 3 });

  return {
    BillboardCollection: vi.fn(function () {
      return {
        add: mockAdd,
        removeAll: mockRemoveAll,
        get: mockGet,
        get length() {
          return mockBillboardLength;
        },
        get show() {
          return mockBillboardShow;
        },
        set show(v: boolean) {
          mockBillboardShow = v;
        },
      };
    }),
    HorizontalOrigin: { CENTER: 0 },
    VerticalOrigin: { CENTER: 0 },
    Color: {
      WHITE: { withAlpha: (a: number) => ({ alpha: a }) },
      fromCssColorString: vi
        .fn()
        .mockReturnValue({ withAlpha: vi.fn().mockReturnValue({ alpha: 0.35 }) }),
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
  return { primitives: { add: mockPrimitivesAdd } };
}

const CONSTELLATIONS: VisibleConstellation[] = [
  {
    id: "Ori",
    name: "Orion",
    lines: [{ start: { alt: 45, az: 180 }, end: { alt: 30, az: 170 } }],
    centroid: { alt: 31.7, az: 171.7 },
  },
  {
    id: "UMa",
    name: "Ursa Major",
    lines: [{ start: { alt: 60, az: 350 }, end: { alt: 58, az: 348 } }],
    centroid: { alt: 59, az: 349 },
  },
  {
    id: "Sco",
    name: "Scorpius",
    lines: [{ start: { alt: 20, az: 200 }, end: { alt: 22, az: 205 } }],
    centroid: { alt: 21, az: 202.5 },
  },
];

function makeManifest(
  entries: Record<string, ConstellationArtManifest["constellations"][string]>,
): ConstellationArtManifest {
  return { culture: "western", version: 2, constellations: entries };
}

// Lookup that always returns undefined — anchors never resolve, layer falls
// back to placeholder + centroid for every constellation.
const NEVER_LOOKUP: AnchorStarLookup = () => undefined;

// Build a lookup that returns the same stub alt/az for the given HIPs and
// undefined for the rest.
function stubLookup(positions: Record<number, { alt: number; az: number }>): AnchorStarLookup {
  return (hip) => positions[hip];
}

beforeEach(() => {
  mockAdd.mockClear();
  mockRemoveAll.mockClear();
  mockPrimitivesAdd.mockClear();
  mockGet.mockClear();
  mockBillboardShow = true;
  mockBillboardLength = 0;
});

describe("createConstellationArtLayer", () => {
  it("creates a layer without throwing", () => {
    const scene = makeMockScene();
    expect(() => createConstellationArtLayer(scene as never)).not.toThrow();
  });

  it("registers a BillboardCollection with scene.primitives", () => {
    const scene = makeMockScene();
    createConstellationArtLayer(scene as never);
    expect(mockPrimitivesAdd).toHaveBeenCalledOnce();
  });

  it("exposes update, setVisible, setOpacity", () => {
    const layer = createConstellationArtLayer(makeMockScene() as never);
    expect(typeof layer.update).toBe("function");
    expect(typeof layer.setVisible).toBe("function");
    expect(typeof layer.setOpacity).toBe("function");
  });
});

describe("ConstellationArtLayer.update", () => {
  it("adds one billboard per visible constellation (3 → 3 add calls)", () => {
    const layer = createConstellationArtLayer(makeMockScene() as never);
    layer.update(CONSTELLATIONS, NEVER_LOOKUP, 33, -117);
    expect(mockAdd).toHaveBeenCalledTimes(CONSTELLATIONS.length);
  });

  it("clears previous billboards before adding new ones", () => {
    const layer = createConstellationArtLayer(makeMockScene() as never);
    layer.update(CONSTELLATIONS, NEVER_LOOKUP, 33, -117);
    layer.update(CONSTELLATIONS.slice(0, 1), NEVER_LOOKUP, 33, -117);
    expect(mockRemoveAll).toHaveBeenCalledTimes(2);
  });

  it("works with empty input", () => {
    const layer = createConstellationArtLayer(makeMockScene() as never);
    layer.update([], NEVER_LOOKUP, 0, 0);
    expect(mockRemoveAll).toHaveBeenCalledOnce();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("attaches the VisibleConstellation to the billboard id (pickable)", () => {
    const layer = createConstellationArtLayer(makeMockScene() as never);
    layer.update(CONSTELLATIONS, NEVER_LOOKUP, 33, -117);
    const firstCall = mockAdd.mock.calls[0]![0] as { id: unknown };
    expect(firstCall.id).toMatchObject({ id: "Ori" });
  });
});

describe("ConstellationArtLayer manifest lookup", () => {
  it("uses the placeholder canvas when the manifest has file: null", () => {
    const loadImage = vi.fn();
    const layer = createConstellationArtLayer(makeMockScene() as never, {
      manifest: makeManifest({ Ori: { file: null } }),
      loadImage,
    });
    layer.update(CONSTELLATIONS.slice(0, 1), NEVER_LOOKUP, 33, -117);
    expect(loadImage).not.toHaveBeenCalled();
    const call = mockAdd.mock.calls[0]![0] as { image: unknown; scale: number };
    expect(call.image).toBeDefined();
    expect(call.scale).toBe(1.0);
  });

  it("uses the placeholder when the constellation is not in the manifest", () => {
    const loadImage = vi.fn();
    const layer = createConstellationArtLayer(makeMockScene() as never, {
      manifest: makeManifest({}),
      loadImage,
    });
    layer.update(CONSTELLATIONS.slice(0, 1), NEVER_LOOKUP, 33, -117);
    expect(loadImage).not.toHaveBeenCalled();
    expect(mockAdd).toHaveBeenCalledOnce();
  });

  it("uses the placeholder when a file is set but no anchors resolve", () => {
    // Entry has anchors, but lookup returns undefined for every HIP → cannot
    // solve the affine → falls back to placeholder + centroid.
    const loadImage = vi.fn().mockReturnValue({ src: "" } as HTMLImageElement);
    const layer = createConstellationArtLayer(makeMockScene() as never, {
      manifest: makeManifest({
        Ori: {
          file: "Ori.png",
          size: [512, 512],
          anchors: [
            { pos: [100, 100], hip: 27913 },
            { pos: [300, 200], hip: 27366 },
            { pos: [200, 400], hip: 22449 },
          ],
        },
      }),
      loadImage,
    });
    layer.update(CONSTELLATIONS.slice(0, 1), NEVER_LOOKUP, 33, -117);
    expect(loadImage).not.toHaveBeenCalled();
    const call = mockAdd.mock.calls[0]![0] as { scale: number };
    expect(call.scale).toBe(1.0);
  });

  it("loads the file and applies the anchored scale when all anchors resolve", () => {
    const fakeImg = { src: "" } as HTMLImageElement;
    const loadImage = vi.fn().mockReturnValue(fakeImg);
    const layer = createConstellationArtLayer(makeMockScene() as never, {
      manifest: makeManifest({
        Ori: {
          file: "Ori.png",
          size: [512, 512],
          anchors: [
            { pos: [100, 100], hip: 27913 },
            { pos: [300, 200], hip: 27366 },
            { pos: [200, 400], hip: 22449 },
          ],
        },
      }),
      loadImage,
    });
    layer.update(
      CONSTELLATIONS.slice(0, 1),
      stubLookup({
        27913: { alt: 40, az: 170 },
        27366: { alt: 30, az: 175 },
        22449: { alt: 45, az: 180 },
      }),
      33,
      -117,
    );
    expect(loadImage).toHaveBeenCalledOnce();
    expect(loadImage.mock.calls[0]![0]).toContain("Ori.png");
    const call = mockAdd.mock.calls[0]![0] as { image: unknown; scale: number };
    expect(call.image).toBe(fakeImg);
    // Anchored path applies BASE_ANCHORED_SCALE (0.5), not the placeholder 1.0
    expect(call.scale).toBe(0.5);
  });

  it("caches loadImage calls per file across multiple constellations", () => {
    const fakeImg = { src: "" } as HTMLImageElement;
    const loadImage = vi.fn().mockReturnValue(fakeImg);
    const layer = createConstellationArtLayer(makeMockScene() as never, {
      manifest: makeManifest({
        Ori: {
          file: "shared.png",
          size: [512, 512],
          anchors: [
            { pos: [100, 100], hip: 1 },
            { pos: [300, 200], hip: 2 },
            { pos: [200, 400], hip: 3 },
          ],
        },
        UMa: {
          file: "shared.png",
          size: [512, 512],
          anchors: [
            { pos: [100, 100], hip: 1 },
            { pos: [300, 200], hip: 2 },
            { pos: [200, 400], hip: 3 },
          ],
        },
        Sco: {
          file: "shared.png",
          size: [512, 512],
          anchors: [
            { pos: [100, 100], hip: 1 },
            { pos: [300, 200], hip: 2 },
            { pos: [200, 400], hip: 3 },
          ],
        },
      }),
      loadImage,
    });
    layer.update(
      CONSTELLATIONS,
      stubLookup({
        1: { alt: 40, az: 170 },
        2: { alt: 30, az: 175 },
        3: { alt: 45, az: 180 },
      }),
      33,
      -117,
    );
    expect(loadImage).toHaveBeenCalledOnce();
    expect(mockAdd).toHaveBeenCalledTimes(3);
  });

  it("falls back to placeholder when only some anchor stars are visible", () => {
    // 2 of 3 anchors resolve — not enough to solve; placeholder path.
    const loadImage = vi.fn();
    const layer = createConstellationArtLayer(makeMockScene() as never, {
      manifest: makeManifest({
        Ori: {
          file: "Ori.png",
          size: [512, 512],
          anchors: [
            { pos: [100, 100], hip: 1 },
            { pos: [300, 200], hip: 2 },
            { pos: [200, 400], hip: 3 },
          ],
        },
      }),
      loadImage,
    });
    layer.update(
      CONSTELLATIONS.slice(0, 1),
      stubLookup({
        1: { alt: 40, az: 170 },
        2: { alt: 30, az: 175 },
        // HIP 3 missing → below horizon or not in visible-star list
      }),
      33,
      -117,
    );
    expect(loadImage).not.toHaveBeenCalled();
    const call = mockAdd.mock.calls[0]![0] as { scale: number };
    expect(call.scale).toBe(1.0);
  });

  it("falls back to placeholder when the three anchor pixels are collinear", () => {
    // Degenerate triangle — barycentric solve fails, no anchored position.
    const loadImage = vi.fn();
    const layer = createConstellationArtLayer(makeMockScene() as never, {
      manifest: makeManifest({
        Ori: {
          file: "Ori.png",
          size: [512, 512],
          anchors: [
            { pos: [0, 0], hip: 1 },
            { pos: [100, 100], hip: 2 },
            { pos: [200, 200], hip: 3 },
          ],
        },
      }),
      loadImage,
    });
    layer.update(
      CONSTELLATIONS.slice(0, 1),
      stubLookup({
        1: { alt: 40, az: 170 },
        2: { alt: 30, az: 175 },
        3: { alt: 45, az: 180 },
      }),
      33,
      -117,
    );
    expect(loadImage).not.toHaveBeenCalled();
    const call = mockAdd.mock.calls[0]![0] as { scale: number };
    expect(call.scale).toBe(1.0);
  });
});

describe("ConstellationArtLayer.setVisible", () => {
  it("does not throw when setVisible is called", () => {
    const layer = createConstellationArtLayer(makeMockScene() as never);
    expect(() => layer.setVisible(true)).not.toThrow();
    expect(() => layer.setVisible(false)).not.toThrow();
  });

  it("toggles the collection show flag", () => {
    const layer = createConstellationArtLayer(makeMockScene() as never);
    layer.setVisible(false);
    expect(mockBillboardShow).toBe(false);
    layer.setVisible(true);
    expect(mockBillboardShow).toBe(true);
  });
});

describe("ConstellationArtLayer.setOpacity", () => {
  it("does not throw when setOpacity is called on an empty collection", () => {
    const layer = createConstellationArtLayer(makeMockScene() as never);
    expect(() => layer.setOpacity(0.35)).not.toThrow();
  });

  it("does not throw when setOpacity is called after update", () => {
    const layer = createConstellationArtLayer(makeMockScene() as never);
    layer.update(CONSTELLATIONS, NEVER_LOOKUP, 33, -117);
    mockBillboardLength = CONSTELLATIONS.length;
    mockGet.mockImplementation(() => ({ color: { alpha: 0 } }));
    expect(() => layer.setOpacity(0.5)).not.toThrow();
  });
});
