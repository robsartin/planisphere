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

    return ok(viewer);
  } catch (e) {
    return err({
      kind: "scene-init-failed",
      message: `Cesium Viewer creation failed: ${String(e)}`,
    });
  }
}
