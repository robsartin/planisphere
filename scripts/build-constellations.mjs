#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
import { writeFileSync, mkdirSync } from "node:fs";

const STELLARIUM_URL =
  "https://raw.githubusercontent.com/Stellarium/stellarium/v23.4/skycultures/modern_st/constellationship.fab";

const NAMES_URL =
  "https://raw.githubusercontent.com/Stellarium/stellarium/v23.4/skycultures/modern_st/constellation_names.eng.fab";

console.log("Fetching Stellarium constellation data...");
const [shipResp, namesResp] = await Promise.all([fetch(STELLARIUM_URL), fetch(NAMES_URL)]);

if (!shipResp.ok) {
  console.error(`Failed to fetch constellationship: ${shipResp.status}`);
  process.exit(1);
}
if (!namesResp.ok) {
  console.error(`Failed to fetch names: ${namesResp.status}`);
  process.exit(1);
}

const shipText = await shipResp.text();
const namesText = await namesResp.text();

// Parse names: lines like 'And	"Andromeda"'
const nameMap = new Map();
for (const line of namesText.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const match = trimmed.match(/^(\S+)\s+"([^"]+)"/);
  if (match) nameMap.set(match[1], match[2]);
}

// Parse constellationship: lines like 'And 3 677 919 919 1067 ...'
// Format: <abbr> <numSegments> <hip1> <hip2> <hip3> <hip4> ...
const constellations = [];
for (const line of shipText.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const parts = trimmed.split(/\s+/);
  if (parts.length < 3) continue;
  const id = parts[0];
  const numSegments = parseInt(parts[1], 10);
  if (isNaN(numSegments) || numSegments <= 0) continue;

  const hipIds = parts.slice(2).map((s) => parseInt(s, 10));
  const lines = [];
  for (let i = 0; i + 1 < hipIds.length; i += 2) {
    const a = hipIds[i];
    const b = hipIds[i + 1];
    if (!isNaN(a) && !isNaN(b) && a > 0 && b > 0) {
      lines.push([a, b]);
    }
  }

  if (lines.length > 0) {
    const name = nameMap.get(id) || id;
    constellations.push({ id, name, lines });
  }
}

constellations.sort((a, b) => a.id.localeCompare(b.id));

mkdirSync("data", { recursive: true });
writeFileSync("data/constellations.json", JSON.stringify(constellations));
console.log(`Wrote ${constellations.length} constellations to data/constellations.json`);
