/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { err, isErr, isOk, ok } from "./result";
import { map } from "./result";
import { flatMap, mapErr, unwrapOr } from "./result";
import { expectOk } from "./result";

describe("Result — construction and narrowing", () => {
  it("ok() wraps a value and isOk narrows it", () => {
    const r = ok(42);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    if (isOk(r)) {
      expect(r.value).toBe(42);
    }
  });

  it("err() wraps an error and isErr narrows it", () => {
    const r = err({ kind: "boom" } as const);
    expect(isErr(r)).toBe(true);
    expect(isOk(r)).toBe(false);
    if (isErr(r)) {
      expect(r.error.kind).toBe("boom");
    }
  });
});

describe("Result — map", () => {
  it("transforms an Ok value", () => {
    const r = map(ok(2), (n) => n * 3);
    expect(r).toEqual({ ok: true, value: 6 });
  });

  it("passes Err through unchanged", () => {
    const r = map(err("bad" as const), (n: number) => n * 3);
    expect(r).toEqual({ ok: false, error: "bad" });
  });
});

describe("Result — mapErr", () => {
  it("transforms an Err", () => {
    const r = mapErr(err("low" as const), (s) => s.toUpperCase());
    expect(r).toEqual({ ok: false, error: "LOW" });
  });

  it("passes Ok through unchanged", () => {
    const r = mapErr(ok(5), (s: string) => s.toUpperCase());
    expect(r).toEqual({ ok: true, value: 5 });
  });
});

describe("Result — flatMap", () => {
  it("chains Ok into another Result", () => {
    const parse = (s: string) => (/^\d+$/.test(s) ? ok(Number(s)) : err("nope" as const));
    const r = flatMap(ok("42"), parse);
    expect(r).toEqual({ ok: true, value: 42 });
  });

  it("short-circuits on Err", () => {
    const parse = (s: string) => ok(Number(s));
    const r = flatMap(err("bad" as const), parse);
    expect(r).toEqual({ ok: false, error: "bad" });
  });

  it("propagates downstream Err", () => {
    const parse = (_: string) => err("downstream" as const);
    const r = flatMap(ok("x"), parse);
    expect(r).toEqual({ ok: false, error: "downstream" });
  });
});

describe("Result — unwrapOr", () => {
  it("returns value for Ok", () => {
    expect(unwrapOr(ok(7), 0)).toBe(7);
  });

  it("returns fallback for Err", () => {
    expect(unwrapOr(err("bad"), 0)).toBe(0);
  });
});

describe("Result — expectOk", () => {
  it("returns value when Ok", () => {
    expect(expectOk(ok(9))).toBe(9);
  });

  it("throws a descriptive error when Err", () => {
    expect(() => expectOk(err({ kind: "nope" }))).toThrow(/expectOk/);
  });
});
