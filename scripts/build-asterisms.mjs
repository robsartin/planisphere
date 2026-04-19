#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Build asterism data files for the planisphere.
//
// - data/asterisms/western.json: derived from the existing data/constellations.json
//   (Western/IAU 88 stick figures, public-domain lines from Stellarium modern_st).
// - data/asterisms/<culture>.json for non-Western skycultures, derived from
//   Stellarium's skyculture dataset at master. Stellarium skyculture data is
//   CC-BY-SA 4.0 (or CC-BY 4.0 for some cultures) — attributions are in NOTICE
//   and ADR 007.
//
// Currently bundled non-Western cultures:
//   - chinese (CC-BY-SA 4.0)            traditional Xingguan system
//   - indian  (CC-BY-SA 4.0)            Vedic / Nakshatra sky
//   - norse_edda (CC-BY 4.0)            Germanic/Norse, reconstructed from Eddic texts
//   - hawaiian_starlines (CC-BY-SA 4.0) Polynesian navigation starlines
//   - maori (CC-BY-SA 4.0)              Māori whānau o ngā whetū (small but distinctive)
//
// Usage:
//   node scripts/build-asterisms.mjs
//   pnpm prettier --write data/asterisms/*.json
//
// (Run Prettier afterwards to keep the committed JSON files formatted.)
//
// Output JSON shape (matches parseAsterismSet in src/astro/skycultures.ts):
//   { id, name, constellations: [ { id, name, lines: [[hip, hip, ...]] } ] }
// where each entry of `lines` is a polyline of HIP star ids (>=2 points).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const STELLARIUM_BASE =
  "https://raw.githubusercontent.com/Stellarium/stellarium/master/skycultures";

/**
 * Non-Western cultures to fetch and normalize from Stellarium.
 * displayName is what the planisphere UI shows in the skyculture dropdown.
 * Each entry's constellations[].lines are polylines of HIP star ids.
 */
const STELLARIUM_CULTURES = [
  { id: "chinese", stellariumId: "chinese", displayName: "Chinese (Xingguan)" },
  { id: "indian", stellariumId: "indian", displayName: "Indian (Vedic)" },
  { id: "norse_edda", stellariumId: "norse_edda", displayName: "Norse (Edda)" },
  {
    id: "hawaiian_starlines",
    stellariumId: "hawaiian_starlines",
    displayName: "Hawaiian Starlines",
  },
  { id: "maori", stellariumId: "maori", displayName: "Māori" },
];

function writeJson(path, data) {
  // Compact form; run `pnpm prettier --write data/asterisms/*.json` after the
  // build to reshape the output into the committed form.
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

// ---- Generic Stellarium skyculture normalizer ----
// Stellarium format per culture: { constellations: [ { id, lines, common_name: { english, native, pronounce } } ] }
// We prefer `native` for the display name (renders in the culture's script),
// falling back to english, then id.
async function buildStellariumCulture({ id, stellariumId, displayName }) {
  const url = `${STELLARIUM_BASE}/${stellariumId}/index.json`;
  console.log(`Fetching Stellarium ${stellariumId} skyculture: ${url}`);
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to fetch ${stellariumId} skyculture: ${resp.status}`);
  }
  const raw = await resp.json();
  if (!Array.isArray(raw.constellations)) {
    throw new Error(`Expected 'constellations' array in ${stellariumId} skyculture`);
  }
  const constellations = [];
  for (const c of raw.constellations) {
    if (typeof c.id !== "string" || !Array.isArray(c.lines)) continue;
    const lines = [];
    for (const poly of c.lines) {
      if (!Array.isArray(poly)) continue;
      const clean = poly.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
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
  return { id, name: displayName, constellations };
}

async function main() {
  mkdirSync("data/asterisms", { recursive: true });

  const western = buildWestern();
  writeJson("data/asterisms/western.json", western);
  console.log(
    `Wrote ${western.constellations.length} Western asterisms to data/asterisms/western.json`,
  );

  for (const culture of STELLARIUM_CULTURES) {
    const set = await buildStellariumCulture(culture);
    const path = `data/asterisms/${culture.id}.json`;
    writeJson(path, set);
    console.log(`Wrote ${set.constellations.length} ${culture.id} asterisms to ${path}`);
  }
}

await main();
