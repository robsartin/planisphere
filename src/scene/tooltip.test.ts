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

  it("creates a hover tooltip div inside the container", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    createTooltip(viewer as never, container);
    const tooltipDiv = container.querySelector("div");
    expect(tooltipDiv).toBeTruthy();
    expect(tooltipDiv!.style.display).toBe("none");
  });

  it("creates exactly one DOM element (hover only — no pinned tooltip any more)", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    createTooltip(viewer as never, container);
    expect(container.querySelectorAll("div").length).toBe(1);
    expect(container.querySelector("[data-pinned]")).toBeNull();
  });

  it("registers a MOUSE_MOVE handler and a LEFT_CLICK handler", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    createTooltip(viewer as never, container);
    expect(mockSetInputAction).toHaveBeenCalledTimes(2);
  });

  it("shows hover tooltip with star info when a billboard is picked", () => {
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

  // --- Click-to-card tests ---

  it("clicking an object invokes onObjectClicked with the picked data + screen coords", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    const onObjectClicked = vi.fn();
    createTooltip(viewer as never, container, { onObjectClicked });

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

    expect(onObjectClicked).toHaveBeenCalledOnce();
    const call = onObjectClicked.mock.calls[0] as [{ kind: string }, number, number];
    expect(call[0].kind).toBe("star");
    expect(call[1]).toBe(100);
    expect(call[2]).toBe(200);
  });

  it("clicking empty space invokes onObjectClicked with null + screen coords", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    const onObjectClicked = vi.fn();
    createTooltip(viewer as never, container, { onObjectClicked });

    const clickCallback = mockSetInputAction.mock.calls[1]![0] as (movement: {
      position: { x: number; y: number };
    }) => void;
    mockPick.mockReturnValueOnce(undefined);
    clickCallback({ position: { x: 200, y: 400 } });
    expect(onObjectClicked).toHaveBeenCalledOnce();
    const call = onObjectClicked.mock.calls[0] as [unknown, number, number];
    expect(call[0]).toBeNull();
    expect(call[1]).toBe(200);
    expect(call[2]).toBe(400);
  });

  it("does not throw on empty-sky click without an onObjectClicked handler", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    createTooltip(viewer as never, container);
    const clickCallback = mockSetInputAction.mock.calls[1]![0] as (movement: {
      position: { x: number; y: number };
    }) => void;
    mockPick.mockReturnValueOnce(undefined);
    expect(() => clickCallback({ position: { x: 10, y: 20 } })).not.toThrow();
  });

  it("clicking a constellation label invokes onObjectClicked with kind='constellation'", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    const onObjectClicked = vi.fn();
    createTooltip(viewer as never, container, { onObjectClicked });

    const clickCallback = mockSetInputAction.mock.calls[1]![0] as (movement: {
      position: { x: number; y: number };
    }) => void;
    mockPick.mockReturnValueOnce({
      id: {
        id: "Ori",
        name: "Orion",
        lines: [],
        centroid: { alt: 15, az: 105 },
      },
    });
    clickCallback({ position: { x: 150, y: 150 } });
    expect(onObjectClicked).toHaveBeenCalledOnce();
    expect((onObjectClicked.mock.calls[0]![0] as { kind: string }).kind).toBe("constellation");
  });

  it("does not throw when clicked without an onObjectClicked handler", () => {
    const container = document.createElement("div");
    const viewer = makeMockViewer();
    createTooltip(viewer as never, container);
    const clickCallback = mockSetInputAction.mock.calls[1]![0] as (movement: {
      position: { x: number; y: number };
    }) => void;
    mockPick.mockReturnValueOnce({
      id: {
        hip: 32349,
        ra: 101,
        dec: -16,
        alt: 45,
        az: 180,
        mag: -1.44,
        name: "Sirius",
        size: 16,
        opacity: 1,
      },
    });
    expect(() => clickCallback({ position: { x: 10, y: 20 } })).not.toThrow();
  });
});
