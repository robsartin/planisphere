/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { collectionAt, collectionLength, setCollectionVisible } from "./cesium-collections";

describe("setCollectionVisible", () => {
  it("sets `.show` on the collection object", () => {
    const c: { show: boolean } = { show: false };
    setCollectionVisible(c, true);
    expect(c.show).toBe(true);
    setCollectionVisible(c, false);
    expect(c.show).toBe(false);
  });
});

describe("collectionLength", () => {
  it("returns the numeric `.length`", () => {
    expect(collectionLength({ length: 7 })).toBe(7);
    expect(collectionLength({ length: 0 })).toBe(0);
  });

  it("returns 0 when `.length` is missing or non-numeric", () => {
    expect(collectionLength({})).toBe(0);
    expect(collectionLength({ length: "x" })).toBe(0);
  });
});

describe("collectionAt", () => {
  it("delegates to the collection's `.get(i)` and returns the typed shape", () => {
    const c = {
      get(i: number): { id: number; color: { alpha: number } } {
        return { id: i, color: { alpha: i * 0.1 } };
      },
    };
    const row = collectionAt<{ id: number; color: { alpha: number } }>(c, 3);
    expect(row.id).toBe(3);
    expect(row.color.alpha).toBeCloseTo(0.3);
  });
});
