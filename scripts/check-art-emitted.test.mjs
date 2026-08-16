// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { missingArtAssets } from "./check-art-emitted.mjs";

/**
 * The matching rule this covers: Vite emits `Ori.png` as
 * `dist/assets/Ori-<hash>.png`, so a manifest basename is "present" only when
 * some emitted name is exactly `<basename>-…` + `.png`.
 *
 * The guard itself was watched failing by hand (reverting the glob makes all
 * 85 go missing), but that is a one-off. These cases pin the rule so CI can
 * re-run it.
 */
describe("missingArtAssets", () => {
  it("treats a hashed emitted name as covering its manifest basename", () => {
    expect(missingArtAssets(["Ori.png"], ["Ori-BLfFGGYk.png"])).toEqual([]);
  });

  it("reports a manifest file with no emitted counterpart", () => {
    expect(missingArtAssets(["Ori.png", "And.png"], ["Ori-BLfFGGYk.png"])).toEqual(["And.png"]);
  });

  it("reports every file when nothing was emitted", () => {
    // The shape of the original bug: the glob resolved to nothing, so no art
    // asset reached dist/ at all.
    expect(missingArtAssets(["Ori.png", "And.png"], [])).toEqual(["Ori.png", "And.png"]);
  });

  it("returns nothing to report when the manifest names no files", () => {
    expect(missingArtAssets([], ["Ori-BLfFGGYk.png"])).toEqual([]);
  });

  it("does not let a longer basename satisfy a shorter one", () => {
    // Prefix matching without the `-` separator would let the emitted
    // `Ari-x.png` mark `Ar.png` present. IAU codes nest like this for real
    // (CMa/CMi, UMa/UMi), so the separator is load-bearing.
    expect(missingArtAssets(["Ar.png"], ["Ari-x.png"])).toEqual(["Ar.png"]);
  });

  it("ignores emitted non-PNG assets that share the basename", () => {
    expect(missingArtAssets(["Ori.png"], ["Ori-BLfFGGYk.webp"])).toEqual(["Ori.png"]);
  });
});
