/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { bootstrap } from "./app";

describe("bootstrap", () => {
  it("renders observer + time text into the root element", () => {
    const root = document.createElement("main");
    const params = new URLSearchParams({
      lat: "34.05",
      lon: "-118.25",
      t: "2026-04-15T03:30:00.000Z",
    });
    bootstrap(root, params);
    expect(root.textContent).toContain("34.05");
    expect(root.textContent).toContain("-118.25");
    expect(root.textContent).toContain("2026-04-15T03:30:00.000Z");
  });

  it("renders an error message when params are invalid", () => {
    const root = document.createElement("main");
    bootstrap(root, new URLSearchParams({ lat: "999" }));
    expect(root.textContent).toMatch(/lat-out-of-range/);
  });

  it("does nothing when root is null", () => {
    expect(() => bootstrap(null, new URLSearchParams())).not.toThrow();
  });

  it("uses default URLSearchParams when params arg is omitted", () => {
    const root = document.createElement("main");
    // In jsdom, location.search is "" by default, so it parses as default state
    bootstrap(root);
    expect(root.textContent).toContain("Planisphere");
  });
});
