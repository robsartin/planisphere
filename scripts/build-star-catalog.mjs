#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
import { writeFileSync, mkdirSync } from "node:fs";

const HYG_URL =
  "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv";

console.log("Fetching HYG database...");
const response = await fetch(HYG_URL);
if (!response.ok) {
  console.error(`Fetch failed: ${response.status} ${response.statusText}`);
  process.exit(1);
}
const csv = await response.text();
const lines = csv.split("\n");
const header = lines[0].split(",").map((h) => h.replace(/^"|"$/g, ""));

const col = (name) => header.indexOf(name);
const hipIdx = col("hip");
const raIdx = col("ra");
const decIdx = col("dec");
const magIdx = col("mag");
const properIdx = col("proper");
const ciIdx = col("ci");

const stars = [];
for (let i = 1; i < lines.length; i++) {
  const c = lines[i].split(",");
  if (c.length < header.length) continue;
  const hip = parseInt(c[hipIdx], 10);
  if (!hip || isNaN(hip)) continue;
  const mag = parseFloat(c[magIdx]);
  if (isNaN(mag) || mag > 6.0) continue;
  const raHours = parseFloat(c[raIdx]);
  const dec = parseFloat(c[decIdx]);
  if (isNaN(raHours) || isNaN(dec)) continue;
  const ra = Math.round(raHours * 15 * 10000) / 10000;
  const decRound = Math.round(dec * 10000) / 10000;
  const magRound = Math.round(mag * 100) / 100;
  const proper = c[properIdx]?.trim().replace(/^"|"$/g, "").trim();
  const ciRaw = parseFloat(c[ciIdx]);
  const entry = { hip, ra, dec: decRound, mag: magRound };
  if (proper) entry.name = proper;
  if (!isNaN(ciRaw)) entry.ci = Math.round(ciRaw * 1000) / 1000;
  stars.push(entry);
}

stars.sort((a, b) => a.mag - b.mag);

mkdirSync("data", { recursive: true });
writeFileSync("data/stars.json", JSON.stringify(stars));
console.log(`Wrote ${stars.length} stars to data/stars.json`);
