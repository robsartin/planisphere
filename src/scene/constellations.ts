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

  // Hidden DOM mirror of the label text (#306). Cesium renders labels into
  // the WebGL canvas via its font atlas, so end-to-end tests can't scrape
  // them from the DOM. Every call to update() also rebuilds a matching set
  // of `<span data-label-for="constellation-<id>">…</span>` nodes inside a
  // sentinel container off-screen so Playwright can assert language / sky-
  // culture translations without OCR or screenshot diffing. The container
  // is created lazily to keep unit-test environments without a DOM working.
  let labelMirrorRoot: HTMLDivElement | null = null;
  function ensureLabelMirrorRoot(): HTMLDivElement | null {
    if (labelMirrorRoot !== null) return labelMirrorRoot;
    if (typeof document === "undefined") return null;
    const root = document.createElement("div");
    root.dataset["labelMirror"] = "constellations";
    root.style.position = "absolute";
    root.style.left = "-9999px";
    root.style.top = "-9999px";
    root.style.width = "1px";
    root.style.height = "1px";
    root.style.overflow = "hidden";
    root.style.pointerEvents = "none";
    root.setAttribute("aria-hidden", "true");
    document.body.appendChild(root);
    labelMirrorRoot = root;
    return root;
  }

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

    const mirror = ensureLabelMirrorRoot();
    if (mirror !== null) mirror.replaceChildren();

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
      const labelText = labelFor(constellation);
      labels.add({
        position: centroidPos,
        text: labelText,
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

      // Mirror the rendered label text into a hidden DOM span so e2e tests
      // (#306) can assert language / skyculture translations without OCR.
      if (mirror !== null) {
        const span = document.createElement("span");
        span.dataset["labelFor"] = `constellation-${constellation.id}`;
        span.textContent = labelText;
        mirror.appendChild(span);
      }
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
