/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { isOk, expectOk } from "../result";
import { fetchTle } from "./fetch";

const MOCK_TLE = `ISS (ZARYA)
1 25544U 98067A   24100.50000000  .00016717  00000-0  10270-3 0  9006
2 25544  51.6400 208.9163 0002476 102.8574 355.4846 15.49909786447384`;

const BUNDLED_TLE = `HUBBLE
1 20580U 90037B   24100.50000000  .00001234  00000-0  56789-4 0  9005
2 20580  28.4700 123.4567 0002345  67.8901 292.1098 15.09876543210987`;

vi.mock("../../data/tle/visual.txt?raw", () => ({
  default: `HUBBLE
1 20580U 90037B   24100.50000000  .00001234  00000-0  56789-4 0  9005
2 20580  28.4700 123.4567 0002345  67.8901 292.1098 15.09876543210987`,
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchTle", () => {
  it("returns fresh TLE on successful fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(MOCK_TLE),
      }),
    );
    const r = await fetchTle();
    expect(isOk(r)).toBe(true);
    const text = expectOk(r);
    expect(text).toContain("ISS");
  });

  it("falls back to bundled data on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    const r = await fetchTle();
    expect(isOk(r)).toBe(true);
    const text = expectOk(r);
    expect(text).toContain("HUBBLE");
    expect(text).toBe(BUNDLED_TLE);
  });

  it("falls back to bundled data on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      }),
    );
    const r = await fetchTle();
    expect(isOk(r)).toBe(true);
    const text = expectOk(r);
    expect(text).toContain("HUBBLE");
    expect(text).toBe(BUNDLED_TLE);
  });
});
