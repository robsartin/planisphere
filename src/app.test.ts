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
    length: 0,
  })),
  Cartesian3: { fromDegrees: vi.fn().mockReturnValue({ x: 0, y: 0, z: 0 }) },
  Color: {
    BLACK: { clone: () => ({ red: 0, green: 0, blue: 0, alpha: 1 }) },
    WHITE: { withAlpha: (a: number) => ({ red: 1, green: 1, blue: 1, alpha: a }) },
  },
  Ion: { defaultAccessToken: "" },
  Math: { toRadians: (d: number) => (d * Math.PI) / 180 },
  HorizontalOrigin: { CENTER: 0 },
  VerticalOrigin: { CENTER: 0 },
}));

vi.mock("../data/stars.json", () => ({
  default: [
    { hip: 11767, ra: 37.9546, dec: 89.2641, mag: 2.02, name: "Polaris" },
    { hip: 32349, ra: 101.2872, dec: -16.7161, mag: -1.46, name: "Sirius" },
  ],
}));

import { bootstrap } from "./app";
import * as astro from "./astro";
import { err } from "./result";

describe("bootstrap", () => {
  it("creates a cesium-container div when root exists", () => {
    const root = document.createElement("main");
    root.id = "app";
    const cesiumDiv = document.createElement("div");
    cesiumDiv.id = "cesium-container";
    root.appendChild(cesiumDiv);
    const errorDiv = document.createElement("div");
    errorDiv.id = "error";
    root.appendChild(errorDiv);
    document.body.appendChild(root);

    bootstrap(root);

    expect(document.getElementById("cesium-container")).toBeTruthy();
    document.body.removeChild(root);
  });

  it("does nothing when root is null", () => {
    expect(() => bootstrap(null)).not.toThrow();
  });

  it("shows error text when state parsing fails", () => {
    const root = document.createElement("main");
    root.id = "app";
    const errorDiv = document.createElement("div");
    errorDiv.id = "error";
    root.appendChild(errorDiv);
    document.body.appendChild(root);

    bootstrap(root, new URLSearchParams({ lat: "999" }));

    expect(errorDiv.style.display).not.toBe("none");
    expect(errorDiv.textContent).toMatch(/lat-out-of-range/);
    document.body.removeChild(root);
  });

  it("shows error text when catalog parsing fails", () => {
    const spy = vi
      .spyOn(astro, "parseCatalog")
      .mockReturnValueOnce(err({ kind: "catalog-load-failed", message: "empty catalog" }));
    const root = document.createElement("main");
    root.id = "app";
    const errorDiv = document.createElement("div");
    errorDiv.id = "error";
    root.appendChild(errorDiv);
    document.body.appendChild(root);

    bootstrap(root, new URLSearchParams({ lat: "34", lon: "-118", t: "2026-01-15T04:00:00Z" }));

    expect(errorDiv.style.display).not.toBe("none");
    expect(errorDiv.textContent).toMatch(/Catalog error/);
    document.body.removeChild(root);
    spy.mockRestore();
  });

  it("shows error text when viewer creation fails", () => {
    const root = document.createElement("main");
    root.id = "app";
    const errorDiv = document.createElement("div");
    errorDiv.id = "error";
    root.appendChild(errorDiv);
    // No #cesium-container in DOM → createViewer returns Err
    document.body.appendChild(root);

    bootstrap(root, new URLSearchParams({ lat: "34", lon: "-118", t: "2026-01-15T04:00:00Z" }));

    expect(errorDiv.style.display).not.toBe("none");
    expect(errorDiv.textContent).toMatch(/Scene error/);
    document.body.removeChild(root);
  });
});
