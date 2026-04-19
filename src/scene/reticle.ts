/* SPDX-License-Identifier: Apache-2.0 */
import { Math as CesiumMath } from "cesium";
import type { Scene } from "cesium";
import type { FovPresetId } from "../astro/fov-presets";
import { getFovDegrees } from "../astro/fov-presets";

export type ReticleLayer = {
  setPreset: (preset: FovPresetId) => void;
  /** Force a redraw — call after the camera FOV changes so the ring resizes. */
  render: () => void;
  destroy: () => void;
};

const SVG_NS = "http://www.w3.org/2000/svg";

const CIRCLE_STROKE = "rgba(255, 200, 80, 0.85)";
const CROSSHAIR_STROKE = "rgba(255, 200, 80, 0.6)";

/**
 * Compute the on-screen reticle radius in pixels for a given preset field-of-view.
 *
 * The reticle represents a circle of `presetDeg` angular diameter centered on the view.
 * For a perspective camera with vertical field-of-view `cameraVfovDeg`, the on-screen
 * pixel radius r is half the projection of that angular diameter, i.e.:
 *
 *   r = (canvasHeightPx / 2) * (tan(presetRad / 2) / tan(cameraVfovRad / 2))
 */
export function computeReticleRadiusPx(
  presetDeg: number,
  cameraVfovDeg: number,
  canvasHeightPx: number,
): number {
  if (presetDeg <= 0) return 0;
  if (cameraVfovDeg <= 0) return 0;
  if (canvasHeightPx <= 0) return 0;
  const halfPreset = (presetDeg * Math.PI) / 360;
  const halfCamera = (cameraVfovDeg * Math.PI) / 360;
  return (canvasHeightPx / 2) * (Math.tan(halfPreset) / Math.tan(halfCamera));
}

export function createReticleLayer(scene: Scene, container: HTMLElement): ReticleLayer {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.dataset.reticle = "true";
  svg.style.position = "absolute";
  svg.style.top = "0";
  svg.style.left = "0";
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.pointerEvents = "none";
  svg.style.display = "none";
  svg.style.zIndex = "5";
  container.appendChild(svg);

  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("fill", "none");
  circle.setAttribute("stroke", CIRCLE_STROKE);
  circle.setAttribute("stroke-width", "1.5");
  svg.appendChild(circle);

  // Short crosshair ticks in the center
  const hTick = document.createElementNS(SVG_NS, "line");
  hTick.setAttribute("stroke", CROSSHAIR_STROKE);
  hTick.setAttribute("stroke-width", "1");
  svg.appendChild(hTick);
  const vTick = document.createElementNS(SVG_NS, "line");
  vTick.setAttribute("stroke", CROSSHAIR_STROKE);
  vTick.setAttribute("stroke-width", "1");
  svg.appendChild(vTick);

  let currentPreset: FovPresetId = "off";

  function canvasDims(): { w: number; h: number } {
    const canvas = scene.canvas;
    // Prefer clientWidth/clientHeight (CSS size) because SVG is laid out in CSS px
    const w = canvas.clientWidth || canvas.width || 0;
    const h = canvas.clientHeight || canvas.height || 0;
    return { w, h };
  }

  function cameraVfovDeg(): number {
    const frustum = scene.camera.frustum as { fovy?: number; fov?: number };
    const fovyRad =
      typeof frustum.fovy === "number" && Number.isFinite(frustum.fovy) && frustum.fovy > 0
        ? frustum.fovy
        : typeof frustum.fov === "number" && Number.isFinite(frustum.fov)
          ? frustum.fov
          : Math.PI / 3;
    return CesiumMath.toDegrees(fovyRad);
  }

  function render(): void {
    const presetDeg = getFovDegrees(currentPreset);
    if (presetDeg <= 0) {
      svg.style.display = "none";
      return;
    }
    const { w, h } = canvasDims();
    if (w <= 0 || h <= 0) {
      svg.style.display = "none";
      return;
    }
    const r = computeReticleRadiusPx(presetDeg, cameraVfovDeg(), h);
    const cx = w / 2;
    const cy = h / 2;
    circle.setAttribute("cx", String(cx));
    circle.setAttribute("cy", String(cy));
    circle.setAttribute("r", String(Math.max(0, r)));

    const tick = 6;
    hTick.setAttribute("x1", String(cx - tick));
    hTick.setAttribute("x2", String(cx + tick));
    hTick.setAttribute("y1", String(cy));
    hTick.setAttribute("y2", String(cy));
    vTick.setAttribute("x1", String(cx));
    vTick.setAttribute("x2", String(cx));
    vTick.setAttribute("y1", String(cy - tick));
    vTick.setAttribute("y2", String(cy + tick));

    svg.style.display = "block";
  }

  function setPreset(preset: FovPresetId): void {
    currentPreset = preset;
    render();
  }

  function destroy(): void {
    svg.remove();
  }

  return { setPreset, render, destroy };
}
