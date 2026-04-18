/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { isErr, isOk, expectOk } from "../result";
import { parseCatalog } from "./catalog";

const VALID_STARS = [
  { hip: 32349, ra: 101.2872, dec: -16.7161, mag: -1.46, name: "Sirius", ci: 0.009 },
  { hip: 69673, ra: 279.2347, dec: 38.7837, mag: 0.03, name: "Vega", ci: 0.0 },
  { hip: 11767, ra: 37.9546, dec: 89.2641, mag: 2.02, name: "Polaris" },
];

describe("parseCatalog", () => {
  it("parses a valid star array", () => {
    const r = parseCatalog(VALID_STARS);
    expect(isOk(r)).toBe(true);
    const stars = expectOk(r);
    expect(stars).toHaveLength(3);
    expect(stars[0]!.hip).toBe(32349);
    expect(stars[0]!.name).toBe("Sirius");
  });

  it("accepts stars without a name field", () => {
    const data = [{ hip: 1, ra: 0, dec: 0, mag: 5.5 }];
    const stars = expectOk(parseCatalog(data));
    expect(stars[0]!.name).toBeUndefined();
  });

  it("parses ci (color index) when present", () => {
    const stars = expectOk(parseCatalog(VALID_STARS));
    const sirius = stars.find((s) => s.hip === 32349);
    expect(sirius!.ci).toBeCloseTo(0.009);
    const vega = stars.find((s) => s.hip === 69673);
    expect(vega!.ci).toBe(0.0);
  });

  it("ci is undefined when absent", () => {
    const stars = expectOk(parseCatalog(VALID_STARS));
    const polaris = stars.find((s) => s.hip === 11767);
    expect(polaris!.ci).toBeUndefined();
  });

  it("ci is undefined when non-numeric", () => {
    const data = [{ hip: 1, ra: 0, dec: 0, mag: 5.5, ci: "bright" }];
    const stars = expectOk(parseCatalog(data));
    expect(stars[0]!.ci).toBeUndefined();
  });

  it("returns Err for non-array input", () => {
    const r = parseCatalog("not an array");
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("catalog-load-failed");
  });

  it("returns Err for empty array", () => {
    const r = parseCatalog([]);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("catalog-load-failed");
  });

  it("skips entries with missing hip", () => {
    const data = [
      { hip: 32349, ra: 101.2872, dec: -16.7161, mag: -1.46 },
      { ra: 0, dec: 0, mag: 5.0 },
    ];
    const stars = expectOk(parseCatalog(data));
    expect(stars).toHaveLength(1);
  });

  it("skips entries with non-numeric mag", () => {
    const data = [
      { hip: 32349, ra: 101.2872, dec: -16.7161, mag: -1.46 },
      { hip: 2, ra: 0, dec: 0, mag: "bright" },
    ];
    const stars = expectOk(parseCatalog(data));
    expect(stars).toHaveLength(1);
  });
});
