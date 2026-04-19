/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi } from "vitest";

// Mock the astro worker client so tests exercise the worker code path
// without needing a real Web Worker (jsdom doesn't support import.meta.url workers).
vi.mock("./workers/astro-worker-client", () => {
  const mockComputeAltAz = vi.fn().mockResolvedValue({
    altAzs: new Float64Array([45, 90, 30, 180]),
    visibleIndices: new Uint16Array([0, 1]),
  });
  return {
    AstroWorkerClient: vi.fn().mockImplementation(() => ({
      computeAltAz: mockComputeAltAz,
      terminate: vi.fn(),
    })),
  };
});

vi.mock("cesium", () => {
  const mockCamera = {
    setView: vi.fn(),
    direction: { x: 0, y: 0, z: 1 },
    up: { x: 0, y: 1, z: 0 },
    right: { x: 1, y: 0, z: 0 },
    frustum: { fovy: Math.PI / 3, fov: Math.PI / 3 },
  };
  return {
    Viewer: vi.fn().mockImplementation(() => ({
      scene: {
        skyBox: undefined,
        skyAtmosphere: undefined,
        sun: { show: true },
        moon: { show: true },
        backgroundColor: { red: 0, green: 0, blue: 0, alpha: 1 },
        globe: { show: true },
        primitives: { add: vi.fn() },
        canvas: document.createElement("canvas"),
        camera: mockCamera,
        pick: vi.fn().mockReturnValue(undefined),
        screenSpaceCameraController: {
          enableRotate: true,
          enableTranslate: true,
          enableZoom: true,
          enableTilt: true,
          enableLook: true,
        },
      },
      imageryLayers: { removeAll: vi.fn() },
      camera: mockCamera,
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
      {
        fromDegrees: vi.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
        cross: vi.fn((a: object, _b: object, result: object) => Object.assign(result, a)),
        normalize: vi.fn((_v: object, result: object) => result),
      },
    ),
    Color: {
      BLACK: { clone: () => ({ red: 0, green: 0, blue: 0, alpha: 1 }) },
      WHITE: { withAlpha: (a: number) => ({ red: 1, green: 1, blue: 1, alpha: a }) },
      fromCssColorString: vi.fn().mockReturnValue({
        withAlpha: (a: number) => ({ alpha: a }),
      }),
    },
    Ion: { defaultAccessToken: "" },
    Math: {
      toRadians: (d: number) => (d * Math.PI) / 180,
      toDegrees: (r: number) => (r * 180) / Math.PI,
    },
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
    ScreenSpaceEventType: {
      MOUSE_MOVE: 0,
      LEFT_DOWN: 1,
      LEFT_UP: 2,
      LEFT_CLICK: 3,
      LEFT_DOUBLE_CLICK: 4,
      WHEEL: 5,
      PINCH_START: 6,
      PINCH_MOVE: 7,
      PINCH_END: 8,
    },
    Matrix3: {
      fromQuaternion: vi.fn().mockReturnValue({}),
      multiplyByVector: vi.fn().mockReturnValue({ x: 0, y: 0, z: 1 }),
    },
    Quaternion: {
      fromAxisAngle: vi.fn().mockReturnValue({}),
      multiply: vi.fn().mockReturnValue({}),
    },
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
  };
});

vi.mock("../data/stars.json", () => ({
  default: [
    { hip: 11767, ra: 37.9546, dec: 89.2641, mag: 2.02, name: "Polaris" },
    { hip: 32349, ra: 101.2872, dec: -16.7161, mag: -1.46, name: "Sirius" },
  ],
}));

vi.mock("../data/constellations.json", () => ({
  default: [{ id: "Ori", name: "Orion", lines: [[27366, 26311]] }],
}));

vi.mock("../data/asterisms/western.json", () => ({
  default: {
    id: "western",
    name: "Western (IAU)",
    constellations: [{ id: "Ori", name: "Orion", lines: [[27366, 26311]] }],
  },
}));

vi.mock("../data/asterisms/chinese.json", () => ({
  default: {
    id: "chinese",
    name: "Chinese (Xingguan)",
    constellations: [{ id: "CON chinese 003", name: "参宿", lines: [[27989, 26727, 27366]] }],
  },
}));

vi.mock("../data/asterisms/indian.json", () => ({
  default: {
    id: "indian",
    name: "Indian (Vedic)",
    constellations: [{ id: "CON indian Aśv", name: "अश्विनी", lines: [[8832, 8903]] }],
  },
}));

vi.mock("../data/asterisms/norse_edda.json", () => ({
  default: {
    id: "norse_edda",
    name: "Norse (Edda)",
    constellations: [{ id: "CON norse_edda Bif", name: "Bifrǫst", lines: [[102098, 112158]] }],
  },
}));

vi.mock("../data/asterisms/hawaiian_starlines.json", () => ({
  default: {
    id: "hawaiian_starlines",
    name: "Hawaiian Starlines",
    constellations: [
      {
        id: "CON hawaiian_starlines KOM",
        name: "Ke Ka o Makali`i",
        lines: [[32349, 37279, 37826]],
      },
    ],
  },
}));

vi.mock("../data/asterisms/maori.json", () => ({
  default: {
    id: "maori",
    name: "Māori",
    constellations: [{ id: "CON maori 001", name: "Taki-o-Autahi", lines: [[61084, 60718]] }],
  },
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
    setNightVision: vi.fn(),
  }),
  createLocationControls: vi.fn().mockReturnValue(document.createElement("div")),
  createLayerControls: vi.fn().mockReturnValue(document.createElement("div")),
  createViewControls: vi.fn().mockReturnValue(document.createElement("div")),
  createPlanetInfo: vi.fn().mockReturnValue(document.createElement("div")),
  createSearch: vi.fn().mockReturnValue(document.createElement("div")),
  createFovControls: vi.fn().mockReturnValue(document.createElement("div")),
  createEventsPanel: vi.fn().mockReturnValue(document.createElement("div")),
  createHelpModal: vi.fn().mockReturnValue({
    element: document.createElement("div"),
    open: vi.fn(),
    close: vi.fn(),
    isOpen: vi.fn().mockReturnValue(false),
  }),
  createBottomHud: vi.fn().mockImplementation((_initial: unknown, dispatch: unknown) => {
    capturedDispatch = dispatch as (intent: unknown) => void;
    const element = document.createElement("div");
    element.dataset.testid = "bottom-hud";
    return {
      element,
      setTime: vi.fn(),
      setObserver: vi.fn(),
      setCompass: vi.fn(),
      destroy: vi.fn(),
    };
  }),
}));

// Mock the TLE bundled data
vi.mock("../data/tle/visual.txt?raw", () => ({
  default:
    "ISS (ZARYA)\n1 25544U 98067A   24100.50000000  .00016717  00000-0  10270-3 0  9006\n2 25544  51.6400 208.9163 0002476 102.8574 355.4846 15.49909786447384",
}));

// Mock the sat module so tests don't do real network/propagation
vi.mock("./sat", () => ({
  fetchTle: vi.fn().mockResolvedValue({ ok: true, value: "" }),
  parseTle: vi.fn().mockReturnValue({ ok: true, value: [] }),
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

  it("wheel gesture re-renders the reticle layer via onZoom", async () => {
    capturedDispatch = null;
    const root = document.createElement("main");
    root.id = "app";
    const cesiumDiv = document.createElement("div");
    cesiumDiv.id = "cesium-container";
    root.appendChild(cesiumDiv);
    const errorDiv = document.createElement("div");
    errorDiv.id = "error";
    root.appendChild(errorDiv);
    document.body.appendChild(root);

    const cesium = await import("cesium");
    const handlerCtor = cesium.ScreenSpaceEventHandler as unknown as ReturnType<typeof vi.fn>;
    handlerCtor.mockClear();

    await bootstrap(root, new URLSearchParams({ fov: "naked-eye" }));

    // Collect WHEEL handler across all ScreenSpaceEventHandler instances
    const handlers = handlerCtor.mock.results.map(
      (r) => r.value as { setInputAction: ReturnType<typeof vi.fn> },
    );
    let wheelFn: ((delta: number) => void) | null = null;
    let doubleClickFn:
      | ((ev: { position: { x: number; y: number } }) => void)
      | null = null;
    for (const h of handlers) {
      for (const call of h.setInputAction.mock.calls) {
        const [fn, type] = call as [unknown, unknown];
        if (type === cesium.ScreenSpaceEventType.WHEEL) {
          wheelFn = fn as (delta: number) => void;
        }
        if (type === cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK) {
          doubleClickFn = fn as (ev: { position: { x: number; y: number } }) => void;
        }
      }
    }
    expect(wheelFn).not.toBeNull();
    expect(doubleClickFn).not.toBeNull();
    // Fire them — exercises resolveObjectAt, getObserver, onZoom callbacks in app.ts
    expect(() => wheelFn!(-100)).not.toThrow();
    expect(() => doubleClickFn!({ position: { x: 100, y: 100 } })).not.toThrow();

    document.body.removeChild(root);
  });

  it("registers gesture handlers (WHEEL, LEFT_DOUBLE_CLICK) on bootstrap", async () => {
    capturedDispatch = null;
    const root = document.createElement("main");
    root.id = "app";
    const cesiumDiv = document.createElement("div");
    cesiumDiv.id = "cesium-container";
    root.appendChild(cesiumDiv);
    const errorDiv = document.createElement("div");
    errorDiv.id = "error";
    root.appendChild(errorDiv);
    document.body.appendChild(root);

    const cesium = await import("cesium");
    const handlerCtor = cesium.ScreenSpaceEventHandler as unknown as ReturnType<typeof vi.fn>;
    handlerCtor.mockClear();

    await bootstrap(root);

    // Collect every event type registered across all ScreenSpaceEventHandler instances
    const handlers = handlerCtor.mock.results.map(
      (r) => r.value as { setInputAction: ReturnType<typeof vi.fn> },
    );
    const allEvents: unknown[] = handlers.flatMap((h) =>
      h.setInputAction.mock.calls.map((c: unknown[]) => c[1]),
    );
    expect(allEvents).toContain(cesium.ScreenSpaceEventType.WHEEL);
    expect(allEvents).toContain(cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
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

  it("mounts the bottom HUD on the document body", async () => {
    capturedDispatch = null;
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

    expect(document.querySelector("[data-testid='bottom-hud']")).not.toBeNull();
    expect(capturedDispatch).not.toBeNull();
    document.body.removeChild(root);
    document
      .querySelectorAll("[data-testid='bottom-hud']")
      .forEach((el) => el.parentNode?.removeChild(el));
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
    vi.useFakeTimers();
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(capturedDispatch).not.toBeNull();
    expect(() =>
      capturedDispatch!({ type: "set-time", time: new Date("2026-05-01T00:00:00Z") }),
    ).not.toThrow();
    vi.advanceTimersByTime(100);
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    vi.useRealTimers();
  });

  it("set-time preserves existing observer location and updates URL with new time only", async () => {
    vi.useFakeTimers();
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root, new URLSearchParams({ lat: "51.5", lon: "-0.12" }));
    const spy = vi.spyOn(globalThis.history, "replaceState");
    const eventTime = new Date("2026-08-12T00:00:00.000Z");
    capturedDispatch!({ type: "set-time", time: eventTime });
    const urls = spy.mock.calls.map((c) => String(c[2]));
    const lastUrl = urls[urls.length - 1]!;
    expect(lastUrl).toContain("lat=51.5");
    expect(lastUrl).toContain("lon=-0.12");
    expect(lastUrl).toContain(`t=${encodeURIComponent(eventTime.toISOString())}`);
    spy.mockRestore();
    vi.advanceTimersByTime(100);
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    vi.useRealTimers();
  });

  it("set-observer intent re-renders without throwing", async () => {
    vi.useFakeTimers();
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(() => capturedDispatch!({ type: "set-observer", lat: 51.5, lon: -0.12 })).not.toThrow();
    vi.advanceTimersByTime(100);
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    vi.useRealTimers();
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

  it("set-view intent changes camera direction without throwing", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(() => capturedDispatch!({ type: "set-view", az: 180, alt: 30 })).not.toThrow();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("toggle-night-vision intent toggles night-vision class on body", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(document.body.classList.contains("night-vision")).toBe(false);
    capturedDispatch!({ type: "toggle-night-vision" });
    expect(document.body.classList.contains("night-vision")).toBe(true);
    capturedDispatch!({ type: "toggle-night-vision" });
    expect(document.body.classList.contains("night-vision")).toBe(false);
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("nv=1 URL param applies night-vision class and button state on init", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root, new URLSearchParams({ nv: "1" }));
    expect(document.body.classList.contains("night-vision")).toBe(true);
    // clean up
    document.body.classList.remove("night-vision");
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("set-mag-limit intent schedules rerender and updates URL without throwing", async () => {
    vi.useFakeTimers();
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(() => capturedDispatch!({ type: "set-mag-limit", value: 4.0 })).not.toThrow();
    vi.advanceTimersByTime(100);
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    vi.useRealTimers();
  });

  it("now intent sets time and attempts geolocation without throwing", async () => {
    vi.useFakeTimers();
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();

    let geoSuccess: PositionCallback | null = null;
    const geolocationMock = {
      getCurrentPosition: vi.fn((success: PositionCallback) => {
        geoSuccess = success;
      }),
    };
    Object.defineProperty(navigator, "geolocation", {
      value: geolocationMock,
      configurable: true,
    });

    await bootstrap(root);
    expect(() => capturedDispatch!({ type: "now" })).not.toThrow();
    expect(geolocationMock.getCurrentPosition).toHaveBeenCalled();

    // Simulate successful geolocation response
    expect(() =>
      geoSuccess!({
        coords: { latitude: 48.85, longitude: 2.35, accuracy: 10 },
      } as GeolocationPosition),
    ).not.toThrow();

    vi.advanceTimersByTime(100);
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    vi.useRealTimers();
  });

  it("now intent updates time even when geolocation is denied", async () => {
    vi.useFakeTimers();
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();

    let geoError: PositionErrorCallback | null = null;
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: vi.fn((_success: PositionCallback, error: PositionErrorCallback) => {
          geoError = error;
        }),
      },
      configurable: true,
    });

    await bootstrap(root);
    expect(() => capturedDispatch!({ type: "now" })).not.toThrow();

    // Simulate geolocation failure (e.g. user denied)
    expect(() =>
      geoError!({ code: 1, message: "User denied" } as GeolocationPositionError),
    ).not.toThrow();

    vi.advanceTimersByTime(100);
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    vi.useRealTimers();
  });

  it("set-language intent updates URL with lang param", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    const spy = vi.spyOn(globalThis.history, "replaceState");
    await bootstrap(root);
    spy.mockClear();
    capturedDispatch!({ type: "set-language", language: "zh" });
    expect(spy).toHaveBeenCalled();
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1]!;
    expect(String(lastCall[2])).toContain("lang=zh");
    spy.mockRestore();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("set-language back to 'la' removes lang param from URL", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root, new URLSearchParams({ lang: "zh" }));
    const spy = vi.spyOn(globalThis.history, "replaceState");
    capturedDispatch!({ type: "set-language", language: "la" });
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1]!;
    expect(String(lastCall[2])).not.toContain("lang=");
    spy.mockRestore();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("set-language resets a non-western skyculture back to western", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root, new URLSearchParams({ sky: "chinese" }));
    const spy = vi.spyOn(globalThis.history, "replaceState");
    capturedDispatch!({ type: "set-language", language: "en" });
    // URL should no longer carry a non-default sky param
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1]!;
    expect(String(lastCall[2])).not.toContain("sky=chinese");
    spy.mockRestore();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("now intent handles missing geolocation API gracefully", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();

    Object.defineProperty(navigator, "geolocation", {
      value: undefined,
      configurable: true,
    });

    await bootstrap(root);
    expect(() => capturedDispatch!({ type: "now" })).not.toThrow();

    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("show-trail intent with a valid body id does not throw", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(() =>
      capturedDispatch!({ type: "show-trail", objectKind: "body", id: "Mars" }),
    ).not.toThrow();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("show-trail intent with an unknown id does not throw", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(() =>
      capturedDispatch!({ type: "show-trail", objectKind: "body", id: "NotAPlanet" }),
    ).not.toThrow();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("hide-trail intent after show-trail does not throw", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    capturedDispatch!({ type: "show-trail", objectKind: "body", id: "Sun" });
    expect(() => capturedDispatch!({ type: "hide-trail" })).not.toThrow();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("set-fov intent updates reticle preset without throwing", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(() => capturedDispatch!({ type: "set-fov", preset: "binoculars" })).not.toThrow();
    expect(() => capturedDispatch!({ type: "set-fov", preset: "off" })).not.toThrow();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("set-skyculture intent updates URL with sky param", async () => {
    vi.useFakeTimers();
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    const spy = vi.spyOn(globalThis.history, "replaceState");
    await bootstrap(root);
    spy.mockClear();
    capturedDispatch!({ type: "set-skyculture", id: "chinese" });
    expect(spy).toHaveBeenCalled();
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1]!;
    expect(String(lastCall[2])).toContain("sky=chinese");
    spy.mockRestore();
    vi.advanceTimersByTime(100);
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    vi.useRealTimers();
  });

  it("open-location-picker intent is handled without throwing (stub)", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(() => capturedDispatch!({ type: "open-location-picker" })).not.toThrow();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("toggle-animation intent is handled without throwing (stub)", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(() => capturedDispatch!({ type: "toggle-animation" })).not.toThrow();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("set-skyculture back to 'western' removes sky param from URL", async () => {
    vi.useFakeTimers();
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root, new URLSearchParams({ sky: "chinese" }));
    const spy = vi.spyOn(globalThis.history, "replaceState");
    capturedDispatch!({ type: "set-skyculture", id: "western" });
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1]!;
    expect(String(lastCall[2])).not.toContain("sky=");
    spy.mockRestore();
    vi.advanceTimersByTime(100);
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    vi.useRealTimers();
  });
});
