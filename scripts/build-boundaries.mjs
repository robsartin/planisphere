#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Fetches IAU constellation boundary data (Davenhall & Leggett, 1989) from the
 * CDS VizieR FTP mirror and emits data/boundaries.json.
 *
 * Primary source: https://cdsarc.cds.unistra.fr/ftp/VI/49/bound_20.dat
 * Fallback source: https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.bounds.json
 *   (pre-processed GeoJSON, public domain, same underlying IAU data)
 *
 * Output format: array of { id: string, vertices: { ra: number, dec: number }[] }
 *   RA in degrees (0–360), Dec in degrees.
 */
import { writeFileSync, mkdirSync } from "node:fs";

const PRIMARY_URL = "https://cdsarc.cds.unistra.fr/ftp/VI/49/bound_20.dat";
const FALLBACK_URL =
  "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.bounds.json";

/** Parse the raw Davenhall & Leggett fixed-width .dat format */
function parseDatFormat(text) {
  const polygons = new Map(); // id → { id, vertices: [{ra, dec}] }

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.startsWith("#")) continue;

    // Fixed-width columns (0-indexed): RA 0-9, Dec 9-18, id 19-22
    const raHours = parseFloat(line.substring(0, 9).trim());
    const dec = parseFloat(line.substring(9, 18).trim());
    const id = line.substring(19, 22).trim();

    if (!id || isNaN(raHours) || isNaN(dec)) continue;

    const ra = raHours * 15; // convert hours → degrees
    if (!polygons.has(id)) polygons.set(id, { id, vertices: [] });
    polygons.get(id).vertices.push({ ra, dec });
  }

  return [...polygons.values()].filter((b) => b.vertices.length >= 3);
}

/** Parse the d3-celestial GeoJSON format.
 *  Coordinates are [lon, lat] where lon is RA in degrees, range -180..+180.
 *  We normalise RA to 0..360.
 */
function parseGeoJsonFormat(json) {
  const data = JSON.parse(json);
  const boundaries = [];

  for (const feature of data.features ?? []) {
    const id = feature.id;
    if (!id) continue;

    // Polygon coordinates: outer ring is coordinates[0], array of [lon, lat]
    const ring = feature.geometry?.coordinates?.[0];
    if (!Array.isArray(ring) || ring.length < 3) continue;

    const vertices = ring.map(([lonDeg, lat]) => {
      // Normalise RA from -180..+180 to 0..360
      const ra = ((lonDeg % 360) + 360) % 360;
      return { ra, dec: lat };
    });

    boundaries.push({ id, vertices });
  }

  return boundaries;
}

async function tryFetch(url) {
  console.log(`Trying: ${url}`);
  const resp = await fetch(url);
  if (!resp.ok) {
    console.warn(`  → ${resp.status} ${resp.statusText}`);
    return null;
  }
  return await resp.text();
}

let boundaries;

// --- Try primary source (.dat) ---
const datText = await tryFetch(PRIMARY_URL);
if (datText) {
  console.log("Parsing Davenhall & Leggett .dat format...");
  boundaries = parseDatFormat(datText);
} else {
  // --- Try fallback (d3-celestial GeoJSON) ---
  const jsonText = await tryFetch(FALLBACK_URL);
  if (!jsonText) {
    console.error("All data sources failed. Cannot generate boundaries.json.");
    process.exit(1);
  }
  console.log("Parsing d3-celestial GeoJSON format...");
  boundaries = parseGeoJsonFormat(jsonText);
}

boundaries.sort((a, b) => a.id.localeCompare(b.id));

mkdirSync("data", { recursive: true });
writeFileSync("data/boundaries.json", JSON.stringify(boundaries));
console.log(`Wrote ${boundaries.length} boundary polygons to data/boundaries.json`);
