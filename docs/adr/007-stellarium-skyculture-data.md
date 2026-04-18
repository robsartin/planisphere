# ADR 007 — Stellarium skyculture data (CC-BY-SA 4.0)

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
(*儀象考成*, 1756 and Yi Shitong's *Chinese and Western Contrast Star Chart and
Catalogue 1950.0*, 1981).

## Decision

Bundle a subset of Stellarium skyculture data as additional asterism JSON
under `data/asterisms/<culture>.json`. The v1 shipping set is:

- `data/asterisms/western.json` — IAU 88, mirror of existing public-domain
  `data/constellations.json`.
- `data/asterisms/chinese.json` — Stellarium's `chinese` skyculture, CC-BY-SA 4.0.

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

Attribution is recorded in `NOTICE`. The CC-BY-SA 4.0 license is compatible
with our Apache 2.0 source license as long as the derived data files
themselves remain under CC-BY-SA 4.0 (the data is separable from the code).

## Consequences

- **Bundle size:** +26 KB (chinese.json) + 15 KB (western.json). Well within
  the existing budget.
- **Licensing:** Data files under `data/asterisms/` are CC-BY-SA 4.0. Any
  downstream redistribution must preserve the NOTICE attribution and the
  share-alike provision applies to modifications of the data (not to code
  using the data).
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
