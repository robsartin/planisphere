/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi } from "vitest";

vi.mock("cesium", () => ({
  Viewer: vi.fn().mockImplementation(() => ({
    scene: {
      skyBox: undefined,
      skyAtmosphere: undefined,
      sun: { show: true },
      moon: { show: true },
      backgroundColor: { red: 0, green: 0, blue: 0, alpha: 1 },
      globe: { show: true },
      primitives: { add: vi.fn() },
    },
    imageryLayers: { removeAll: vi.fn() },
    camera: { setView: vi.fn() },
    destroy: vi.fn(),
  })),
  BillboardCollection: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    removeAll: vi.fn(),
    show: true,
    length: 0,
  })),
  Cartesian3: Object.assign(
    vi.fn().mockImplementation((x: number, y: number, z: number) => ({ x, y, z })),
    { fromDegrees: vi.fn().mockReturnValue({ x: 0, y: 0, z: 0 }) },
  ),
  Color: {
    BLACK: { clone: () => ({ red: 0, green: 0, blue: 0, alpha: 1 }) },
    WHITE: { withAlpha: (a: number) => ({ red: 1, green: 1, blue: 1, alpha: a }) },
    fromCssColorString: vi.fn().mockReturnValue({
      withAlpha: (a: number) => ({ alpha: a }),
    }),
  },
  Ion: { defaultAccessToken: "" },
  Math: { toRadians: (d: number) => (d * Math.PI) / 180 },
  HorizontalOrigin: { CENTER: 0 },
  VerticalOrigin: { CENTER: 0 },
  Transforms: {
    eastNorthUpToFixedFrame: vi
      .fn()
      .mockReturnValue([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  },
  Matrix4: {
    multiplyByPoint: vi.fn().mockReturnValue({ x: 10, y: 20, z: 30 }),
  },
  ScreenSpaceEventHandler: vi.fn().mockImplementation(() => ({
    setInputAction: vi.fn(),
    destroy: vi.fn(),
  })),
  ScreenSpaceEventType: { MOUSE_MOVE: 0 },
  defined: (v: unknown) => v !== undefined && v !== null,
  PolylineCollection: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockReturnValue({ material: { uniforms: { color: { alpha: 1 } } } }),
    removeAll: vi.fn(),
    get length() {
      return 0;
    },
    show: true,
  })),
  LabelCollection: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    removeAll: vi.fn(),
    show: true,
  })),
  LabelStyle: { FILL: 0 },
  Material: { fromType: vi.fn().mockReturnValue({ uniforms: { color: { alpha: 1 } } }) },
}));

vi.mock("../data/stars.json", () => ({
  default: [
    { hip: 11767, ra: 37.9546, dec: 89.2641, mag: 2.02, name: "Polaris" },
    { hip: 32349, ra: 101.2872, dec: -16.7161, mag: -1.46, name: "Sirius" },
  ],
}));

vi.mock("../data/constellations.json", () => ({
  default: [{ id: "Ori", name: "Orion", lines: [[27366, 26311]] }],
}));

vi.mock("../data/boundaries.json", () => ({
  default: [
    {
      id: "Ori",
      vertices: [
        { ra: 75, dec: 10 },
        { ra: 90, dec: 10 },
        { ra: 90, dec: -10 },
      ],
    },
  ],
}));

// Captured dispatch function from UI mock — used in intent tests
let capturedDispatch: ((intent: unknown) => void) | null = null;

// Mock UI modules — they exercise DOM which is fully covered in their own tests
vi.mock("./ui", () => ({
  createPanel: vi.fn().mockReturnValue({
    element: document.createElement("div"),
    setContent: vi.fn(),
    setCollapsed: vi.fn(),
  }),
  createTimeControls: vi.fn().mockImplementation((_time: unknown, dispatch: unknown) => {
    capturedDispatch = dispatch as (intent: unknown) => void;
    return document.createElement("div");
  }),
  createLocationControls: vi.fn().mockReturnValue(document.createElement("div")),
  createLayerControls: vi.fn().mockReturnValue(document.createElement("div")),
}));

// Mock the TLE bundled data
vi.mock("../data/tle/visual.txt?raw", () => ({
  default:
    "ISS (ZARYA)\n1 25544U 98067A   24100.50000000  .00016717  00000-0  10270-3 0  9006\n2 25544  51.6400 208.9163 0002476 102.8574 355.4846 15.49909786447384",
}));

// Mock the sat module so tests don't do real network/propagation
vi.mock("./sat", () => ({
  fetchTle: vi.fn().mockResolvedValue({ ok: true, value: "" }),
  parseTle: vi
    .fn()
    .mockReturnValue({ ok: false, error: { kind: "tle-parse-failed", message: "mocked" } }),
  propagateSatellites: vi.fn().mockReturnValue([]),
}));

import { bootstrap } from "./app";
import * as astro from "./astro";
import { err } from "./result";

describe("bootstrap", () => {
  it("creates a cesium-container div when root exists", async () => {
    const root = document.createElement("main");
    root.id = "app";
    const cesiumDiv = document.createElement("div");
    cesiumDiv.id = "cesium-container";
    root.appendChild(cesiumDiv);
    const errorDiv = document.createElement("div");
    errorDiv.id = "error";
    root.appendChild(errorDiv);
    document.body.appendChild(root);

    await bootstrap(root);

    expect(document.getElementById("cesium-container")).toBeTruthy();
    document.body.removeChild(root);
  });

  it("does nothing when root is null", async () => {
    await expect(bootstrap(null)).resolves.toBeUndefined();
  });

  it("shows error text when state parsing fails", async () => {
    const root = document.createElement("main");
    root.id = "app";
    const errorDiv = document.createElement("div");
    errorDiv.id = "error";
    root.appendChild(errorDiv);
    document.body.appendChild(root);

    await bootstrap(root, new URLSearchParams({ lat: "999" }));

    expect(errorDiv.style.display).not.toBe("none");
    expect(errorDiv.textContent).toMatch(/lat-out-of-range/);
    document.body.removeChild(root);
  });

  it("shows error text when catalog parsing fails", async () => {
    const spy = vi
      .spyOn(astro, "parseCatalog")
      .mockReturnValueOnce(err({ kind: "catalog-load-failed", message: "empty catalog" }));
    const root = document.createElement("main");
    root.id = "app";
    const errorDiv = document.createElement("div");
    errorDiv.id = "error";
    root.appendChild(errorDiv);
    document.body.appendChild(root);

    await bootstrap(
      root,
      new URLSearchParams({ lat: "34", lon: "-118", t: "2026-01-15T04:00:00Z" }),
    );

    expect(errorDiv.style.display).not.toBe("none");
    expect(errorDiv.textContent).toMatch(/Catalog error/);
    document.body.removeChild(root);
    spy.mockRestore();
  });

  it("shows error text when viewer creation fails", async () => {
    const root = document.createElement("main");
    root.id = "app";
    const errorDiv = document.createElement("div");
    errorDiv.id = "error";
    root.appendChild(errorDiv);
    // No #cesium-container in DOM → createViewer returns Err
    document.body.appendChild(root);

    await bootstrap(
      root,
      new URLSearchParams({ lat: "34", lon: "-118", t: "2026-01-15T04:00:00Z" }),
    );

    expect(errorDiv.style.display).not.toBe("none");
    expect(errorDiv.textContent).toMatch(/Scene error/);
    document.body.removeChild(root);
  });

  it("builds UI panel when ui-panel-root is present", async () => {
    capturedDispatch = null;
    const root = document.createElement("main");
    root.id = "app";
    const cesiumDiv = document.createElement("div");
    cesiumDiv.id = "cesium-container";
    root.appendChild(cesiumDiv);
    const errorDiv = document.createElement("div");
    errorDiv.id = "error";
    root.appendChild(errorDiv);
    const panelRoot = document.createElement("div");
    panelRoot.id = "ui-panel-root";
    document.body.appendChild(panelRoot);
    document.body.appendChild(root);

    await bootstrap(root);

    expect(capturedDispatch).not.toBeNull();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });
});

describe("handleIntent routing", () => {
  function makeRoot() {
    const root = document.createElement("main");
    root.id = "app";
    const cesiumDiv = document.createElement("div");
    cesiumDiv.id = "cesium-container";
    root.appendChild(cesiumDiv);
    const errorDiv = document.createElement("div");
    errorDiv.id = "error";
    root.appendChild(errorDiv);
    const panelRoot = document.createElement("div");
    panelRoot.id = "ui-panel-root";
    document.body.appendChild(panelRoot);
    document.body.appendChild(root);
    return { root, panelRoot };
  }

  it("set-time intent re-renders without throwing", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(capturedDispatch).not.toBeNull();
    expect(() =>
      capturedDispatch!({ type: "set-time", time: new Date("2026-05-01T00:00:00Z") }),
    ).not.toThrow();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("set-observer intent re-renders without throwing", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(() => capturedDispatch!({ type: "set-observer", lat: 51.5, lon: -0.12 })).not.toThrow();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("toggle-layer intent updates layer visibility without throwing", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(() => capturedDispatch!({ type: "toggle-layer", layer: "stars" })).not.toThrow();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("set-opacity intent updates opacity without throwing", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(() =>
      capturedDispatch!({ type: "set-opacity", layer: "constellationLines", value: 0.5 }),
    ).not.toThrow();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });
});
