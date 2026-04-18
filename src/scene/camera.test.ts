/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Camera, Viewer } from "cesium";
import { initCamera, setupTrackballControls } from "./camera";

const { mockSetInputAction, mockScreenSpaceEventHandler } = vi.hoisted(() => {
  const mockSetInputAction = vi.fn();
  const mockScreenSpaceEventHandler = vi.fn(() => ({ setInputAction: mockSetInputAction }));
  return { mockSetInputAction, mockScreenSpaceEventHandler };
});

vi.mock("cesium", () => ({
  Cartesian3: {
    fromDegrees: vi.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
    cross: vi.fn((a: object, _b: object, result: object) => Object.assign(result, a)),
    normalize: vi.fn((_v: object, result: object) => result),
  },
  Math: { toRadians: (deg: number) => (deg * Math.PI) / 180 },
  Matrix3: {
    fromQuaternion: vi.fn().mockReturnValue({}),
    multiplyByVector: vi.fn().mockReturnValue({ x: 0, y: 0, z: 1 }),
  },
  Quaternion: {
    fromAxisAngle: vi.fn().mockReturnValue({}),
    multiply: vi.fn().mockReturnValue({}),
  },
  ScreenSpaceEventHandler: mockScreenSpaceEventHandler,
  ScreenSpaceEventType: {
    LEFT_DOWN: "LEFT_DOWN",
    MOUSE_MOVE: "MOUSE_MOVE",
    LEFT_UP: "LEFT_UP",
  },
}));

function makeCamera(): { mock: Camera; setView: ReturnType<typeof vi.fn> } {
  const setView = vi.fn();
  const mock = { setView } as unknown as Camera;
  return { mock, setView };
}

function makeViewer(): Viewer {
  const camera = {
    direction: { x: 0, y: 0, z: 1 },
    up: { x: 0, y: 1, z: 0 },
    right: { x: 1, y: 0, z: 0 },
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
      canvas: {} as HTMLCanvasElement,
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

describe("setupTrackballControls", () => {
  beforeEach(() => {
    mockSetInputAction.mockClear();
    mockScreenSpaceEventHandler.mockClear();
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
