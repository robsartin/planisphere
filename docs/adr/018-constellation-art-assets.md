# ADR 018 — Constellation art assets: Stellarium `modern` skyculture + Free Art License

**Date:** 2026-08-14
**Status:** Accepted, amended 2026-08-16 by [the affine-placement design spec](../specs/2026-08-16-constellation-art-affine-design.md) (partially supersedes [ADR 017](017-constellation-art-pack.md) — the "licence deferred until assets land" note and the SVG-only manifest schema)

> **Amendment (2026-08-16).** The rendering half of this ADR has been
> rewritten in place. Anchored art is no longer a fixed-scale billboard: it
> is a textured world-space quad carrying the full affine. The sections
> below reflect the amended decision, not the original one; the paragraphs
> that deferred zoom-correct rendering have been replaced rather than
> annotated, so nothing here describes the superseded design.

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
  shader. Cesium uses standard alpha blending, so we
  re-encode each PNG to RGBA with the luminance value remapped into the
  alpha channel (RGB values preserved; a pixel that was fully black in
  the upstream becomes fully transparent, a pixel that was fully bright
  becomes fully opaque). The pixel information is preserved 1:1; the
  channel layout changes so the same visual intent renders correctly
  under standard blending. This modification is a "derivative work"
  under the Free Art License and is itself re-licensed under FAL 1.3
  per the licence's share-alike clause. See NOTICE for attribution.
- **Weight**: 3.1 MB on disk across all 85 PNGs after re-encoding to RGBA (from
  ~2.1 MB upstream; the alpha channel adds a byte per pixel). Vite
  emits each as a hashed asset; the layer only ever names the URL of a
  currently-visible constellation, and Cesium fetches a texture the first
  time a material references it, so a typical mid-latitude night pulls a
  fraction of the total rather than all 3.1 MB.
- **Reproducibility**: `scripts/build-art.mjs` performs the rename and the
  manifest extraction (the RGBA re-encode is documented there but left
  manual — automating it needs an image-codec dependency, and every
  dependency in this repo needs its own ADR). Two upstream quirks are
  encoded in that script because they are exactly what a future
  regeneration would trip over: Carina's illustration is the reused
  `argonavis.png` (the single Argo Navis image), and Horologium's upstream
  file is misspelled `horlogium.png`, missing the second "o".

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
3. Otherwise, solve for the affine that carries image space to world
   space:
   a. Convert each anchor's alt/az to a `Cartesian3` on the celestial
   sphere via the existing `altAzToCartesian`.
   b. Three pixel→world correspondences determine a unique affine map.
   Solving them yields a `Matrix4` whose columns are the world-space
   images of the image's `+x` and `+y` pixel axes plus the world-space
   image of the pixel origin — so translation, scale, rotation **and
   shear** all fall out of the same solve.
   c. Use that `Matrix4` directly as the `modelMatrix` of a unit-quad
   `Primitive` textured with the illustration.

Working in `Cartesian3` world space rather than alt/az avoids wraparound
issues near the meridian and pole. The quad's corners need not sit exactly
on the sky sphere — Cesium projects world-space geometry regardless of
whether it is on-sphere, and at sky-sphere radius the flat quad is
visually indistinguishable from a curved patch.

### Rendering: textured world-space quad, not a billboard

Anchored art is drawn as a `Primitive`: a unit quad in the model-space XY
plane, drawn with a flat `MaterialAppearance`, carrying the affine above as
its `modelMatrix`. `BillboardCollection` is retained **only** for the
placeholder sprite, which is what the layer draws when there is no
upstream illustration, an anchor star is below the horizon, the anchor
triangle is degenerate, or `artAssetUrl` reports the asset was not
emitted.

Four implementation constraints are load-bearing and easy to undo by
accident:

- **The material is the built-in `Image` material with
  `material.translucent = true`.** The built-in reports its translucency
  as a function of `color.alpha`, and `Appearance.isTranslucent()` prefers
  the material's answer over the appearance's — so at opacity 1.0 the
  render state flips to opaque and every PNG's transparent background
  renders black. Setting `translucent` explicitly pins it.
- **Primitives are cached per constellation id; a rerender mutates
  `modelMatrix` instead of rebuilding.** The time-animation loop calls
  `update()` every frame. Rebuilding meant a fresh Cesium `Material` per
  constellation per frame, and a fresh `Material` starts on a default 1×1
  white texture until its fetch resolves — so every constellation
  rendered as a solid white parallelogram while leaking a material per
  frame.
- **The viewer is constructed with `scene3DOnly: true`.** The quad's
  model-space vertices include the origin, and the `modelMatrix` is applied
  at draw time rather than baked into the geometry. Without the flag,
  Cesium's geometry pipeline projects those raw model-space positions to
  2D for the unused 2D/Columbus scene modes, and projecting `(0, 0, 0)`
  throws a `DeveloperError` that halts the render loop entirely. The app
  has no scene-mode picker, so nothing is lost.
- **The art pick payload is a live mutable object**, updated in place by
  the layer each frame — a different lifetime model from the polyline
  layer's per-frame immutable payloads. Nothing observable differs today,
  but a consumer that wants to retain pick-time state must copy it.

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
- **Bundle size grows by 3.1 MB** of PNG assets, but textures are
  fetched per constellation on first use, so the wire cost is
  proportional to what a user actually sees.
- **Scale, rotation and shear are all correct, and zoom-correct by
  construction.** The quad lives in world space, so it scales with the
  stars under zoom and turns with the sky under pan without any
  per-frame screen-space correction. There is no `BASE_ANCHORED_SCALE`
  fudge factor any more, and no per-constellation hand-tuning.
- **The art was not emitted to `dist/` at all in the first cut.**
  `new URL(<literal dir> + dynamicBasename, import.meta.url)` is not
  rewritten by Vite — it only rewrites `new URL` when the entire path is
  a static literal — so no PNG was ever emitted and every art fetch 404'd
  in production. No test could catch it: unit tests run against source,
  and the e2e suite runs against the Vite dev server, where the relative
  path resolves off disk. The fix is a build-time `import.meta.glob` plus
  an `artAssetUrl()` resolver that returns `null` for an unemitted file,
  guarded by a manifest-coverage unit test and by
  `scripts/check-art-emitted.mjs`, which CI runs against `dist/assets/`
  immediately after `pnpm build`.
- **Larger Cesium API surface.** `Primitive`, `GeometryInstance`,
  `Material` and `MaterialAppearance` are now in play where the rest of
  the scene uses collections. That was the original reason for deferring
  this approach; it is a real cost, accepted because it is the only way
  to express shear.
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
- **Keep the fixed-scale billboard.** This was the original decision here,
  and it was deferred on a premise that turned out to be wrong (see the
  next bullet). Rejected once the art was actually on screen: a
  fixed screen-space scale visibly detaches the illustration from the
  stars it is meant to trace as soon as the user zooms.
- **`Billboard.alignedAxis` + `Billboard.sizeInMeters`.** This is the
  honest correction to the original ADR. It claimed zoom-correct
  rendering "would require moving to a `Primitive` with a textured
  world-space polygon". That is false. `alignedAxis` takes a world-space
  up vector and `sizeInMeters` sizes the quad in world units, so a
  billboard could have delivered both rotation and zoom-correctness with
  no new primitive machinery, and the deferral rested on a wrong premise
  rather than on a real constraint. It was rejected here only because a
  billboard remains an axis-aligned rectangle about its axis: it can
  express translation, uniform scale and rotation, but **not shear**.
  Stellarium's three-anchor alignment produces a general affine, and
  dropping its shear component mis-registers the illustration against
  its own anchor stars. Expressing shear is the sole reason the
  `Primitive` path was taken.
