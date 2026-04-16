/* SPDX-License-Identifier: Apache-2.0 */

export type StarVisual = {
  readonly size: number;
  readonly opacity: number;
};

const MAG_MIN = -1.5;
const MAG_MAX = 6.5;
const SIZE_MIN = 3;
const SIZE_MAX = 16;
const OPACITY_MIN = 0.4;
const OPACITY_MAX = 1.0;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(t: number, a: number, b: number): number {
  return a + t * (b - a);
}

export function magToVisual(mag: number): StarVisual {
  const t = clamp((mag - MAG_MIN) / (MAG_MAX - MAG_MIN), 0, 1);
  const size = Math.round(lerp(1 - t, SIZE_MIN, SIZE_MAX));
  const opacity = Math.round(lerp(1 - t, OPACITY_MIN, OPACITY_MAX) * 100) / 100;
  return { size, opacity };
}
