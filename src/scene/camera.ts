/* SPDX-License-Identifier: Apache-2.0 */
import {
  Cartesian3,
  Math as CesiumMath,
  Matrix3,
  Quaternion,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from "cesium";
import type { Camera, Viewer } from "cesium";

export function initCamera(camera: Camera, lat: number, lon: number): void {
  setCameraView(camera, lat, lon, 0, 89.9);
}

/**
 * Read the current camera heading (azimuth) in degrees, normalized to [0, 360).
 * Returns 0 if the camera object does not expose a numeric `heading` property —
 * this happens in jsdom-based tests where the mock camera is a static object.
 */
export function getCameraHeadingDeg(camera: Camera): number {
  const h = (camera as { heading?: unknown }).heading;
  if (typeof h !== "number" || !Number.isFinite(h)) return 0;
  const deg = CesiumMath.toDegrees(h);
  return ((deg % 360) + 360) % 360;
}

export function setCameraView(
  camera: Camera,
  lat: number,
  lon: number,
  azDeg: number,
  altDeg: number,
): void {
  const height = 1.7;
  const clampedAlt = Math.min(89.9, Math.max(0, altDeg));
  camera.setView({
    destination: Cartesian3.fromDegrees(lon, lat, height),
    orientation: {
      heading: CesiumMath.toRadians(azDeg),
      pitch: CesiumMath.toRadians(clampedAlt),
      roll: 0,
    },
  });
}

export function setupTrackballControls(viewer: Viewer): void {
  const scene = viewer.scene;
  const camera = viewer.camera;
  const controller = scene.screenSpaceCameraController;

  // Disable all default camera interactions — observer is fixed on the ground
  controller.enableRotate = false;
  controller.enableTranslate = false;
  controller.enableZoom = false;
  controller.enableTilt = false;
  controller.enableLook = false;

  const handler = new ScreenSpaceEventHandler(scene.canvas);

  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  const rotateSpeed = 0.005; // radians per pixel

  handler.setInputAction((click: ScreenSpaceEventHandler.PositionedEvent) => {
    isDragging = true;
    lastX = click.position.x;
    lastY = click.position.y;
  }, ScreenSpaceEventType.LEFT_DOWN);

  handler.setInputAction((movement: ScreenSpaceEventHandler.MotionEvent) => {
    if (!isDragging) return;

    const dx = movement.endPosition.x - lastX;
    const dy = movement.endPosition.y - lastY;
    lastX = movement.endPosition.x;
    lastY = movement.endPosition.y;

    // Map mouse dx to rotation around camera up (yaw), dy to rotation around
    // camera right (pitch). Quaternion multiplication avoids gimbal lock.
    const qRight = Quaternion.fromAxisAngle(camera.right, -dy * rotateSpeed, new Quaternion());
    const qUp = Quaternion.fromAxisAngle(camera.up, -dx * rotateSpeed, new Quaternion());
    const qCombined = Quaternion.multiply(qUp, qRight, new Quaternion());

    const rotMatrix = Matrix3.fromQuaternion(qCombined, new Matrix3());

    camera.direction = Matrix3.multiplyByVector(rotMatrix, camera.direction, new Cartesian3());
    camera.up = Matrix3.multiplyByVector(rotMatrix, camera.up, new Cartesian3());

    // Re-derive right and re-orthogonalize up to prevent drift
    Cartesian3.cross(camera.direction, camera.up, camera.right);
    Cartesian3.normalize(camera.right, camera.right);
    Cartesian3.cross(camera.right, camera.direction, camera.up);
    Cartesian3.normalize(camera.up, camera.up);
  }, ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction(() => {
    isDragging = false;
  }, ScreenSpaceEventType.LEFT_UP);
}
