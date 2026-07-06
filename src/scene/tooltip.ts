/* SPDX-License-Identifier: Apache-2.0 */
import { ScreenSpaceEventHandler, ScreenSpaceEventType, defined } from "cesium";
import type { Cartesian2, Viewer } from "cesium";
import type { AltAzStar } from "../astro";
import type { CelestialBody } from "../astro";
import type { VisibleSatellite } from "../sat";
import type { VisibleMessier } from "../astro/messier";
import type { VisibleConstellation } from "../astro/constellations";
import type { VisibleBoundary } from "../astro/boundaries";

export type Tooltip = {
  destroy: () => void;
};

/** Structured representation of what was picked under the mouse.
 *  Used for both hover rendering and the click-emit callback. */
export type PickedObject =
  | { readonly kind: "star"; readonly star: AltAzStar }
  | { readonly kind: "body"; readonly body: CelestialBody }
  | { readonly kind: "satellite"; readonly satellite: VisibleSatellite }
  | { readonly kind: "messier"; readonly messier: VisibleMessier }
  | { readonly kind: "constellation"; readonly constellation: VisibleConstellation }
  | { readonly kind: "boundary"; readonly boundary: VisibleBoundary };

export type TooltipOptions = {
  /** Invoked on left-click. `picked` is the object under the cursor, or `null`
   *  when the click landed on empty sky (no billboard / line / label hit).
   *  The caller is responsible for presenting any pinned UI
   *  (see `ui/object-cards-manager` for picks, `ui/empty-sky-popover` for nulls). */
  onObjectClicked?: (picked: PickedObject | null, screenX: number, screenY: number) => void;
};

function formatRa(raDeg: number): string {
  const hours = raDeg / 15;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h)}h ${String(m)}m`;
}

function formatDec(dec: number): string {
  const sign = dec >= 0 ? "+" : "-";
  const abs = Math.abs(dec);
  const d = Math.floor(abs);
  const m = Math.round((abs - d) * 60);
  return `${sign}${String(d)}\u00B0 ${String(m)}\u2032`;
}

function isAltAzStar(obj: unknown): obj is AltAzStar {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "hip" in obj &&
    "alt" in obj &&
    "az" in obj &&
    "mag" in obj
  );
}

function isCelestialBody(obj: unknown): obj is CelestialBody {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    typeof (obj as Record<string, unknown>).id === "string" &&
    "alt" in obj &&
    "az" in obj &&
    "mag" in obj
  );
}

function formatStar(star: AltAzStar): string {
  const label = star.name ?? `HIP ${String(star.hip)}`;
  return (
    `<strong>${label}</strong><br>` +
    `mag ${star.mag.toFixed(2)}<br>` +
    `Alt ${star.alt.toFixed(1)}\u00B0 Az ${star.az.toFixed(1)}\u00B0<br>` +
    `RA ${formatRa(star.ra)} Dec ${formatDec(star.dec)}`
  );
}

function formatBody(body: CelestialBody): string {
  let html =
    `<strong>${body.id}</strong><br>` +
    `mag ${body.mag.toFixed(2)}<br>` +
    `Alt ${body.alt.toFixed(1)}\u00B0 Az ${body.az.toFixed(1)}\u00B0<br>` +
    `RA ${formatRa(body.ra)} Dec ${formatDec(body.dec)}`;
  if (body.illumination !== undefined) {
    html += `<br>${Math.round(body.illumination * 100)}% illuminated`;
  }
  return html;
}

function isVisibleSatellite(obj: unknown): obj is VisibleSatellite {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "noradId" in obj &&
    "alt" in obj &&
    "az" in obj &&
    "velocity" in obj
  );
}

function isVisibleMessier(obj: unknown): obj is VisibleMessier {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "m" in obj &&
    typeof (obj as Record<string, unknown>).m === "number" &&
    "type" in obj &&
    "alt" in obj &&
    "az" in obj &&
    "mag" in obj &&
    !("hip" in obj) &&
    !("noradId" in obj) &&
    !("id" in obj)
  );
}

function isVisibleConstellation(obj: unknown): obj is VisibleConstellation {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "centroid" in obj &&
    "lines" in obj &&
    "id" in obj &&
    "name" in obj &&
    typeof (obj as Record<string, unknown>).id === "string"
  );
}

function isVisibleBoundary(obj: unknown): obj is VisibleBoundary {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "name" in obj &&
    "segments" in obj &&
    !("centroid" in obj) &&
    !("lines" in obj) &&
    typeof (obj as Record<string, unknown>).id === "string" &&
    Array.isArray((obj as Record<string, unknown>).segments)
  );
}

function formatMessier(obj: VisibleMessier): string {
  const label = obj.name.length > 0 ? `M${String(obj.m)} \u2014 ${obj.name}` : `M${String(obj.m)}`;
  return (
    `<strong>${label}</strong> (${obj.type})<br>` +
    `mag ${obj.mag.toFixed(1)}<br>` +
    `Alt ${obj.alt.toFixed(1)}\u00B0 Az ${obj.az.toFixed(1)}\u00B0<br>` +
    `RA ${formatRa(obj.ra)} Dec ${formatDec(obj.dec)}`
  );
}

function formatSatellite(sat: VisibleSatellite): string {
  return (
    `<strong>${sat.name}</strong> (NORAD ${String(sat.noradId)})<br>` +
    `Alt ${sat.alt.toFixed(1)}\u00B0 Az ${sat.az.toFixed(1)}\u00B0<br>` +
    `Orbit: ${Math.round(sat.height)} km<br>` +
    `Velocity: ${sat.velocity.toFixed(2)} km/s`
  );
}

/**
 * Cesium's `Scene.pick` defaults to a 3x3-pixel pick rectangle. Star and
 * Messier sprites are 6–10 px and the cursor rarely lands exactly on them —
 * users perceive hover as "broken" because most positions return null.
 * Widening the rectangle to 21x21 makes the hit area roughly star-sized
 * without spuriously latching onto distant objects. Verified via Playwright
 * grid sweep: 3x3 → 12 hits / 259 (4.6%); 21x21 → 36 / 259 (13.9%).
 */
const PICK_RECT_PX = 21;

function pickObject(
  viewer: {
    scene: { pick: (pos: Cartesian2, width?: number, height?: number) => unknown };
  },
  position: Cartesian2,
): PickedObject | null {
  const picked: { id?: unknown } | undefined = viewer.scene.pick(
    position,
    PICK_RECT_PX,
    PICK_RECT_PX,
  ) as { id?: unknown } | undefined;

  if (!defined(picked) || picked === undefined) return null;

  if (isAltAzStar(picked.id)) return { kind: "star", star: picked.id };
  if (isCelestialBody(picked.id)) return { kind: "body", body: picked.id };
  if (isVisibleSatellite(picked.id)) return { kind: "satellite", satellite: picked.id };
  if (isVisibleMessier(picked.id)) return { kind: "messier", messier: picked.id };
  if (isVisibleConstellation(picked.id)) return { kind: "constellation", constellation: picked.id };
  if (isVisibleBoundary(picked.id)) return { kind: "boundary", boundary: picked.id };
  return null;
}

function pickHtml(picked: PickedObject): string {
  switch (picked.kind) {
    case "star":
      return formatStar(picked.star);
    case "body":
      return formatBody(picked.body);
    case "satellite":
      return formatSatellite(picked.satellite);
    case "messier":
      return formatMessier(picked.messier);
    case "constellation":
      return `<strong>${picked.constellation.name}</strong><br>(constellation)`;
    case "boundary":
      return `<strong>${picked.boundary.name}</strong><br>(IAU boundary)`;
  }
}

const HOVER_STYLE =
  "position:fixed;pointer-events:none;display:none;background:rgba(0,0,0,0.85);" +
  "color:#fff;font:12px/1.4 monospace;padding:6px 10px;border-radius:4px;" +
  "border:1px solid rgba(255,255,255,0.2);white-space:nowrap;z-index:10";

export function createTooltip(
  viewer: Viewer,
  _container: HTMLElement,
  options: TooltipOptions = {},
): Tooltip {
  // Hover tooltip only — pinned / card presentation now lives in ui/object-cards-manager.
  // Mounted on document.body (not the caller-supplied container) so the popup's
  // `position: fixed` containing block is the viewport regardless of how the
  // host app wraps the canvas. The container parameter is kept in the signature
  // for backward compatibility with existing callers.
  const hoverEl = document.createElement("div");
  hoverEl.dataset.tooltipHover = "";
  hoverEl.style.cssText = HOVER_STYLE;
  document.body.appendChild(hoverEl);

  // Parallel DOM mousemove tracker on the canvas. Cesium's
  // ScreenSpaceEventType.MOUSE_MOVE delivers `endPosition` in canvas-local
  // coords, which is correct for picking but cannot be reliably converted
  // back to viewport coords for popup placement: `getBoundingClientRect()`
  // breaks under any ancestor with `filter` / `transform` / `will-change`
  // (e.g. the night-vision filter on `body`), which create new containing
  // blocks for `position: fixed` descendants. Capture clientX/clientY off
  // the DOM event — universally viewport-relative — and use those for
  // placement, while still using Cesium's endPosition for the pick.
  let lastClientX = 0;
  let lastClientY = 0;
  function trackPointer(e: MouseEvent): void {
    lastClientX = e.clientX;
    lastClientY = e.clientY;
  }
  viewer.scene.canvas.addEventListener("mousemove", trackPointer);

  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

  handler.setInputAction((movement: { endPosition: Cartesian2 }) => {
    const picked = pickObject(viewer, movement.endPosition);
    if (picked !== null) {
      hoverEl.innerHTML = pickHtml(picked);
      hoverEl.style.display = "block";
      hoverEl.style.left = `${String(lastClientX + 14)}px`;
      hoverEl.style.top = `${String(lastClientY + 14)}px`;
    } else {
      hoverEl.style.display = "none";
    }
  }, ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction((movement: { position: Cartesian2 }) => {
    const picked = pickObject(viewer, movement.position);
    hoverEl.style.display = "none";
    options.onObjectClicked?.(picked, movement.position.x, movement.position.y);
  }, ScreenSpaceEventType.LEFT_CLICK);

  function destroy(): void {
    viewer.scene.canvas.removeEventListener("mousemove", trackPointer);
    handler.destroy();
    hoverEl.remove();
  }

  return { destroy };
}
