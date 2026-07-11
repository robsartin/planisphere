/* SPDX-License-Identifier: Apache-2.0 */

/**
 * "Describe this sky" — prose summary for screen-reader users (#381).
 *
 * A WebGL canvas is opaque to assistive tech. This module turns the
 * scene's current visible-object list into a short block of natural-
 * language sentences: where you're facing, which bright bodies are up,
 * which constellations sit well, and the twilight state.
 *
 * Pure. No DOM, no Cesium, no fetch — data in, string out.
 */

export type DescribableBody = {
  readonly id: string;
  /** Altitude in degrees; positive = above the horizon. */
  readonly alt: number;
  /** Azimuth in degrees, 0 = North, 90 = East. */
  readonly az: number;
  /** Apparent magnitude. Lower = brighter. */
  readonly mag: number;
};

export type DescribableConstellation = {
  readonly id: string;
  readonly name: string;
  readonly centroid: { readonly alt: number; readonly az: number };
};

export type DescribeSkyInput = {
  readonly observer: { readonly lat: number; readonly lon: number };
  readonly timeUtc: Date;
  readonly bodies: readonly DescribableBody[];
  readonly constellations: readonly DescribableConstellation[];
  /** Camera heading in degrees from North (0..360). Undefined if unknown. */
  readonly cameraHeadingDeg?: number;
};

/** Named body list for the "bright things up" sentence — Sun / Moon / naked-eye planets. */
const NAMED_BRIGHT_BODIES = new Set([
  "Sun",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
]);

const CARDINAL_LOOKUP: readonly { readonly maxAz: number; readonly name: string }[] = [
  { maxAz: 11.25, name: "north" },
  { maxAz: 33.75, name: "north-northeast" },
  { maxAz: 56.25, name: "northeast" },
  { maxAz: 78.75, name: "east-northeast" },
  { maxAz: 101.25, name: "east" },
  { maxAz: 123.75, name: "east-southeast" },
  { maxAz: 146.25, name: "southeast" },
  { maxAz: 168.75, name: "south-southeast" },
  { maxAz: 191.25, name: "south" },
  { maxAz: 213.75, name: "south-southwest" },
  { maxAz: 236.25, name: "southwest" },
  { maxAz: 258.75, name: "west-southwest" },
  { maxAz: 281.25, name: "west" },
  { maxAz: 303.75, name: "west-northwest" },
  { maxAz: 326.25, name: "northwest" },
  { maxAz: 348.75, name: "north-northwest" },
];

/** Convert azimuth degrees (0..360) to a compass label. */
export function azimuthToCompass(azDeg: number): string {
  const norm = ((azDeg % 360) + 360) % 360;
  for (const entry of CARDINAL_LOOKUP) {
    if (norm < entry.maxAz) return entry.name;
  }
  return "north";
}

function altToBand(altDeg: number): string {
  if (altDeg < 10) return "low";
  if (altDeg < 30) return "medium-low";
  if (altDeg < 60) return "medium-high";
  return "high";
}

function altToPhrase(altDeg: number): string {
  const rounded = Math.round(altDeg);
  return `${String(rounded)}° up`;
}

function formatBodyClause(body: DescribableBody): string {
  const compass = azimuthToCompass(body.az);
  return `${body.id} is ${altToBand(body.alt)} in the ${compass}, ${altToPhrase(body.alt)}`;
}

function formatTwilightSentence(sunAlt: number | null): string | null {
  if (sunAlt === null) return null;
  if (sunAlt > 6) return null; // just plain daytime — the summary would be dominated by the Sun anyway
  if (sunAlt > -0.83) return "The Sun is near the horizon (civil twilight edge).";
  if (sunAlt > -6) return "The Sun is below the horizon — civil twilight.";
  if (sunAlt > -12) return "The Sun is below the horizon — nautical twilight.";
  if (sunAlt > -18) return "The Sun is below the horizon — astronomical twilight.";
  return "The sky is fully dark (Sun more than 18° below the horizon).";
}

function pickBrightBodies(bodies: readonly DescribableBody[]): DescribableBody[] {
  const named = bodies.filter((b) => NAMED_BRIGHT_BODIES.has(b.id) && b.alt > 0 && b.id !== "Sun");
  // Sort by magnitude (bright first), keep top three so the sentence
  // stays short. Ties broken by altitude so the highest gets top billing.
  named.sort((a, b) => a.mag - b.mag || b.alt - a.alt);
  return named.slice(0, 3);
}

function pickConstellations(
  constellations: readonly DescribableConstellation[],
): DescribableConstellation[] {
  const above = constellations.filter((c) => c.centroid.alt > 20);
  above.sort((a, b) => b.centroid.alt - a.centroid.alt);
  return above.slice(0, 3);
}

function formatLatLonPhrase(lat: number, lon: number): string {
  const latAbs = Math.abs(lat).toFixed(1);
  const lonAbs = Math.abs(lon).toFixed(1);
  const latHemi = lat >= 0 ? "N" : "S";
  const lonHemi = lon >= 0 ? "E" : "W";
  return `${latAbs}° ${latHemi}, ${lonAbs}° ${lonHemi}`;
}

/**
 * Render an English prose summary of the given sky snapshot. Returns
 * between two and five sentences; never throws — an empty visible list
 * yields "Nothing bright is above the horizon right now."
 */
export function describeSky(input: DescribeSkyInput): string {
  const sentences: string[] = [];

  // Facing sentence.
  if (input.cameraHeadingDeg !== undefined) {
    const compass = azimuthToCompass(input.cameraHeadingDeg);
    sentences.push(
      `Facing ${compass} (heading ${String(Math.round(input.cameraHeadingDeg))}°) from ${formatLatLonPhrase(input.observer.lat, input.observer.lon)}.`,
    );
  } else {
    sentences.push(
      `Viewing the sky from ${formatLatLonPhrase(input.observer.lat, input.observer.lon)}.`,
    );
  }

  // Twilight state.
  const sun = input.bodies.find((b) => b.id === "Sun");
  const twilight = formatTwilightSentence(sun !== undefined ? sun.alt : null);
  if (twilight !== null) sentences.push(twilight);

  // Bright bodies + constellations. If neither has anything to say, fall
  // through to a single "nothing above the horizon" sentence rather than
  // stringing two negatives together.
  const brights = pickBrightBodies(input.bodies);
  const cons = pickConstellations(input.constellations);

  if (brights.length === 0 && cons.length === 0) {
    sentences.push("Nothing bright is above the horizon right now.");
    return sentences.join(" ");
  }

  if (brights.length > 0) {
    sentences.push(`${brights.map(formatBodyClause).join("; ")}.`);
  } else {
    sentences.push("None of the naked-eye planets are above the horizon.");
  }

  if (cons.length > 0) {
    const names = cons.map((c) => c.name).join(", ");
    sentences.push(`Well-placed constellations: ${names}.`);
  }

  return sentences.join(" ");
}
