/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi } from "vitest";
import { isOk, isErr } from "../result";
import { createViewer, repositionCreditBar } from "./viewer";

vi.mock("cesium", () => {
  const MockViewer = vi.fn(function () {
    return {
      scene: {
        skyBox: undefined,
        skyAtmosphere: undefined,
        sun: { show: true },
        moon: { show: true },
        backgroundColor: { red: 0, green: 0, blue: 0, alpha: 1 },
        globe: { show: true },
      },
      imageryLayers: { removeAll: vi.fn() },
      destroy: vi.fn(),
    };
  });

  return {
    Viewer: MockViewer,
    Color: { BLACK: { clone: () => ({ red: 0, green: 0, blue: 0, alpha: 1 }) } },
    Ion: { defaultAccessToken: "" },
  };
});

describe("createViewer", () => {
  it("returns Ok with a viewer when container exists", () => {
    const container = document.createElement("div");
    container.id = "cesium-container";
    document.body.appendChild(container);
    const r = createViewer("cesium-container");
    expect(isOk(r)).toBe(true);
    document.body.removeChild(container);
  });

  it("constructs the viewer with scene3DOnly so primitives skip the 2D projection", async () => {
    // The constellation-art layer draws unit quads whose model-space vertices
    // include the origin, positioned by the Primitive's modelMatrix. When
    // scene3DOnly is false Cesium's geometry pipeline projects the raw
    // model-space positions to 2D, and projecting (0, 0, 0) throws a
    // DeveloperError that halts the whole render loop.
    const { Viewer } = await import("cesium");
    const mock = vi.mocked(Viewer);
    mock.mockClear();

    const container = document.createElement("div");
    container.id = "cesium-3donly";
    document.body.appendChild(container);
    createViewer("cesium-3donly");
    document.body.removeChild(container);

    expect(mock.mock.calls[0]?.[1]).toMatchObject({ scene3DOnly: true });
  });

  it("returns Err when container does not exist", () => {
    const r = createViewer("nonexistent");
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("scene-init-failed");
  });

  it("returns Err when Viewer constructor throws", async () => {
    const { Viewer } = await import("cesium");
    const mock = vi.mocked(Viewer);
    mock.mockImplementationOnce(() => {
      throw new Error("WebGL not available");
    });
    const container = document.createElement("div");
    container.id = "cesium-throw";
    document.body.appendChild(container);
    const r = createViewer("cesium-throw");
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.message).toContain("WebGL not available");
    document.body.removeChild(container);
  });
});

describe("repositionCreditBar", () => {
  it("moves Cesium's default credit bar from bottom-left to top-right", () => {
    const container = document.createElement("div");
    const creditBar = document.createElement("div");
    creditBar.className = "cesium-viewer-bottom";
    creditBar.style.bottom = "0";
    creditBar.style.left = "0";
    container.appendChild(creditBar);

    repositionCreditBar(container);

    expect(creditBar.style.top).toBe("8px");
    expect(creditBar.style.right).toBe("8px");
    expect(creditBar.style.bottom).toBe("auto");
    expect(creditBar.style.left).toBe("auto");
    expect(creditBar.dataset.testid).toBe("cesium-credit-bar");
  });

  it("shrinks the bar to content width and disables pointer events", () => {
    // Cesium's default `.cesium-viewer-bottom` is a full-width absolutely-
    // positioned element. Leaving it full-width at `top: 8px` would lay a
    // transparent band across the top of the viewer that intercepts every
    // hover / drag gesture — breaks picker popups and camera drag. The
    // wrapper must be `pointer-events: none` + `width: auto` so only the
    // visible logo area shows and nothing there eats mouse events.
    const container = document.createElement("div");
    const creditBar = document.createElement("div");
    creditBar.className = "cesium-viewer-bottom";
    container.appendChild(creditBar);

    repositionCreditBar(container);

    expect(creditBar.style.pointerEvents).toBe("none");
    expect(creditBar.style.width).toBe("auto");
  });

  it("is a no-op if the viewer has no .cesium-viewer-bottom child", () => {
    const container = document.createElement("div");
    expect(() => {
      repositionCreditBar(container);
    }).not.toThrow();
  });
});
