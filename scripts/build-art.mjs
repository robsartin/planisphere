#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Build the constellation art assets + manifest for the planisphere.
//
// Source: Stellarium/stellarium@master:skycultures/modern/
//   - illustrations/*.png  Free Art License 1.3
//   - index.json           CC-BY-SA 4.0
// Attributions are in NOTICE and ADR 018.
//
// Three steps, none of which were reproducible before this script existed:
//   1. Rename from Stellarium's Latin lowercase basenames to IAU 3-letter
//      codes, so the manifest key equals the file basename.
//   2. Re-encode each PNG to RGBA with luminance remapped into the alpha
//      channel. Stellarium ships opaque images with a "black = transparent"
//      convention baked into its own shader; Cesium uses standard alpha
//      blending, so the convention has to be materialised into real alpha.
//      This step is NOT automated by this script — it needs an image-decode/
//      encode dependency, and every new dependency in this repo needs its
//      own ADR (see CLAUDE.md). To reproduce by hand: for each pixel, take
//      the source luminance (the PNG is greyscale-on-black already) and
//      write it into the output alpha channel, with RGB set to opaque white
//      (255,255,255); fully black source pixels become fully transparent.
//   3. Extract {file, size, anchors} per constellation from index.json.
//
// Usage:
//   node scripts/build-art.mjs
//   pnpm prettier --write data/art/western/manifest.json
//
// Coverage note: 85 of the IAU 88. Pup, Ser and Vel have no upstream
// illustration (Argo Navis is one image assigned to Carina; Serpens is
// historically split into Caput/Cauda). Those three get file: null and the
// layer draws its placeholder sprite.

const IAU_BY_LATIN = {
  andromeda: "And",
  antlia: "Ant",
  apus: "Aps",
  aquarius: "Aqr",
  aquila: "Aql",
  ara: "Ara",
  aries: "Ari",
  auriga: "Aur",
  bootes: "Boo",
  caelum: "Cae",
  camelopardalis: "Cam",
  cancer: "Cnc",
  "canes-venatici": "CVn",
  "canis-major": "CMa",
  "canis-minor": "CMi",
  capricornus: "Cap",
  carina: "Car",
  cassiopeia: "Cas",
  centaurus: "Cen",
  cepheus: "Cep",
  cetus: "Cet",
  chamaeleon: "Cha",
  circinus: "Cir",
  columba: "Col",
  "coma-berenices": "Com",
  "corona-australis": "CrA",
  "corona-borealis": "CrB",
  corvus: "Crv",
  crater: "Crt",
  crux: "Cru",
  cygnus: "Cyg",
  delphinus: "Del",
  dorado: "Dor",
  draco: "Dra",
  equuleus: "Equ",
  eridanus: "Eri",
  fornax: "For",
  gemini: "Gem",
  grus: "Gru",
  hercules: "Her",
  horologium: "Hor",
  // Stellarium's index.json currently ships this illustration as
  // "horlogium.png" (missing the second "o") rather than the correct Latin
  // spelling. Map both so the pipeline tolerates either upstream spelling.
  horlogium: "Hor",
  hydra: "Hya",
  hydrus: "Hyi",
  indus: "Ind",
  lacerta: "Lac",
  leo: "Leo",
  "leo-minor": "LMi",
  lepus: "Lep",
  libra: "Lib",
  lupus: "Lup",
  lynx: "Lyn",
  lyra: "Lyr",
  mensa: "Men",
  microscopium: "Mic",
  monoceros: "Mon",
  musca: "Mus",
  norma: "Nor",
  octans: "Oct",
  ophiuchus: "Oph",
  orion: "Ori",
  pavo: "Pav",
  pegasus: "Peg",
  perseus: "Per",
  phoenix: "Phe",
  pictor: "Pic",
  pisces: "Psc",
  "piscis-austrinus": "PsA",
  puppis: "Pup",
  pyxis: "Pyx",
  reticulum: "Ret",
  sagitta: "Sge",
  sagittarius: "Sgr",
  scorpius: "Sco",
  sculptor: "Scl",
  scutum: "Sct",
  serpens: "Ser",
  sextans: "Sex",
  taurus: "Tau",
  telescopium: "Tel",
  triangulum: "Tri",
  "triangulum-australe": "TrA",
  tucana: "Tuc",
  "ursa-major": "UMa",
  "ursa-minor": "UMi",
  vela: "Vel",
  virgo: "Vir",
  volans: "Vol",
  vulpecula: "Vul",
};

/**
 * Map a Stellarium illustration basename (no extension) to its IAU 3-letter
 * code, or null when there is no IAU counterpart.
 */
export function latinToIau(latinName) {
  return IAU_BY_LATIN[latinName] ?? null;
}

import { fileURLToPath } from "node:url";

const UPSTREAM =
  "https://raw.githubusercontent.com/Stellarium/stellarium/master/skycultures/modern";
const OUT_DIR = new URL("../data/art/western/", import.meta.url);

async function main() {
  console.log(`Fetching ${UPSTREAM}/index.json`);
  const index = await (await fetch(`${UPSTREAM}/index.json`)).json();

  const constellations = {};
  for (const entry of index.constellations ?? []) {
    // entry.id is e.g. "CON modern Aql" — the trailing token is Stellarium's
    // own IAU code for this constellation record, authoritative regardless
    // of what the illustration file happens to be named. We do NOT derive
    // the key from the image filename via latinToIau: Carina's illustration
    // ships as illustrations/argonavis.png (the single Argo Navis image,
    // reassigned to Carina — see header note), which has no Latin-name
    // mapping of its own and would be silently dropped by a filename lookup.
    const iau = entry.id.split(" ").pop();

    if (!entry.image) {
      // Pup, Ser, Vel: no upstream illustration for this record.
      constellations[iau] = { file: null };
      continue;
    }

    const latin = entry.image.file
      .split("/")
      .pop()
      .replace(/\.png$/i, "");
    if (latinToIau(latin) !== iau) {
      console.warn(`  note: illustration "${latin}" has no direct Latin-name match for ${iau}`);
    }

    constellations[iau] = {
      file: `${iau}.png`,
      size: entry.image.size,
      anchors: entry.image.anchors.map((a) => ({ pos: a.pos, hip: a.hip })),
    };
  }

  console.log(`Writing manifest with ${Object.keys(constellations).length} entries`);
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    new URL("manifest.json", OUT_DIR),
    `${JSON.stringify(
      {
        culture: "western",
        version: 2,
        source: `${UPSTREAM}/index.json`,
        notes:
          "Generated by scripts/build-art.mjs. Illustrations FAL 1.3, metadata CC-BY-SA 4.0. See NOTICE and ADR 018.",
        constellations,
      },
      null,
      2,
    )}\n`,
  );
  console.log("Done. Run: pnpm prettier --write data/art/western/manifest.json");
}

// Only run the pipeline when invoked directly, not when imported by tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
