/* SPDX-License-Identifier: Apache-2.0 */

/**
 * Pure math helpers for the gesture-polish milestone (Plan 07 1J):
 * camera-view animations, drag inertia, and FOV clamping.
 *
 * Framework-free by design so the suite stays fast and deterministic.
 */

export const FOV_MIN_DEG = 1;
export const FOV_MAX_DEG = 120;

/**
 * Cubic ease-out. Clamps t to [0, 1].
 */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  const inv = 1 - clamped;
  return 1 - inv * inv * inv;
}

export type AzAlt = { az: number; alt: number };

/**
 * Linear interpolation between two alt/az directions taking the shortest
 * azimuthal arc (handles the 0/360 wraparound). The eased time parameter `t`
 * is expected to already be in [0, 1] — callers compose with `easeOutCubic`.
 */
export function interpolateAzAlt(from: AzAlt, to: AzAlt, t: number): AzAlt {
  const clampedT = Math.min(1, Math.max(0, t));

  // Shortest signed delta in degrees: (to - from + 540) % 360 - 180 gives
  // a value in [-180, 180).
  const rawDelta = to.az - from.az;
  const shortestDelta = (((rawDelta % 360) + 540) % 360) - 180;
  const azRaw = from.az + shortestDelta * clampedT;
  const az = ((azRaw % 360) + 360) % 360;

  const alt = from.alt + (to.alt - from.alt) * clampedT;

  return { az, alt };
}

/**
 * Compute the integrated displacement of an inertial slide with a
 * linear-velocity decay over `decayMs` milliseconds.
 *
 * Model: v(t) = v0 * (1 - t / decayMs) for t in [0, decayMs], else 0.
 * Integrated displacement from 0..elapsed: v0 * (elapsed - elapsed^2 / (2 * decayMs)).
 *
 * @param velocity  initial velocity (e.g. pixels / ms)
 * @param elapsedMs elapsed time since inertia started
 * @param decayMs   total decay window
 * @returns         the cumulative displacement at `elapsedMs`
 */
export function inertiaDelta(velocity: number, elapsedMs: number, decayMs: number): number {
  if (decayMs <= 0) return 0;
  if (elapsedMs <= 0) return 0;
  if (elapsedMs >= decayMs) {
    // Full integral over [0, decayMs] = v0 * decayMs / 2
    return (velocity * decayMs) / 2;
  }
  return velocity * (elapsedMs - (elapsedMs * elapsedMs) / (2 * decayMs));
}

/**
 * Clamp a vertical-FOV value (in degrees) into the user-facing zoom range.
 * Defensive against NaN (defaults to FOV_MAX_DEG).
 */
export function clampFov(deg: number): number {
  if (!Number.isFinite(deg)) return FOV_MAX_DEG;
  return Math.min(FOV_MAX_DEG, Math.max(FOV_MIN_DEG, deg));
}
