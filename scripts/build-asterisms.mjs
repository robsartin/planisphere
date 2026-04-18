#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Build asterism data files for the planisphere.
//
// - data/asterisms/western.json: derived from the existing data/constellations.json
//   (Western/IAU 88 stick figures, public-domain lines from Stellarium modern_st).
// - data/asterisms/chinese.json: derived from Stellarium's "chinese" skyculture
//   (Xingguan system, 283+ traditional Chinese asterisms). Stellarium skyculture
//   data is CC-BY-SA 4.0 — attribution is in NOTICE and ADR 007.
//
// Usage: node scripts/build-asterisms.mjs
//
// Output JSON shape (matches parseAsterismSet in src/astro/skycultures.ts):
//   { id, name, constellations: [ { id, name, lines: [[hip, hip, ...]] } ] }
// where each entry of `lines` is a polyline of HIP star ids (>=2 points).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const STELLARIUM_CHINESE_URL =
  "https://raw.githubusercontent.com/Stellarium/stellarium/master/skycultures/chinese/index.json";

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data));
}

// ---- Western (from existing data/constellations.json) ----
// Existing format: [{ id, name, lines: [[hipA, hipB], ...] }]
// Each line is already a 2-point segment — we keep that shape (still a valid
// polyline of length 2).

function buildWestern() {
  const raw = JSON.parse(readFileSync("data/constellations.json", "utf-8"));
  const constellations = [];
  for (const entry of raw) {
    const lines = [];
    for (const seg of entry.lines) {
      if (Array.isArray(seg) && seg.length >= 2) {
        lines.push(seg.map((n) => Number(n)));
      }
    }
    if (lines.length > 0) {
      constellations.push({ id: entry.id, name: entry.name, lines });
    }
  }
  return {
    id: "western",
    name: "Western (IAU)",
    constellations,
  };
}

// ---- Chinese (from Stellarium) ----
// Stellarium format: { constellations: [ { id, lines, common_name: { english, native, pronounce } } ] }
// We prefer `native` (Chinese characters) for the display name, fall back to english.
async function buildChinese() {
  console.log(`Fetching Stellarium Chinese skyculture: ${STELLARIUM_CHINESE_URL}`);
  const resp = await fetch(STELLARIUM_CHINESE_URL);
  if (!resp.ok) {
    throw new Error(`Failed to fetch chinese skyculture: ${resp.status}`);
  }
  const raw = await resp.json();
  if (!Array.isArray(raw.constellations)) {
    throw new Error("Expected 'constellations' array in chinese skyculture");
  }
  const constellations = [];
  for (const c of raw.constellations) {
    if (typeof c.id !== "string" || !Array.isArray(c.lines)) continue;
    const lines = [];
    for (const poly of c.lines) {
      if (!Array.isArray(poly)) continue;
      const clean = poly
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (clean.length >= 2) lines.push(clean);
    }
    if (lines.length === 0) continue;
    const cn = c.common_name ?? {};
    const name =
      (typeof cn.native === "string" && cn.native.length > 0 && cn.native) ||
      (typeof cn.english === "string" && cn.english.length > 0 && cn.english) ||
      c.id;
    constellations.push({ id: c.id, name, lines });
  }
  return {
    id: "chinese",
    name: "Chinese (Xingguan)",
    constellations,
  };
}

async function main() {
  mkdirSync("data/asterisms", { recursive: true });

  const western = buildWestern();
  writeJson("data/asterisms/western.json", western);
  console.log(
    `Wrote ${western.constellations.length} Western asterisms to data/asterisms/western.json`,
  );

  const chinese = await buildChinese();
  writeJson("data/asterisms/chinese.json", chinese);
  console.log(
    `Wrote ${chinese.constellations.length} Chinese asterisms to data/asterisms/chinese.json`,
  );
}

await main();
