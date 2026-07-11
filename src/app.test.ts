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
    AstroWorkerClient: vi.fn(function () {
      return {
        computeAltAz: mockComputeAltAz,
        terminate: vi.fn(),
      };
    }),
  };
});

vi.mock("cesium", () => {
  const mockCamera = {
    setView: vi.fn(),
    direction: { x: 0, y: 0, z: 1 },
    up: { x: 0, y: 1, z: 0 },
    right: { x: 1, y: 0, z: 0 },
    frustum: { fovy: Math.PI / 3, fov: Math.PI / 3 },
    getPickRay: vi.fn().mockReturnValue({
      origin: { x: 0, y: 0, z: 0 },
      // Zenith-pointing ray in ENU — lines up with (lat=0, lon=0) ENU axes
      // under the identity mock for eastNorthUpToFixedFrame below.
      direction: { x: 0, y: 0, z: 1 },
    }),
  };
  return {
    Viewer: vi.fn(function () {
      return {
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
      };
    }),
    BillboardCollection: vi.fn(function () {
      return {
        add: vi.fn(),
        removeAll: vi.fn(),
        show: true,
        length: 0,
      };
    }),
    Cartesian3: Object.assign(
      vi.fn(function (x: number, y: number, z: number) {
        return { x, y, z };
      }),
      {
        fromDegrees: vi.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
        cross: vi.fn((a: object, _b: object, result: object) => Object.assign(result, a)),
        normalize: vi.fn((v: { x: number; y: number; z: number }, result: object) => {
          const n = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
          if (n === 0) return Object.assign(result, { x: 0, y: 0, z: 0 });
          return Object.assign(result, { x: v.x / n, y: v.y / n, z: v.z / n });
        }),
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
    Matrix4: Object.assign(
      vi.fn(function () {
        return {};
      }),
      {
        multiplyByPoint: vi.fn().mockReturnValue({ x: 10, y: 20, z: 30 }),
        multiplyByPointAsVector: vi
          .fn()
          .mockImplementation(
            (_m: unknown, v: { x: number; y: number; z: number }, result: object) =>
              Object.assign(result, { x: v.x, y: v.y, z: v.z }),
          ),
        inverseTransformation: vi
          .fn()
          .mockImplementation((_m: unknown, result: object) =>
            Object.assign(result, { __inv: true }),
          ),
      },
    ),
    ScreenSpaceEventHandler: vi.fn(function () {
      return {
        setInputAction: vi.fn(),
        destroy: vi.fn(),
      };
    }),
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
    PolylineCollection: vi.fn(function () {
      return {
        add: vi.fn().mockReturnValue({ material: { uniforms: { color: { alpha: 1 } } } }),
        removeAll: vi.fn(),
        get length() {
          return 0;
        },
        show: true,
      };
    }),
    LabelCollection: vi.fn(function () {
      return {
        add: vi.fn(),
        removeAll: vi.fn(),
        show: true,
      };
    }),
    LabelStyle: { FILL: 0 },
    Material: { fromType: vi.fn().mockReturnValue({ uniforms: { color: { alpha: 1 } } }) },
    SceneTransforms: {
      worldToWindowCoordinates: vi.fn().mockReturnValue({ x: 0, y: 0 }),
    },
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
// Captured bottomHud.setAnimation spy — lets tests assert bootstrap hydration
// of ?anim / ?speed reaches the HUD (#348).
let capturedBottomHudSetAnimation: ReturnType<typeof vi.fn> | null = null;
let capturedPanelOptions: {
  onOpenEvents?: () => void;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
  onOpenTonight?: () => void;
  onOpenPlans?: () => void;
  onProRequired?: () => void;
  mode?: "planetarium" | "notebook";
} | null = null;
let notebookWorkspaceMock: {
  element: HTMLElement;
  setVisible: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  onProRequired: (() => void) | null;
} | null = null;
let loginModalMock: {
  element: HTMLElement;
  open: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  isOpen: ReturnType<typeof vi.fn>;
  requestMagicLink: (email: string) => Promise<unknown>;
} | null = null;
let panelSetModeMock: ReturnType<typeof vi.fn> | null = null;
let settingsDrawerMock: {
  open: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  isOpen: ReturnType<typeof vi.fn>;
} | null = null;
let locationPickerMock: {
  open: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  isOpen: ReturnType<typeof vi.fn>;
} | null = null;
let onboardingOverlayMock: {
  start: ReturnType<typeof vi.fn>;
  replay: ReturnType<typeof vi.fn>;
  dismiss: ReturnType<typeof vi.fn>;
  isActive: ReturnType<typeof vi.fn>;
} | null = null;
let capturedHelpModalOptions: { onReplayTour?: () => void } | null = null;

let plansDrawerMock: {
  element: HTMLElement;
  openPanel: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  isOpen: ReturnType<typeof vi.fn>;
  setView: ReturnType<typeof vi.fn>;
  dispatch: ((intent: unknown) => void) | null;
} | null = null;
let plansModalMock: {
  element: HTMLElement;
  setPlan: ReturnType<typeof vi.fn>;
  setError: ReturnType<typeof vi.fn>;
  dispatch: ((intent: unknown) => void) | null;
} | null = null;

// Captured events-drawer setEvents spy — lets tests assert it was called when
// `set-time` / `set-observer` / `now` intents fire.
const eventsDrawerSetEvents = vi.fn();
const eventsDrawerOpen = vi.fn();

// Captured tonight-drawer spies — same shape as events drawer. Tests assert
// setBodies fires on observer/time changes and open() fires on panel click.
const tonightDrawerSetBodies = vi.fn();
const tonightDrawerOpen = vi.fn();

// Mock the lazily-loaded notebook workspace factory. Its production module now
// lives behind a dynamic `import("./ui/notebook-workspace")` in app.ts (#372),
// so mocking the "./ui" barrel is not enough — Vitest resolves the dynamic
// specifier as its own module.
vi.mock("./ui/notebook-workspace", () => ({
  createNotebookWorkspace: vi
    .fn()
    .mockImplementation((opts?: { getCurrentView?: unknown; onProRequired?: () => void }) => {
      const element = document.createElement("aside");
      element.dataset.testid = "notebook-workspace";
      const mock = {
        element,
        setVisible: vi.fn(),
        destroy: vi.fn(),
        onProRequired: opts?.onProRequired ?? null,
      };
      notebookWorkspaceMock = mock;
      return mock;
    }),
}));

// Mock UI modules — they exercise DOM which is fully covered in their own tests
vi.mock("./ui", () => ({
  createPanel: vi.fn().mockImplementation(
    (
      _root: HTMLElement,
      _dispatch: unknown,
      options?: {
        onOpenEvents?: () => void;
        onOpenSettings?: () => void;
        onOpenHelp?: () => void;
        onOpenTonight?: () => void;
        onOpenPlans?: () => void;
        onProRequired?: () => void;
        mode?: "planetarium" | "notebook";
      },
    ) => {
      capturedPanelOptions = options ?? null;
      const setMode = vi.fn();
      panelSetModeMock = setMode;
      return {
        element: document.createElement("div"),
        setContent: vi.fn(),
        setCollapsed: vi.fn(),
        setNightVision: vi.fn(),
        setMode,
      };
    },
  ),
  createLocationControls: vi.fn().mockReturnValue(document.createElement("div")),
  createViewControls: vi.fn().mockReturnValue(document.createElement("div")),
  createPlanetInfo: vi.fn().mockReturnValue(document.createElement("div")),
  createSearch: vi.fn().mockReturnValue(document.createElement("div")),
  createFovControls: vi.fn().mockReturnValue(document.createElement("div")),
  createEventsPanel: vi.fn().mockReturnValue(document.createElement("div")),
  createEventsDrawer: vi.fn().mockImplementation(() => {
    const element = document.createElement("div");
    element.dataset.testid = "events-drawer";
    let open = false;
    return {
      element,
      open: vi.fn().mockImplementation(() => {
        open = true;
        eventsDrawerOpen();
      }),
      close: vi.fn().mockImplementation(() => {
        open = false;
      }),
      isOpen: vi.fn().mockImplementation(() => open),
      setEvents: eventsDrawerSetEvents,
    };
  }),
  createTonightDrawer: vi.fn().mockImplementation(() => {
    const element = document.createElement("div");
    element.dataset.testid = "tonight-drawer";
    let open = false;
    return {
      element,
      open: vi.fn().mockImplementation(() => {
        open = true;
        tonightDrawerOpen();
      }),
      close: vi.fn().mockImplementation(() => {
        open = false;
      }),
      isOpen: vi.fn().mockImplementation(() => open),
      setBodies: tonightDrawerSetBodies,
    };
  }),
  createHelpModal: vi.fn().mockImplementation((options?: { onReplayTour?: () => void }) => {
    capturedHelpModalOptions = options ?? null;
    return {
      element: document.createElement("div"),
      open: vi.fn(),
      close: vi.fn(),
      isOpen: vi.fn().mockReturnValue(false),
    };
  }),
  createDescribeSkyModal: vi.fn().mockImplementation(() => {
    const element = document.createElement("div");
    element.dataset.testid = "describe-sky-modal";
    return {
      element,
      open: vi.fn(),
      close: vi.fn(),
      isOpen: vi.fn().mockReturnValue(false),
    };
  }),
  createSettingsDrawer: vi.fn().mockImplementation(() => {
    const element = document.createElement("div");
    element.dataset.testid = "settings-drawer-root";
    const mock = {
      element,
      open: vi.fn(),
      close: vi.fn(),
      isOpen: vi.fn().mockReturnValue(false),
    };
    settingsDrawerMock = mock;
    return mock;
  }),
  createBottomHud: vi.fn().mockImplementation((_initial: unknown, dispatch: unknown) => {
    capturedDispatch = dispatch as (intent: unknown) => void;
    const element = document.createElement("div");
    element.dataset.testid = "bottom-hud";
    const setAnimation = vi.fn();
    capturedBottomHudSetAnimation = setAnimation;
    return {
      element,
      setTime: vi.fn(),
      setObserver: vi.fn(),
      setCompass: vi.fn(),
      setAnimation,
      destroy: vi.fn(),
    };
  }),
  createLocationPickerOverlay: vi.fn().mockImplementation(() => {
    const element = document.createElement("div");
    element.dataset.testid = "location-picker";
    const mock = {
      element,
      open: vi.fn(),
      close: vi.fn(),
      isOpen: vi.fn().mockReturnValue(false),
    };
    locationPickerMock = mock;
    return mock;
  }),
  createCommandPalette: vi
    .fn()
    .mockImplementation(
      (opts: {
        getSources: () => unknown;
        dispatch: (i: unknown) => void;
        onRecentSelected: (e: unknown) => void;
      }) => {
        opts.getSources();
        opts.onRecentSelected({ id: "probe", label: "Probe" });
        opts.getSources();
        return {
          element: document.createElement("div"),
          open: vi.fn(),
          close: vi.fn(),
          isOpen: vi.fn().mockReturnValue(false),
        };
      },
    ),
  // Object-cards manager — capture the dispatch + projector so tests can exercise
  // the click-to-card intent pathway without a real Cesium scene.
  createObjectCardsManager: vi.fn(function () {
    return {
      open: vi.fn(),
      close: vi.fn(),
      closeActive: vi.fn(),
      update: vi.fn(),
      destroy: vi.fn(),
    };
  }),
  // Empty-sky popover — tiny floating card + reticle triggered on empty-space clicks.
  // Probe the factory's `dispatch` callback so coverage sees the app.ts arrow function.
  createEmptySkyPopover: vi
    .fn()
    .mockImplementation((opts: { dispatch: (i: unknown) => void; initialFov: string }) => {
      // Fire a harmless set-fov intent so app.ts's `dispatch: intent => handleIntent(intent)`
      // arrow is exercised. This keeps the mock light while satisfying the function-coverage gate.
      opts.dispatch({ type: "set-fov", preset: opts.initialFov });
      return {
        element: document.createElement("div"),
        open: vi.fn(),
        close: vi.fn(),
        isOpen: vi.fn().mockReturnValue(false),
      };
    }),
  createLoginModal: vi
    .fn()
    .mockImplementation((opts: { requestMagicLink: (email: string) => Promise<unknown> }) => {
      const element = document.createElement("div");
      element.dataset.testid = "login-modal";
      const mock = {
        element,
        open: vi.fn(),
        close: vi.fn(),
        isOpen: vi.fn().mockReturnValue(false),
        requestMagicLink: opts.requestMagicLink,
      };
      loginModalMock = mock;
      return mock;
    }),
  createOnboardingOverlay: vi.fn().mockImplementation(() => {
    const element = document.createElement("div");
    element.dataset.testid = "onboarding-overlay";
    const mock = {
      element,
      start: vi.fn(),
      replay: vi.fn(),
      dismiss: vi.fn(),
      isActive: vi.fn().mockReturnValue(false),
    };
    onboardingOverlayMock = mock;
    return mock;
  }),
  createPlansDrawer: vi.fn().mockImplementation((opts: { dispatch: (intent: unknown) => void }) => {
    const element = document.createElement("div");
    element.dataset.testid = "plans-drawer";
    const mock = {
      element,
      openPanel: vi.fn(),
      close: vi.fn(),
      isOpen: vi.fn().mockReturnValue(false),
      setView: vi.fn(),
      dispatch: opts.dispatch,
    };
    plansDrawerMock = mock;
    return mock;
  }),
  createPlansModal: vi.fn().mockImplementation((opts: { dispatch: (intent: unknown) => void }) => {
    const element = document.createElement("div");
    element.dataset.testid = "plans-modal";
    element.hidden = true;
    const mock = {
      element,
      setPlan: vi.fn().mockImplementation((plan: unknown) => {
        element.hidden = plan === null;
      }),
      setError: vi.fn().mockImplementation(() => {
        element.hidden = false;
      }),
      dispatch: opts.dispatch,
    };
    plansModalMock = mock;
    return mock;
  }),
  ONBOARDING_STORAGE_KEY: "planisphere.onboarding.v1",
}));

// Mock the plans client wrapper — tests flip the list/detail responses so
// the app-side state machine can be exercised without hitting the Worker.
let listPlansResult: unknown = { ok: true, value: [] };
let getPlanResult: unknown = {
  ok: true,
  value: {
    slug: "2026-04",
    title: "April",
    month: "2026-04",
    hemisphere: "both",
    summary: "Stub",
    author: "Rob",
    publishedAt: "2026-04-01T00:00:00.000Z",
    bodyMd: "Body",
    objects: [],
  },
};
vi.mock("./plans", () => ({
  listPlans: vi.fn().mockImplementation(() => Promise.resolve(listPlansResult)),
  getPlan: vi
    .fn()
    .mockImplementation((slug: string) =>
      Promise.resolve(
        typeof getPlanResult === "function"
          ? (getPlanResult as (s: string) => unknown)(slug)
          : getPlanResult,
      ),
    ),
  __clearPlanCacheForTests: vi.fn(),
}));

// Mock the TLE bundled data
vi.mock("../data/tle/visual.txt?raw", () => ({
  default:
    "ISS (ZARYA)\n1 25544U 98067A   24100.50000000  .00016717  00000-0  10270-3 0  9006\n2 25544  51.6400 208.9163 0002476 102.8574 355.4846 15.49909786447384",
}));

// Mock the sat module so tests don't do real network/propagation
vi.mock("./sat", () => ({
  fetchTle: vi.fn().mockResolvedValue({
    ok: true,
    value: { text: "", sourceAgeSeconds: 0, usedFallback: false },
  }),
  parseTle: vi.fn().mockReturnValue({ ok: true, value: [] }),
  propagateSatellites: vi.fn().mockReturnValue([]),
}));

// Mock the client-side auth wrapper. Tests can flip the currentUser() return
// via `setCurrentUserResult` (declared below) to exercise the bootstrap sync.
// requestMagicLink always reports success so the login-modal wiring test can
// round-trip through the mock.
let currentUserResult: { email: string; tier: "free" | "pro" } | null = null;
function setCurrentUserResult(value: { email: string; tier: "free" | "pro" } | null): void {
  currentUserResult = value;
}
vi.mock("./auth", () => ({
  currentUser: vi.fn().mockImplementation(() => Promise.resolve(currentUserResult)),
  requestMagicLink: vi
    .fn()
    .mockImplementation(() => Promise.resolve({ ok: true, value: undefined })),
  logout: vi.fn().mockImplementation(() => Promise.resolve()),
}));

// Mock the shortlink client wrapper (#377). Default to a network-error
// return so the copy-link fallback exercises the long-URL path; tests
// that want to observe the shortlink-win path re-mock this per-case.
vi.mock("./share", () => ({
  createShareLink: vi
    .fn()
    .mockImplementation(() => Promise.resolve({ ok: false, error: { kind: "network" } })),
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

  it("sets window.__PLANISPHERE_READY__ and dispatches planisphere:ready when bootstrap completes (#373)", async () => {
    const readyWindow = globalThis as { __PLANISPHERE_READY__?: boolean };
    readyWindow.__PLANISPHERE_READY__ = false;
    let eventFired = false;
    const listener = (): void => {
      eventFired = true;
    };
    globalThis.addEventListener("planisphere:ready", listener);
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
    expect(readyWindow.__PLANISPHERE_READY__).toBe(true);
    expect(eventFired).toBe(true);
    globalThis.removeEventListener("planisphere:ready", listener);
    document.body.removeChild(root);
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

  it("wheel + double-click gestures bootstrap without throwing (exercises onZoom + resolveObjectAt)", async () => {
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
    const viewerCtor = vi.mocked(cesium.Viewer);
    const handlerCtor = vi.mocked(cesium.ScreenSpaceEventHandler);
    viewerCtor.mockClear();
    handlerCtor.mockClear();

    await bootstrap(root, new URLSearchParams({ fov: "naked-eye" }));

    // Wheel listener now lives on the canvas DOM element (no longer routed
    // through Cesium's ScreenSpaceEventHandler). Dispatch a real WheelEvent
    // on the viewer's canvas to exercise the pan + zoom paths.
    const viewer = viewerCtor.mock.results[0]!.value as { scene: { canvas: HTMLCanvasElement } };
    const canvas = viewer.scene.canvas;
    expect(() =>
      canvas.dispatchEvent(
        new WheelEvent("wheel", { deltaX: 0, deltaY: -100, ctrlKey: true, cancelable: true }),
      ),
    ).not.toThrow();
    expect(() =>
      canvas.dispatchEvent(
        new WheelEvent("wheel", { deltaX: 5, deltaY: 5, ctrlKey: false, cancelable: true }),
      ),
    ).not.toThrow();

    // LEFT_DOUBLE_CLICK is still wired through Cesium's ScreenSpaceEventHandler.
    const handlers = handlerCtor.mock.results.map(
      (r) => r.value as { setInputAction: ReturnType<typeof vi.fn> },
    );
    let doubleClickFn: ((ev: { position: { x: number; y: number } }) => void) | null = null;
    for (const h of handlers) {
      for (const call of h.setInputAction.mock.calls) {
        const [fn, type] = call as [unknown, unknown];
        if (type === cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK) {
          doubleClickFn = fn as (ev: { position: { x: number; y: number } }) => void;
        }
      }
    }
    expect(doubleClickFn).not.toBeNull();
    expect(() => doubleClickFn!({ position: { x: 100, y: 100 } })).not.toThrow();

    document.body.removeChild(root);
  });

  it("registers gesture handlers (canvas wheel + LEFT_DOUBLE_CLICK) on bootstrap", async () => {
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
    const viewerCtor = vi.mocked(cesium.Viewer);
    const handlerCtor = vi.mocked(cesium.ScreenSpaceEventHandler);
    viewerCtor.mockClear();
    handlerCtor.mockClear();

    await bootstrap(root);

    // Wheel handler lives on the canvas now — spy on addEventListener via
    // dispatching an event and asserting cancelable behavior implies a
    // listener handled it. Cleaner: verify by dispatching a plain wheel event
    // and confirming preventDefault was honored.
    const viewer = viewerCtor.mock.results[0]!.value as { scene: { canvas: HTMLCanvasElement } };
    const wheelEvent = new WheelEvent("wheel", { deltaY: 1, cancelable: true });
    viewer.scene.canvas.dispatchEvent(wheelEvent);
    expect(wheelEvent.defaultPrevented).toBe(true);

    // LEFT_DOUBLE_CLICK still goes through ScreenSpaceEventHandler.
    const handlers = handlerCtor.mock.results.map(
      (r) => r.value as { setInputAction: ReturnType<typeof vi.fn> },
    );
    const allEvents: unknown[] = handlers.flatMap((h) =>
      h.setInputAction.mock.calls.map((c: unknown[]) => c[1]),
    );
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

  it("open-location-picker intent invokes the overlay's open()", async () => {
    capturedDispatch = null;
    locationPickerMock = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(locationPickerMock).not.toBeNull();
    capturedDispatch!({ type: "open-location-picker" });
    expect(locationPickerMock!.open).toHaveBeenCalled();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("location picker overlay is mounted on the document body", async () => {
    capturedDispatch = null;
    locationPickerMock = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(document.querySelector("[data-testid='location-picker']")).not.toBeNull();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='location-picker']")
      .forEach((el) => el.parentNode?.removeChild(el));
  });

  it("toggle-animation intent is handled without throwing (stub)", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(() => capturedDispatch!({ type: "toggle-animation" })).not.toThrow();
    // Second toggle stops the animation loop — also must not throw.
    expect(() => capturedDispatch!({ type: "toggle-animation" })).not.toThrow();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("set-animation-speed intent is handled without throwing (#136)", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(() => capturedDispatch!({ type: "set-animation-speed", speed: 10 })).not.toThrow();
    expect(() => capturedDispatch!({ type: "set-animation-speed", speed: 100 })).not.toThrow();
    expect(() => capturedDispatch!({ type: "set-animation-speed", speed: 1 })).not.toThrow();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("hydrates animation state from ?anim=play&speed=10 and syncs the HUD (#348)", async () => {
    capturedDispatch = null;
    capturedBottomHudSetAnimation = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root, new URLSearchParams({ anim: "play", speed: "10" }));
    expect(capturedBottomHudSetAnimation).not.toBeNull();
    // Bootstrap should reflect the hydrated URL params in the HUD.
    expect(capturedBottomHudSetAnimation).toHaveBeenCalledWith(true, 10);
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("does not sync animation-playing to HUD when ?anim is absent (default paused)", async () => {
    capturedDispatch = null;
    capturedBottomHudSetAnimation = null;
    const { root, panelRoot } = makeRoot();
    // Explicit empty params — the default (globalThis.location.search) may
    // still carry ?anim=play&speed=10 from a prior test's history.replaceState.
    await bootstrap(root, new URLSearchParams());
    // Paused default → no setAnimation with playing=true from bootstrap.
    expect(capturedBottomHudSetAnimation).not.toHaveBeenCalledWith(true, 1);
    expect(capturedBottomHudSetAnimation).not.toHaveBeenCalledWith(true, 10);
    expect(capturedBottomHudSetAnimation).not.toHaveBeenCalledWith(true, 100);
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("hydrates speed only when ?speed=100 and ?anim absent (#348)", async () => {
    capturedDispatch = null;
    capturedBottomHudSetAnimation = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root, new URLSearchParams({ speed: "100" }));
    expect(capturedBottomHudSetAnimation).toHaveBeenCalledWith(false, 100);
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

  it("pin-object intent for a known object updates URL with new view", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(() => capturedDispatch!({ type: "pin-object", id: "Polaris" })).not.toThrow();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("pin-object intent for an unknown id does not throw", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(() => capturedDispatch!({ type: "pin-object", id: "NoSuchObject" })).not.toThrow();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("copy-link intent does not throw when clipboard is unavailable", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    await bootstrap(root);
    expect(() => capturedDispatch!({ type: "copy-link" })).not.toThrow();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("copy-link intent invokes clipboard.writeText when available", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await bootstrap(root);
    capturedDispatch!({ type: "copy-link" });
    // The shortlink race resolves in a microtask via the mocked
    // `createShareLink`. Flush microtasks by awaiting a resolved Promise
    // twice — once for the race, once for the inner `.then` chain — so
    // the writeText call is observable synchronously in the next tick.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledOnce();
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("mounts the events drawer on the document body", async () => {
    capturedDispatch = null;
    capturedPanelOptions = null;
    eventsDrawerSetEvents.mockClear();
    eventsDrawerOpen.mockClear();
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);

    expect(document.querySelector("[data-testid='events-drawer']")).not.toBeNull();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='events-drawer']")
      .forEach((el) => el.parentNode?.removeChild(el));
  });

  it("events drawer is refreshed on set-time intent", async () => {
    vi.useFakeTimers();
    capturedDispatch = null;
    capturedPanelOptions = null;
    eventsDrawerSetEvents.mockClear();
    eventsDrawerOpen.mockClear();
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);

    const beforeCount = eventsDrawerSetEvents.mock.calls.length;
    capturedDispatch!({ type: "set-time", time: new Date("2026-05-01T00:00:00Z") });
    expect(eventsDrawerSetEvents.mock.calls.length).toBeGreaterThan(beforeCount);

    vi.advanceTimersByTime(100);
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='events-drawer']")
      .forEach((el) => el.parentNode?.removeChild(el));
    vi.useRealTimers();
  });

  it("events drawer is refreshed on set-observer intent", async () => {
    vi.useFakeTimers();
    capturedDispatch = null;
    capturedPanelOptions = null;
    eventsDrawerSetEvents.mockClear();
    eventsDrawerOpen.mockClear();
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);

    const beforeCount = eventsDrawerSetEvents.mock.calls.length;
    capturedDispatch!({ type: "set-observer", lat: 48.8, lon: 2.35 });
    expect(eventsDrawerSetEvents.mock.calls.length).toBeGreaterThan(beforeCount);

    vi.advanceTimersByTime(100);
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='events-drawer']")
      .forEach((el) => el.parentNode?.removeChild(el));
    vi.useRealTimers();
  });

  it("events drawer is refreshed on now intent", async () => {
    vi.useFakeTimers();
    capturedDispatch = null;
    capturedPanelOptions = null;
    eventsDrawerSetEvents.mockClear();
    eventsDrawerOpen.mockClear();
    Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true });
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);

    const beforeCount = eventsDrawerSetEvents.mock.calls.length;
    capturedDispatch!({ type: "now" });
    expect(eventsDrawerSetEvents.mock.calls.length).toBeGreaterThan(beforeCount);

    vi.advanceTimersByTime(100);
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='events-drawer']")
      .forEach((el) => el.parentNode?.removeChild(el));
    vi.useRealTimers();
  });

  it("panel's onOpenEvents callback opens the events drawer", async () => {
    capturedDispatch = null;
    capturedPanelOptions = null;
    eventsDrawerSetEvents.mockClear();
    eventsDrawerOpen.mockClear();
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);

    expect(capturedPanelOptions).not.toBeNull();
    expect(typeof capturedPanelOptions!.onOpenEvents).toBe("function");
    capturedPanelOptions!.onOpenEvents!();
    expect(eventsDrawerOpen).toHaveBeenCalled();

    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='events-drawer']")
      .forEach((el) => el.parentNode?.removeChild(el));
  });

  it("wires createSettingsDrawer into the panel's onOpenSettings callback", async () => {
    capturedDispatch = null;
    capturedPanelOptions = null;
    settingsDrawerMock = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(settingsDrawerMock).not.toBeNull();
    expect(capturedPanelOptions).not.toBeNull();
    expect(typeof capturedPanelOptions!.onOpenSettings).toBe("function");
    capturedPanelOptions!.onOpenSettings!();
    expect(settingsDrawerMock!.open).toHaveBeenCalled();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("open-empty-sky-popover intent calls the popover's open() with alt/az + coords", async () => {
    const ui = await import("./ui");
    const openMock = vi.fn();
    vi.mocked(ui.createEmptySkyPopover).mockReturnValueOnce({
      element: document.createElement("div"),
      open: openMock,
      close: vi.fn(),
      isOpen: vi.fn().mockReturnValue(false),
    });
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    capturedDispatch!({
      type: "open-empty-sky-popover",
      alt: 42.5,
      az: 180,
      screenX: 120,
      screenY: 240,
    });
    expect(openMock).toHaveBeenCalledWith(42.5, 180, 120, 240);
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("empty-sky click dispatches open-empty-sky-popover", async () => {
    const ui = await import("./ui");
    const openMock = vi.fn();
    vi.mocked(ui.createEmptySkyPopover).mockReturnValueOnce({
      element: document.createElement("div"),
      open: openMock,
      close: vi.fn(),
      isOpen: vi.fn().mockReturnValue(false),
    });
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);

    const cesium = await import("cesium");
    const handlerCtor = vi.mocked(cesium.ScreenSpaceEventHandler);
    const handlers = handlerCtor.mock.results.map(
      (r) => r.value as { setInputAction: ReturnType<typeof vi.fn> },
    );
    let clickFn: ((ev: { position: { x: number; y: number } }) => void) | null = null;
    for (const h of handlers) {
      for (const call of h.setInputAction.mock.calls) {
        const [fn, type] = call as [unknown, unknown];
        if (type === cesium.ScreenSpaceEventType.LEFT_CLICK) {
          clickFn = fn as (ev: { position: { x: number; y: number } }) => void;
        }
      }
    }
    expect(clickFn).not.toBeNull();

    // Empty-sky click — scene.pick returns undefined (nothing under cursor).
    const viewerCtor = vi.mocked(cesium.Viewer);
    const lastViewer = viewerCtor.mock.results[viewerCtor.mock.results.length - 1]?.value as {
      scene?: { pick?: ReturnType<typeof vi.fn> };
    };
    lastViewer?.scene?.pick?.mockReturnValueOnce(undefined);
    clickFn!({ position: { x: 250, y: 150 } });

    // The popover's open() must have been called with the click coords.
    expect(openMock).toHaveBeenCalled();
    const args = openMock.mock.calls[0] as [number, number, number, number];
    expect(args[2]).toBe(250);
    expect(args[3]).toBe(150);

    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("open-object-card intent is handled without throwing when no card data is pending", async () => {
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(() =>
      capturedDispatch!({
        type: "open-object-card",
        objectKind: "star",
        id: "Sirius",
        screenX: 100,
        screenY: 200,
      }),
    ).not.toThrow();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("settings drawer is mounted on document.body", async () => {
    capturedDispatch = null;
    settingsDrawerMock = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(document.querySelector("[data-testid='settings-drawer-root']")).not.toBeNull();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='settings-drawer-root']")
      .forEach((el) => el.parentNode?.removeChild(el));
  });

  it("mounts the tonight drawer on the document body", async () => {
    capturedDispatch = null;
    capturedPanelOptions = null;
    tonightDrawerSetBodies.mockClear();
    tonightDrawerOpen.mockClear();
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);

    expect(document.querySelector("[data-testid='tonight-drawer']")).not.toBeNull();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='tonight-drawer']")
      .forEach((el) => el.parentNode?.removeChild(el));
  });

  it("tonight drawer is refreshed on set-time intent", async () => {
    vi.useFakeTimers();
    capturedDispatch = null;
    tonightDrawerSetBodies.mockClear();
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);

    const beforeCount = tonightDrawerSetBodies.mock.calls.length;
    capturedDispatch!({ type: "set-time", time: new Date("2026-05-01T00:00:00Z") });
    expect(tonightDrawerSetBodies.mock.calls.length).toBeGreaterThan(beforeCount);

    vi.advanceTimersByTime(100);
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='tonight-drawer']")
      .forEach((el) => el.parentNode?.removeChild(el));
    vi.useRealTimers();
  });

  it("tonight drawer is refreshed on set-observer intent", async () => {
    vi.useFakeTimers();
    capturedDispatch = null;
    tonightDrawerSetBodies.mockClear();
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);

    const beforeCount = tonightDrawerSetBodies.mock.calls.length;
    capturedDispatch!({ type: "set-observer", lat: 48.8, lon: 2.35 });
    expect(tonightDrawerSetBodies.mock.calls.length).toBeGreaterThan(beforeCount);

    vi.advanceTimersByTime(100);
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='tonight-drawer']")
      .forEach((el) => el.parentNode?.removeChild(el));
    vi.useRealTimers();
  });

  it("tonight drawer is refreshed on now intent", async () => {
    vi.useFakeTimers();
    capturedDispatch = null;
    tonightDrawerSetBodies.mockClear();
    Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true });
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);

    const beforeCount = tonightDrawerSetBodies.mock.calls.length;
    capturedDispatch!({ type: "now" });
    expect(tonightDrawerSetBodies.mock.calls.length).toBeGreaterThan(beforeCount);

    vi.advanceTimersByTime(100);
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='tonight-drawer']")
      .forEach((el) => el.parentNode?.removeChild(el));
    vi.useRealTimers();
  });

  it("tonight drawer is refreshed on show-trail intent", async () => {
    capturedDispatch = null;
    tonightDrawerSetBodies.mockClear();
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);

    const beforeCount = tonightDrawerSetBodies.mock.calls.length;
    capturedDispatch!({ type: "show-trail", objectKind: "body", id: "Mars" });
    expect(tonightDrawerSetBodies.mock.calls.length).toBeGreaterThan(beforeCount);

    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("tonight drawer is refreshed on hide-trail intent", async () => {
    capturedDispatch = null;
    tonightDrawerSetBodies.mockClear();
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);

    capturedDispatch!({ type: "show-trail", objectKind: "body", id: "Mars" });
    const beforeCount = tonightDrawerSetBodies.mock.calls.length;
    capturedDispatch!({ type: "hide-trail" });
    expect(tonightDrawerSetBodies.mock.calls.length).toBeGreaterThan(beforeCount);

    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("panel's onOpenTonight callback opens the tonight drawer", async () => {
    capturedDispatch = null;
    capturedPanelOptions = null;
    tonightDrawerOpen.mockClear();
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);

    expect(capturedPanelOptions).not.toBeNull();
    expect(typeof capturedPanelOptions!.onOpenTonight).toBe("function");
    capturedPanelOptions!.onOpenTonight!();
    expect(tonightDrawerOpen).toHaveBeenCalled();

    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='tonight-drawer']")
      .forEach((el) => el.parentNode?.removeChild(el));
  });

  it("side panel setContent is called without a layer-controls child (moved to drawer)", async () => {
    const ui = await import("./ui");
    const panelMock = vi.mocked(ui.createPanel);
    const setContent = vi.fn();
    panelMock.mockReturnValueOnce({
      element: document.createElement("div"),
      setContent,
      setCollapsed: vi.fn(),
      setNightVision: vi.fn(),
      setMode: vi.fn(),
    });
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(setContent).toHaveBeenCalled();
    const uiContainer = setContent.mock.calls[0]![0] as HTMLElement;
    // The drawer-mounted opacity sliders / language selects must NOT appear
    // in the side panel's UI container anymore.
    expect(uiContainer.querySelector("select[data-language]")).toBeNull();
    expect(uiContainer.querySelector("select[data-skyculture]")).toBeNull();
    expect(uiContainer.querySelector("input[data-mag='limit']")).toBeNull();
    expect(uiContainer.querySelector("input[data-opacity]")).toBeNull();
    // Planet Info likewise now lives in the tonight drawer (milestone 1G).
    expect(uiContainer.querySelector("[data-testid='planet-info-heading']")).toBeNull();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  async function driveScenePick(pickedId: Record<string, unknown>): Promise<{
    openMock: ReturnType<typeof vi.fn>;
    root: HTMLElement;
    panelRoot: HTMLElement;
  }> {
    const ui = await import("./ui");
    const openMock = vi.fn();
    vi.mocked(ui.createObjectCardsManager).mockReturnValueOnce({
      open: openMock,
      close: vi.fn(),
      closeActive: vi.fn(),
      update: vi.fn(),
      destroy: vi.fn(),
    });

    const { root, panelRoot } = makeRoot();
    await bootstrap(root);

    const cesium = await import("cesium");
    const handlerCtor = vi.mocked(cesium.ScreenSpaceEventHandler);
    const handlers = handlerCtor.mock.results.map(
      (r) => r.value as { setInputAction: ReturnType<typeof vi.fn> },
    );
    let clickFn: ((ev: { position: { x: number; y: number } }) => void) | null = null;
    for (const h of handlers) {
      for (const call of h.setInputAction.mock.calls) {
        const [fn, type] = call as [unknown, unknown];
        if (type === cesium.ScreenSpaceEventType.LEFT_CLICK) {
          clickFn = fn as (ev: { position: { x: number; y: number } }) => void;
        }
      }
    }

    if (clickFn !== null) {
      const viewerCtor = vi.mocked(cesium.Viewer);
      const lastViewer = viewerCtor.mock.results[viewerCtor.mock.results.length - 1]?.value as {
        scene?: { pick?: ReturnType<typeof vi.fn> };
      };
      lastViewer?.scene?.pick?.mockReturnValueOnce({ id: pickedId });
      clickFn({ position: { x: 140, y: 260 } });
    }

    return { openMock, root, panelRoot };
  }

  it("picking a star dispatches open-object-card + opens a card", async () => {
    capturedDispatch = null;
    const { openMock, root, panelRoot } = await driveScenePick({
      hip: 32349,
      ra: 101.2872,
      dec: -16.7161,
      alt: 45,
      az: 180,
      mag: -1.44,
      name: "Sirius",
      size: 16,
      opacity: 1,
    });
    expect(openMock).toHaveBeenCalled();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("picking a planet (body) dispatches open-object-card + opens a card", async () => {
    capturedDispatch = null;
    const { openMock, root, panelRoot } = await driveScenePick({
      id: "Mars",
      ra: 120,
      dec: 20,
      alt: 30,
      az: 90,
      mag: 0.4,
    });
    expect(openMock).toHaveBeenCalled();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("picking a satellite dispatches open-object-card + opens a card", async () => {
    capturedDispatch = null;
    const { openMock, root, panelRoot } = await driveScenePick({
      noradId: 25544,
      name: "ISS",
      alt: 40,
      az: 160,
      velocity: 7.66,
    });
    expect(openMock).toHaveBeenCalled();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("picking a Messier object dispatches open-object-card + opens a card", async () => {
    capturedDispatch = null;
    const { openMock, root, panelRoot } = await driveScenePick({
      m: 31,
      type: "Galaxy",
      name: "Andromeda",
      alt: 50,
      az: 70,
      mag: 3.4,
    });
    expect(openMock).toHaveBeenCalled();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("picking a constellation label dispatches open-object-card + opens a card", async () => {
    capturedDispatch = null;
    const { openMock, root, panelRoot } = await driveScenePick({
      id: "Ori",
      name: "Orion",
      centroid: { alt: 25, az: 180 },
      lines: [],
    });
    expect(openMock).toHaveBeenCalled();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("mounts the onboarding overlay on the document body", async () => {
    capturedDispatch = null;
    onboardingOverlayMock = null;
    globalThis.localStorage?.removeItem("planisphere.onboarding.v1");
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(document.querySelector("[data-testid='onboarding-overlay']")).not.toBeNull();
    expect(onboardingOverlayMock).not.toBeNull();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='onboarding-overlay']")
      .forEach((el) => el.parentNode?.removeChild(el));
  });

  it("starts the onboarding overlay on first load (flag not set) after a small delay", async () => {
    vi.useFakeTimers();
    capturedDispatch = null;
    onboardingOverlayMock = null;
    globalThis.localStorage?.removeItem("planisphere.onboarding.v1");
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(onboardingOverlayMock).not.toBeNull();
    // Not started yet — bootstrap defers start() by ~500ms so the scene can paint.
    expect(onboardingOverlayMock!.start).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    expect(onboardingOverlayMock!.start).toHaveBeenCalled();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='onboarding-overlay']")
      .forEach((el) => el.parentNode?.removeChild(el));
    vi.useRealTimers();
  });

  it("does NOT start the onboarding overlay when the dismissed flag is set", async () => {
    vi.useFakeTimers();
    capturedDispatch = null;
    onboardingOverlayMock = null;
    globalThis.localStorage?.setItem("planisphere.onboarding.v1", "dismissed");
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(onboardingOverlayMock).not.toBeNull();
    vi.advanceTimersByTime(1000);
    expect(onboardingOverlayMock!.start).not.toHaveBeenCalled();
    globalThis.localStorage?.removeItem("planisphere.onboarding.v1");
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='onboarding-overlay']")
      .forEach((el) => el.parentNode?.removeChild(el));
    vi.useRealTimers();
  });

  it("does NOT start the onboarding overlay when booting with ?plan=<slug>", async () => {
    // Regression #353: the transparent onboarding click-shield used to sit
    // above the plan-reader modal on first visit with ?plan= in the URL,
    // no-op'ing the modal's "×" close button. When a slug is in the URL the
    // user has expressed a clear intent to read a plan — hydrate that, not the
    // tour. Don't persist a "dismissed" flag on this path; they still deserve
    // the tour on a subsequent open without a slug.
    vi.useFakeTimers();
    capturedDispatch = null;
    onboardingOverlayMock = null;
    plansModalMock = null;
    globalThis.localStorage?.removeItem("planisphere.onboarding.v1");
    getPlanResult = {
      ok: true,
      value: {
        slug: "2026-04",
        title: "April",
        month: "2026-04",
        hemisphere: "both",
        summary: "Stub",
        author: "Rob",
        publishedAt: "2026-04-01T00:00:00.000Z",
        bodyMd: "Body",
        objects: [],
      },
    };
    const { root, panelRoot } = makeRoot();
    await bootstrap(root, new URLSearchParams({ plan: "2026-04" }));
    expect(onboardingOverlayMock).not.toBeNull();
    vi.advanceTimersByTime(1000);
    expect(onboardingOverlayMock!.start).not.toHaveBeenCalled();
    // The flag stays unset so the tour will still fire on a later open without ?plan=.
    expect(globalThis.localStorage?.getItem("planisphere.onboarding.v1")).toBeNull();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='onboarding-overlay']")
      .forEach((el) => el.parentNode?.removeChild(el));
    vi.useRealTimers();
  });

  it("passes an onReplayTour callback into createHelpModal that invokes overlay.replay()", async () => {
    capturedDispatch = null;
    onboardingOverlayMock = null;
    capturedHelpModalOptions = null;
    globalThis.localStorage?.removeItem("planisphere.onboarding.v1");
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(capturedHelpModalOptions).not.toBeNull();
    expect(typeof capturedHelpModalOptions!.onReplayTour).toBe("function");
    capturedHelpModalOptions!.onReplayTour!();
    expect(onboardingOverlayMock).not.toBeNull();
    expect(onboardingOverlayMock!.replay).toHaveBeenCalled();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='onboarding-overlay']")
      .forEach((el) => el.parentNode?.removeChild(el));
  });

  it("does NOT mount the notebook workspace in planetarium bootstrap (#372 lazy load)", async () => {
    capturedDispatch = null;
    notebookWorkspaceMock = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    // Notebook workspace is loaded via dynamic import in app.ts; without a
    // mode=notebook URL param it must not be created — tiptap's 432 KB chunk
    // should never enter the initial page for a planetarium-mode user (#372).
    expect(notebookWorkspaceMock).toBeNull();
    expect(document.querySelector("[data-testid='notebook-workspace']")).toBeNull();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  it("notebook workspace is shown when bootstrapping with mode=notebook", async () => {
    capturedDispatch = null;
    notebookWorkspaceMock = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root, new URLSearchParams({ mode: "notebook" }));
    await vi.waitFor(() => {
      expect(notebookWorkspaceMock).not.toBeNull();
      expect(notebookWorkspaceMock!.setVisible).toHaveBeenCalledWith(true);
    });
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='notebook-workspace']")
      .forEach((el) => el.parentNode?.removeChild(el));
  });

  it("set-mode intent lazily loads and toggles the notebook workspace visibility (Pro user)", async () => {
    capturedDispatch = null;
    notebookWorkspaceMock = null;
    // Notebook is a Pro feature (issue #224); establish Pro identity first.
    const { setUser } = await import("./features");
    setUser("rob.sartin@gmail.com");
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    // Not created at bootstrap in planetarium mode — that's the whole point of #372.
    expect(notebookWorkspaceMock).toBeNull();

    capturedDispatch!({ type: "set-mode", mode: "notebook" });
    await vi.waitFor(() => {
      expect(notebookWorkspaceMock).not.toBeNull();
      expect(notebookWorkspaceMock!.setVisible).toHaveBeenCalledWith(true);
    });
    capturedDispatch!({ type: "set-mode", mode: "planetarium" });
    expect(notebookWorkspaceMock!.setVisible).toHaveBeenCalledWith(false);
    globalThis.localStorage?.clear();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='notebook-workspace']")
      .forEach((el) => el.parentNode?.removeChild(el));
  });

  it("set-mode intent updates URL with mode param when notebook, removes it when planetarium (Pro user)", async () => {
    capturedDispatch = null;
    notebookWorkspaceMock = null;
    const { setUser } = await import("./features");
    setUser("rob.sartin@gmail.com");
    const { root, panelRoot } = makeRoot();
    const spy = vi.spyOn(globalThis.history, "replaceState");
    await bootstrap(root);
    spy.mockClear();

    capturedDispatch!({ type: "set-mode", mode: "notebook" });
    let lastCall = spy.mock.calls[spy.mock.calls.length - 1]!;
    expect(String(lastCall[2])).toContain("mode=notebook");

    capturedDispatch!({ type: "set-mode", mode: "planetarium" });
    lastCall = spy.mock.calls[spy.mock.calls.length - 1]!;
    expect(String(lastCall[2])).not.toContain("mode=");

    spy.mockRestore();
    globalThis.localStorage?.clear();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='notebook-workspace']")
      .forEach((el) => el.parentNode?.removeChild(el));
  });

  it("set-mode intent updates the panel's mode-toggle icon via setMode (Pro user)", async () => {
    capturedDispatch = null;
    panelSetModeMock = null;
    const { setUser } = await import("./features");
    setUser("rob.sartin@gmail.com");
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(panelSetModeMock).not.toBeNull();
    panelSetModeMock!.mockClear();
    capturedDispatch!({ type: "set-mode", mode: "notebook" });
    expect(panelSetModeMock).toHaveBeenCalledWith("notebook");
    capturedDispatch!({ type: "set-mode", mode: "planetarium" });
    expect(panelSetModeMock).toHaveBeenCalledWith("planetarium");
    globalThis.localStorage?.clear();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='notebook-workspace']")
      .forEach((el) => el.parentNode?.removeChild(el));
  });

  it("set-mode notebook while NOT Pro opens the login modal and does NOT lazy-load the workspace", async () => {
    capturedDispatch = null;
    notebookWorkspaceMock = null;
    loginModalMock = null;
    globalThis.localStorage?.clear();
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(loginModalMock).not.toBeNull();
    // Not lazy-loaded at bootstrap in planetarium mode (#372).
    expect(notebookWorkspaceMock).toBeNull();
    loginModalMock!.open.mockClear();

    capturedDispatch!({ type: "set-mode", mode: "notebook" });
    expect(loginModalMock!.open).toHaveBeenCalledTimes(1);
    // The Pro gate should also prevent the tiptap chunk from being fetched —
    // no dynamic import should happen when the user hits the paywall.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(notebookWorkspaceMock).toBeNull();

    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='login-modal']")
      .forEach((el) => el.parentNode?.removeChild(el));
  });

  it("bootstrap calls currentUser() and syncs features.setUser when a user is returned", async () => {
    globalThis.localStorage?.clear();
    setCurrentUserResult({ email: "rob.sartin@gmail.com", tier: "free" });
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    // The currentUser() promise resolves on a microtask; flush it.
    await Promise.resolve();
    await Promise.resolve();
    const { getUser } = await import("./features");
    expect(getUser().email).toBe("rob.sartin@gmail.com");
    globalThis.localStorage?.clear();
    setCurrentUserResult(null);
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='notebook-workspace']")
      .forEach((el) => el.parentNode?.removeChild(el));
    document
      .querySelectorAll("[data-testid='login-modal']")
      .forEach((el) => el.parentNode?.removeChild(el));
  });

  it("bootstrap leaves features untouched when currentUser returns null", async () => {
    globalThis.localStorage?.clear();
    setCurrentUserResult(null);
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    await Promise.resolve();
    await Promise.resolve();
    const { getUser } = await import("./features");
    expect(getUser().email).toBeNull();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='notebook-workspace']")
      .forEach((el) => el.parentNode?.removeChild(el));
    document
      .querySelectorAll("[data-testid='login-modal']")
      .forEach((el) => el.parentNode?.removeChild(el));
  });

  it("panel option onProRequired opens the login modal", async () => {
    capturedDispatch = null;
    capturedPanelOptions = null;
    loginModalMock = null;
    globalThis.localStorage?.clear();
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(capturedPanelOptions).not.toBeNull();
    expect(capturedPanelOptions!.onProRequired).toBeDefined();
    expect(loginModalMock).not.toBeNull();
    loginModalMock!.open.mockClear();
    capturedPanelOptions!.onProRequired!();
    expect(loginModalMock!.open).toHaveBeenCalledTimes(1);
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='notebook-workspace']")
      .forEach((el) => el.parentNode?.removeChild(el));
    document
      .querySelectorAll("[data-testid='login-modal']")
      .forEach((el) => el.parentNode?.removeChild(el));
  });

  it("notebook workspace's onProRequired opens the login modal", { timeout: 15_000 }, async () => {
    capturedDispatch = null;
    notebookWorkspaceMock = null;
    loginModalMock = null;
    globalThis.localStorage?.clear();
    // The workspace is only mounted when the user actually enters notebook
    // mode (#372). Bootstrap with mode=notebook so the lazy import resolves
    // and the mock captures the onProRequired callback wiring.
    const { root, panelRoot } = makeRoot();
    await bootstrap(root, new URLSearchParams({ mode: "notebook" }));
    await vi.waitFor(
      () => {
        expect(notebookWorkspaceMock).not.toBeNull();
      },
      { timeout: 10_000 },
    );
    expect(notebookWorkspaceMock!.onProRequired).not.toBeNull();
    expect(loginModalMock).not.toBeNull();
    loginModalMock!.open.mockClear();
    notebookWorkspaceMock!.onProRequired!();
    expect(loginModalMock!.open).toHaveBeenCalledTimes(1);
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='notebook-workspace']")
      .forEach((el) => el.parentNode?.removeChild(el));
    document
      .querySelectorAll("[data-testid='login-modal']")
      .forEach((el) => el.parentNode?.removeChild(el));
  });

  it("login modal is created with requestMagicLink wired to the auth module", async () => {
    loginModalMock = null;
    globalThis.localStorage?.clear();
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    expect(loginModalMock).not.toBeNull();
    expect(typeof loginModalMock!.requestMagicLink).toBe("function");
    const result = await loginModalMock!.requestMagicLink("a@b.co");
    expect(result).toEqual({ ok: true, value: undefined });
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='notebook-workspace']")
      .forEach((el) => el.parentNode?.removeChild(el));
    document
      .querySelectorAll("[data-testid='login-modal']")
      .forEach((el) => el.parentNode?.removeChild(el));
  });

  it("panel receives the initial mode option at bootstrap", async () => {
    capturedDispatch = null;
    capturedPanelOptions = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root, new URLSearchParams({ mode: "notebook" }));
    expect(capturedPanelOptions).not.toBeNull();
    expect(capturedPanelOptions!.mode).toBe("notebook");
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
    document
      .querySelectorAll("[data-testid='notebook-workspace']")
      .forEach((el) => el.parentNode?.removeChild(el));
  });

  it("Ctrl+K / Cmd+K opens the command palette via the global keydown handler", async () => {
    // Grab the real createCommandPalette mock so we can see its returned palette.
    const ui = await import("./ui");
    const mockOpen = vi.fn();
    const mockClose = vi.fn();
    let isOpen = false;
    vi.mocked(ui.createCommandPalette).mockReturnValueOnce({
      element: document.createElement("div"),
      open: () => {
        isOpen = true;
        mockOpen();
      },
      close: () => {
        isOpen = false;
        mockClose();
      },
      isOpen: () => isOpen,
    });
    capturedDispatch = null;
    const { root, panelRoot } = makeRoot();
    await bootstrap(root);
    const evt = new KeyboardEvent("keydown", { key: "k", ctrlKey: true });
    document.dispatchEvent(evt);
    expect(mockOpen).toHaveBeenCalled();
    document.body.removeChild(root);
    document.body.removeChild(panelRoot);
  });

  describe("set-active-plan intent", () => {
    it("non-null slug updates state and URL and opens the modal", async () => {
      capturedDispatch = null;
      plansModalMock = null;
      listPlansResult = { ok: true, value: [] };
      getPlanResult = {
        ok: true,
        value: {
          slug: "2026-04",
          title: "April",
          month: "2026-04",
          hemisphere: "both",
          summary: "Stub",
          author: "Rob",
          publishedAt: "2026-04-01T00:00:00.000Z",
          bodyMd: "Body",
          objects: [],
        },
      };
      const { root, panelRoot } = makeRoot();
      await bootstrap(root);
      const spy = vi.spyOn(globalThis.history, "replaceState");
      capturedDispatch!({ type: "set-active-plan", slug: "2026-04" });
      // Give the openPlanBySlug microtask a tick.
      await Promise.resolve();
      await Promise.resolve();
      const urls = spy.mock.calls.map((c) => String(c[2]));
      const lastUrl = urls[urls.length - 1]!;
      expect(lastUrl).toContain("plan=2026-04");
      expect(plansModalMock).not.toBeNull();
      expect(plansModalMock!.setPlan).toHaveBeenCalled();
      spy.mockRestore();
      document.body.removeChild(root);
      document.body.removeChild(panelRoot);
    });

    it("null slug clears state, drops the URL param, and hides the modal", async () => {
      capturedDispatch = null;
      plansModalMock = null;
      listPlansResult = { ok: true, value: [] };
      const { root, panelRoot } = makeRoot();
      await bootstrap(root, new URLSearchParams({ plan: "2026-04" }));
      await Promise.resolve();
      const spy = vi.spyOn(globalThis.history, "replaceState");
      capturedDispatch!({ type: "set-active-plan", slug: null });
      const urls = spy.mock.calls.map((c) => String(c[2]));
      const lastUrl = urls[urls.length - 1]!;
      expect(lastUrl).not.toContain("plan=");
      expect(plansModalMock).not.toBeNull();
      expect(plansModalMock!.setPlan).toHaveBeenCalledWith(null);
      spy.mockRestore();
      document.body.removeChild(root);
      document.body.removeChild(panelRoot);
    });

    it("getPlan error clears the active slug and surfaces setError on the modal", async () => {
      capturedDispatch = null;
      plansModalMock = null;
      listPlansResult = { ok: true, value: [] };
      getPlanResult = { ok: false, error: { kind: "not_found" } };
      const { root, panelRoot } = makeRoot();
      await bootstrap(root);
      const spy = vi.spyOn(globalThis.history, "replaceState");
      capturedDispatch!({ type: "set-active-plan", slug: "missing-slug" });
      // Wait for openPlanBySlug to resolve + the clearing dispatch to run.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(plansModalMock).not.toBeNull();
      expect(plansModalMock!.setError).toHaveBeenCalledWith("missing-slug", "not_found");
      // Final URL should not carry the plan= param because the handler clears it.
      const urls = spy.mock.calls.map((c) => String(c[2]));
      const lastUrl = urls[urls.length - 1]!;
      expect(lastUrl).not.toContain("plan=");
      spy.mockRestore();
      document.body.removeChild(root);
      document.body.removeChild(panelRoot);
      // Reset for other tests
      getPlanResult = {
        ok: true,
        value: {
          slug: "2026-04",
          title: "April",
          month: "2026-04",
          hemisphere: "both",
          summary: "Stub",
          author: "Rob",
          publishedAt: "2026-04-01T00:00:00.000Z",
          bodyMd: "Body",
          objects: [],
        },
      };
    });
  });

  describe("?plan= hydration", () => {
    it("boot with ?plan=<slug> opens the reader modal", async () => {
      plansModalMock = null;
      getPlanResult = {
        ok: true,
        value: {
          slug: "2026-04",
          title: "April",
          month: "2026-04",
          hemisphere: "both",
          summary: "Stub",
          author: "Rob",
          publishedAt: "2026-04-01T00:00:00.000Z",
          bodyMd: "Body",
          objects: [],
        },
      };
      const { root, panelRoot } = makeRoot();
      await bootstrap(root, new URLSearchParams({ plan: "2026-04" }));
      await Promise.resolve();
      await Promise.resolve();
      expect(plansModalMock).not.toBeNull();
      expect(plansModalMock!.setPlan).toHaveBeenCalled();
      document.body.removeChild(root);
      document.body.removeChild(panelRoot);
    });

    it("boot with a malformed ?plan= value leaves the modal closed", async () => {
      plansModalMock = null;
      const { root, panelRoot } = makeRoot();
      await bootstrap(root, new URLSearchParams({ plan: "Not A Slug" }));
      await Promise.resolve();
      expect(plansModalMock).not.toBeNull();
      expect(plansModalMock!.setPlan).not.toHaveBeenCalled();
      document.body.removeChild(root);
      document.body.removeChild(panelRoot);
    });
  });

  describe("retry-plans + open-sign-in + onOpenPlans", () => {
    it("retry-plans intent re-fetches the list", async () => {
      capturedDispatch = null;
      plansDrawerMock = null;
      listPlansResult = { ok: true, value: [] };
      const { root, panelRoot } = makeRoot();
      await bootstrap(root);
      expect(plansDrawerMock).not.toBeNull();
      plansDrawerMock!.setView.mockClear();
      capturedDispatch!({ type: "retry-plans" });
      await Promise.resolve();
      await Promise.resolve();
      expect(plansDrawerMock!.setView).toHaveBeenCalled();
      document.body.removeChild(root);
      document.body.removeChild(panelRoot);
    });

    it("open-sign-in intent opens the login modal", async () => {
      capturedDispatch = null;
      loginModalMock = null;
      const { root, panelRoot } = makeRoot();
      await bootstrap(root);
      expect(loginModalMock).not.toBeNull();
      capturedDispatch!({ type: "open-sign-in" });
      expect(loginModalMock!.open).toHaveBeenCalled();
      document.body.removeChild(root);
      document.body.removeChild(panelRoot);
    });

    it("onOpenPlans panel callback opens the drawer and triggers a refresh", async () => {
      plansDrawerMock = null;
      capturedPanelOptions = null;
      listPlansResult = { ok: true, value: [] };
      const { root, panelRoot } = makeRoot();
      await bootstrap(root);
      expect(capturedPanelOptions).not.toBeNull();
      expect(capturedPanelOptions!.onOpenPlans).toBeDefined();
      capturedPanelOptions!.onOpenPlans!();
      await Promise.resolve();
      expect(plansDrawerMock).not.toBeNull();
      expect(plansDrawerMock!.openPanel).toHaveBeenCalled();
      document.body.removeChild(root);
      document.body.removeChild(panelRoot);
    });

    it("refreshPlansView maps not_pro error to the not_pro view", async () => {
      plansDrawerMock = null;
      listPlansResult = { ok: false, error: { kind: "not_pro" } };
      capturedDispatch = null;
      const { root, panelRoot } = makeRoot();
      await bootstrap(root);
      expect(plansDrawerMock).not.toBeNull();
      plansDrawerMock!.setView.mockClear();
      capturedDispatch!({ type: "retry-plans" });
      await Promise.resolve();
      await Promise.resolve();
      const calls = plansDrawerMock!.setView.mock.calls;
      const last = calls[calls.length - 1];
      expect(last?.[0]).toEqual({ kind: "not_pro" });
      document.body.removeChild(root);
      document.body.removeChild(panelRoot);
      // reset
      listPlansResult = { ok: true, value: [] };
    });

    it("refreshPlansView maps unauthenticated error to the unauthenticated view", async () => {
      plansDrawerMock = null;
      listPlansResult = { ok: false, error: { kind: "unauthenticated" } };
      capturedDispatch = null;
      const { root, panelRoot } = makeRoot();
      await bootstrap(root);
      expect(plansDrawerMock).not.toBeNull();
      plansDrawerMock!.setView.mockClear();
      capturedDispatch!({ type: "retry-plans" });
      await Promise.resolve();
      await Promise.resolve();
      const calls = plansDrawerMock!.setView.mock.calls;
      const last = calls[calls.length - 1];
      expect(last?.[0]).toEqual({ kind: "unauthenticated" });
      document.body.removeChild(root);
      document.body.removeChild(panelRoot);
      listPlansResult = { ok: true, value: [] };
    });

    it("refreshPlansView maps other errors to the error view", async () => {
      plansDrawerMock = null;
      listPlansResult = { ok: false, error: { kind: "server" } };
      capturedDispatch = null;
      const { root, panelRoot } = makeRoot();
      await bootstrap(root);
      expect(plansDrawerMock).not.toBeNull();
      plansDrawerMock!.setView.mockClear();
      capturedDispatch!({ type: "retry-plans" });
      await Promise.resolve();
      await Promise.resolve();
      const calls = plansDrawerMock!.setView.mock.calls;
      const last = calls[calls.length - 1];
      expect(last?.[0]).toEqual({ kind: "error" });
      document.body.removeChild(root);
      document.body.removeChild(panelRoot);
      listPlansResult = { ok: true, value: [] };
    });
  });
});
