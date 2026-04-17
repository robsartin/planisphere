/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi } from "vitest";
import { isOk, isErr } from "../result";
import { createViewer } from "./viewer";

vi.mock("cesium", () => {
  const MockViewer = vi.fn().mockImplementation(() => ({
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
  }));

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
