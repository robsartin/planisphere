# ADR 007 — Stellarium skyculture data (CC-BY-SA 4.0, CC-BY 4.0)

**Date:** 2026-04-18
**Status:** Accepted

## Context

GitHub issue #167 (part 2) asks for alternate constellation asterisms per culture.
The v1 design already bundles the Western / IAU stick-figure data derived from
Stellarium's `modern_st` skyculture, which is in the public domain.

To ship additional cultures we need a source that:

- is well-curated (HIP ids match our star catalog, lines are documented),
- has clear provenance and scholarly references,
- covers the major traditions we want to offer (starting with Chinese Xingguan),
- is freely redistributable.

The Stellarium project maintains dozens of per-culture `skycultures/<name>/index.json`
files. Each file bundles asterism polylines (HIP ids) plus native names. The
Chinese skyculture in particular is licensed as CC-BY-SA 4.0 and is based on
two well-known Chinese astronomical references
(_儀象考成_, 1756 and Yi Shitong's _Chinese and Western Contrast Star Chart and
Catalogue 1950.0_, 1981).

## Decision

Bundle a subset of Stellarium skyculture data as additional asterism JSON
under `data/asterisms/<culture>.json`. The v1 shipping set is:

- `data/asterisms/western.json` — IAU 88, mirror of existing public-domain
  `data/constellations.json`.
- `data/asterisms/chinese.json` — Stellarium's `chinese` skyculture, CC-BY-SA 4.0.
- `data/asterisms/indian.json` — Stellarium's `indian` skyculture, CC-BY-SA 4.0
  (Vedic / Nakshatra sky).
- `data/asterisms/norse_edda.json` — Stellarium's `norse_edda` skyculture,
  CC-BY 4.0 (reconstructed Germanic/Norse constellations from Eddic texts).
- `data/asterisms/hawaiian_starlines.json` — Stellarium's `hawaiian_starlines`
  skyculture, CC-BY-SA 4.0 (Polynesian navigation starlines).
- `data/asterisms/maori.json` — Stellarium's `maori` skyculture, CC-BY-SA 4.0
  (a small but distinctive set of traditional Māori star groupings).

Stellarium skycultures distributed under CC-BY-ND (e.g. `arabic_al-sufi`,
`babylonian_seleucid`, `babylonian_mulapin`) or GPL-2.0 (e.g. `inuit`,
`aztec`, `navajo`) are **not** bundled — the no-derivatives clause of
CC-BY-ND forbids distributing our normalized polyline form, and GPL-2.0
is a strong copyleft that would conflict with our Apache 2.0 code license.
If a user later wants any of those cultures, they would need an alternate
upstream or a separately-licensed data source.

The build script `scripts/build-asterisms.mjs` downloads and normalises the
Stellarium source into our simple shape:

```json
{
  "id": "chinese",
  "name": "Chinese (Xingguan)",
  "constellations": [
    { "id": "CON chinese 001", "name": "毕宿", "lines": [[20889, 20648, 20455, 20205]] }
  ]
}
```

Attribution is recorded in `NOTICE`. The CC-BY-SA 4.0 and CC-BY 4.0 licenses
are both compatible with our Apache 2.0 source license as long as the derived
data files themselves remain under their respective original licenses (the
data is separable from the code). CC-BY 4.0 imposes attribution only;
CC-BY-SA 4.0 additionally imposes share-alike on modifications to the data.

## Consequences

- **Bundle size:** roughly +50 KB total for all non-Western skyculture JSON
  (chinese ≈ 26 KB, the others ≈ 1–5 KB each) + 15 KB western.json. Well
  within the existing budget.
- **Licensing:** Data files under `data/asterisms/` retain their upstream
  licenses (CC-BY-SA 4.0 or CC-BY 4.0). Any downstream redistribution must
  preserve the NOTICE attribution; the share-alike provision of CC-BY-SA
  applies to modifications of the data (not to code using the data).
- **No runtime fetch.** Data is bundled at build time.
- **Extensibility.** Adding more cultures is now a small script change +
  a new JSON file + adding the id to `SKYCULTURES`.

## Alternatives considered

- **Hand-curating asterisms from scholarly references:** rejected — expensive
  in time, error-prone, and duplicates years of Stellarium community work.
- **Runtime fetch of Stellarium GitHub:** rejected — violates the "no backend
  / no runtime network for static data" principle and would break offline use.
- **Ship only the Western infrastructure with no additional culture:** rejected
  in favour of a single, clean, licensed second culture (Chinese) as a
  proof-of-concept.
