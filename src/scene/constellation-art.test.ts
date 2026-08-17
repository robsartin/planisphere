/* SPDX-License-Identifier: Apache-2.0 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  artAssetUrl,
  createConstellationArtLayer,
  type AnchorStarLookup,
  type ConstellationArtManifest,
} from "./constellation-art";
import type { VisibleConstellation } from "../astro";
import bundledManifest from "../../data/art/western/manifest.json";

// Shape the mocked `Material.fromType` hands back — mirrors the built-in
// Image material's uniform set.
type MockMaterial = {
  type: string;
  uniforms: { image: string; color: { alpha: number } };
  translucent: boolean;
  destroy: ReturnType<typeof vi.fn>;
};

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

const mockPrimitiveAdd = vi.fn();
const mockPrimitiveRemove = vi.fn();
const mockPrimitiveRemoveAll = vi.fn();
let mockPrimitiveCollectionShow = true;

// Hoisted so the `vi.mock` factory can reference it as a property value (a
// plain module-scope const would still be in its TDZ when the factory runs).
// The caching tests count constructor calls, so they need the spy itself
// rather than the collection's `add`.
const { mockPrimitiveCtor, mockMaterialFromType } = vi.hoisted(() => ({
  mockPrimitiveCtor: vi.fn(function (opts: unknown) {
    return { ...(opts as object), isPrimitive: true };
  }),
  // Mirrors the real Material.fromType: caller uniforms override the
  // registered defaults, and `translucent` arrives false-y so that dropping
  // the layer's explicit `material.translucent = true` is detectable.
  mockMaterialFromType: vi.fn((type: string, uniforms: Record<string, unknown>) => ({
    type,
    uniforms: { image: null, repeat: { x: 1, y: 1 }, color: { alpha: 1 }, ...uniforms },
    translucent: false,
    destroy: vi.fn(),
  })),
}));

vi.mock("cesium", () => {
  const MockCartesian3 = vi.fn(function (x: number, y: number, z: number) {
    return { x, y, z };
  });
  (MockCartesian3 as unknown as { fromDegrees: ReturnType<typeof vi.fn> }).fromDegrees = vi
    .fn()
    .mockReturnValue({ x: 1, y: 2, z: 3 });
  // `constellation-art-affine` is imported by the module under test, so it
  // receives this mock too. Stub the vector ops it calls rather than
  // re-asserting the real math here — that is covered by
  // constellation-art-affine.test.ts against the real Cesium.
  (MockCartesian3 as unknown as Record<string, unknown>).subtract = vi
    .fn()
    .mockReturnValue({ x: 1, y: 0, z: 0 });
  (MockCartesian3 as unknown as Record<string, unknown>).add = vi
    .fn()
    .mockReturnValue({ x: 1, y: 1, z: 0 });
  (MockCartesian3 as unknown as Record<string, unknown>).multiplyByScalar = vi
    .fn()
    .mockReturnValue({ x: 1, y: 0, z: 0 });
  (MockCartesian3 as unknown as Record<string, unknown>).cross = vi
    .fn()
    .mockReturnValue({ x: 0, y: 0, z: 1 });
  (MockCartesian3 as unknown as Record<string, unknown>).magnitude = vi.fn().mockReturnValue(1);
  (MockCartesian3 as unknown as Record<string, unknown>).divideByScalar = vi
    .fn()
    .mockReturnValue({ x: 0, y: 0, z: 1 });

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
    PrimitiveCollection: vi.fn(function () {
      return {
        add: mockPrimitiveAdd,
        remove: mockPrimitiveRemove,
        removeAll: mockPrimitiveRemoveAll,
        get show() {
          return mockPrimitiveCollectionShow;
        },
        set show(v: boolean) {
          mockPrimitiveCollectionShow = v;
        },
      };
    }),
    Primitive: mockPrimitiveCtor,
    GeometryInstance: vi.fn(function (opts: unknown) {
      return { ...(opts as object) };
    }),
    Geometry: vi.fn(function (opts: unknown) {
      return { ...(opts as object) };
    }),
    GeometryAttribute: vi.fn(function (opts: unknown) {
      return { ...(opts as object) };
    }),
    GeometryAttributes: vi.fn(function () {
      return {};
    }),
    MaterialAppearance: vi.fn(function (opts: unknown) {
      return { ...(opts as object) };
    }),
    Material: { fromType: mockMaterialFromType },
    ComponentDatatype: { DOUBLE: 0, FLOAT: 1 },
    PrimitiveType: { TRIANGLES: 4 },
    // Real Cesium fromVertices on the unit quad returns radius sqrt(0.5)
    // (distance from center (0.5, 0.5, 0) to a corner) — the under-covering
    // value the source code is expected to override.
    BoundingSphere: { fromVertices: vi.fn().mockReturnValue({ radius: Math.sqrt(0.5) }) },
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
      fromColumnMajorArray: vi.fn().mockReturnValue({ isMatrix4: true }),
      IDENTITY: { isIdentity: true },
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

// A manifest whose Ori entry anchors cleanly, plus the lookup that resolves
// all three of its stars — together the only way to get a real art primitive
// into the layer's cache.
const ANCHORED = makeManifest({
  Ori: {
    file: "Ori.png",
    size: [512, 512],
    anchors: [
      { pos: [59, 11], hip: 27913 },
      { pos: [329, 477], hip: 27366 },
      { pos: [421, 91], hip: 22449 },
    ],
  },
});

const ALL_VISIBLE = stubLookup({
  27913: { alt: 40, az: 180 },
  27366: { alt: 30, az: 175 },
  22449: { alt: 45, az: 185 },
});

beforeEach(() => {
  mockAdd.mockClear();
  mockRemoveAll.mockClear();
  mockPrimitivesAdd.mockClear();
  mockGet.mockClear();
  mockBillboardShow = true;
  mockBillboardLength = 0;
  mockPrimitiveAdd.mockClear();
  mockPrimitiveRemove.mockClear();
  mockPrimitiveRemoveAll.mockClear();
  mockPrimitiveCtor.mockClear();
  mockMaterialFromType.mockClear();
  mockPrimitiveCollectionShow = true;
});

describe("createConstellationArtLayer", () => {
  it("creates a layer without throwing", () => {
    const scene = makeMockScene();
    expect(() => createConstellationArtLayer(scene as never)).not.toThrow();
  });

  it("registers a BillboardCollection with scene.primitives", () => {
    const scene = makeMockScene();
    createConstellationArtLayer(scene as never);
    const registered = mockPrimitivesAdd.mock.calls.map((call) => call[0] as { add: unknown });
    expect(registered.some((collection) => collection.add === mockAdd)).toBe(true);
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
    const layer = createConstellationArtLayer(makeMockScene() as never, {
      manifest: makeManifest({ Ori: { file: null } }),
    });
    layer.update(CONSTELLATIONS.slice(0, 1), NEVER_LOOKUP, 33, -117);
    expect(mockPrimitiveAdd).not.toHaveBeenCalled();
    const call = mockAdd.mock.calls[0]![0] as { image: unknown; scale: number };
    expect(call.image).toBeDefined();
    expect(call.scale).toBe(1.0);
  });

  it("uses the placeholder when the constellation is not in the manifest", () => {
    const layer = createConstellationArtLayer(makeMockScene() as never, {
      manifest: makeManifest({}),
    });
    layer.update(CONSTELLATIONS.slice(0, 1), NEVER_LOOKUP, 33, -117);
    expect(mockPrimitiveAdd).not.toHaveBeenCalled();
    expect(mockAdd).toHaveBeenCalledOnce();
  });

  it("uses the placeholder when a file is set but no anchors resolve", () => {
    // Entry has anchors, but lookup returns undefined for every HIP → cannot
    // solve the affine → falls back to placeholder + centroid.
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
    });
    layer.update(CONSTELLATIONS.slice(0, 1), NEVER_LOOKUP, 33, -117);
    expect(mockPrimitiveAdd).not.toHaveBeenCalled();
    const call = mockAdd.mock.calls[0]![0] as { scale: number };
    expect(call.scale).toBe(1.0);
  });

  it("falls back to placeholder when only some anchor stars are visible", () => {
    // 2 of 3 anchors resolve — not enough to solve; placeholder path.
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
    expect(mockPrimitiveAdd).not.toHaveBeenCalled();
    const call = mockAdd.mock.calls[0]![0] as { scale: number };
    expect(call.scale).toBe(1.0);
  });

  it("falls back to placeholder when the three anchor pixels are collinear", () => {
    // Degenerate triangle — the affine solve fails, no model matrix.
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
    expect(mockPrimitiveAdd).not.toHaveBeenCalled();
    const call = mockAdd.mock.calls[0]![0] as { scale: number };
    expect(call.scale).toBe(1.0);
  });

  it("falls back to placeholder when the entry has fewer than three anchors", () => {
    const layer = createConstellationArtLayer(makeMockScene() as never, {
      manifest: makeManifest({
        Ori: {
          file: "Ori.png",
          size: [512, 512],
          anchors: [
            { pos: [100, 100], hip: 1 },
            { pos: [300, 200], hip: 2 },
          ],
        },
      }),
    });
    layer.update(CONSTELLATIONS.slice(0, 1), stubLookup({ 1: { alt: 40, az: 170 } }), 33, -117);
    expect(mockPrimitiveAdd).not.toHaveBeenCalled();
    expect(mockAdd).toHaveBeenCalledOnce();
  });

  it("falls back to placeholder when a file is set but size/anchors are missing", () => {
    const layer = createConstellationArtLayer(makeMockScene() as never, {
      manifest: makeManifest({ Ori: { file: "Ori.png" } }),
    });
    layer.update(CONSTELLATIONS.slice(0, 1), NEVER_LOOKUP, 33, -117);
    expect(mockPrimitiveAdd).not.toHaveBeenCalled();
    expect(mockAdd).toHaveBeenCalledOnce();
  });
});

describe("ConstellationArtLayer anchored primitives", () => {
  it("registers a PrimitiveCollection with scene.primitives", () => {
    const scene = makeMockScene();
    createConstellationArtLayer(scene as never, { manifest: ANCHORED });
    // One BillboardCollection (placeholders) + one PrimitiveCollection (art).
    const registered = mockPrimitivesAdd.mock.calls.map((call) => call[0] as { add: unknown });
    expect(registered.some((collection) => collection.add === mockPrimitiveAdd)).toBe(true);
    expect(mockPrimitivesAdd).toHaveBeenCalledTimes(2);
  });

  it("adds a primitive, not a billboard, when all anchors resolve", () => {
    const scene = makeMockScene();
    const layer = createConstellationArtLayer(scene as never, { manifest: ANCHORED });
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);

    expect(mockPrimitiveAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("adds a placeholder billboard, not a primitive, when anchors do not resolve", () => {
    const scene = makeMockScene();
    const layer = createConstellationArtLayer(scene as never, { manifest: ANCHORED });
    layer.update([CONSTELLATIONS[0]!], NEVER_LOOKUP, 61, -149);

    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockPrimitiveAdd).not.toHaveBeenCalled();
  });

  it("widens the quad's bounding sphere radius past fromVertices' orthonormal-basis estimate", () => {
    const scene = makeMockScene();
    const layer = createConstellationArtLayer(scene as never, { manifest: ANCHORED });
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);

    // fromVertices' sqrt(0.5) radius only covers the quad's far corner when
    // the model matrix's column vectors are orthogonal; real anchor bases
    // carry shear, so the layer must widen the radius rather than trust it.
    const primitive = mockPrimitiveAdd.mock.calls[0]?.[0] as {
      geometryInstances: { geometry: { boundingSphere: { radius: number } } };
    };
    expect(primitive.geometryInstances.geometry.boundingSphere.radius).toBe(1.0);
  });

  it("attaches a VisibleConstellation as the geometry instance id (pickable)", () => {
    const scene = makeMockScene();
    const layer = createConstellationArtLayer(scene as never, { manifest: ANCHORED });
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);

    // Preserves the pick contract the constellation-line layer established
    // (#305 / #308) — hovering the art must resolve to a typed payload.
    // It is a layer-owned mirror rather than the caller's object, because
    // Primitive bakes the pick id at creation: the payload has to be an object
    // the layer can keep current for the primitive's whole lifetime.
    const primitive = mockPrimitiveAdd.mock.calls[0]?.[0] as {
      geometryInstances: { id: VisibleConstellation };
    };
    expect(primitive.geometryInstances.id).not.toBe(CONSTELLATIONS[0]);
    expect(primitive.geometryInstances.id).toEqual(CONSTELLATIONS[0]);
  });

  it("keeps the cached primitive's pick payload current as the constellation moves", () => {
    const scene = makeMockScene();
    const layer = createConstellationArtLayer(scene as never, { manifest: ANCHORED });

    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);
    const moved: VisibleConstellation = {
      ...CONSTELLATIONS[0]!,
      lines: [{ start: { alt: 14, az: 90 }, end: { alt: 11, az: 86 } }],
      centroid: { alt: 12.5, az: 88.25 },
    };
    layer.update([moved], ALL_VISIBLE, 61, -149);

    // Primitive bakes its pick id at creation and drops geometryInstances
    // after upload (releaseGeometryInstances defaults true), so a cached
    // primitive would hand back the frame-0 payload forever. object-card's
    // "Copy link" dispatches set-view from centroid.alt/az, so a stale payload
    // frames the view where the constellation was hours of sky-time ago —
    // while picking the same constellation's LINES gives a fresh position.
    const payload = mockPrimitiveCtor.mock.calls[0]![0] as {
      geometryInstances: { id: VisibleConstellation };
    };
    expect(payload.geometryInstances.id.centroid).toEqual({ alt: 12.5, az: 88.25 });
    expect(payload.geometryInstances.id.lines).toEqual(moved.lines);
    expect(payload.geometryInstances.id.id).toBe("Ori");
  });

  it("carries the anchor affine as the primitive's modelMatrix", () => {
    const scene = makeMockScene();
    const layer = createConstellationArtLayer(scene as never, { manifest: ANCHORED });
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);

    const primitive = mockPrimitiveAdd.mock.calls[0]?.[0] as { modelMatrix: unknown };
    expect(primitive.modelMatrix).toEqual({ isMatrix4: true });
  });

  it("textures the quad with the emitted asset URL at the current opacity", () => {
    const scene = makeMockScene();
    const layer = createConstellationArtLayer(scene as never, { manifest: ANCHORED });
    layer.setOpacity(0.42);
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);

    const primitive = mockPrimitiveAdd.mock.calls[0]?.[0] as {
      appearance: { material: MockMaterial };
    };
    const material = primitive.appearance.material;
    expect(material.type).toBe("Image");
    expect(material.uniforms.color.alpha).toBe(0.42);
    // #406 — the image uniform is a decoded element the layer loaded, never
    // the URL. Handing Cesium a URL makes the material fetch it and show its
    // default white texture in the meantime. Which element arrives, and when,
    // is covered by the art-image-loading block below.
    expect(typeof material.uniforms.image).not.toBe("string");
  });

  it("forces material translucency so transparent PNG areas still blend at alpha 1", () => {
    const scene = makeMockScene();
    const layer = createConstellationArtLayer(scene as never, { manifest: ANCHORED });
    layer.setOpacity(1);
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);

    // The built-in Image material registers `translucent` as a function of
    // color.alpha, and Appearance.isTranslucent() prefers the material's
    // answer — at alpha 1 that flips the render state to depthMask/no-blend
    // and every PNG's transparent background draws opaque. Setting the public
    // property overrides the registered function.
    const primitive = mockPrimitiveAdd.mock.calls[0]?.[0] as {
      appearance: { material: MockMaterial };
    };
    expect(primitive.appearance.material.translucent).toBe(true);
  });

  it("clears placeholder billboards before adding new content", () => {
    const scene = makeMockScene();
    const layer = createConstellationArtLayer(scene as never, { manifest: ANCHORED });
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);

    // Billboards are cheap and rebuilt wholesale; the primitive collection
    // reconciles against the visible set instead, so it is never cleared.
    expect(mockRemoveAll).toHaveBeenCalled();
    expect(mockPrimitiveRemoveAll).not.toHaveBeenCalled();
  });

  it("reuses the cached primitive across rerenders of the same constellation", () => {
    const scene = makeMockScene();
    const layer = createConstellationArtLayer(scene as never, { manifest: ANCHORED });

    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);

    // Rebuilding geometry every rerender would recompile ~30 primitives at the
    // 50ms scheduleRerender cadence, and would orphan a half-loaded Material
    // per constellation per frame while the time animation runs.
    expect(mockPrimitiveCtor).toHaveBeenCalledTimes(1);
    expect(mockPrimitiveAdd).toHaveBeenCalledTimes(1);
  });

  it("reassigns the modelMatrix of the cached primitive on rerender", () => {
    const scene = makeMockScene();
    const layer = createConstellationArtLayer(scene as never, { manifest: ANCHORED });

    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);
    const primitive = mockPrimitiveCtor.mock.results[0]!.value as { modelMatrix: unknown };
    primitive.modelMatrix = { stale: true };
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);

    expect(primitive.modelMatrix).toEqual({ isMatrix4: true });
  });

  it("drops the cached primitive when the constellation stops being visible", () => {
    const scene = makeMockScene();
    const layer = createConstellationArtLayer(scene as never, { manifest: ANCHORED });

    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);
    const first = mockPrimitiveCtor.mock.results[0]!.value;
    layer.update([], ALL_VISIBLE, 61, -149);

    // PrimitiveCollection.remove destroys the primitive by default, so the
    // cache entry must go with it — reusing a destroyed Primitive throws.
    expect(mockPrimitiveRemove).toHaveBeenCalledWith(first);

    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);
    expect(mockPrimitiveCtor).toHaveBeenCalledTimes(2);
  });

  it("destroys the material of an evicted primitive", () => {
    const scene = makeMockScene();
    const layer = createConstellationArtLayer(scene as never, { manifest: ANCHORED });

    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);
    const material = mockMaterialFromType.mock.results[0]!.value as MockMaterial;
    layer.update([], ALL_VISIBLE, 61, -149);

    // Primitive.destroy tears down _sp / _va / _pickIds / _batchTable but
    // never appearance.material, so the texture would outlive the primitive.
    // A constellation oscillating around the anchor threshold during time
    // animation would churn one orphaned Material per crossing.
    expect(material.destroy).toHaveBeenCalledTimes(1);
  });

  it("evicts the cached primitive when the constellation falls back to a placeholder", () => {
    const scene = makeMockScene();
    const layer = createConstellationArtLayer(scene as never, { manifest: ANCHORED });

    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);
    const first = mockPrimitiveCtor.mock.results[0]!.value;
    // Anchor stars set below the horizon: still "visible" as a constellation,
    // but no longer anchorable, so the art must leave the collection.
    layer.update([CONSTELLATIONS[0]!], NEVER_LOOKUP, 61, -149);

    expect(mockPrimitiveRemove).toHaveBeenCalledWith(first);
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });

  it("falls back to a placeholder billboard when the art asset was not emitted", () => {
    const scene = makeMockScene();
    const missing = makeManifest({
      Ori: {
        file: "DoesNotExist.png",
        size: [512, 512],
        anchors: [
          { pos: [0, 0], hip: 27913 },
          { pos: [512, 0], hip: 27366 },
          { pos: [0, 512], hip: 22449 },
        ],
      },
    });
    const layer = createConstellationArtLayer(scene as never, { manifest: missing });
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);

    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockPrimitiveAdd).not.toHaveBeenCalled();
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

  it("toggles the primitive collection show flag too", () => {
    const layer = createConstellationArtLayer(makeMockScene() as never);
    layer.setVisible(false);
    expect(mockPrimitiveCollectionShow).toBe(false);
    layer.setVisible(true);
    expect(mockPrimitiveCollectionShow).toBe(true);
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

  it("rewrites the color alpha of already-cached art primitives", () => {
    const layer = createConstellationArtLayer(makeMockScene() as never, { manifest: ANCHORED });
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);
    const primitive = mockPrimitiveCtor.mock.results[0]!.value as {
      appearance: { material: MockMaterial };
    };

    layer.setOpacity(0.75);

    // Cached primitives are never rebuilt, so an opacity change has to reach
    // the live material rather than waiting for the next construction.
    expect(primitive.appearance.material.uniforms.color.alpha).toBe(0.75);
  });
});

describe("artAssetUrl", () => {
  it("returns null for a file that was never emitted as an asset", () => {
    // The old concatenating implementation returned a plausible-looking
    // string for ANY input, which is exactly why a missing asset could not
    // be detected. A resolver backed by Vite's emitted-asset map knows the
    // difference between a real file and a typo.
    expect(artAssetUrl("NotAConstellation.png")).toBeNull();
  });

  it("resolves every non-null file in the bundled manifest", () => {
    const files = Object.values(bundledManifest.constellations)
      .map((entry) => (entry as { file: string | null }).file)
      .filter((file): file is string => file !== null);

    // Guards two failure modes at once: assets Vite never emitted (the #404
    // production bug), and manifest entries naming a PNG that is not on disk.
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(artAssetUrl(file), `no emitted asset for ${file}`).not.toBeNull();
    }
  });
});

/**
 * #406 — a Cesium `Material` built from a URL starts bound to the engine's
 * default 1x1 white texture and only swaps to the real image once its own
 * fetch resolves. With ~30 constellations that showed as a screen of flat grey
 * parallelograms for a second or two, which reads as a rendering fault rather
 * than a loading state.
 *
 * The layer now loads each PNG itself, keeps the primitive hidden until that
 * image is in hand, and hands the decoded element to the material — so the
 * white default is never on screen and the material owns no fetch of its own.
 */
describe("ConstellationArtLayer art image loading (#406)", () => {
  type FakeImage = {
    src: string;
    onload: (() => void) | null;
    onerror: (() => void) | null;
  };

  function makeLoader() {
    const created: FakeImage[] = [];
    const loadImage = vi.fn((url: string) => {
      const img: FakeImage = { src: url, onload: null, onerror: null };
      created.push(img);
      return img as unknown as HTMLImageElement;
    });
    return { loadImage, created };
  }

  function firstPrimitive() {
    return mockPrimitiveAdd.mock.calls[0]?.[0] as {
      show: boolean;
      appearance: { material: MockMaterial };
    };
  }

  it("keeps the primitive hidden until its image has loaded", () => {
    const { loadImage } = makeLoader();
    const layer = createConstellationArtLayer(makeMockScene() as never, {
      manifest: ANCHORED,
      loadImage,
    });
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);

    expect(mockPrimitiveAdd).toHaveBeenCalledTimes(1);
    expect(firstPrimitive().show).toBe(false);
  });

  it("never puts the art URL in the material, so the default white texture cannot show", () => {
    const { loadImage } = makeLoader();
    const layer = createConstellationArtLayer(makeMockScene() as never, {
      manifest: ANCHORED,
      loadImage,
    });
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);

    // A string here is the bug: it makes the material fetch, and fetch means a
    // white-textured window plus an in-flight request the layer does not own.
    expect(typeof firstPrimitive().appearance.material.uniforms.image).not.toBe("string");
  });

  it("reveals the primitive and hands it the decoded image once loading finishes", () => {
    const { loadImage, created } = makeLoader();
    const layer = createConstellationArtLayer(makeMockScene() as never, {
      manifest: ANCHORED,
      loadImage,
    });
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);

    expect(created).toHaveLength(1);
    expect(created[0]?.src).toContain("Ori");
    created[0]?.onload?.();

    expect(firstPrimitive().show).toBe(true);
    expect(firstPrimitive().appearance.material.uniforms.image).toBe(created[0]);
  });

  it("loads each art image once across rerenders", () => {
    const { loadImage, created } = makeLoader();
    const layer = createConstellationArtLayer(makeMockScene() as never, {
      manifest: ANCHORED,
      loadImage,
    });
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);
    created[0]?.onload?.();
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);

    expect(loadImage).toHaveBeenCalledTimes(1);
  });

  it("falls back to the placeholder billboard when the image fails to load", () => {
    const { loadImage, created } = makeLoader();
    const layer = createConstellationArtLayer(makeMockScene() as never, {
      manifest: ANCHORED,
      loadImage,
    });
    layer.update([CONSTELLATIONS[0]!], ALL_VISIBLE, 61, -149);
    expect(mockAdd).not.toHaveBeenCalled();

    created[0]?.onerror?.();

    // A permanently hidden primitive would leave the constellation with no
    // art and no placeholder — worse than the pre-#406 behaviour.
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });
});
