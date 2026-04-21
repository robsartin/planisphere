/* SPDX-License-Identifier: Apache-2.0 */
import { PolylineCollection, Color, Material } from "cesium";
import type { Scene } from "cesium";
import { setCollectionVisible } from "./cesium-collections";
import type { VisibleBoundary } from "../astro";
import { raDecToAltAz } from "../astro/coords";
import { altAzToCartesian } from "./stars";

export type BoundaryLayer = {
  update: (boundaries: VisibleBoundary[], lat: number, lon: number) => void;
  setVisible: (visible: boolean) => void;
  setOpacity: (opacity: number) => void;
};

export function createBoundaryLayer(scene: Scene): BoundaryLayer {
  const polylines = new PolylineCollection();
  scene.primitives.add(polylines);

  let currentLat = 0;
  let currentLon = 0;
  let currentBoundaries: VisibleBoundary[] = [];
  let currentOpacity = 0.15;
  const addedPolylines: Array<{ material: { uniforms: { color: { alpha: number } } } }> = [];

  function buildPolylines(): void {
    polylines.removeAll();
    addedPolylines.length = 0;
    for (const boundary of currentBoundaries) {
      for (const seg of boundary.segments) {
        // Convert RA/Dec to alt/az for current observer
        const startCoord = raDecToAltAz(
          seg.start.ra,
          seg.start.dec,
          currentLat,
          currentLon,
          new Date(),
        );
        const endCoord = raDecToAltAz(seg.end.ra, seg.end.dec, currentLat, currentLon, new Date());
        const startPos = altAzToCartesian(startCoord.alt, startCoord.az, currentLat, currentLon);
        const endPos = altAzToCartesian(endCoord.alt, endCoord.az, currentLat, currentLon);
        const pl = polylines.add({
          positions: [startPos, endPos],
          width: 1,
          material: Material.fromType("Color", {
            color: Color.WHITE.withAlpha(currentOpacity),
          }),
        });
        addedPolylines.push(pl as never);
      }
    }
  }

  function update(boundaries: VisibleBoundary[], lat: number, lon: number): void {
    currentBoundaries = boundaries;
    currentLat = lat;
    currentLon = lon;
    buildPolylines();
  }

  function setVisible(visible: boolean): void {
    setCollectionVisible(polylines, visible);
  }

  function setOpacity(opacity: number): void {
    currentOpacity = opacity;
    for (const pl of addedPolylines) {
      if (pl?.material?.uniforms?.color !== undefined) {
        pl.material.uniforms.color.alpha = opacity;
      }
    }
  }

  return { update, setVisible, setOpacity };
}
