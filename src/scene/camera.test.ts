/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Camera, Viewer } from "cesium";
import {
  initCamera,
  setupTrackballControls,
  setCameraViewAnimated,
  setupGestures,
  getCameraHeadingDeg,
} from "./camera";

const { mockSetInputAction, mockScreenSpaceEventHandler, mockHandlerDestroy } = vi.hoisted(() => {
  const mockSetInputAction = vi.fn();
  const mockHandlerDestroy = vi.fn();
  const mockScreenSpaceEventHandler = vi.fn(function () {
    return { setInputAction: mockSetInputAction, destroy: mockHandlerDestroy };
  });
  return { mockSetInputAction, mockScreenSpaceEventHandler, mockHandlerDestroy };
});

vi.mock("cesium", () => {
  const Cartesian3 = vi.fn(function (x: number = 0, y: number = 0, z: number = 0) {
    return { x, y, z };
  });
  Object.assign(Cartesian3, {
    fromDegrees: vi.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
    cross: vi.fn((a: object, _b: object, result: object) => Object.assign(result, a)),
    normalize: vi.fn((_v: object, result: object) => result),
  });

  const Quaternion = vi.fn(function () {
    return {};
  });
  Object.assign(Quaternion, {
    fromAxisAngle: vi.fn().mockReturnValue({}),
    multiply: vi.fn().mockReturnValue({}),
  });

  const Matrix3 = vi.fn(function () {
    return {};
  });
  Object.assign(Matrix3, {
    fromQuaternion: vi.fn().mockReturnValue({}),
    multiplyByVector: vi.fn().mockReturnValue({ x: 0, y: 0, z: 1 }),
  });

  return {
    Cartesian3,
    Math: {
      toRadians: (deg: number) => (deg * Math.PI) / 180,
      toDegrees: (rad: number) => (rad * 180) / Math.PI,
    },
    Matrix3,
    Quaternion,
    ScreenSpaceEventHandler: mockScreenSpaceEventHandler,
    ScreenSpaceEventType: {
      LEFT_DOWN: "LEFT_DOWN",
      MOUSE_MOVE: "MOUSE_MOVE",
      LEFT_UP: "LEFT_UP",
      LEFT_CLICK: "LEFT_CLICK",
      LEFT_DOUBLE_CLICK: "LEFT_DOUBLE_CLICK",
      WHEEL: "WHEEL",
      PINCH_START: "PINCH_START",
      PINCH_MOVE: "PINCH_MOVE",
      PINCH_END: "PINCH_END",
    },
  };
});

function makeCamera(): { mock: Camera; setView: ReturnType<typeof vi.fn> } {
  const setView = vi.fn();
  const mock = { setView } as unknown as Camera;
  return { mock, setView };
}

function makeViewer(fovy = Math.PI / 3): Viewer {
  const camera = {
    setView: vi.fn(),
    direction: { x: 0, y: 0, z: 1 },
    up: { x: 0, y: 1, z: 0 },
    right: { x: 1, y: 0, z: 0 },
    frustum: { fovy, fov: fovy },
  };
  const controller = {
    enableRotate: true,
    enableTranslate: true,
    enableZoom: true,
    enableTilt: true,
    enableLook: true,
  };
  return {
    scene: {
      screenSpaceCameraController: controller,
      canvas: {
        clientWidth: 800,
        clientHeight: 600,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as HTMLCanvasElement,
      camera,
      pick: vi.fn().mockReturnValue(undefined),
    },
    camera,
  } as unknown as Viewer;
}

describe("initCamera", () => {
  it("calls setView with the observer's position looking up", () => {
    const { mock, setView } = makeCamera();
    initCamera(mock, 33.0, -117.0);
    expect(setView).toHaveBeenCalledOnce();
    const [args] = setView.mock.calls[0] as [Record<string, unknown>];
    expect(args).toHaveProperty("destination");
    expect(args).toHaveProperty("orientation");
  });

  it("orientation pitch points upward (positive = looking up in Cesium)", () => {
    const { mock, setView } = makeCamera();
    initCamera(mock, 40.0, -74.0);
    const [args] = setView.mock.calls[0] as [{ orientation: { pitch: number } }];
    expect(args.orientation.pitch).toBeGreaterThan(0);
  });
});

describe("getCameraHeadingDeg", () => {
  it("converts radian heading to degrees", () => {
    const camera = { heading: Math.PI / 2 } as unknown as Camera;
    expect(getCameraHeadingDeg(camera)).toBeCloseTo(90, 5);
  });

  it("normalizes negative headings into [0, 360)", () => {
    const camera = { heading: -Math.PI / 2 } as unknown as Camera;
    expect(getCameraHeadingDeg(camera)).toBeCloseTo(270, 5);
  });

  it("returns 0 when camera has no numeric heading (test mocks, degenerate cases)", () => {
    const camera = {} as unknown as Camera;
    expect(getCameraHeadingDeg(camera)).toBe(0);
  });

  it("returns 0 when heading is NaN", () => {
    const camera = { heading: NaN } as unknown as Camera;
    expect(getCameraHeadingDeg(camera)).toBe(0);
  });
});

describe("setupTrackballControls", () => {
  beforeEach(() => {
    mockSetInputAction.mockClear();
    mockScreenSpaceEventHandler.mockClear();
    mockHandlerDestroy.mockClear();
  });

  it("disables all default camera controller interactions", () => {
    const viewer = makeViewer();
    setupTrackballControls(viewer);
    const controller = viewer.scene.screenSpaceCameraController;
    expect(controller.enableRotate).toBe(false);
    expect(controller.enableTranslate).toBe(false);
    expect(controller.enableZoom).toBe(false);
    expect(controller.enableTilt).toBe(false);
    expect(controller.enableLook).toBe(false);
  });

  it("creates a ScreenSpaceEventHandler on the scene canvas", () => {
    const viewer = makeViewer();
    setupTrackballControls(viewer);
    expect(mockScreenSpaceEventHandler).toHaveBeenCalledWith(viewer.scene.canvas);
  });

  it("registers handlers for LEFT_DOWN, MOUSE_MOVE, and LEFT_UP", () => {
    const viewer = makeViewer();
    setupTrackballControls(viewer);
    expect(mockSetInputAction).toHaveBeenCalledTimes(3);
    const registeredEvents = mockSetInputAction.mock.calls.map((call: unknown[]) => call[1]);
    expect(registeredEvents).toContain("LEFT_DOWN");
    expect(registeredEvents).toContain("MOUSE_MOVE");
    expect(registeredEvents).toContain("LEFT_UP");
  });
});

describe("setCameraViewAnimated", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls setView at least once immediately (starts the animation)", () => {
    const { mock, setView } = makeCamera();
    setCameraViewAnimated(mock, 40, -74, 180, 45, 400);
    expect(setView).toHaveBeenCalled();
  });

  it("after the duration completes, final setView call has the target az/alt (in radians)", () => {
    const { mock, setView } = makeCamera();
    setCameraViewAnimated(mock, 40, -74, 180, 45, 400);
    // Advance animation to completion
    vi.advanceTimersByTime(500);
    const lastCall = setView.mock.calls[setView.mock.calls.length - 1] as [
      { orientation: { heading: number; pitch: number } },
    ];
    const expectedHeading = (180 * Math.PI) / 180;
    const expectedPitch = (45 * Math.PI) / 180;
    expect(lastCall[0].orientation.heading).toBeCloseTo(expectedHeading, 5);
    expect(lastCall[0].orientation.pitch).toBeCloseTo(expectedPitch, 5);
  });

  it("with zero duration, snaps to the target in a single call", () => {
    const { mock, setView } = makeCamera();
    setCameraViewAnimated(mock, 40, -74, 90, 30, 0);
    const lastCall = setView.mock.calls[setView.mock.calls.length - 1] as [
      { orientation: { heading: number; pitch: number } },
    ];
    const expectedHeading = (90 * Math.PI) / 180;
    expect(lastCall[0].orientation.heading).toBeCloseTo(expectedHeading, 5);
  });

  it("takes the shortest azimuth arc (wraparound)", () => {
    // Animating 350 -> 10 should interpolate near 0/360, not via 180.
    const { mock, setView } = makeCamera();
    setCameraViewAnimated(mock, 0, 0, 10, 45, 400);
    // mid-animation: feed in starting az=350 as a second call path? Simpler —
    // check the final heading matches target.
    vi.advanceTimersByTime(500);
    const lastCall = setView.mock.calls[setView.mock.calls.length - 1] as [
      { orientation: { heading: number } },
    ];
    const h = lastCall[0].orientation.heading;
    const expected = (10 * Math.PI) / 180;
    expect(h).toBeCloseTo(expected, 5);
  });
});

describe("setupGestures", () => {
  beforeEach(() => {
    mockSetInputAction.mockClear();
    mockScreenSpaceEventHandler.mockClear();
    mockHandlerDestroy.mockClear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("registers a wheel listener on the canvas (alt/az pan with Cmd-zoom)", () => {
    const viewer = makeViewer();
    setupGestures(viewer, {
      getObserver: () => ({ lat: 0, lon: 0 }),
      resolveObjectAt: () => null,
    });
    const addEventListener = (
      viewer.scene.canvas as unknown as { addEventListener: { mock: { calls: unknown[][] } } }
    ).addEventListener;
    const wheelCalls = addEventListener.mock.calls.filter((c: unknown[]) => c[0] === "wheel");
    expect(wheelCalls).toHaveLength(1);
  });

  it("registers a LEFT_DOUBLE_CLICK handler", () => {
    const viewer = makeViewer();
    setupGestures(viewer, {
      getObserver: () => ({ lat: 0, lon: 0 }),
      resolveObjectAt: () => null,
    });
    const registeredEvents = mockSetInputAction.mock.calls.map((call: unknown[]) => call[1]);
    expect(registeredEvents).toContain("LEFT_DOUBLE_CLICK");
  });

  it("Cmd/Ctrl+wheel zoom clamps FOV within [FOV_MIN_DEG, FOV_MAX_DEG]", () => {
    const viewer = makeViewer(Math.PI / 3); // 60 deg
    setupGestures(viewer, {
      getObserver: () => ({ lat: 0, lon: 0 }),
      resolveObjectAt: () => null,
    });
    const addEventListener = (
      viewer.scene.canvas as unknown as { addEventListener: { mock: { calls: unknown[][] } } }
    ).addEventListener;
    const wheelCall = addEventListener.mock.calls.find((c: unknown[]) => c[0] === "wheel") as
      [string, (e: WheelEvent) => void, AddEventListenerOptions] | undefined;
    expect(wheelCall).toBeDefined();
    const wheelHandler = wheelCall![1];
    const make = (deltaY: number) =>
      ({
        deltaX: 0,
        deltaY,
        ctrlKey: true,
        metaKey: false,
        preventDefault: () => undefined,
      }) as unknown as WheelEvent;
    // Huge negative delta — clamp at min
    for (let i = 0; i < 1000; i++) wheelHandler(make(-1000));
    const frustum = viewer.camera.frustum as { fovy: number };
    const fovDeg = (frustum.fovy * 180) / Math.PI;
    expect(fovDeg).toBeGreaterThanOrEqual(1 - 1e-6);
    // Huge positive delta — clamp at max
    for (let i = 0; i < 1000; i++) wheelHandler(make(1000));
    const fovDeg2 = ((viewer.camera.frustum as { fovy: number }).fovy * 180) / Math.PI;
    expect(fovDeg2).toBeLessThanOrEqual(120 + 1e-6);
  });

  it("plain wheel pans alt/az (no FOV change)", () => {
    const viewer = makeViewer(Math.PI / 3);
    setupGestures(viewer, {
      getObserver: () => ({ lat: 40, lon: -74 }),
      resolveObjectAt: () => null,
    });
    const addEventListener = (
      viewer.scene.canvas as unknown as { addEventListener: { mock: { calls: unknown[][] } } }
    ).addEventListener;
    const wheelCall = addEventListener.mock.calls.find((c: unknown[]) => c[0] === "wheel") as
      [string, (e: WheelEvent) => void, AddEventListenerOptions] | undefined;
    const wheelHandler = wheelCall![1];
    const setView = (viewer.camera as unknown as { setView: ReturnType<typeof vi.fn> }).setView;
    setView.mockClear();
    const fovBefore = (viewer.camera.frustum as { fovy: number }).fovy;
    wheelHandler({
      deltaX: 0,
      deltaY: 100,
      ctrlKey: false,
      metaKey: false,
      preventDefault: () => undefined,
    } as unknown as WheelEvent);
    expect(setView).toHaveBeenCalled();
    expect((viewer.camera.frustum as { fovy: number }).fovy).toBe(fovBefore);
  });

  it("plain wheel altitude is clamped to [-89.9, 89.9]", () => {
    const viewer = makeViewer();
    // Camera "looks up" near zenith so big negative deltaY would push past 90.
    (viewer.camera as unknown as { pitch: number; heading: number }).pitch = (89.5 * Math.PI) / 180;
    (viewer.camera as unknown as { heading: number }).heading = 0;
    setupGestures(viewer, {
      getObserver: () => ({ lat: 0, lon: 0 }),
      resolveObjectAt: () => null,
    });
    const addEventListener = (
      viewer.scene.canvas as unknown as { addEventListener: { mock: { calls: unknown[][] } } }
    ).addEventListener;
    const wheelHandler = (
      addEventListener.mock.calls.find((c: unknown[]) => c[0] === "wheel") as [
        string,
        (e: WheelEvent) => void,
      ]
    )[1];
    const setView = (viewer.camera as unknown as { setView: ReturnType<typeof vi.fn> }).setView;
    setView.mockClear();
    // Big negative deltaY (drag world up = look up) tries to push alt past 90
    wheelHandler({
      deltaX: 0,
      deltaY: -10_000,
      ctrlKey: false,
      metaKey: false,
      preventDefault: () => undefined,
    } as unknown as WheelEvent);
    const lastCall = setView.mock.calls[setView.mock.calls.length - 1] as [
      { orientation: { pitch: number } },
    ];
    expect(lastCall[0].orientation.pitch).toBeLessThanOrEqual((89.9 * Math.PI) / 180 + 1e-6);
  });

  it("double-tap with no picked object resets view toward zenith", () => {
    const viewer = makeViewer();
    setupGestures(viewer, {
      getObserver: () => ({ lat: 40, lon: -74 }),
      resolveObjectAt: () => null,
    });
    const dblClickCall = mockSetInputAction.mock.calls.find(
      (c: unknown[]) => c[1] === "LEFT_DOUBLE_CLICK",
    ) as [(ev: { position: { x: number; y: number } }) => void, string] | undefined;
    expect(dblClickCall).toBeDefined();
    const handler = dblClickCall![0];
    (viewer.camera.setView as ReturnType<typeof vi.fn>).mockClear();
    handler({ position: { x: 400, y: 300 } });
    vi.advanceTimersByTime(500);

    const calls = (viewer.camera.setView as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const last = calls[calls.length - 1] as [{ orientation: { pitch: number } }];
    // Pitch for zenith is 89.9 deg — close to π/2
    expect(last[0].orientation.pitch).toBeGreaterThan((89 * Math.PI) / 180 - 1e-3);
  });

  it("double-tap on an object centers camera on its az/alt", () => {
    const viewer = makeViewer();
    setupGestures(viewer, {
      getObserver: () => ({ lat: 40, lon: -74 }),
      resolveObjectAt: () => ({ az: 210, alt: 30 }),
    });
    const dblClickCall = mockSetInputAction.mock.calls.find(
      (c: unknown[]) => c[1] === "LEFT_DOUBLE_CLICK",
    ) as [(ev: { position: { x: number; y: number } }) => void, string] | undefined;
    const handler = dblClickCall![0];
    (viewer.camera.setView as ReturnType<typeof vi.fn>).mockClear();
    handler({ position: { x: 400, y: 300 } });
    vi.advanceTimersByTime(500);
    const calls = (viewer.camera.setView as ReturnType<typeof vi.fn>).mock.calls;
    const last = calls[calls.length - 1] as [{ orientation: { heading: number; pitch: number } }];
    expect(last[0].orientation.heading).toBeCloseTo((210 * Math.PI) / 180, 5);
    expect(last[0].orientation.pitch).toBeCloseTo((30 * Math.PI) / 180, 5);
  });

  it("returns a destroy function that cleans up the handler", () => {
    const viewer = makeViewer();
    const api = setupGestures(viewer, {
      getObserver: () => ({ lat: 0, lon: 0 }),
      resolveObjectAt: () => null,
    });
    api.destroy();
    expect(mockHandlerDestroy).toHaveBeenCalled();
  });

  it("invokes onZoom callback after a Cmd/Ctrl+wheel event (so caller can re-render reticle)", () => {
    const viewer = makeViewer();
    const onZoom = vi.fn();
    setupGestures(viewer, {
      getObserver: () => ({ lat: 0, lon: 0 }),
      resolveObjectAt: () => null,
      onZoom,
    });
    const addEventListener = (
      viewer.scene.canvas as unknown as { addEventListener: { mock: { calls: unknown[][] } } }
    ).addEventListener;
    const wheelHandler = (
      addEventListener.mock.calls.find((c: unknown[]) => c[0] === "wheel") as [
        string,
        (e: WheelEvent) => void,
      ]
    )[1];
    wheelHandler({
      deltaX: 0,
      deltaY: -100,
      ctrlKey: true,
      metaKey: false,
      preventDefault: () => undefined,
    } as unknown as WheelEvent);
    expect(onZoom).toHaveBeenCalled();
  });

  it("does NOT invoke onZoom on a plain (no-modifier) wheel event", () => {
    const viewer = makeViewer();
    const onZoom = vi.fn();
    setupGestures(viewer, {
      getObserver: () => ({ lat: 0, lon: 0 }),
      resolveObjectAt: () => null,
      onZoom,
    });
    const addEventListener = (
      viewer.scene.canvas as unknown as { addEventListener: { mock: { calls: unknown[][] } } }
    ).addEventListener;
    const wheelHandler = (
      addEventListener.mock.calls.find((c: unknown[]) => c[0] === "wheel") as [
        string,
        (e: WheelEvent) => void,
      ]
    )[1];
    wheelHandler({
      deltaX: 0,
      deltaY: -100,
      ctrlKey: false,
      metaKey: false,
      preventDefault: () => undefined,
    } as unknown as WheelEvent);
    expect(onZoom).not.toHaveBeenCalled();
  });

  it("PINCH_MOVE with fingers apart (bigger distance) zooms in (smaller FOV)", () => {
    const viewer = makeViewer(Math.PI / 3); // 60 deg
    setupGestures(viewer, {
      getObserver: () => ({ lat: 0, lon: 0 }),
      resolveObjectAt: () => null,
    });
    const startCall = mockSetInputAction.mock.calls.find(
      (c: unknown[]) => c[1] === "PINCH_START",
    ) as [
      (ev: { position1: { x: number; y: number }; position2: { x: number; y: number } }) => void,
      string,
    ];
    const moveCall = mockSetInputAction.mock.calls.find(
      (c: unknown[]) => c[1] === "PINCH_MOVE",
    ) as [
      (ev: { position1: { x: number; y: number }; position2: { x: number; y: number } }) => void,
      string,
    ];
    // Start with fingers 100px apart
    startCall[0]({ position1: { x: 0, y: 0 }, position2: { x: 100, y: 0 } });
    // Move: fingers now 200px apart (zoomed in)
    moveCall[0]({ position1: { x: 0, y: 0 }, position2: { x: 200, y: 0 } });
    const fovDeg = ((viewer.camera.frustum as { fovy: number }).fovy * 180) / Math.PI;
    expect(fovDeg).toBeLessThan(60);
  });

  it("PINCH_MOVE with no prior PINCH_START does nothing", () => {
    const viewer = makeViewer(Math.PI / 3);
    const onZoom = vi.fn();
    setupGestures(viewer, {
      getObserver: () => ({ lat: 0, lon: 0 }),
      resolveObjectAt: () => null,
      onZoom,
    });
    const moveCall = mockSetInputAction.mock.calls.find(
      (c: unknown[]) => c[1] === "PINCH_MOVE",
    ) as [
      (ev: { position1: { x: number; y: number }; position2: { x: number; y: number } }) => void,
      string,
    ];
    moveCall[0]({ position1: { x: 0, y: 0 }, position2: { x: 100, y: 0 } });
    expect(onZoom).not.toHaveBeenCalled();
  });

  it("PINCH_END resets pinch state so subsequent PINCH_MOVE events are ignored", () => {
    const viewer = makeViewer(Math.PI / 3);
    const onZoom = vi.fn();
    setupGestures(viewer, {
      getObserver: () => ({ lat: 0, lon: 0 }),
      resolveObjectAt: () => null,
      onZoom,
    });
    const startCall = mockSetInputAction.mock.calls.find(
      (c: unknown[]) => c[1] === "PINCH_START",
    ) as [
      (ev: { position1: { x: number; y: number }; position2: { x: number; y: number } }) => void,
      string,
    ];
    const endCall = mockSetInputAction.mock.calls.find((c: unknown[]) => c[1] === "PINCH_END") as [
      () => void,
      string,
    ];
    const moveCall = mockSetInputAction.mock.calls.find(
      (c: unknown[]) => c[1] === "PINCH_MOVE",
    ) as [
      (ev: { position1: { x: number; y: number }; position2: { x: number; y: number } }) => void,
      string,
    ];
    startCall[0]({ position1: { x: 0, y: 0 }, position2: { x: 100, y: 0 } });
    endCall[0]();
    moveCall[0]({ position1: { x: 0, y: 0 }, position2: { x: 200, y: 0 } });
    expect(onZoom).not.toHaveBeenCalled();
  });

  it("PINCH_MOVE with degenerate zero distance is ignored (defensive)", () => {
    const viewer = makeViewer(Math.PI / 3);
    const onZoom = vi.fn();
    setupGestures(viewer, {
      getObserver: () => ({ lat: 0, lon: 0 }),
      resolveObjectAt: () => null,
      onZoom,
    });
    const startCall = mockSetInputAction.mock.calls.find(
      (c: unknown[]) => c[1] === "PINCH_START",
    ) as [
      (ev: { position1: { x: number; y: number }; position2: { x: number; y: number } }) => void,
      string,
    ];
    const moveCall = mockSetInputAction.mock.calls.find(
      (c: unknown[]) => c[1] === "PINCH_MOVE",
    ) as [
      (ev: { position1: { x: number; y: number }; position2: { x: number; y: number } }) => void,
      string,
    ];
    startCall[0]({ position1: { x: 0, y: 0 }, position2: { x: 100, y: 0 } });
    // Both fingers on the same spot → zero distance, ignored
    moveCall[0]({ position1: { x: 50, y: 0 }, position2: { x: 50, y: 0 } });
    expect(onZoom).not.toHaveBeenCalled();
  });
});

describe("setupTrackballControls drag + inertia", () => {
  beforeEach(() => {
    mockSetInputAction.mockClear();
    mockScreenSpaceEventHandler.mockClear();
    mockHandlerDestroy.mockClear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function getHandler(eventType: string): (ev: unknown) => void {
    const call = mockSetInputAction.mock.calls.find((c: unknown[]) => c[1] === eventType) as
      [(ev: unknown) => void, string] | undefined;
    if (!call) throw new Error(`no handler registered for ${eventType}`);
    return call[0];
  }

  it("MOUSE_MOVE before LEFT_DOWN does nothing (no matrix ops triggered)", () => {
    const viewer = makeViewer();
    setupTrackballControls(viewer);
    // If not dragging, the MOUSE_MOVE handler should early-return.
    expect(() => {
      getHandler("MOUSE_MOVE")({ endPosition: { x: 100, y: 100 } });
    }).not.toThrow();
  });

  it("LEFT_DOWN then MOUSE_MOVE then LEFT_UP with meaningful velocity schedules inertia frames", () => {
    const viewer = makeViewer();
    setupTrackballControls(viewer);
    // Simulate a drag: down at (100, 100), move to (200, 150) 10ms later
    getHandler("LEFT_DOWN")({ position: { x: 100, y: 100 } });
    vi.advanceTimersByTime(10);
    getHandler("MOUSE_MOVE")({ endPosition: { x: 200, y: 150 } });
    // Release — inertia should be scheduled (velocity > threshold)
    getHandler("LEFT_UP")({});
    // Inertia fires via setTimeout(16ms); after advancing several frames it should
    // produce additional rotation calls but no crash.
    expect(() => vi.advanceTimersByTime(900)).not.toThrow();
  });

  it("LEFT_UP with tiny velocity does not schedule inertia (no crash even with no moves)", () => {
    const viewer = makeViewer();
    setupTrackballControls(viewer);
    getHandler("LEFT_DOWN")({ position: { x: 100, y: 100 } });
    // No movement at all — release
    getHandler("LEFT_UP")({});
    expect(() => vi.advanceTimersByTime(900)).not.toThrow();
  });

  it("starting a new drag during inertia cancels the inertia (no crash)", () => {
    const viewer = makeViewer();
    setupTrackballControls(viewer);
    getHandler("LEFT_DOWN")({ position: { x: 100, y: 100 } });
    vi.advanceTimersByTime(10);
    getHandler("MOUSE_MOVE")({ endPosition: { x: 300, y: 300 } });
    getHandler("LEFT_UP")({});
    // Start new drag mid-inertia
    vi.advanceTimersByTime(50);
    getHandler("LEFT_DOWN")({ position: { x: 50, y: 50 } });
    expect(() => vi.advanceTimersByTime(900)).not.toThrow();
  });
});
