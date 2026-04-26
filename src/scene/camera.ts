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
import { clampFov, easeOutCubic, inertiaDelta, interpolateAzAlt } from "./animation-math";

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

/** Duration (ms) used for the animated double-tap camera transitions. */
export const CAMERA_ANIM_DURATION_MS = 400;

/** Total inertial-pan decay window (ms). */
export const DRAG_INERTIA_DECAY_MS = 800;

/**
 * Smoothly animate the camera from its current az/alt to the target az/alt
 * over `durationMs` milliseconds. Uses an ease-out cubic curve and picks the
 * shortest azimuthal arc (so a 350→10 transition crosses 0, not 180).
 *
 * For tests and non-animated call sites, `durationMs <= 0` snaps instantly.
 *
 * NOTE: this function reads the camera's current heading/pitch at call time
 * via `camera.heading` / `camera.pitch` if present (Cesium `Camera` exposes
 * these as live getters). If neither is available it starts from az=0, alt=0.
 */
export function setCameraViewAnimated(
  camera: Camera,
  lat: number,
  lon: number,
  targetAzDeg: number,
  targetAltDeg: number,
  durationMs: number,
): void {
  if (durationMs <= 0) {
    setCameraView(camera, lat, lon, targetAzDeg, targetAltDeg);
    return;
  }

  // Safely snapshot current orientation; Cesium's Camera has live getters.
  const c = camera as unknown as { heading?: number; pitch?: number };
  const fromAz = typeof c.heading === "number" ? CesiumMath.toDegrees(c.heading) : 0;
  const fromAlt = typeof c.pitch === "number" ? CesiumMath.toDegrees(c.pitch) : 0;

  const start = Date.now();
  const from = { az: fromAz, alt: fromAlt };
  const to = { az: targetAzDeg, alt: targetAltDeg };

  // setTimeout(16ms) instead of requestAnimationFrame: 60fps is plenty for a
  // 400ms transition and setTimeout is easier to reason about under fake timers
  // in tests. Any additional visual smoothness from rAF is imperceptible here.
  function step(): void {
    const elapsed = Date.now() - start;
    const t = Math.min(1, Math.max(0, elapsed / durationMs));
    const eased = easeOutCubic(t);
    const { az, alt } = interpolateAzAlt(from, to, eased);
    setCameraView(camera, lat, lon, az, alt);
    if (t < 1) {
      setTimeout(step, 16);
    }
  }

  step();
}

/**
 * Gesture subsystem — owns pointer-driven camera interactions:
 *  - drag to pan (with post-release inertia)
 *  - scroll-wheel zoom (FOV)
 *  - pinch-to-zoom (mobile — handled through Cesium's built-in PINCH events)
 *  - double-tap / double-click to center (empty sky → zenith, object → its az/alt)
 *
 * Designed to coexist with tooltip.ts which independently wires LEFT_CLICK
 * and MOUSE_MOVE on the same canvas. Cesium's `ScreenSpaceEventHandler`
 * supports multiple independent handlers per canvas.
 */

export type AzAltPosition = { az: number; alt: number };

export type GestureOptions = {
  /** Observer location provider (az/alt transforms need it). */
  getObserver: () => { lat: number; lon: number };
  /**
   * Hit-test at a screen position. Returns the az/alt of the picked object,
   * or null if the point is empty sky.
   */
  resolveObjectAt: (x: number, y: number) => AzAltPosition | null;
  /** Called after a zoom changes the camera FOV (so callers can re-render reticle). */
  onZoom?: () => void;
  /**
   * Called after a wheel-pan changes the camera's az/alt. Lets the caller
   * propagate the new view direction into AppState so URL serialisation
   * (`?vaz=…&valt=…`) and other state-derived UI stay in sync. Without
   * this, scroll-panning leaves the URL pointing at the default view —
   * "Copy link" produces a bare URL.
   */
  onPan?: (azDeg: number, altDeg: number) => void;
};

export type GestureHandle = {
  destroy: () => void;
};

/** Wheel-zoom sensitivity: multiplicative factor per "unit" of wheel delta. */
const WHEEL_ZOOM_FACTOR = 1.0015;

/** Wheel-pan sensitivity: degrees of altitude/azimuth per pixel of wheel delta. */
const WHEEL_PAN_DEG_PER_PX = 0.1;

/** Hard altitude clamp — Cesium pitch becomes degenerate at exactly 90°. */
const ALT_MAX_DEG = 89.9;
const ALT_MIN_DEG = -89.9;

function getCameraPitchDeg(camera: Camera): number {
  const p = (camera as { pitch?: unknown }).pitch;
  if (typeof p !== "number" || !Number.isFinite(p)) return 0;
  return CesiumMath.toDegrees(p);
}

function wrapAz(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function getCameraFovDeg(camera: Camera): number {
  const frustum = camera.frustum as { fovy?: number; fov?: number };
  const rad =
    typeof frustum.fovy === "number" && Number.isFinite(frustum.fovy) && frustum.fovy > 0
      ? frustum.fovy
      : typeof frustum.fov === "number" && Number.isFinite(frustum.fov) && frustum.fov > 0
        ? frustum.fov
        : Math.PI / 3;
  return CesiumMath.toDegrees(rad);
}

function setCameraFovDeg(camera: Camera, deg: number): void {
  const rad = CesiumMath.toRadians(deg);
  const frustum = camera.frustum as { fovy?: number; fov?: number };
  if (typeof frustum.fovy === "number") frustum.fovy = rad;
  if (typeof frustum.fov === "number") frustum.fov = rad;
}

export function setupGestures(viewer: Viewer, options: GestureOptions): GestureHandle {
  const { scene, camera } = viewer;
  const handler = new ScreenSpaceEventHandler(scene.canvas);

  // --- Scroll-wheel ---------------------------------------------------------
  // EXPERIMENT (exp/altaz-scroll-controls): scroll now pans the view in alt/az
  // instead of zooming. Cmd/Ctrl + scroll keeps the old zoom-FOV behavior so
  // zoom remains reachable while we evaluate the scroll-to-pan UX.
  function applyWheelZoom(delta: number): void {
    const current = getCameraFovDeg(camera);
    const next = clampFov(current * Math.pow(WHEEL_ZOOM_FACTOR, delta));
    setCameraFovDeg(camera, next);
    options.onZoom?.();
  }

  function applyWheelPan(deltaXPx: number, deltaYPx: number): void {
    const { lat, lon } = options.getObserver();
    const currentAz = getCameraHeadingDeg(camera);
    const currentAlt = getCameraPitchDeg(camera);
    // "Steer the camera" feel:
    // deltaY positive = scroll down = look down = alt decreases.
    // deltaX positive = scroll right = look right = az increases.
    const nextAlt = Math.min(
      ALT_MAX_DEG,
      Math.max(ALT_MIN_DEG, currentAlt - deltaYPx * WHEEL_PAN_DEG_PER_PX),
    );
    const nextAz = wrapAz(currentAz + deltaXPx * WHEEL_PAN_DEG_PER_PX);
    setCameraView(camera, lat, lon, nextAz, nextAlt);
    options.onPan?.(nextAz, nextAlt);
  }

  // Bypass Cesium's WHEEL action so we can read both deltaX (trackpad
  // horizontal scroll) and deltaY off the raw DOM event.
  //
  // NOTE: an earlier version of this handler also added a `mousemove` tracker
  // and dispatched a synthetic mousemove after each scroll-driven camera
  // change to keep the hover tooltip in sync with the moved sky. That
  // synthetic event poisoned Cesium's MOUSE_MOVE pipeline (offsetX/offsetY
  // aren't settable via MouseEvent init, so picks landed at (0,0) and
  // subsequent hover tracking broke for planets/stars/satellites). Hover
  // is now allowed to stay briefly stale during active scroll; it refreshes
  // naturally on the next real cursor motion.
  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Trackpad pinch-zoom and Cmd+wheel arrive as ctrlKey/metaKey + deltaY.
      applyWheelZoom(e.deltaY);
      return;
    }
    applyWheelPan(e.deltaX, e.deltaY);
  }
  scene.canvas.addEventListener("wheel", onWheel, { passive: false });

  // Pinch zoom: Cesium fires PINCH_START with two finger positions
  // (TwoPointEvent) and PINCH_MOVE with current+previous positions
  // (TwoPointMotionEvent). We use the ratio of finger separation to map
  // the pinch to a multiplicative FOV change.
  let pinchStartDistance = 0;
  let pinchStartFovDeg = 0;

  function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  handler.setInputAction((event: ScreenSpaceEventHandler.TwoPointEvent) => {
    pinchStartDistance = distance(event.position1, event.position2);
    pinchStartFovDeg = getCameraFovDeg(camera);
  }, ScreenSpaceEventType.PINCH_START);

  handler.setInputAction((event: ScreenSpaceEventHandler.TwoPointMotionEvent) => {
    if (pinchStartDistance <= 0) return;
    const currentDistance = distance(event.position1, event.position2);
    if (currentDistance <= 0) return;
    // Fingers apart → larger distance → zoom in (smaller FOV)
    const ratio = pinchStartDistance / currentDistance;
    const next = clampFov(pinchStartFovDeg * ratio);
    setCameraFovDeg(camera, next);
    options.onZoom?.();
  }, ScreenSpaceEventType.PINCH_MOVE);

  handler.setInputAction(() => {
    pinchStartDistance = 0;
  }, ScreenSpaceEventType.PINCH_END);

  // --- Double-tap reset / center ------------------------------------------
  handler.setInputAction((event: { position: { x: number; y: number } }) => {
    const { lat, lon } = options.getObserver();
    const hit = options.resolveObjectAt(event.position.x, event.position.y);
    if (hit) {
      setCameraViewAnimated(camera, lat, lon, hit.az, hit.alt, CAMERA_ANIM_DURATION_MS);
    } else {
      setCameraViewAnimated(camera, lat, lon, 0, 89.9, CAMERA_ANIM_DURATION_MS);
    }
  }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  function destroy(): void {
    scene.canvas.removeEventListener("wheel", onWheel);
    handler.destroy();
  }

  return { destroy };
}

export type TrackballOptions = {
  /**
   * Called after each drag-rotation (or inertia frame) with the camera's
   * current heading/pitch in degrees. Lets the caller mirror the rotation
   * into AppState so URL serialisation (`?vaz=…&valt=…`) stays in sync —
   * without it, drag-panning leaves "Copy link" producing a default URL.
   * Mirrors `GestureOptions.onPan` for the wheel-pan path.
   */
  onPan?: (azDeg: number, altDeg: number) => void;
};

export function setupTrackballControls(viewer: Viewer, options: TrackballOptions = {}): void {
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
  let lastMoveTime = 0;
  // Rolling velocity estimate (pixels / ms) for inertial drag.
  let vx = 0;
  let vy = 0;
  // Active inertia frame id (if any). Used to cancel when a new drag begins.
  let inertiaToken = 0;

  const rotateSpeed = 0.005; // radians per pixel

  function applyRotation(dxPx: number, dyPx: number): void {
    const qRight = Quaternion.fromAxisAngle(camera.right, -dyPx * rotateSpeed, new Quaternion());
    const qUp = Quaternion.fromAxisAngle(camera.up, -dxPx * rotateSpeed, new Quaternion());
    const qCombined = Quaternion.multiply(qUp, qRight, new Quaternion());

    const rotMatrix = Matrix3.fromQuaternion(qCombined, new Matrix3());

    camera.direction = Matrix3.multiplyByVector(rotMatrix, camera.direction, new Cartesian3());
    camera.up = Matrix3.multiplyByVector(rotMatrix, camera.up, new Cartesian3());

    // Re-derive right and re-orthogonalize up to prevent drift
    Cartesian3.cross(camera.direction, camera.up, camera.right);
    Cartesian3.normalize(camera.right, camera.right);
    Cartesian3.cross(camera.right, camera.direction, camera.up);
    Cartesian3.normalize(camera.up, camera.up);

    // After rotation, sync the new heading/pitch back into state.view via
    // onPan (if provided). Cesium derives heading/pitch from the
    // direction/up/right vectors we just mutated.
    if (options.onPan !== undefined) {
      const az = getCameraHeadingDeg(camera);
      const alt = getCameraPitchDeg(camera);
      options.onPan(az, alt);
    }
  }

  handler.setInputAction((click: ScreenSpaceEventHandler.PositionedEvent) => {
    isDragging = true;
    lastX = click.position.x;
    lastY = click.position.y;
    lastMoveTime = Date.now();
    vx = 0;
    vy = 0;
    // Cancel any running inertia by bumping the token
    inertiaToken++;
  }, ScreenSpaceEventType.LEFT_DOWN);

  handler.setInputAction((movement: ScreenSpaceEventHandler.MotionEvent) => {
    if (!isDragging) return;

    const now = Date.now();
    const dx = movement.endPosition.x - lastX;
    const dy = movement.endPosition.y - lastY;
    lastX = movement.endPosition.x;
    lastY = movement.endPosition.y;

    // Update rolling velocity (simple instantaneous estimate)
    const dtMs = Math.max(1, now - lastMoveTime);
    lastMoveTime = now;
    // Low-pass filter: blend new sample with existing velocity
    const alpha = 0.5;
    vx = alpha * (dx / dtMs) + (1 - alpha) * vx;
    vy = alpha * (dy / dtMs) + (1 - alpha) * vy;

    applyRotation(dx, dy);
  }, ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction(() => {
    isDragging = false;
    // Kick off inertia if velocity is meaningful
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed <= 0.05) return; // ignore tiny jitters — treat as stopped

    const token = ++inertiaToken;
    const v0x = vx;
    const v0y = vy;
    const startTime = Date.now();
    let lastDx = 0;
    let lastDy = 0;

    function stepInertia(): void {
      if (token !== inertiaToken) return; // cancelled by a new drag
      const elapsed = Date.now() - startTime;
      const totalDx = inertiaDelta(v0x, elapsed, DRAG_INERTIA_DECAY_MS);
      const totalDy = inertiaDelta(v0y, elapsed, DRAG_INERTIA_DECAY_MS);
      const frameDx = totalDx - lastDx;
      const frameDy = totalDy - lastDy;
      lastDx = totalDx;
      lastDy = totalDy;
      if (frameDx !== 0 || frameDy !== 0) applyRotation(frameDx, frameDy);
      if (elapsed < DRAG_INERTIA_DECAY_MS) {
        setTimeout(stepInertia, 16);
      }
    }

    stepInertia();
  }, ScreenSpaceEventType.LEFT_UP);
}
