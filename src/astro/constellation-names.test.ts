/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { expectOk, isErr, isOk } from "../result";
import { parseConstellationNames, LANGUAGES, type Language } from "./constellation-names";

describe("parseConstellationNames", () => {
  it("parses a valid name map object", () => {
    const raw = { Ori: "Орион", UMa: "Большая Медведица" };
    const r = parseConstellationNames(raw);
    expect(isOk(r)).toBe(true);
    const names = expectOk(r);
    expect(names["Ori"]).toBe("Орион");
    expect(names["UMa"]).toBe("Большая Медведица");
  });

  it("returns Err for non-object input (string)", () => {
    const r = parseConstellationNames("not an object");
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("constellation-names-invalid");
  });

  it("returns Err for null", () => {
    const r = parseConstellationNames(null);
    expect(isErr(r)).toBe(true);
  });

  it("returns Err for arrays (which are objects but not maps)", () => {
    const r = parseConstellationNames([]);
    expect(isErr(r)).toBe(true);
  });

  it("skips entries whose value is not a string", () => {
    const raw = { Ori: "Orion", UMa: 123, Cyg: "Cygnus" };
    const r = parseConstellationNames(raw);
    const names = expectOk(r);
    expect(names["Ori"]).toBe("Orion");
    expect(names["Cyg"]).toBe("Cygnus");
    expect("UMa" in names).toBe(false);
  });

  it("returns Err for an empty name map (no valid entries)", () => {
    const r = parseConstellationNames({});
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("constellation-names-empty");
  });

  it("returns Err when all entries have non-string values", () => {
    const r = parseConstellationNames({ Ori: 1, UMa: null });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("constellation-names-empty");
  });
});

describe("LANGUAGES", () => {
  it("includes all supported language codes", () => {
    const codes: Language[] = ["la", "en", "zh", "ar", "el"];
    for (const code of codes) {
      expect(LANGUAGES).toContain(code);
    }
  });

  it("has 'la' as the first (default) language", () => {
    expect(LANGUAGES[0]).toBe("la");
  });
});
