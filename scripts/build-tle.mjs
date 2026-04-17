#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
import { writeFileSync, mkdirSync } from "node:fs";

const TLE_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle";

console.log("Fetching CelesTrak visual satellites TLE...");
const response = await fetch(TLE_URL);
if (!response.ok) {
  console.error(`Fetch failed: ${response.status} ${response.statusText}`);
  process.exit(1);
}
const text = await response.text();
const lines = text
  .trim()
  .split("\n")
  .filter((l) => l.trim().length > 0);
const satCount = Math.floor(lines.length / 3);

mkdirSync("data/tle", { recursive: true });
writeFileSync("data/tle/visual.txt", text.trim() + "\n");
console.log(`Wrote ${satCount} satellites to data/tle/visual.txt`);
