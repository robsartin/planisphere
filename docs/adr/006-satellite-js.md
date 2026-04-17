# ADR 006 — satellite.js

**Date:** 2026-04-16
**Status:** Accepted

## Context

Plan 05 needs SGP4/SDP4 TLE propagation for artificial satellites.
The v1 design spec selected satellite.js as the orbital math library.

## Decision

Use `satellite.js` (MIT, ~30KB). It provides TLE parsing (`twoline2satrec`),
SGP4/SDP4 propagation (`propagate`), and coordinate conversions
(ECI → geodetic, ECI → ECF, ECF → look angles).

## Consequences

- Runtime dependency. Bundle size increases by ~30KB.
- `src/sat/` wraps satellite.js; no other module imports it directly.
- TLE data uses NORAD 3-line format; satellite.js parses the 2 orbital lines.

## Alternatives considered

- Manual SGP4 implementation: rejected — complex, error-prone, satellite.js is
  well-tested and maintained.
- Orekit (Java): rejected — wrong ecosystem.
