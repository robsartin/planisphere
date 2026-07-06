/* SPDX-License-Identifier: Apache-2.0 */
import {
  PolylineCollection,
  LabelCollection,
  Color,
  HorizontalOrigin,
  VerticalOrigin,
  LabelStyle,
  Material,
} from "cesium";
import type { Scene } from "cesium";
import type { VisibleConstellation } from "../astro";
import { setCollectionVisible } from "./cesium-collections";
import { altAzToCartesian } from "./stars";

export type ConstellationNameOverrides = Readonly<Record<string, string>> | null;

export type ConstellationLayer = {
  update: (constellations: VisibleConstellation[], lat: number, lon: number) => void;
  setVisible: (visible: boolean) => void;
  setOpacity: (opacity: number) => void;
  setNameOverrides: (overrides: ConstellationNameOverrides) => void;
};

export function createConstellationLayer(scene: Scene): ConstellationLayer {
  const polylines = new PolylineCollection();
  const labels = new LabelCollection({ scene });
  scene.primitives.add(polylines);
  scene.primitives.add(labels);

  const addedPolylines: Array<{ material: { uniforms: { color: { alpha: number } } } }> = [];
  let nameOverrides: ConstellationNameOverrides = null;

  function labelFor(c: VisibleConstellation): string {
    if (nameOverrides !== null) {
      const translated = nameOverrides[c.id];
      if (typeof translated === "string" && translated.length > 0) return translated;
    }
    return c.name;
  }

  function update(constellations: VisibleConstellation[], lat: number, lon: number): void {
    polylines.removeAll();
    labels.removeAll();
    addedPolylines.length = 0;

    for (const constellation of constellations) {
      for (const line of constellation.lines) {
        const startPos = altAzToCartesian(line.start.alt, line.start.az, lat, lon);
        const endPos = altAzToCartesian(line.end.alt, line.end.az, lat, lon);
        const pl = polylines.add({
          positions: [startPos, endPos],
          width: 1,
          material: Material.fromType("Color", {
            color: Color.WHITE.withAlpha(0.25),
          }),
          // Attach the VisibleConstellation as the picked id so hovering a
          // line segment (e.g. anywhere along Scorpius's stick figure) opens
          // the constellation popup. Without this the polyline picks but
          // returns picked.id=undefined and the type-guard chain in
          // pickObject falls through to null. Labels are tiny and rare
          // pick targets; lines are most of the visible footprint.
          id: constellation,
        });
        addedPolylines.push(pl);
      }

      const centroidPos = altAzToCartesian(
        constellation.centroid.alt,
        constellation.centroid.az,
        lat,
        lon,
      );
      labels.add({
        position: centroidPos,
        text: labelFor(constellation),
        font: "12px sans-serif",
        fillColor: Color.WHITE.withAlpha(0.6),
        style: LabelStyle.FILL,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        // Attach the VisibleConstellation as the picked id so scene/tooltip can
        // resolve clicks on the label back to a typed structured payload.
        id: constellation,
      });
    }
  }

  function setVisible(visible: boolean): void {
    setCollectionVisible(polylines, visible);
    setCollectionVisible(labels, visible);
  }

  function setOpacity(opacity: number): void {
    for (const pl of addedPolylines) {
      if (pl?.material?.uniforms?.color !== undefined) {
        pl.material.uniforms.color.alpha = opacity;
      }
    }
  }

  function setNameOverrides(overrides: ConstellationNameOverrides): void {
    nameOverrides = overrides;
  }

  return { update, setVisible, setOpacity, setNameOverrides };
}
