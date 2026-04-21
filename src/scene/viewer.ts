/* SPDX-License-Identifier: Apache-2.0 */
import { Viewer, Color, Ion } from "cesium";
import { err, ok, type Result } from "../result";

export type SceneInitError = { kind: "scene-init-failed"; message: string };

Ion.defaultAccessToken = "";

export function createViewer(containerId: string): Result<Viewer, SceneInitError> {
  const container = document.getElementById(containerId);
  if (!container) {
    return err({
      kind: "scene-init-failed",
      message: `Container element #${containerId} not found`,
    });
  }

  try {
    const viewer = new Viewer(containerId, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      skyBox: false,
      skyAtmosphere: false,
      orderIndependentTranslucency: false,
      contextOptions: {
        webgl: { alpha: false },
      },
    });

    viewer.scene.backgroundColor = Color.BLACK.clone();
    if (viewer.scene.sun) viewer.scene.sun.show = false;
    if (viewer.scene.moon) viewer.scene.moon.show = false;
    viewer.scene.globe.show = false;
    viewer.imageryLayers.removeAll();

    repositionCreditBar(container);

    return ok(viewer);
  } catch (e) {
    return err({
      kind: "scene-init-failed",
      message: `Cesium Viewer creation failed: ${String(e)}`,
    });
  }
}

/**
 * Move Cesium's default credit bar (the `.cesium-viewer-bottom` child of the
 * viewer container) from its default bottom-left position to the top-right
 * corner of the viewer. Cesium's own CSS renders the "Powered by Cesium"
 * logo + attributions inside it; we're only overriding the outer container's
 * position so it doesn't collide with the bottom-hud (time / observer /
 * scrubber). Exported for testing.
 *
 * Cesium's Apache-2.0 licence expects the credit display to stay visible;
 * we keep it visible and clickable, just out of the hud's way.
 */
export function repositionCreditBar(viewerContainer: HTMLElement): void {
  const creditBar = viewerContainer.querySelector<HTMLElement>(".cesium-viewer-bottom");
  if (creditBar === null) return;
  creditBar.style.bottom = "auto";
  creditBar.style.left = "auto";
  creditBar.style.top = "8px";
  creditBar.style.right = "8px";
  creditBar.style.zIndex = "100";
  creditBar.dataset.testid = "cesium-credit-bar";
}
