/* SPDX-License-Identifier: Apache-2.0 */

// Control points: [B-V value, R, G, B]
const CONTROL_POINTS: [number, number, number, number][] = [
  [-0.3, 0x9b, 0xb0, 0xff], // blue-white, O stars
  [0.0, 0xaa, 0xbf, 0xff], // white-blue, A stars
  [0.3, 0xca, 0xd7, 0xff], // white, F stars
  [0.6, 0xff, 0xf4, 0xea], // yellow-white, G stars
  [0.8, 0xff, 0xd2, 0xa1], // yellow-orange, K stars
  [1.4, 0xff, 0xcc, 0x6f], // orange-red, M stars
];

function toHex(value: number): string {
  return Math.round(value).toString(16).padStart(2, "0");
}

/**
 * Maps a B-V color index to an RGB hex string.
 * Returns white (#ffffff) when bv is undefined.
 */
export function bvToRgb(bv: number | undefined): string {
  if (bv === undefined) return "#ffffff";

  const first = CONTROL_POINTS[0]!;
  const last = CONTROL_POINTS[CONTROL_POINTS.length - 1]!;

  if (bv <= first[0]) return `#${toHex(first[1])}${toHex(first[2])}${toHex(first[3])}`;
  if (bv >= last[0]) return `#${toHex(last[1])}${toHex(last[2])}${toHex(last[3])}`;

  for (let i = 0; i < CONTROL_POINTS.length - 1; i++) {
    const lo = CONTROL_POINTS[i]!;
    const hi = CONTROL_POINTS[i + 1]!;
    if (bv >= lo[0] && bv <= hi[0]) {
      const t = (bv - lo[0]) / (hi[0] - lo[0]);
      const r = lo[1] + t * (hi[1] - lo[1]);
      const g = lo[2] + t * (hi[2] - lo[2]);
      const b = lo[3] + t * (hi[3] - lo[3]);
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
  }

  return "#ffffff";
}
