// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { latinToIau } from "./build-art.mjs";

describe("latinToIau", () => {
  it("maps a single-word Latin name to its IAU code", () => {
    expect(latinToIau("andromeda")).toBe("And");
    expect(latinToIau("orion")).toBe("Ori");
  });

  it("maps a hyphenated Latin name to its IAU code", () => {
    // The renaming is the error-prone half of the pipeline: Stellarium ships
    // canis-major and canis-minor, whose codes differ only in one letter.
    expect(latinToIau("canis-major")).toBe("CMa");
    expect(latinToIau("canis-minor")).toBe("CMi");
    expect(latinToIau("ursa-major")).toBe("UMa");
    expect(latinToIau("ursa-minor")).toBe("UMi");
  });

  it("returns null for a name with no IAU counterpart", () => {
    // Argo Navis is not an IAU 88 constellation; Stellarium assigns its single
    // illustration to Carina, which is why Pup and Vel have no art.
    expect(latinToIau("argo-navis")).toBeNull();
    expect(latinToIau("not-a-constellation")).toBeNull();
  });
});
