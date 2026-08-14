# ADR 018 — Constellation art assets: Stellarium `modern` skyculture + Free Art License

**Date:** 2026-08-14
**Status:** Accepted (partially supersedes [ADR 017](017-constellation-art-pack.md) — the "licence deferred until assets land" note and the SVG-only manifest schema)

## Context

ADR 017 landed the loader plumbing for #366's constellation-art overlay
with a placeholder-only manifest and no bundled assets. The follow-up
work was defined as "source the SVG pack, hand-tune each transform
in-browser, extend NOTICE, decide the licence."

Doing that work surfaced three assumptions from the original issue that
turned out not to match reality:

1. **Format.** The issue asked for one SVG per constellation. The obvious
   upstream — Stellarium's western skyculture — ships **PNGs**, not SVGs,
   and none of the CC-compatible SVG constellation-art collections we
   surveyed cover all 88 IAU constellations with a consistent style.
2. **Alignment.** ADR 017's manifest carried a per-constellation
   `{scale, rotationDeg, offsetAlt, offsetAz}`. That's enough for
   billboards centred on the constellation centroid, but it can't express
   the correct rotation/scale for a real illustration without hand-tuning
   each of the 88 by eye — a browser-in-the-loop task that doesn't fit
   the review loop we want.
3. **Licence.** The illustrations subdirectory of Stellarium's `modern`
   skyculture is licensed under the **Free Art License**, not CC-BY-SA
   as the issue guessed. Text/data in the same skyculture is CC-BY-SA 4.0.

## Decision

Bundle Stellarium's `modern` skyculture illustrations verbatim, aligned
via the same 3-anchor scheme Stellarium itself uses. Specifically:

### Assets

- **Source**: `Stellarium/stellarium@master:skycultures/modern/illustrations/*.png`.
- **Bundled at**: `data/art/western/<IAU>.png` (renamed from Stellarium's
  Latin-name filenames, e.g. `andromeda.png` → `And.png`, so the manifest
  key = the file basename).
- **Coverage**: 85 of the 88 IAU constellations. Puppis, Serpens, and Vela
  have no upstream illustration (Argo Navis is a single image assigned to
  Carina; Serpens is historically split into Caput / Cauda). These three
  fall back to the placeholder sprite the layer already draws.
- **Modification**: Stellarium ships these as opaque 8-bit grayscale (or
  RGB) with the convention "black = transparent" baked into its custom
  shader. Cesium's billboard renderer uses standard alpha blending, so we
  re-encode each PNG to RGBA with the luminance value remapped into the
  alpha channel (RGB values preserved; a pixel that was fully black in
  the upstream becomes fully transparent, a pixel that was fully bright
  becomes fully opaque). The pixel information is preserved 1:1; the
  channel layout changes so the same visual intent renders correctly
  under standard blending. This modification is a "derivative work"
  under the Free Art License and is itself re-licensed under FAL 1.3
  per the licence's share-alike clause. See NOTICE for attribution.
- **Weight**: ~3.0 MB across all 85 PNGs after re-encoding to RGBA (from
  ~2.1 MB upstream; the alpha channel adds a byte per pixel). Vite
  emits each as a hashed asset; the loader only fetches images for
  currently-visible constellations (lazy in `update()` with per-file
  caching), so a typical mid-latitude night pulls ~800 KB–1.4 MB.

### Manifest schema (v2)

Supersedes the v1 schema in ADR 017. Each entry now carries:

```json
{
  "file": "Ori.png",
  "size": [512, 512],
  "anchors": [
    { "pos": [59, 11], "hip": 27913 },
    { "pos": [329, 477], "hip": 27366 },
    { "pos": [421, 91], "hip": 22449 }
  ]
}
```

- `file` — image basename under `data/art/western/`. Null means "no
  upstream image; use placeholder" (Pup / Ser / Vel).
- `size` — image dimensions in pixels.
- `anchors` — three `{pos: [px, py], hip}` pairs. Each pins a specific
  pixel in the image to a Hipparcos-catalogue star; together they
  define an affine mapping from image space to the celestial sphere.

The v1 `{scale, rotationDeg, offsetAlt, offsetAz}` fields are gone —
anchors carry all the alignment information Stellarium uses, and hand-
tuning per-constellation transforms is no longer required.

### Loader math

The layer computes each frame:

1. Look up each anchor's current alt/az via the `AnchorStarLookup`
   callback the app passes in (backed by `filterVisibleStars`'s output).
2. If any anchor star isn't currently above the horizon, or the three
   anchor pixels are collinear (degenerate triangle), fall back to the
   placeholder sprite at the constellation centroid so we never draw a
   wrong-positioned illustration.
3. Otherwise:
   a. Compute barycentric coordinates of the image centre pixel `(w/2, h/2)`
   relative to the three anchor pixels.
   b. Convert each anchor's alt/az to a Cartesian3 on the celestial
   sphere via the existing `altAzToCartesian`.
   c. Interpolate the image centre's world position by the same
   barycentric weights.
   d. Draw a Cesium billboard at that position with a fixed base scale
   (`BASE_ANCHORED_SCALE = 0.5`).

Barycentric interpolation in Cartesian3 world space avoids alt/az
wraparound issues near the meridian and pole. The interpolated point
may not sit exactly on the sky sphere when the image centre lies outside
the anchor triangle — that's fine, Cesium projects world-space points
regardless of whether they're on-sphere.

### Licence

- **Illustrations** (`data/art/western/*.png`): Free Art License 1.3
  (per `Stellarium/stellarium@master:skycultures/modern/description.md`).
  FAL is copyleft; it approves redistribution and modification as long
  as the licence is preserved on derived copies of the art itself. It
  does not affect our Apache 2.0 source licence — the art files retain
  their own licence, and NOTICE records the attribution + the licence
  name and URL.
- **Anchor + size metadata** (embedded in `data/art/western/manifest.json`):
  CC-BY-SA 4.0 (same as Stellarium's constellation data — this is data
  extracted from Stellarium's `index.json`).

This mirrors the split we already accepted in ADR 007 for bundled
skyculture asterism data: each data file retains its upstream licence,
NOTICE lists them per-file, Apache 2.0 governs everything we authored.

## Consequences

- **Users see real illustrations.** The overlay now renders Stellarium's
  86-year-old-and-refreshed western skyculture art (85 constellations),
  positioned via the same anchor scheme Stellarium uses internally.
- **Layer contract change.** `createConstellationArtLayer.update()` now
  takes an extra `AnchorStarLookup` argument. `app.ts` builds a HIP-to-
  alt/az `Map` once per rerender from the existing `visibleStars` list.
- **Anchor stars must be visible.** If any of a constellation's three
  Stellarium anchor stars is below the horizon, the layer falls back
  to the placeholder at the centroid rather than drawing a distorted
  image. In practice this affects constellations sitting on the horizon;
  ones fully in view render correctly.
- **Bundle size grows by ~2.1 MB** of PNG assets, but the loader is
  lazy per constellation so the wire cost is proportional to what a
  user actually sees.
- **Scale is fixed, not zoom-aware.** `BASE_ANCHORED_SCALE = 0.5` looks
  right at Cesium's default zoom; zooming in makes the art appear too
  small, zooming out makes it too large. Cesium billboards are screen-
  aligned quads, so a truly zoom-correct render would require moving
  to a `Primitive` with a textured world-space polygon (deferred; not
  blocking for the first assets slice).
- **Per-constellation override still open.** The v2 schema doesn't
  currently expose a per-constellation scale override, because
  Stellarium's data doesn't need one; a follow-up can add
  `scaleOverride`, `opacityOverride`, etc. if any constellation looks
  too big/small in practice.

## Alternatives considered

- **Ship SVGs from a different pack.** No coherent CC-compatible SVG
  pack covers all 88 IAU constellations in a single artistic style. A
  patchwork would create attribution complexity and visual inconsistency.
- **Commission original SVG art.** Right project, wrong PR — this is
  a several-month artistic effort. Would be a fresh ADR when funded.
- **Ship identity transforms only (ADR 017 schema unchanged).** Rejected
  in the earlier options discussion: without anchor-driven placement each
  512×512 sprite would plop at the centroid unscaled, producing a visibly
  wrong overlay that undermines the whole feature.
- **Move to `Primitive` + textured polygon now for zoom-correct rendering.**
  Larger Cesium API surface, and the billboard model matches every other
  layer in the scene. Deferred to a follow-up if the fixed-scale
  approximation reads as too rough in practice.
