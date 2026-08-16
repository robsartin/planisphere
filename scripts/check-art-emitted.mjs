#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Assert every constellation illustration named by the art manifest actually
// came out of the Vite build as an emitted asset.
//
// This exists because the original `new URL(<literal dir> + dynamicBasename,
// import.meta.url)` form emitted nothing at all: Vite only rewrites `new URL`
// when the whole path is a static literal. Nothing caught it — unit tests run
// against source, and the e2e suite runs against the dev server, where the
// relative path resolves off disk. Only a post-`vite build` check on `dist/`
// can see the difference.
//
// Vite flattens emitted assets to `dist/assets/<basename>-<hash>.png`, so
// there is no `art/` path segment to grep for; the manifest is the only
// reliable list of what must be present.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(repoRoot, "data/art/western/manifest.json");
const distAssets = join(repoRoot, "dist/assets");

/**
 * Manifest basenames with no emitted counterpart.
 *
 * @param {readonly string[]} expected manifest basenames, e.g. `["Ori.png"]`
 * @param {readonly string[]} emitted `dist/assets` entries, e.g. `["Ori-BLfFGGYk.png"]`
 * @returns {string[]} the subset of `expected` that is missing
 */
export function missingArtAssets(expected, emitted) {
  return expected.filter((file) => {
    const base = file.replace(/\.png$/, "");
    // The `-` separator is load-bearing: a bare prefix test would let an
    // emitted `Ari-x.png` mark `Ar.png` present, and IAU codes really do nest
    // that way (CMa/CMi, UMa/UMi).
    return !emitted.some((name) => name.startsWith(`${base}-`) && name.endsWith(".png"));
  });
}

function main() {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const expected = Object.values(manifest.constellations)
    .map((entry) => entry.file)
    .filter((file) => typeof file === "string" && file.length > 0);

  if (expected.length === 0) {
    console.error("check-art-emitted: manifest names no art files — that cannot be right.");
    process.exit(1);
  }

  let emitted;
  try {
    emitted = readdirSync(distAssets);
  } catch {
    console.error(`check-art-emitted: no ${distAssets} — run \`pnpm build\` first.`);
    process.exit(1);
  }

  const missing = missingArtAssets(expected, emitted);
  if (missing.length > 0) {
    console.error(
      `check-art-emitted: ${missing.length} of ${expected.length} manifest art files were not ` +
        `emitted to dist/assets/.`,
    );
    for (const file of missing.slice(0, 10)) console.error(`  ${file}`);
    if (missing.length > 10) console.error(`  …and ${missing.length - 10} more`);
    process.exit(1);
  }

  console.log(`Art emission OK: ${expected.length} manifest files present in dist/assets/.`);
}

// Only run the check when invoked directly, not when imported by tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
