/* SPDX-License-Identifier: Apache-2.0 */
import { ScreenSpaceEventHandler, ScreenSpaceEventType, defined } from "cesium";
import type { Cartesian2, Viewer } from "cesium";
import type { AltAzStar } from "../astro";
import type { CelestialBody } from "../astro";
import type { VisibleSatellite } from "../sat";
import type { VisibleMessier } from "../astro/messier";

export type Tooltip = {
  destroy: () => void;
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

function pickHtml(
  viewer: { scene: { pick: (pos: Cartesian2) => unknown } },
  position: Cartesian2,
): string | null {
  const picked: { id?: unknown } | undefined = viewer.scene.pick(position) as
    | { id?: unknown }
    | undefined;

  if (!defined(picked) || picked === undefined) return null;

  if (isAltAzStar(picked.id)) return formatStar(picked.id);
  if (isCelestialBody(picked.id)) return formatBody(picked.id);
  if (isVisibleSatellite(picked.id)) return formatSatellite(picked.id);
  if (isVisibleMessier(picked.id)) return formatMessier(picked.id);
  return null;
}

const HOVER_STYLE =
  "position:absolute;pointer-events:none;display:none;background:rgba(0,0,0,0.85);" +
  "color:#fff;font:12px/1.4 monospace;padding:6px 10px;border-radius:4px;" +
  "border:1px solid rgba(255,255,255,0.2);white-space:nowrap;z-index:10";

const PINNED_STYLE =
  "position:absolute;pointer-events:auto;display:none;background:rgba(10,20,40,0.95);" +
  "color:#fff;font:12px/1.4 monospace;padding:6px 10px 6px 10px;border-radius:4px;" +
  "border:1px solid rgba(100,160,255,0.8);white-space:nowrap;z-index:11;box-shadow:0 0 8px rgba(100,160,255,0.3)";

const CLOSE_BTN_STYLE =
  "background:none;border:none;color:rgba(255,255,255,0.6);cursor:pointer;" +
  "font:14px/1 monospace;padding:0 0 0 8px;vertical-align:top;float:right";

export function createTooltip(viewer: Viewer, container: HTMLElement): Tooltip {
  // Hover tooltip
  const hoverEl = document.createElement("div");
  hoverEl.style.cssText = HOVER_STYLE;
  container.appendChild(hoverEl);

  // Pinned tooltip
  const pinnedEl = document.createElement("div");
  pinnedEl.style.cssText = PINNED_STYLE;
  pinnedEl.dataset.pinned = "true";
  container.appendChild(pinnedEl);

  let isPinned = false;

  function dismissPinned(): void {
    isPinned = false;
    pinnedEl.style.display = "none";
    pinnedEl.innerHTML = "";
  }

  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

  // Hover handler
  handler.setInputAction((movement: { endPosition: Cartesian2 }) => {
    if (isPinned) {
      hoverEl.style.display = "none";
      return;
    }

    const html = pickHtml(viewer, movement.endPosition);
    if (html !== null) {
      hoverEl.innerHTML = html;
      hoverEl.style.display = "block";
      hoverEl.style.left = `${String(movement.endPosition.x + 14)}px`;
      hoverEl.style.top = `${String(movement.endPosition.y + 14)}px`;
    } else {
      hoverEl.style.display = "none";
    }
  }, ScreenSpaceEventType.MOUSE_MOVE);

  // Click handler
  handler.setInputAction((movement: { position: Cartesian2 }) => {
    const html = pickHtml(viewer, movement.position);

    if (html === null) {
      // Clicked empty space — dismiss pinned
      dismissPinned();
      return;
    }

    // Pin the tooltip
    isPinned = true;
    hoverEl.style.display = "none";

    const closeBtn = document.createElement("button");
    closeBtn.style.cssText = CLOSE_BTN_STYLE;
    closeBtn.textContent = "\u00D7";
    closeBtn.addEventListener("click", () => {
      dismissPinned();
    });

    pinnedEl.innerHTML = html;
    pinnedEl.appendChild(closeBtn);
    pinnedEl.style.display = "block";
    pinnedEl.style.left = `${String(movement.position.x + 14)}px`;
    pinnedEl.style.top = `${String(movement.position.y + 14)}px`;
  }, ScreenSpaceEventType.LEFT_CLICK);

  function destroy(): void {
    handler.destroy();
    hoverEl.remove();
    pinnedEl.remove();
  }

  return { destroy };
}
