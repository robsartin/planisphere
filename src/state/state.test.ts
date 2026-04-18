/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { expectOk, isErr, isOk } from "../result";
import { DEFAULT_STATE, parseStateFromSearchParams, serializeStateToSearchParams } from "./state";

describe("AppState — defaults", () => {
  it("has observer at (0, 0) and a valid timeUtc", () => {
    expect(DEFAULT_STATE.observer.lat).toBe(0);
    expect(DEFAULT_STATE.observer.lon).toBe(0);
    expect(DEFAULT_STATE.timeUtc).toBeInstanceOf(Date);
    expect(Number.isFinite(DEFAULT_STATE.timeUtc.getTime())).toBe(true);
  });
});

describe("AppState — parse from URLSearchParams", () => {
  it("returns defaults when all params are absent", () => {
    const r = parseStateFromSearchParams(new URLSearchParams());
    expect(isOk(r)).toBe(true);
    const s = expectOk(r);
    expect(s.observer.lat).toBe(DEFAULT_STATE.observer.lat);
    expect(s.observer.lon).toBe(DEFAULT_STATE.observer.lon);
  });

  it("parses valid lat/lon/t", () => {
    const params = new URLSearchParams({
      lat: "37.7749",
      lon: "-122.4194",
      t: "2026-04-15T12:00:00.000Z",
    });
    const s = expectOk(parseStateFromSearchParams(params));
    expect(s.observer.lat).toBeCloseTo(37.7749, 4);
    expect(s.observer.lon).toBeCloseTo(-122.4194, 4);
    expect(s.timeUtc.toISOString()).toBe("2026-04-15T12:00:00.000Z");
  });

  it("returns Err for out-of-range latitude", () => {
    const r = parseStateFromSearchParams(new URLSearchParams({ lat: "95" }));
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("lat-out-of-range");
  });

  it("returns Err for out-of-range longitude", () => {
    const r = parseStateFromSearchParams(new URLSearchParams({ lon: "-200" }));
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("lon-out-of-range");
  });

  it("returns Err for non-numeric latitude", () => {
    const r = parseStateFromSearchParams(new URLSearchParams({ lat: "abc" }));
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("lat-not-a-number");
  });

  it("returns Err for invalid ISO timestamp", () => {
    const r = parseStateFromSearchParams(new URLSearchParams({ t: "not-a-date" }));
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("time-invalid");
  });
});

describe("AppState — serialize", () => {
  it("round-trips a known state", () => {
    const params = new URLSearchParams({
      lat: "10",
      lon: "20",
      t: "2030-01-01T00:00:00.000Z",
    });
    const s = expectOk(parseStateFromSearchParams(params));
    const out = serializeStateToSearchParams(s);
    const s2 = expectOk(parseStateFromSearchParams(out));
    expect(s2.observer.lat).toBe(s.observer.lat);
    expect(s2.observer.lon).toBe(s.observer.lon);
    expect(s2.timeUtc.toISOString()).toBe(s.timeUtc.toISOString());
  });
});

describe("LayerVisibility — defaults", () => {
  it("toggle layers visible by default (stars, planets, satellites, compass)", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams()));
    expect(s.layers.stars).toBe(true);
    expect(s.layers.planets).toBe(true);
    expect(s.layers.satellites).toBe(true);
    expect(s.layers.compass).toBe(true);
  });
});

describe("LayerVisibility — parse from URL", () => {
  it("parses subset of visible layers from 'layers' param", () => {
    const params = new URLSearchParams({ layers: "stars,planets,compass" });
    const s = expectOk(parseStateFromSearchParams(params));
    expect(s.layers.stars).toBe(true);
    expect(s.layers.planets).toBe(true);
    expect(s.layers.compass).toBe(true);
    expect(s.layers.satellites).toBe(false);
  });

  it("treats 'layers' param absence as all visible", () => {
    const params = new URLSearchParams({ lat: "10", lon: "20" });
    const s = expectOk(parseStateFromSearchParams(params));
    expect(s.layers.stars).toBe(true);
    expect(s.layers.satellites).toBe(true);
  });
});

describe("LayerOpacity — defaults", () => {
  it("constellation/satellite opacities default to 1.0", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams()));
    expect(s.opacity.constellationLines).toBe(1.0);
    expect(s.opacity.constellationBoundaries).toBe(1.0);
    expect(s.opacity.satelliteTrails).toBe(1.0);
  });

  it("raDecGrid defaults to 0.2 and ecliptic to 0.4", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams()));
    expect(s.opacity.raDecGrid).toBeCloseTo(0.2);
    expect(s.opacity.ecliptic).toBeCloseTo(0.4);
  });
});

describe("LayerOpacity — parse from URL", () => {
  it("parses opacity params op_cl, op_cb, op_st as 0–1 fractions", () => {
    const params = new URLSearchParams({ op_cl: "50", op_cb: "25", op_st: "75" });
    const s = expectOk(parseStateFromSearchParams(params));
    expect(s.opacity.constellationLines).toBeCloseTo(0.5);
    expect(s.opacity.constellationBoundaries).toBeCloseTo(0.25);
    expect(s.opacity.satelliteTrails).toBeCloseTo(0.75);
  });

  it("parses opacity params op_grid and op_ecl as 0–1 fractions", () => {
    const params = new URLSearchParams({ op_grid: "30", op_ecl: "60" });
    const s = expectOk(parseStateFromSearchParams(params));
    expect(s.opacity.raDecGrid).toBeCloseTo(0.3);
    expect(s.opacity.ecliptic).toBeCloseTo(0.6);
  });

  it("clamps opacity to [0, 1]", () => {
    const params = new URLSearchParams({ op_cl: "150", op_cb: "-10" });
    const s = expectOk(parseStateFromSearchParams(params));
    expect(s.opacity.constellationLines).toBe(1.0);
    expect(s.opacity.constellationBoundaries).toBe(0.0);
  });
});

describe("AppState — serialize round-trip with layer fields", () => {
  it("serialises and re-parses layers + opacity", () => {
    const params = new URLSearchParams({
      lat: "33",
      lon: "-117",
      t: "2026-06-01T00:00:00Z",
      layers: "stars,compass",
      op_cl: "60",
      op_cb: "30",
      op_st: "80",
      op_grid: "50",
      op_ecl: "70",
    });
    const s = expectOk(parseStateFromSearchParams(params));
    const out = serializeStateToSearchParams(s);
    const s2 = expectOk(parseStateFromSearchParams(out));
    expect(s2.layers.stars).toBe(true);
    expect(s2.layers.compass).toBe(true);
    expect(s2.layers.satellites).toBe(false);
    expect(s2.opacity.constellationLines).toBeCloseTo(0.6);
    expect(s2.opacity.constellationBoundaries).toBeCloseTo(0.3);
    expect(s2.opacity.satelliteTrails).toBeCloseTo(0.8);
    expect(s2.opacity.raDecGrid).toBeCloseTo(0.5);
    expect(s2.opacity.ecliptic).toBeCloseTo(0.7);
  });

  it("does not write op_grid and op_ecl when at defaults", () => {
    const params = new URLSearchParams({ lat: "33", lon: "-117", t: "2026-06-01T00:00:00Z" });
    const s = expectOk(parseStateFromSearchParams(params));
    const out = serializeStateToSearchParams(s);
    expect(out.has("op_grid")).toBe(false);
    expect(out.has("op_ecl")).toBe(false);
  });
});

describe("NightVision — URL round-trip", () => {
  it("defaults to false when nv param is absent", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams()));
    expect(s.nightVision).toBe(false);
  });

  it("parses nv=1 as nightVision true", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams({ nv: "1" })));
    expect(s.nightVision).toBe(true);
  });

  it("does not set nv when nightVision is false", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams()));
    const out = serializeStateToSearchParams(s);
    expect(out.has("nv")).toBe(false);
  });

  it("serializes nv=1 when nightVision is true", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams({ nv: "1" })));
    const out = serializeStateToSearchParams(s);
    expect(out.get("nv")).toBe("1");
  });

  it("round-trips nightVision=true through serialize/parse", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams({ nv: "1" })));
    const out = serializeStateToSearchParams(s);
    const s2 = expectOk(parseStateFromSearchParams(out));
    expect(s2.nightVision).toBe(true);
  });
});

describe("magLimit — defaults", () => {
  it("defaults to 6.0 when mag param is absent", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams()));
    expect(s.magLimit).toBe(6.0);
  });
});

describe("magLimit — parse from URL", () => {
  it("parses integer mag param", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams({ mag: "4" })));
    expect(s.magLimit).toBe(4.0);
  });

  it("parses decimal mag param", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams({ mag: "3.5" })));
    expect(s.magLimit).toBeCloseTo(3.5);
  });

  it("clamps mag below minimum to 1.0", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams({ mag: "0" })));
    expect(s.magLimit).toBe(1.0);
  });

  it("clamps mag above maximum to 6.0", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams({ mag: "9" })));
    expect(s.magLimit).toBe(6.0);
  });

  it("falls back to 6.0 for non-numeric mag", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams({ mag: "bright" })));
    expect(s.magLimit).toBe(6.0);
  });
});

describe("magLimit — serialize round-trip", () => {
  it("omits mag param when at default (6.0)", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams()));
    const out = serializeStateToSearchParams(s);
    expect(out.has("mag")).toBe(false);
  });

  it("writes mag param when not at default", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams({ mag: "4" })));
    const out = serializeStateToSearchParams(s);
    expect(out.get("mag")).toBe("4");
  });

  it("round-trips a non-default magLimit", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams({ mag: "2.5" })));
    const out = serializeStateToSearchParams(s);
    const s2 = expectOk(parseStateFromSearchParams(out));
    expect(s2.magLimit).toBeCloseTo(2.5);
  });
});

describe("language — defaults", () => {
  it("defaults to 'la' (Latin) when lang param is absent", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams()));
    expect(s.language).toBe("la");
  });

  it("DEFAULT_STATE.language is 'la'", () => {
    expect(DEFAULT_STATE.language).toBe("la");
  });
});

describe("language — parse from URL", () => {
  it("parses lang=en as English", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams({ lang: "en" })));
    expect(s.language).toBe("en");
  });

  it("parses lang=zh as Chinese", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams({ lang: "zh" })));
    expect(s.language).toBe("zh");
  });

  it("parses lang=ar as Arabic", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams({ lang: "ar" })));
    expect(s.language).toBe("ar");
  });

  it("parses lang=el as Greek", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams({ lang: "el" })));
    expect(s.language).toBe("el");
  });

  it("falls back to 'la' for unknown language code", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams({ lang: "xx" })));
    expect(s.language).toBe("la");
  });
});

describe("language — serialize round-trip", () => {
  it("omits lang param when at default ('la')", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams()));
    const out = serializeStateToSearchParams(s);
    expect(out.has("lang")).toBe(false);
  });

  it("writes lang param when not at default", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams({ lang: "en" })));
    const out = serializeStateToSearchParams(s);
    expect(out.get("lang")).toBe("en");
  });

  it("round-trips a non-default language", () => {
    const s = expectOk(parseStateFromSearchParams(new URLSearchParams({ lang: "zh" })));
    const out = serializeStateToSearchParams(s);
    const s2 = expectOk(parseStateFromSearchParams(out));
    expect(s2.language).toBe("zh");
  });
});
