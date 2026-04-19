/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createObjectCardsManager } from "./object-cards-manager";
import type { ObjectCardData } from "./object-card";

function starData(name = "Sirius", alt = 45, az = 180): ObjectCardData {
  return {
    kind: "star",
    star: {
      hip: 32349,
      ra: 101.2872,
      dec: -16.7161,
      alt,
      az,
      mag: -1.44,
      name,
      size: 16,
      opacity: 1,
    },
  };
}

function bodyData(id = "Mars", alt = 30, az = 100): ObjectCardData {
  return {
    kind: "body",
    body: {
      id,
      alt,
      az,
      ra: 50,
      dec: 20,
      mag: 1,
      size: 10,
      color: "#CC4422",
    },
  };
}

describe("createObjectCardsManager", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("open creates a card element inside the container", () => {
    const mgr = createObjectCardsManager({
      container,
      dispatch: vi.fn(),
      projector: () => ({ x: 100, y: 100, onScreen: true }),
      resolver: () => ({ alt: 45, az: 180, belowHorizon: false }),
      getViewport: () => ({ width: 800, height: 600 }),
    });
    mgr.open({ data: starData("Sirius"), screenX: 200, screenY: 200 });
    expect(container.querySelectorAll("[data-testid='object-card']").length).toBe(1);
  });

  it("opening twice with the same id/kind moves the existing card instead of duplicating", () => {
    const mgr = createObjectCardsManager({
      container,
      dispatch: vi.fn(),
      projector: () => ({ x: 100, y: 100, onScreen: true }),
      resolver: () => ({ alt: 45, az: 180, belowHorizon: false }),
      getViewport: () => ({ width: 800, height: 600 }),
    });
    mgr.open({ data: starData("Sirius"), screenX: 100, screenY: 100 });
    mgr.open({ data: starData("Sirius"), screenX: 300, screenY: 300 });
    expect(container.querySelectorAll("[data-testid='object-card']").length).toBe(1);
  });

  it("open adds multiple cards when ids differ", () => {
    const mgr = createObjectCardsManager({
      container,
      dispatch: vi.fn(),
      projector: () => ({ x: 100, y: 100, onScreen: true }),
      resolver: () => ({ alt: 45, az: 180, belowHorizon: false }),
      getViewport: () => ({ width: 800, height: 600 }),
    });
    mgr.open({ data: starData("Sirius"), screenX: 100, screenY: 100 });
    mgr.open({ data: starData("Vega"), screenX: 200, screenY: 200 });
    mgr.open({ data: bodyData("Mars"), screenX: 300, screenY: 300 });
    expect(container.querySelectorAll("[data-testid='object-card']").length).toBe(3);
  });

  it("closeActive removes the most recent card", () => {
    const mgr = createObjectCardsManager({
      container,
      dispatch: vi.fn(),
      projector: () => ({ x: 100, y: 100, onScreen: true }),
      resolver: () => ({ alt: 45, az: 180, belowHorizon: false }),
      getViewport: () => ({ width: 800, height: 600 }),
    });
    mgr.open({ data: starData("Sirius"), screenX: 100, screenY: 100 });
    mgr.open({ data: starData("Vega"), screenX: 200, screenY: 200 });
    expect(container.querySelectorAll("[data-testid='object-card']").length).toBe(2);
    mgr.closeActive();
    expect(container.querySelectorAll("[data-testid='object-card']").length).toBe(1);
  });

  it("close-by-id removes the specified card", () => {
    const mgr = createObjectCardsManager({
      container,
      dispatch: vi.fn(),
      projector: () => ({ x: 100, y: 100, onScreen: true }),
      resolver: () => ({ alt: 45, az: 180, belowHorizon: false }),
      getViewport: () => ({ width: 800, height: 600 }),
    });
    mgr.open({ data: starData("Sirius"), screenX: 100, screenY: 100 });
    mgr.open({ data: starData("Vega"), screenX: 200, screenY: 200 });
    mgr.close({ objectKind: "star", id: "Sirius" });
    const remaining = Array.from(
      container.querySelectorAll<HTMLElement>("[data-testid='object-card-title']"),
    ).map((el) => el.textContent);
    expect(remaining).toContain("Vega");
    expect(remaining).not.toContain("Sirius");
  });

  it("escape key closes the active card", () => {
    const mgr = createObjectCardsManager({
      container,
      dispatch: vi.fn(),
      projector: () => ({ x: 100, y: 100, onScreen: true }),
      resolver: () => ({ alt: 45, az: 180, belowHorizon: false }),
      getViewport: () => ({ width: 800, height: 600 }),
    });
    mgr.open({ data: starData("Sirius"), screenX: 100, screenY: 100 });
    mgr.open({ data: starData("Vega"), screenX: 200, screenY: 200 });
    const event = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(event);
    expect(container.querySelectorAll("[data-testid='object-card']").length).toBe(1);
    mgr.destroy();
  });

  it("most recently interacted card is marked active; previous cards are dimmed", () => {
    const mgr = createObjectCardsManager({
      container,
      dispatch: vi.fn(),
      projector: () => ({ x: 100, y: 100, onScreen: true }),
      resolver: () => ({ alt: 45, az: 180, belowHorizon: false }),
      getViewport: () => ({ width: 800, height: 600 }),
    });
    mgr.open({ data: starData("Sirius"), screenX: 100, screenY: 100 });
    mgr.open({ data: starData("Vega"), screenX: 200, screenY: 200 });
    const cards = container.querySelectorAll<HTMLElement>("[data-testid='object-card']");
    // Sirius (first) should be dimmed; Vega (second, active) should be bright
    const opacitiesByTitle = new Map<string, number>();
    for (const c of cards) {
      const title = c.querySelector<HTMLElement>("[data-testid='object-card-title']");
      opacitiesByTitle.set(title?.textContent ?? "", parseFloat(c.style.opacity));
    }
    expect(opacitiesByTitle.get("Sirius")).toBeLessThan(1);
    expect(opacitiesByTitle.get("Vega") ?? 0).toBeCloseTo(1, 2);
  });

  it("update() reprojects positions using the resolver and projector", () => {
    let projCall = 0;
    const mgr = createObjectCardsManager({
      container,
      dispatch: vi.fn(),
      projector: () => {
        projCall++;
        return { x: 400 + projCall, y: 400, onScreen: true };
      },
      resolver: () => ({ alt: 45, az: 180, belowHorizon: false }),
      getViewport: () => ({ width: 800, height: 600 }),
    });
    mgr.open({ data: starData("Sirius"), screenX: 100, screenY: 100 });
    const first = container.querySelector<HTMLElement>("[data-testid='object-card']")!;
    const leftBefore = first.style.left;
    mgr.update();
    const leftAfter = first.style.left;
    expect(leftAfter).not.toBe(leftBefore);
  });

  it("update() marks a card below horizon when the resolver reports so", () => {
    const mgr = createObjectCardsManager({
      container,
      dispatch: vi.fn(),
      projector: () => ({ x: 200, y: 200, onScreen: true }),
      resolver: () => ({ alt: -5, az: 180, belowHorizon: true }),
      getViewport: () => ({ width: 800, height: 600 }),
    });
    mgr.open({ data: starData("Sirius"), screenX: 100, screenY: 100 });
    mgr.update();
    expect(
      container.querySelector<HTMLElement>("[data-testid='object-card-below-horizon']"),
    ).not.toBeNull();
  });

  it("update() removes a card when the resolver reports the object has gone away", () => {
    // Simulate the case where the pinned object is no longer in the scene
    // (e.g. a satellite that left the visible set). The card should stay open
    // showing a below-horizon / unavailable state rather than throwing.
    const mgr = createObjectCardsManager({
      container,
      dispatch: vi.fn(),
      projector: () => ({ x: 200, y: 200, onScreen: true }),
      resolver: () => null,
      getViewport: () => ({ width: 800, height: 600 }),
    });
    mgr.open({ data: starData("Sirius"), screenX: 100, screenY: 100 });
    expect(() => {
      mgr.update();
    }).not.toThrow();
    expect(
      container.querySelector<HTMLElement>("[data-testid='object-card-below-horizon']"),
    ).not.toBeNull();
  });

  it("destroy removes all cards and unbinds listeners", () => {
    const mgr = createObjectCardsManager({
      container,
      dispatch: vi.fn(),
      projector: () => ({ x: 100, y: 100, onScreen: true }),
      resolver: () => ({ alt: 45, az: 180, belowHorizon: false }),
      getViewport: () => ({ width: 800, height: 600 }),
    });
    mgr.open({ data: starData("Sirius"), screenX: 100, screenY: 100 });
    mgr.destroy();
    expect(container.querySelectorAll("[data-testid='object-card']").length).toBe(0);
    // After destroy, Escape should NOT close anything (no active card exists)
    const event = new KeyboardEvent("keydown", { key: "Escape" });
    expect(() => document.dispatchEvent(event)).not.toThrow();
  });
});
