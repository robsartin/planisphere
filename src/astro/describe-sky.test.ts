/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import {
  azimuthToCompass,
  describeSky,
  type DescribableBody,
  type DescribableConstellation,
} from "./describe-sky";

function body(id: string, alt: number, az: number, mag: number): DescribableBody {
  return { id, alt, az, mag };
}

function constellation(
  id: string,
  name: string,
  alt: number,
  az: number,
): DescribableConstellation {
  return { id, name, centroid: { alt, az } };
}

const ANCHORAGE = { lat: 61.2, lon: -149.9 };
const MIDNIGHT_UTC = new Date("2026-04-25T08:00:00Z");

describe("azimuthToCompass", () => {
  it("maps the four cardinals", () => {
    expect(azimuthToCompass(0)).toBe("north");
    expect(azimuthToCompass(90)).toBe("east");
    expect(azimuthToCompass(180)).toBe("south");
    expect(azimuthToCompass(270)).toBe("west");
  });

  it("normalizes out-of-range and negative azimuths", () => {
    expect(azimuthToCompass(360)).toBe("north");
    expect(azimuthToCompass(720)).toBe("north");
    expect(azimuthToCompass(-90)).toBe("west");
  });

  it("uses 16-point resolution", () => {
    expect(azimuthToCompass(45)).toBe("northeast");
    expect(azimuthToCompass(112.5)).toBe("east-southeast");
    expect(azimuthToCompass(292.5)).toBe("west-northwest");
  });
});

describe("describeSky", () => {
  it("names the observer's location and heading in the first sentence", () => {
    const out = describeSky({
      observer: ANCHORAGE,
      timeUtc: MIDNIGHT_UTC,
      bodies: [],
      constellations: [],
      cameraHeadingDeg: 112,
    });
    expect(out).toMatch(/^Facing east-southeast/);
    expect(out).toMatch(/61\.2° N, 149\.9° W/);
  });

  it("omits the heading clause when no camera heading is provided", () => {
    const out = describeSky({
      observer: ANCHORAGE,
      timeUtc: MIDNIGHT_UTC,
      bodies: [],
      constellations: [],
    });
    expect(out).toMatch(/^Viewing the sky/);
  });

  it("reports fully-dark astronomical twilight based on the Sun's altitude", () => {
    const out = describeSky({
      observer: ANCHORAGE,
      timeUtc: MIDNIGHT_UTC,
      bodies: [body("Sun", -35, 0, -26.7)],
      constellations: [],
    });
    expect(out).toMatch(/fully dark/);
  });

  it("labels civil / nautical / astronomical twilight bands", () => {
    const civil = describeSky({
      observer: ANCHORAGE,
      timeUtc: MIDNIGHT_UTC,
      bodies: [body("Sun", -3, 0, -26.7)],
      constellations: [],
    });
    expect(civil).toMatch(/civil twilight/);

    const nautical = describeSky({
      observer: ANCHORAGE,
      timeUtc: MIDNIGHT_UTC,
      bodies: [body("Sun", -10, 0, -26.7)],
      constellations: [],
    });
    expect(nautical).toMatch(/nautical twilight/);

    const astronomical = describeSky({
      observer: ANCHORAGE,
      timeUtc: MIDNIGHT_UTC,
      bodies: [body("Sun", -15, 0, -26.7)],
      constellations: [],
    });
    expect(astronomical).toMatch(/astronomical twilight/);
  });

  it("lists up to three named naked-eye planets above the horizon, brightest first", () => {
    const out = describeSky({
      observer: ANCHORAGE,
      timeUtc: MIDNIGHT_UTC,
      bodies: [
        body("Sun", -20, 90, -26.7),
        body("Jupiter", 45, 180, -2),
        body("Mars", 15, 90, 1),
        body("Saturn", 30, 270, 0.5),
        body("Venus", 5, 270, -4),
        body("Mercury", 3, 90, 0),
      ],
      constellations: [],
    });
    // Magnitude sort (ascending = brightest first) puts Venus (−4),
    // Jupiter (−2), Mercury (0) in the top three. Saturn (0.5) and
    // Mars (1) drop out.
    expect(out).toMatch(/Venus.*Jupiter.*Mercury/);
    expect(out).not.toContain("Mars is");
    expect(out).not.toContain("Saturn is");
  });

  it("skips below-horizon bodies and doesn't invent bright ones", () => {
    // With one below-horizon body and no visible constellations we fall
    // through to the single "nothing bright" fallback rather than
    // stringing two negatives together.
    const out = describeSky({
      observer: ANCHORAGE,
      timeUtc: MIDNIGHT_UTC,
      bodies: [body("Mars", -20, 90, 1)],
      constellations: [],
    });
    expect(out).toContain("Nothing bright is above the horizon");
    expect(out).not.toContain("Mars");
  });

  it("says 'None of the naked-eye planets' when constellations ARE visible but no bright body is", () => {
    const out = describeSky({
      observer: ANCHORAGE,
      timeUtc: MIDNIGHT_UTC,
      bodies: [],
      constellations: [constellation("UMa", "Ursa Major", 70, 0)],
    });
    expect(out).toContain("None of the naked-eye planets are above the horizon");
    expect(out).toContain("Ursa Major");
  });

  it("lists the highest three constellations by name", () => {
    const out = describeSky({
      observer: ANCHORAGE,
      timeUtc: MIDNIGHT_UTC,
      bodies: [],
      constellations: [
        constellation("UMa", "Ursa Major", 70, 0),
        constellation("Ori", "Orion", 40, 180),
        constellation("Sco", "Scorpius", 25, 200),
        constellation("Cyg", "Cygnus", 22, 90),
        constellation("Lyr", "Lyra", 10, 60), // below altitude threshold, excluded
      ],
    });
    expect(out).toContain("Well-placed constellations: Ursa Major, Orion, Scorpius");
    expect(out).not.toContain("Lyra");
    expect(out).not.toContain("Cygnus");
  });

  it("degrades gracefully to a 'nothing bright' sentence when everything is below the horizon", () => {
    const out = describeSky({
      observer: ANCHORAGE,
      timeUtc: MIDNIGHT_UTC,
      bodies: [],
      constellations: [],
    });
    expect(out).toContain("Nothing bright is above the horizon right now.");
  });
});
