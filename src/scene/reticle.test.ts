/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { computeReticleRadiusPx, createReticleLayer } from "./reticle";

vi.mock("cesium", () => ({
  Math: { toDegrees: (r: number) => (r * 180) / Math.PI },
}));

describe("computeReticleRadiusPx", () => {
  it("returns 0 for a zero-degree preset", () => {
    expect(computeReticleRadiusPx(0, 60, 600)).toBe(0);
  });

  it("returns half the canvas height for a fov equal to camera vfov", () => {
    // If reticle fov == camera vfov, the circle diameter should equal canvas height.
    expect(computeReticleRadiusPx(60, 60, 600)).toBeCloseTo(300, 5);
  });

  it("scales linearly with preset degrees (small angle approximation)", () => {
    // For small angles, tan(x) ~= x, so radius ~= (fov / cameraVfov) * (canvasH / 2)
    const r = computeReticleRadiusPx(1, 60, 600);
    const expected = (1 / 60) * 300;
    // Allow a little room for the exact tan-based formula
    expect(r).toBeGreaterThan(expected * 0.9);
    expect(r).toBeLessThan(expected * 1.1);
  });

  it("never returns negative", () => {
    expect(computeReticleRadiusPx(-1, 60, 600)).toBe(0);
  });

  it("handles zero camera vfov defensively (returns 0)", () => {
    expect(computeReticleRadiusPx(5, 0, 600)).toBe(0);
  });

  it("handles zero canvas height defensively (returns 0)", () => {
    expect(computeReticleRadiusPx(5, 60, 0)).toBe(0);
  });
});

describe("createReticleLayer", () => {
  let container: HTMLElement;
  let canvas: HTMLCanvasElement;

  function makeScene(fovyRad = Math.PI / 3): {
    canvas: HTMLCanvasElement;
    camera: { frustum: { fovy: number } };
  } {
    return {
      canvas,
      camera: { frustum: { fovy: fovyRad } },
    };
  }

  beforeAll(() => {
    // Ensure canvas has a usable default size
    Object.defineProperty(HTMLCanvasElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return 600;
      },
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return 800;
      },
    });
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    canvas = document.createElement("canvas");
  });

  afterEach(() => {
    container.remove();
  });

  it("appends an SVG element to the container", () => {
    createReticleLayer(makeScene() as never, container);
    const svg = container.querySelector("svg[data-reticle]");
    expect(svg).toBeTruthy();
  });

  it("starts hidden when preset is 'off'", () => {
    const layer = createReticleLayer(makeScene() as never, container);
    layer.setPreset("off");
    const svg = container.querySelector<SVGElement>("svg[data-reticle]")!;
    expect(svg.style.display).toBe("none");
  });

  it("shows the reticle when a non-off preset is set", () => {
    const layer = createReticleLayer(makeScene() as never, container);
    layer.setPreset("naked-eye");
    const svg = container.querySelector<SVGElement>("svg[data-reticle]")!;
    expect(svg.style.display).not.toBe("none");
  });

  it("draws a circle element inside the svg for non-off presets", () => {
    const layer = createReticleLayer(makeScene() as never, container);
    layer.setPreset("binoculars");
    const circle = container.querySelector("circle");
    expect(circle).toBeTruthy();
  });

  it("hiding the reticle again removes display", () => {
    const layer = createReticleLayer(makeScene() as never, container);
    layer.setPreset("binoculars");
    layer.setPreset("off");
    const svg = container.querySelector<SVGElement>("svg[data-reticle]")!;
    expect(svg.style.display).toBe("none");
  });

  it("has destroy() that removes the svg from the container", () => {
    const layer = createReticleLayer(makeScene() as never, container);
    layer.destroy();
    expect(container.querySelector("svg[data-reticle]")).toBeNull();
  });

  it("render() resizes the circle after the camera fov changes", () => {
    const scene = makeScene(Math.PI / 3); // 60 deg
    const layer = createReticleLayer(scene as never, container);
    layer.setPreset("naked-eye");
    const r1 = Number(container.querySelector("circle")!.getAttribute("r"));
    // Narrow the camera FOV (zoom in) — same preset should now render larger
    scene.camera.frustum.fovy = Math.PI / 6; // 30 deg
    layer.render();
    const r2 = Number(container.querySelector("circle")!.getAttribute("r"));
    expect(r2).toBeGreaterThan(r1);
  });

  it("draws a larger circle for a wider fov preset", () => {
    const layer = createReticleLayer(makeScene() as never, container);
    layer.setPreset("small-scope");
    const smallR = Number(container.querySelector("circle")!.getAttribute("r"));
    layer.setPreset("binoculars");
    const bigR = Number(container.querySelector("circle")!.getAttribute("r"));
    expect(bigR).toBeGreaterThan(smallR);
  });
});
