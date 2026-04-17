/* SPDX-License-Identifier: Apache-2.0 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTooltip } from "./tooltip";

const mockSetInputAction = vi.fn();
const mockDestroy = vi.fn();
const mockPick = vi.fn();

vi.mock("cesium", () => ({
  ScreenSpaceEventHandler: vi.fn().mockImplementation(() => ({
    setInputAction: mockSetInputAction,
    destroy: mockDestroy,
  })),
  ScreenSpaceEventType: { MOUSE_MOVE: 0 },
  defined: (v: unknown) => v !== undefined && v !== null,
}));

function makeMockViewer() {
  return {
    scene: {
      canvas: document.createElement("canvas"),
      pick: mockPick,
    },
  };
}

describe("createTooltip", () => {
  beforeEach(() => {
    mockSetInputAction.mockClear();
    mockDestroy.mockClear();
    mockPick.mockClear();
  });

  it("creates a tooltip div inside the container", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    createTooltip(viewer as never, container);
    const tooltipDiv = container.querySelector("div");
    expect(tooltipDiv).toBeTruthy();
    expect(tooltipDiv!.style.display).toBe("none");
  });

  it("registers a MOUSE_MOVE handler", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    createTooltip(viewer as never, container);
    expect(mockSetInputAction).toHaveBeenCalledOnce();
  });

  it("shows tooltip with star info when a billboard is picked", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    createTooltip(viewer as never, container);

    const moveCallback = mockSetInputAction.mock.calls[0]![0] as (movement: {
      endPosition: { x: number; y: number };
    }) => void;

    mockPick.mockReturnValueOnce({
      id: {
        hip: 32349,
        ra: 101.2872,
        dec: -16.7161,
        alt: 45.2,
        az: 180.3,
        mag: -1.44,
        name: "Sirius",
        size: 16,
        opacity: 1,
      },
    });
    moveCallback({ endPosition: { x: 100, y: 200 } });

    const tooltipDiv = container.querySelector("div")!;
    expect(tooltipDiv.style.display).toBe("block");
    expect(tooltipDiv.innerHTML).toContain("Sirius");
    expect(tooltipDiv.innerHTML).toContain("-1.44");
    expect(tooltipDiv.innerHTML).toContain("45.2");
  });

  it("hides tooltip when nothing is picked", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    createTooltip(viewer as never, container);

    const moveCallback = mockSetInputAction.mock.calls[0]![0] as (movement: {
      endPosition: { x: number; y: number };
    }) => void;

    mockPick.mockReturnValueOnce(undefined);
    moveCallback({ endPosition: { x: 100, y: 200 } });

    const tooltipDiv = container.querySelector("div")!;
    expect(tooltipDiv.style.display).toBe("none");
  });

  it("destroy removes handler and tooltip element", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    const tooltip = createTooltip(viewer as never, container);
    tooltip.destroy();
    expect(mockDestroy).toHaveBeenCalledOnce();
    expect(container.querySelector("div")).toBeNull();
  });

  it("shows tooltip with body info when a CelestialBody billboard is picked", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    createTooltip(viewer as never, container);

    const moveCallback = mockSetInputAction.mock.calls[0]![0] as (movement: {
      endPosition: { x: number; y: number };
    }) => void;

    mockPick.mockReturnValueOnce({
      id: {
        id: "Moon",
        alt: 55.3,
        az: 120.1,
        ra: 100.5,
        dec: -5.2,
        mag: -12.7,
        size: 20,
        color: "#E8E8E0",
        illumination: 0.75,
        phaseAngle: 90,
      },
    });
    moveCallback({ endPosition: { x: 150, y: 250 } });

    const tooltipDiv = container.querySelector("div")!;
    expect(tooltipDiv.style.display).toBe("block");
    expect(tooltipDiv.innerHTML).toContain("Moon");
    expect(tooltipDiv.innerHTML).toContain("-12.7");
    expect(tooltipDiv.innerHTML).toContain("75%");
  });

  it("shows tooltip with satellite info when a VisibleSatellite billboard is picked", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    createTooltip(viewer as never, container);

    const moveCallback = mockSetInputAction.mock.calls[0]![0] as (movement: {
      endPosition: { x: number; y: number };
    }) => void;

    mockPick.mockReturnValueOnce({
      id: {
        name: "ISS (ZARYA)",
        noradId: 25544,
        alt: 45.2,
        az: 200.3,
        height: 420,
        velocity: 7.66,
        trail: [],
      },
    });
    moveCallback({ endPosition: { x: 200, y: 300 } });

    const tooltipDiv = container.querySelector("div")!;
    expect(tooltipDiv.style.display).toBe("block");
    expect(tooltipDiv.innerHTML).toContain("ISS");
    expect(tooltipDiv.innerHTML).toContain("25544");
    expect(tooltipDiv.innerHTML).toContain("420");
  });
});
