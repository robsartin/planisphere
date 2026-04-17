/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { isErr, isOk, expectOk } from "../result";
import { parseTle } from "./tle";

const ISS_TLE = `ISS (ZARYA)
1 25544U 98067A   24100.50000000  .00016717  00000-0  10270-3 0  9006
2 25544  51.6400 208.9163 0002476 102.8574 355.4846 15.49909786447384`;

const TWO_SATS = `ISS (ZARYA)
1 25544U 98067A   24100.50000000  .00016717  00000-0  10270-3 0  9006
2 25544  51.6400 208.9163 0002476 102.8574 355.4846 15.49909786447384
HUBBLE
1 20580U 90037B   24100.50000000  .00001234  00000-0  56789-4 0  9005
2 20580  28.4700 123.4567 0002345  67.8901 292.1098 15.09876543210987`;

describe("parseTle", () => {
  it("parses a single satellite TLE", () => {
    const r = parseTle(ISS_TLE);
    expect(isOk(r)).toBe(true);
    const sats = expectOk(r);
    expect(sats).toHaveLength(1);
    expect(sats[0]!.name).toBe("ISS (ZARYA)");
    expect(sats[0]!.noradId).toBe(25544);
    expect(sats[0]!.satrec).toBeDefined();
  });

  it("parses multiple satellites", () => {
    const sats = expectOk(parseTle(TWO_SATS));
    expect(sats).toHaveLength(2);
    expect(sats[0]!.name).toBe("ISS (ZARYA)");
    expect(sats[1]!.name).toBe("HUBBLE");
    expect(sats[1]!.noradId).toBe(20580);
  });

  it("returns Err for empty input", () => {
    const r = parseTle("");
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("tle-parse-failed");
  });

  it("returns Err for non-string input", () => {
    const r = parseTle(42 as unknown as string);
    expect(isErr(r)).toBe(true);
  });

  it("skips malformed TLE entries gracefully", () => {
    const badTle = `BAD SAT
1 99999X INVALID
2 99999
${ISS_TLE}`;
    const sats = expectOk(parseTle(badTle));
    expect(sats).toHaveLength(1);
    expect(sats[0]!.name).toBe("ISS (ZARYA)");
  });
});
