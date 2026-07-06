/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { isOk, expectOk } from "../result";
import { fetchTle } from "./fetch";

// TLE epochs in the mocks below are anchored on 2024-04-09T12:00:00Z (year
// 2024, day-of-year 100.5). The fake system time in the "age" tests below is
// pinned so we can compute a deterministic sourceAgeSeconds.
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

afterEach(() => {
  vi.useRealTimers();
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
    const val = expectOk(r);
    expect(val.text).toContain("ISS");
  });

  it("falls back to bundled data on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    const r = await fetchTle();
    expect(isOk(r)).toBe(true);
    const val = expectOk(r);
    expect(val.text).toContain("HUBBLE");
    expect(val.text).toBe(BUNDLED_TLE);
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
    const val = expectOk(r);
    expect(val.text).toContain("HUBBLE");
    expect(val.text).toBe(BUNDLED_TLE);
  });

  describe("usedFallback / sourceAgeSeconds", () => {
    it("reports usedFallback:false and a computed sourceAgeSeconds on a successful live fetch", async () => {
      // Freeze wall clock 30 days after the epoch of MOCK_TLE (2024-04-09T12:00Z).
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-05-09T12:00:00Z"));
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(MOCK_TLE),
        }),
      );
      const r = await fetchTle();
      const val = expectOk(r);
      expect(val.usedFallback).toBe(false);
      expect(val.sourceAgeSeconds).toBe(30 * 86400);
    });

    it("reports usedFallback:true and an accurate sourceAgeSeconds when the fetch fails", async () => {
      // 14 days after the epoch of the BUNDLED_TLE (2024-04-09T12:00Z).
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-04-23T12:00:00Z"));
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
      const r = await fetchTle();
      const val = expectOk(r);
      expect(val.usedFallback).toBe(true);
      expect(val.sourceAgeSeconds).toBe(14 * 86400);
    });

    it("reports usedFallback:true when the response is non-ok", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-04-16T12:00:00Z"));
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: "Server Error",
        }),
      );
      const r = await fetchTle();
      const val = expectOk(r);
      expect(val.usedFallback).toBe(true);
      expect(val.sourceAgeSeconds).toBe(7 * 86400);
    });

    it("uses the newest epoch across multiple TLE records", async () => {
      // Two TLEs, epochs 30 days apart. The newest (day 200) should drive
      // sourceAgeSeconds, not the older (day 100). Wall clock at day 210
      // means the newest is 10 days old.
      vi.useFakeTimers();
      vi.setSystemTime(new Date(Date.UTC(2024, 0, 1) + 209 * 86_400_000));
      const twoRecords = `OLDER SAT
1 11111U 90001A   24100.00000000  .00000001  00000+0  10000-4 0  9990
2 11111  28.4700 123.4567 0002345  67.8901 292.1098 15.09876543210987
NEWER SAT
1 22222U 90002A   24200.00000000  .00000002  00000+0  20000-4 0  9991
2 22222  51.6400 208.9163 0002476 102.8574 355.4846 15.49909786000000`;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(twoRecords),
        }),
      );
      const r = await fetchTle();
      const val = expectOk(r);
      expect(val.usedFallback).toBe(false);
      // 10 days = 864,000 seconds. Allow for TLE-epoch floor rounding.
      expect(val.sourceAgeSeconds).toBe(10 * 86400);
    });

    it("skips malformed line-1s (too-short and non-numeric) and returns 0 age when nothing parses", async () => {
      // Text contains a "line 1" prefix but no valid epoch fields at all —
      // parseTleEpochMs returns null on both, and computeSourceAgeSeconds
      // falls back to 0.
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-05-09T12:00:00Z"));
      const garbage = "GARBAGE\n1 too short\n1 XXXXXU XXXXXA   XXXXX.XXXXXXXX";
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(garbage),
        }),
      );
      const r = await fetchTle();
      const val = expectOk(r);
      expect(val.usedFallback).toBe(false);
      expect(val.sourceAgeSeconds).toBe(0);
    });

    it("treats an empty-text response as a failure and falls back to bundled data", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-04-16T12:00:00Z"));
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve("   \n  "),
        }),
      );
      const r = await fetchTle();
      const val = expectOk(r);
      expect(val.usedFallback).toBe(true);
      expect(val.text).toBe(BUNDLED_TLE);
    });
  });
});
