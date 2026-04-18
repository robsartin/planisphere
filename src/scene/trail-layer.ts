/* SPDX-License-Identifier: Apache-2.0 */
import { PolylineCollection, Color, Material } from "cesium";
import type { Scene } from "cesium";
import type { HorizontalCoord } from "../astro/coords";
import { altAzToCartesian } from "./stars";

export type TrailLayer = {
  setPoints: (points: readonly HorizontalCoord[], lat: number, lon: number) => void;
  show: () => void;
  hide: () => void;
};

const TRAIL_COLOR = Color.fromCssColorString("#6cf");
const DASH_GAP_COLOR = Color.fromCssColorString("#000000");

/**
 * Layer that renders a dashed polyline for an object's future path across the sky.
 *
 * Rendered as a single polyline using the built-in "PolylineDash" Cesium material so
 * the path looks dotted/dashed — visually distinct from the solid ecliptic/grid lines.
 */
export function createTrailLayer(scene: Scene): TrailLayer {
  const polylines = new PolylineCollection();
  scene.primitives.add(polylines);

  function setPoints(points: readonly HorizontalCoord[], lat: number, lon: number): void {
    polylines.removeAll();
    if (points.length < 2) return;

    const positions = points.map((pt) => altAzToCartesian(pt.alt, pt.az, lat, lon));
    polylines.add({
      positions,
      width: 2,
      material: Material.fromType("PolylineDash", {
        color: TRAIL_COLOR,
        gapColor: DASH_GAP_COLOR.withAlpha(0),
        dashLength: 16,
      }),
    });
    (polylines as unknown as { show: boolean }).show = true;
  }

  function show(): void {
    (polylines as unknown as { show: boolean }).show = true;
  }

  function hide(): void {
    (polylines as unknown as { show: boolean }).show = false;
  }

  return { setPoints, show, hide };
}
