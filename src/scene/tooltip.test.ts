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
  ScreenSpaceEventType: { MOUSE_MOVE: 0, LEFT_CLICK: 1 },
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

  it("registers a MOUSE_MOVE handler and a LEFT_CLICK handler", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    createTooltip(viewer as never, container);
    expect(mockSetInputAction).toHaveBeenCalledTimes(2);
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
    // Both hover and pinned tooltips removed
    expect(container.querySelectorAll("div").length).toBe(0);
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

  // --- Click-to-pin tests ---

  it("clicking a star pins the tooltip — it stays visible and has a close button", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    createTooltip(viewer as never, container);

    const clickCallback = mockSetInputAction.mock.calls[1]![0] as (movement: {
      position: { x: number; y: number };
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
    clickCallback({ position: { x: 100, y: 200 } });

    const pinnedDiv = container.querySelector<HTMLElement>("[data-pinned]");
    expect(pinnedDiv).toBeTruthy();
    expect(pinnedDiv!.style.display).toBe("block");
    expect(pinnedDiv!.innerHTML).toContain("Sirius");
    // Close button present
    const closeBtn = pinnedDiv!.querySelector("button");
    expect(closeBtn).toBeTruthy();
  });

  it("clicking the × button dismisses the pinned tooltip", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    createTooltip(viewer as never, container);

    const clickCallback = mockSetInputAction.mock.calls[1]![0] as (movement: {
      position: { x: number; y: number };
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
    clickCallback({ position: { x: 100, y: 200 } });

    const pinnedDiv = container.querySelector<HTMLElement>("[data-pinned]");
    expect(pinnedDiv).toBeTruthy();

    const closeBtn = pinnedDiv!.querySelector("button")!;
    closeBtn.click();

    expect(pinnedDiv!.style.display).toBe("none");
  });

  it("clicking empty space dismisses the pinned tooltip", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    createTooltip(viewer as never, container);

    const clickCallback = mockSetInputAction.mock.calls[1]![0] as (movement: {
      position: { x: number; y: number };
    }) => void;

    // First click pins
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
    clickCallback({ position: { x: 100, y: 200 } });

    const pinnedDiv = container.querySelector<HTMLElement>("[data-pinned]");
    expect(pinnedDiv!.style.display).toBe("block");

    // Second click on empty space (no pick result) dismisses
    mockPick.mockReturnValueOnce(undefined);
    clickCallback({ position: { x: 300, y: 400 } });

    expect(pinnedDiv!.style.display).toBe("none");
  });

  it("hover tooltip is hidden when a tooltip is pinned", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    createTooltip(viewer as never, container);

    const moveCallback = mockSetInputAction.mock.calls[0]![0] as (movement: {
      endPosition: { x: number; y: number };
    }) => void;
    const clickCallback = mockSetInputAction.mock.calls[1]![0] as (movement: {
      position: { x: number; y: number };
    }) => void;

    // Pin a tooltip first
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
    clickCallback({ position: { x: 100, y: 200 } });

    // Hover over another star — hover tooltip should stay hidden
    mockPick.mockReturnValueOnce({
      id: {
        hip: 11111,
        ra: 50.0,
        dec: 20.0,
        alt: 30.0,
        az: 90.0,
        mag: 2.0,
        name: "Vega",
        size: 10,
        opacity: 1,
      },
    });
    moveCallback({ endPosition: { x: 200, y: 300 } });

    // The first (hover) div should remain hidden
    const hoverDiv = container.querySelector<HTMLElement>("div:not([data-pinned])")!;
    expect(hoverDiv.style.display).toBe("none");
  });

  it("pinned tooltip has a solid border style to distinguish from hover", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    createTooltip(viewer as never, container);

    const clickCallback = mockSetInputAction.mock.calls[1]![0] as (movement: {
      position: { x: number; y: number };
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
    clickCallback({ position: { x: 100, y: 200 } });

    const pinnedDiv = container.querySelector<HTMLElement>("[data-pinned]")!;
    // Should have pointer-events enabled (not none) so close button is clickable
    expect(pinnedDiv.style.pointerEvents).not.toBe("none");
  });

  it("shows tooltip with Messier object info when a VisibleMessier billboard is picked", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    createTooltip(viewer as never, container);

    const moveCallback = mockSetInputAction.mock.calls[0]![0] as (movement: {
      endPosition: { x: number; y: number };
    }) => void;

    mockPick.mockReset();
    mockPick.mockReturnValueOnce({
      id: {
        m: 42,
        name: "Orion Nebula",
        type: "nebula",
        alt: 45.2,
        az: 180.3,
        ra: 83.8221,
        dec: -5.3911,
        mag: 4.0,
      },
    });
    moveCallback({ endPosition: { x: 100, y: 200 } });

    const tooltipDiv = container.querySelector("div")!;
    expect(tooltipDiv.style.display).toBe("block");
    expect(tooltipDiv.innerHTML).toContain("M42");
    expect(tooltipDiv.innerHTML).toContain("Orion Nebula");
    expect(tooltipDiv.innerHTML).toContain("nebula");
    expect(tooltipDiv.innerHTML).toContain("4.0");
  });
});
