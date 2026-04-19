#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Generate a 1200x630 OpenGraph placeholder PNG (black sky + random white stars).
// Pure node — no runtime deps. Placeholder for social previews until real
// per-URL SSR previews land (see TODO(#217) / Plan 07 milestone 2B).
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";

const W = 1200;
const H = 630;
// RGB triplet per pixel; start black.
const pixels = Buffer.alloc(W * H * 3, 0);
// Deterministic star field: seeded LCG so runs are reproducible.
let seed = 0x13579bdf;
const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let i = 0; i < 900; i++) {
  const x = Math.floor(rand() * W);
  const y = Math.floor(rand() * H);
  const v = 180 + Math.floor(rand() * 76);
  const off = (y * W + x) * 3;
  pixels[off] = v;
  pixels[off + 1] = v;
  pixels[off + 2] = v;
}
// Assemble raw scanlines: 1 filter byte + W*3 RGB bytes per row.
const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0;
  pixels.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
}
const idatBody = deflateSync(raw, { level: 9 });
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  const body = Buffer.concat([Buffer.from(type), data]);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
};
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = ~0;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}
const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type: truecolor RGB
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;
const png = Buffer.concat([
  sig,
  chunk("IHDR", ihdr),
  chunk("IDAT", idatBody),
  chunk("IEND", Buffer.alloc(0)),
]);
const outPath = new URL("../public/og-default.png", import.meta.url);
writeFileSync(outPath, png);
const hash = createHash("sha256").update(png).digest("hex").slice(0, 12);
console.log(`wrote ${outPath.pathname} (${png.length} bytes, sha256:${hash})`);
