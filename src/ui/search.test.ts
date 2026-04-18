/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSearch } from "./search";
import type { SearchResult } from "../astro/search";
import type { UIIntent } from "./index";

// Helper: build a minimal search result
function makeResult(
  name: string,
  type: SearchResult["type"],
  alt: number,
  az: number,
): SearchResult {
  return { name, type, alt, az, belowHorizon: alt <= 0 };
}

// Stub search function that returns a fixed list based on the query
function stubSearch(query: string): SearchResult[] {
  const all: SearchResult[] = [
    makeResult("Sirius", "star", 45, 120),
    makeResult("Orion", "constellation", 30, 200),
    makeResult("Mars", "body", -5, 50),
  ];
  const q = query.toLowerCase();
  if (q.length < 2) return [];
  return all.filter((r) => r.name.toLowerCase().includes(q));
}

describe("createSearch", () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let el: HTMLElement;

  beforeEach(() => {
    dispatch = vi.fn();
    el = createSearch(stubSearch, dispatch);
  });

  it("returns an HTMLElement", () => {
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it("contains an input with correct placeholder", () => {
    const input = el.querySelector<HTMLInputElement>("input[type='text']");
    expect(input).not.toBeNull();
    expect(input!.placeholder).toMatch(/search/i);
  });

  it("dropdown is hidden initially", () => {
    const dropdown = el.querySelector<HTMLElement>("[data-testid='search-dropdown']");
    expect(dropdown).not.toBeNull();
    // Initially not shown (display:none or empty)
    expect(dropdown!.style.display).toBe("none");
  });

  it("typing fewer than 2 chars keeps dropdown hidden", () => {
    const input = el.querySelector<HTMLInputElement>("input[type='text']")!;
    input.value = "S";
    input.dispatchEvent(new Event("input"));
    const dropdown = el.querySelector<HTMLElement>("[data-testid='search-dropdown']")!;
    expect(dropdown.style.display).toBe("none");
  });

  it("typing 2+ matching chars shows dropdown with results", () => {
    const input = el.querySelector<HTMLInputElement>("input[type='text']")!;
    input.value = "Si";
    input.dispatchEvent(new Event("input"));
    const dropdown = el.querySelector<HTMLElement>("[data-testid='search-dropdown']")!;
    expect(dropdown.style.display).not.toBe("none");
    const items = dropdown.querySelectorAll("[data-testid='search-result-item']");
    expect(items.length).toBe(1); // only "Sirius" matches
    expect(items[0]!.textContent).toContain("Sirius");
  });

  it("shows '(below horizon)' label for objects with alt <= 0", () => {
    const input = el.querySelector<HTMLInputElement>("input[type='text']")!;
    input.value = "Ma"; // matches "Mars" which has alt -5
    input.dispatchEvent(new Event("input"));
    const dropdown = el.querySelector<HTMLElement>("[data-testid='search-dropdown']")!;
    expect(dropdown.textContent).toContain("below horizon");
  });

  it("does not show '(below horizon)' label for visible objects", () => {
    const input = el.querySelector<HTMLInputElement>("input[type='text']")!;
    input.value = "Si"; // matches "Sirius" which has alt 45
    input.dispatchEvent(new Event("input"));
    const item = el.querySelector("[data-testid='search-result-item']")!;
    expect(item.textContent).not.toContain("below horizon");
  });

  it("clicking a result dispatches set-view with correct az/alt", () => {
    const input = el.querySelector<HTMLInputElement>("input[type='text']")!;
    input.value = "Si";
    input.dispatchEvent(new Event("input"));
    const item = el.querySelector<HTMLElement>("[data-testid='search-result-item']")!;
    item.click();
    expect(dispatch).toHaveBeenCalledOnce();
    const intent = dispatch.mock.calls[0]![0] as UIIntent;
    expect(intent.type).toBe("set-view");
    if (intent.type === "set-view") {
      expect(intent.az).toBeCloseTo(120);
      expect(intent.alt).toBeCloseTo(45);
    }
  });

  it("selecting a result clears the input and hides dropdown", () => {
    const input = el.querySelector<HTMLInputElement>("input[type='text']")!;
    input.value = "Si";
    input.dispatchEvent(new Event("input"));
    const item = el.querySelector<HTMLElement>("[data-testid='search-result-item']")!;
    item.click();
    expect(input.value).toBe("");
    const dropdown = el.querySelector<HTMLElement>("[data-testid='search-dropdown']")!;
    expect(dropdown.style.display).toBe("none");
  });

  it("empty query hides dropdown", () => {
    const input = el.querySelector<HTMLInputElement>("input[type='text']")!;
    // First show some results
    input.value = "Si";
    input.dispatchEvent(new Event("input"));
    // Now clear
    input.value = "";
    input.dispatchEvent(new Event("input"));
    const dropdown = el.querySelector<HTMLElement>("[data-testid='search-dropdown']")!;
    expect(dropdown.style.display).toBe("none");
  });

  it("shows type label for each result", () => {
    const input = el.querySelector<HTMLInputElement>("input[type='text']")!;
    input.value = "Or"; // matches "Orion" (constellation)
    input.dispatchEvent(new Event("input"));
    const item = el.querySelector("[data-testid='search-result-item']")!;
    expect(item.textContent).toContain("constellation");
  });
});
