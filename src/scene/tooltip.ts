/* SPDX-License-Identifier: Apache-2.0 */
import { ScreenSpaceEventHandler, ScreenSpaceEventType, defined } from "cesium";
import type { Cartesian2, Viewer } from "cesium";
import type { AltAzStar } from "../astro";

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

export function createTooltip(viewer: Viewer, container: HTMLElement): Tooltip {
  const el = document.createElement("div");
  el.style.cssText =
    "position:absolute;pointer-events:none;display:none;background:rgba(0,0,0,0.85);" +
    "color:#fff;font:12px/1.4 monospace;padding:6px 10px;border-radius:4px;" +
    "border:1px solid rgba(255,255,255,0.2);white-space:nowrap;z-index:10";
  container.appendChild(el);

  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

  handler.setInputAction((movement: { endPosition: Cartesian2 }) => {
    const picked: { id?: unknown } | undefined = viewer.scene.pick(movement.endPosition) as
      | { id?: unknown }
      | undefined;
    if (defined(picked) && picked !== undefined && isAltAzStar(picked.id)) {
      const star = picked.id;
      const label = star.name ?? `HIP ${String(star.hip)}`;
      el.innerHTML =
        `<strong>${label}</strong><br>` +
        `mag ${star.mag.toFixed(2)}<br>` +
        `Alt ${star.alt.toFixed(1)}\u00B0 Az ${star.az.toFixed(1)}\u00B0<br>` +
        `RA ${formatRa(star.ra)} Dec ${formatDec(star.dec)}`;
      el.style.display = "block";
      el.style.left = `${String(movement.endPosition.x + 14)}px`;
      el.style.top = `${String(movement.endPosition.y + 14)}px`;
    } else {
      el.style.display = "none";
    }
  }, ScreenSpaceEventType.MOUSE_MOVE);

  function destroy(): void {
    handler.destroy();
    el.remove();
  }

  return { destroy };
}
