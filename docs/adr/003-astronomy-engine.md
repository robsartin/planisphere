# ADR 003 — Astronomy Engine

**Date:** 2026-04-16
**Status:** Accepted

## Context

Plan 02 needs coordinate transforms (RA/Dec → Alt/Az), sidereal time, and
precession/nutation corrections. Rolling our own is error-prone and would be
replaced by a library in Plan 03 (Sun/Moon/planets) anyway.

## Decision

Use `astronomy-engine` (MIT, ~50KB). It covers all coordinate math needed
for Plans 02–05 and is well-tested against JPL ephemeris data.

## Consequences

- Runtime dependency (first one). Bundle size increases by ~50KB.
- `src/astro/` wraps Astronomy Engine; no other module imports it directly.
- Coordinate convention: Astronomy Engine uses RA in hours, Dec in degrees.
  Our catalog stores RA in degrees; conversion happens at the boundary.

## Alternatives considered

- Hand-rolled transforms: rejected — error-prone, replaced in Plan 03.
- SunCalc: rejected — stars-only, no general-purpose RA/Dec→Alt/Az.
