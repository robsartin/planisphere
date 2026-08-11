# ADR 017 — Constellation art pack (schema + placeholder-fallback loader)

**Date:** 2026-08-11
**Status:** Accepted

## Context

Issue #366 asks for real per-constellation illustrations to sit under the
Western/IAU 88 stick figures. The layer plumbing landed in #350 (see
`src/scene/constellation-art.ts`); what's missing is the assets and the
per-constellation transform metadata needed to align each figure with the
underlying stick figure.

Sourcing 88 art files and hand-tuning their per-constellation transforms is
inherently a browser-in-the-loop exercise — different from the code work
required to load and apply them. The two phases have different reviewers,
different iteration cadences, and (potentially) different licences to
resolve. Bundling them into a single change would either block the code
review on asset acquisition or land untested loader code.

## Decision

Split #366 into two shippable slices:

1. **This slice (scaffolding-only).** Ship a stable data schema and a loader
   that reads from it, with `file: null` for every IAU code so the placeholder
   sprite continues to render for every constellation. Downstream code and
   URL/settings state are unchanged.
2. **Follow-up slice (assets).** Populate the manifest with real
   `file` entries, hand-tune each transform against the running app, extend
   `NOTICE` with per-file attribution, and either extend this ADR with the
   licence decision or land a sibling ADR that supersedes its "licence
   deferred" note. That work is tracked separately on #366.

### Manifest schema — `data/art/western/manifest.json`

```json
{
  "culture": "western",
  "version": 1,
  "notes": "…",
  "constellations": {
    "And": { "file": null, "scale": 1.0, "rotationDeg": 0.0, "offsetAlt": 0.0, "offsetAz": 0.0 },
    "Ant": { "file": null, "scale": 1.0, "rotationDeg": 0.0, "offsetAlt": 0.0, "offsetAz": 0.0 }
    // …one entry per IAU 88 code
  }
}
```

- `file` — basename of the SVG asset under `data/art/western/`, or `null`
  when no asset is available (loader falls back to the placeholder sprite).
- `scale` — multiplier applied to the sprite's base size.
- `rotationDeg` — CCW rotation about the sprite centre, in degrees.
- `offsetAlt` / `offsetAz` — anchor offsets from the constellation centroid,
  in degrees.

Keys are the IAU three-letter codes that already appear in
`data/constellations.json`. The initial file lists all 88 codes with
identity transforms so that follow-up work is purely "fill in `file` and
tune the numbers" — never "add a new key".

### Loader shape — `src/scene/constellation-art.ts`

The exported `createConstellationArtLayer(scene, options?)` accepts an
optional `{ manifest, loadImage }` bag for dependency injection:

- `manifest` defaults to the bundled `data/art/western/manifest.json`.
- `loadImage` defaults to `(url) => { const img = new Image(); img.src = url; return img; }`,
  overridable in tests to avoid touching the DOM's network stack.

Images are cached per file basename so repeated `update()` calls don't
re-issue loads. When a constellation's `file` is `null` — or the whole
manifest entry is missing — the layer falls back to the same placeholder
canvas the previous version generated, preserving visual behaviour.

### Licence — deferred until assets land

The asset-acquisition slice will need its own licence review. Options
under discussion (all deferred):

- **Stellarium `modern_st` skyculture PNG art** — check Stellarium's
  `LICENSE` for the specific `constellation-art/` assets; historically
  the modern-Western art is public-domain user contributions but each
  file needs verifying.
- **Alternative SVG culture packs** — some community skyculture packs
  publish under CC-BY / CC-BY-SA. Compatibility with our Apache 2.0
  source licence follows the pattern in ADR 007: data files retain
  their upstream licence, attributions land in `NOTICE`.
- **Commissioned originals** — Apache 2.0 or CC0 art commissioned
  specifically for this project.

Because no assets are bundled in this slice, `NOTICE` needs no update
here. The follow-up slice must add per-file attribution when the first
real `file` entry ships.

## Consequences

- **Behaviour is unchanged for users of this slice.** Every constellation
  still gets the placeholder sprite; the URL / settings toggles keep
  working; the pick contract is preserved.
- **Test surface widens.** The loader is now covered for the "manifest
  present, file `null`", "manifest present, file set", and "manifest
  missing entry" cases so the follow-up slice inherits confidence.
- **Follow-up work is now purely mechanical for the loader.** Dropping
  an SVG into `data/art/western/`, setting its `file` in the manifest,
  and tuning the four numbers is enough to light up a constellation.
- **Bundle size grows by ~7 KB** (the manifest JSON, minified in the
  built bundle). Well within budget.
- **No runtime fetch.** The manifest is imported at build time; asset
  URLs (once populated) resolve to Vite-hashed bundle paths.

## Alternatives considered

- **Land assets + loader in one PR.** Rejected — mixes two review
  disciplines and forces the code review to wait on eye-balled
  per-constellation alignment.
- **Skip the manifest, hardcode transforms in TypeScript.** Rejected —
  the follow-up slice will iterate on those numbers in a browser;
  keeping them in JSON means the iteration doesn't require a code
  review or a rebuild.
- **One manifest per culture at the top level, e.g. `data/art/manifest.json`.**
  Deferred — only Western is planned for the near term; a per-culture
  file next to the assets (as `data/art/<culture>/manifest.json`) mirrors
  the asterism-per-culture layout in `data/asterisms/`.
