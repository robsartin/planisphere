/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { handleAstroWorkerMessage, type AstroWorkerRequest } from "./astro-worker-dispatch";

// Anchorage at midnight UTC on 2026-04-25 — matches the fixture used in
// e2e/hover-pick-sweep.spec.ts so any regression in the alt/az math shows
// up in both suites.
const ANCHORAGE_LAT = 61.2;
const ANCHORAGE_LON = -149.9;
const T_2026_04_25_MIDNIGHT_UTC_MS = Date.UTC(2026, 3, 25, 8, 0, 0);

function makeRequest(overrides: Partial<AstroWorkerRequest> = {}): AstroWorkerRequest {
  return {
    type: "compute-altaz",
    id: 1,
    raDecs: new Float64Array([0, 0]),
    lat: ANCHORAGE_LAT,
    lon: ANCHORAGE_LON,
    timeMs: T_2026_04_25_MIDNIGHT_UTC_MS,
    ...overrides,
  };
}

describe("handleAstroWorkerMessage", () => {
  it("returns null for a message whose type is not compute-altaz", () => {
    // A future protocol change can add new message kinds; the entry file
    // relies on the null-return to drop unknown types silently.
    const req = { ...makeRequest(), type: "some-other-op" } as unknown as AstroWorkerRequest;
    expect(handleAstroWorkerMessage(req)).toBeNull();
  });

  it("preserves the request id in the response so async callers can correlate", () => {
    const out = handleAstroWorkerMessage(makeRequest({ id: 42 }));
    expect(out).not.toBeNull();
    expect(out!.response.id).toBe(42);
    expect(out!.response.type).toBe("compute-altaz-result");
  });

  it("returns an empty altAzs and visibleIndices when the input is empty", () => {
    const out = handleAstroWorkerMessage(makeRequest({ raDecs: new Float64Array(0) }));
    expect(out).not.toBeNull();
    expect(out!.response.altAzs.length).toBe(0);
    expect(out!.response.visibleIndices.length).toBe(0);
    // Transferables list is still populated — the two buffers exist even
    // when they're zero-length. This matters because a bare-return path
    // would break the caller's postMessage([...]) shape contract.
    expect(out!.transferables).toHaveLength(2);
  });

  it("computes alt/az for each ra/dec pair and lists only the above-horizon indices", () => {
    // Two probe points: north celestial pole (dec ≈ +90°) and south celestial
    // pole (dec ≈ -90°). From Anchorage (lat +61°), NCP is high above the
    // horizon and SCP is far below it, regardless of the time / RA — this
    // makes the assertion time-independent. RA/Dec inputs to
    // `altAzFromRaDec` are in *degrees* (see `worker-math.ts`), and the
    // `alt > 0` visibility check reads altitude in degrees.
    const NCP_DEC_DEG = 89.9; // just under +90° to avoid singular altAz math
    const SCP_DEC_DEG = -89.9;
    const raDecs = new Float64Array([0, NCP_DEC_DEG, 0, SCP_DEC_DEG]);
    const out = handleAstroWorkerMessage(makeRequest({ raDecs }));
    expect(out).not.toBeNull();
    const { altAzs, visibleIndices } = out!.response;
    // Two ra/dec pairs → four alt/az entries.
    expect(altAzs.length).toBe(4);
    // Index 0 (NCP) should be visible; index 1 (SCP) should not be.
    expect(Array.from(visibleIndices)).toEqual([0]);
    // Sanity-check the NCP altitude — it should sit within a few degrees
    // of the observer's latitude (61.2°). Loose bound so drift in the
    // upstream math library doesn't spuriously fail.
    const ncpAltDeg = altAzs[0]!;
    expect(ncpAltDeg).toBeGreaterThan(55);
    expect(ncpAltDeg).toBeLessThan(90);
  });

  it("returns the altAzs and visibleIndices buffers in the transferables list", () => {
    const out = handleAstroWorkerMessage(makeRequest());
    expect(out).not.toBeNull();
    expect(out!.transferables).toContain(out!.response.altAzs.buffer);
    expect(out!.transferables).toContain(out!.response.visibleIndices.buffer);
  });
});
