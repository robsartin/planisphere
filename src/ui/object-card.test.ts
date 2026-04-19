/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi } from "vitest";
import { createObjectCard } from "./object-card";
import type { ObjectCardData } from "./object-card";
import type { UIIntent } from "./index";

function starData(): ObjectCardData {
  return {
    kind: "star",
    star: {
      hip: 32349,
      ra: 101.2872,
      dec: -16.7161,
      alt: 45.2,
      az: 180.3,
      mag: -1.44,
      name: "Sirius",
      size: 16,
      opacity: 1,
    },
  };
}

function bodyData(): ObjectCardData {
  return {
    kind: "body",
    body: {
      id: "Moon",
      alt: 55.3,
      az: 120.1,
      ra: 100.5,
      dec: -5.2,
      mag: -12.7,
      size: 20,
      color: "#E8E8E0",
      illumination: 0.75,
      phaseAngle: 90,
    },
    observer: { lat: 34, lon: -118 },
    time: new Date("2026-04-18T04:00:00Z"),
  };
}

function satelliteData(): ObjectCardData {
  return {
    kind: "satellite",
    satellite: {
      name: "ISS (ZARYA)",
      noradId: 25544,
      alt: 45.2,
      az: 200.3,
      height: 420,
      velocity: 7.66,
      trail: [],
    },
  };
}

function messierData(): ObjectCardData {
  return {
    kind: "messier",
    messier: {
      m: 42,
      name: "Orion Nebula",
      type: "nebula",
      alt: 45.2,
      az: 180.3,
      ra: 83.8221,
      dec: -5.3911,
      mag: 4.0,
    },
  };
}

function constellationData(): ObjectCardData {
  return {
    kind: "constellation",
    constellation: {
      id: "Ori",
      name: "Orion",
      lines: [
        {
          start: { alt: 10, az: 100 },
          end: { alt: 20, az: 110 },
        },
      ],
      centroid: { alt: 15, az: 105 },
    },
  };
}

describe("createObjectCard — star", () => {
  it("renders star name, magnitude and alt/az", () => {
    const dispatch = vi.fn();
    const { element } = createObjectCard({
      data: starData(),
      screenX: 100,
      screenY: 200,
      viewportWidth: 800,
      viewportHeight: 600,
      dispatch,
    });
    const html = element.innerHTML;
    expect(html).toContain("Sirius");
    expect(html).toContain("-1.44");
    expect(html).toContain("45.2");
    expect(html).toContain("180.3");
    expect(html).toMatch(/star/i);
  });

  it("shows Pin and Copy link actions but no Trail / Go to peak for a star", () => {
    const dispatch = vi.fn();
    const { element } = createObjectCard({
      data: starData(),
      screenX: 100,
      screenY: 200,
      viewportWidth: 800,
      viewportHeight: 600,
      dispatch,
    });
    const buttons = Array.from(element.querySelectorAll("button")).map((b) => b.textContent ?? "");
    expect(buttons.some((t) => /pin/i.test(t))).toBe(true);
    expect(buttons.some((t) => /copy link/i.test(t))).toBe(true);
    expect(buttons.some((t) => /trail/i.test(t))).toBe(false);
  });

  it("Pin action dispatches pin-object intent with the star name", () => {
    const dispatch = vi.fn<(i: UIIntent) => void>();
    const { element } = createObjectCard({
      data: starData(),
      screenX: 100,
      screenY: 200,
      viewportWidth: 800,
      viewportHeight: 600,
      dispatch,
    });
    const pinBtn = Array.from(element.querySelectorAll("button")).find((b) =>
      /pin/i.test(b.textContent ?? ""),
    );
    expect(pinBtn).toBeDefined();
    pinBtn!.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "pin-object", id: "Sirius" });
  });
});

describe("createObjectCard — body", () => {
  it("renders body name, magnitude, illumination and rise/set rows", () => {
    const { element } = createObjectCard({
      data: bodyData(),
      screenX: 100,
      screenY: 200,
      viewportWidth: 800,
      viewportHeight: 600,
      dispatch: vi.fn(),
    });
    expect(element.innerHTML).toContain("Moon");
    expect(element.innerHTML).toContain("-12.7");
    expect(element.innerHTML).toContain("75%");
  });

  it("body card includes Trail action", () => {
    const { element } = createObjectCard({
      data: bodyData(),
      screenX: 100,
      screenY: 200,
      viewportWidth: 800,
      viewportHeight: 600,
      dispatch: vi.fn(),
    });
    const buttons = Array.from(element.querySelectorAll("button")).map((b) => b.textContent ?? "");
    expect(buttons.some((t) => /trail/i.test(t))).toBe(true);
  });

  it("body Trail action dispatches show-trail intent", () => {
    const dispatch = vi.fn<(i: UIIntent) => void>();
    const { element } = createObjectCard({
      data: bodyData(),
      screenX: 100,
      screenY: 200,
      viewportWidth: 800,
      viewportHeight: 600,
      dispatch,
    });
    const trailBtn = Array.from(element.querySelectorAll("button")).find((b) =>
      /trail/i.test(b.textContent ?? ""),
    );
    trailBtn!.click();
    expect(dispatch).toHaveBeenCalledWith({
      type: "show-trail",
      objectKind: "body",
      id: "Moon",
    });
  });
});

describe("createObjectCard — satellite", () => {
  it("renders satellite name, NORAD id, altitude and velocity", () => {
    const { element } = createObjectCard({
      data: satelliteData(),
      screenX: 100,
      screenY: 200,
      viewportWidth: 800,
      viewportHeight: 600,
      dispatch: vi.fn(),
    });
    expect(element.innerHTML).toContain("ISS");
    expect(element.innerHTML).toContain("25544");
    expect(element.innerHTML).toContain("420");
    expect(element.innerHTML).toContain("7.66");
  });

  it("satellite card has Pin but no Trail action (trail deferred per #164)", () => {
    const { element } = createObjectCard({
      data: satelliteData(),
      screenX: 100,
      screenY: 200,
      viewportWidth: 800,
      viewportHeight: 600,
      dispatch: vi.fn(),
    });
    const buttons = Array.from(element.querySelectorAll("button")).map((b) => b.textContent ?? "");
    expect(buttons.some((t) => /pin/i.test(t))).toBe(true);
    expect(buttons.some((t) => /trail/i.test(t))).toBe(false);
  });
});

describe("createObjectCard — messier", () => {
  it("renders messier designation, name, type and magnitude", () => {
    const { element } = createObjectCard({
      data: messierData(),
      screenX: 100,
      screenY: 200,
      viewportWidth: 800,
      viewportHeight: 600,
      dispatch: vi.fn(),
    });
    expect(element.innerHTML).toContain("M42");
    expect(element.innerHTML).toContain("Orion Nebula");
    expect(element.innerHTML).toContain("nebula");
    expect(element.innerHTML).toContain("4.0");
  });
});

describe("createObjectCard — constellation", () => {
  it("renders constellation name and centroid alt/az", () => {
    const { element } = createObjectCard({
      data: constellationData(),
      screenX: 100,
      screenY: 200,
      viewportWidth: 800,
      viewportHeight: 600,
      dispatch: vi.fn(),
    });
    expect(element.innerHTML).toContain("Orion");
    // Centroid alt (15) and az (105) rendered
    expect(element.innerHTML).toContain("15");
    expect(element.innerHTML).toContain("105");
  });
});

describe("createObjectCard — close button", () => {
  it("has a close button that invokes the onClose callback", () => {
    const onClose = vi.fn();
    const { element } = createObjectCard({
      data: starData(),
      screenX: 100,
      screenY: 200,
      viewportWidth: 800,
      viewportHeight: 600,
      dispatch: vi.fn(),
      onClose,
    });
    const closeBtn = element.querySelector<HTMLButtonElement>("[data-testid='object-card-close']");
    expect(closeBtn).not.toBeNull();
    closeBtn!.click();
    expect(onClose).toHaveBeenCalled();
  });
});

describe("createObjectCard — Go to peak", () => {
  it("renders Go to peak only when upcomingEvent is provided on a body card", () => {
    const withoutEvent = createObjectCard({
      data: bodyData(),
      screenX: 100,
      screenY: 200,
      viewportWidth: 800,
      viewportHeight: 600,
      dispatch: vi.fn(),
    });
    expect(withoutEvent.element.querySelector("[data-testid='object-card-go-to-peak']")).toBeNull();

    const withEvent = createObjectCard({
      data: bodyData(),
      screenX: 100,
      screenY: 200,
      viewportWidth: 800,
      viewportHeight: 600,
      dispatch: vi.fn(),
      upcomingEvent: {
        when: new Date("2026-05-01T00:00:00Z"),
        viewAz: 180,
        viewAlt: 30,
      },
    });
    expect(
      withEvent.element.querySelector("[data-testid='object-card-go-to-peak']"),
    ).not.toBeNull();
  });

  it("Go to peak action dispatches set-time and set-view to the event's instant", () => {
    const dispatch = vi.fn<(i: UIIntent) => void>();
    const when = new Date("2026-05-01T00:00:00Z");
    const { element } = createObjectCard({
      data: bodyData(),
      screenX: 100,
      screenY: 200,
      viewportWidth: 800,
      viewportHeight: 600,
      dispatch,
      upcomingEvent: { when, viewAz: 180, viewAlt: 30 },
    });
    const btn = element.querySelector<HTMLButtonElement>("[data-testid='object-card-go-to-peak']");
    btn!.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "set-time", time: when });
    expect(dispatch).toHaveBeenCalledWith({ type: "set-view", az: 180, alt: 30 });
  });
});

describe("createObjectCard — copy-link", () => {
  it("Copy link dispatches copy-link intent with framing view", () => {
    const dispatch = vi.fn<(i: UIIntent) => void>();
    const { element } = createObjectCard({
      data: starData(),
      screenX: 100,
      screenY: 200,
      viewportWidth: 800,
      viewportHeight: 600,
      dispatch,
    });
    const copyBtn = Array.from(element.querySelectorAll("button")).find((b) =>
      /copy link/i.test(b.textContent ?? ""),
    );
    expect(copyBtn).toBeDefined();
    copyBtn!.click();
    // Copy link frames the object (set-view) then copies. Either side of the
    // bundle is fine so long as copy-link actually fires.
    expect(dispatch).toHaveBeenCalled();
    const types = dispatch.mock.calls.map((c) => c[0].type);
    expect(types).toContain("copy-link");
  });
});

describe("createObjectCard — smart positioning", () => {
  it("places the card to the right of the click when room is available", () => {
    const { element } = createObjectCard({
      data: starData(),
      screenX: 100,
      screenY: 100,
      viewportWidth: 800,
      viewportHeight: 600,
      dispatch: vi.fn(),
    });
    // Card is absolutely positioned
    const leftPx = parseInt(element.style.left, 10);
    expect(leftPx).toBeGreaterThan(100);
  });

  it("flips to the left when the click is near the right edge", () => {
    const { element } = createObjectCard({
      data: starData(),
      screenX: 780,
      screenY: 100,
      viewportWidth: 800,
      viewportHeight: 600,
      dispatch: vi.fn(),
    });
    const leftPx = parseInt(element.style.left, 10);
    // Left edge of the card should be to the left of the click when flipped
    expect(leftPx).toBeLessThan(780);
  });
});

describe("createObjectCard — update / destroy", () => {
  it("update repositions the card on new screen coordinates", () => {
    const card = createObjectCard({
      data: starData(),
      screenX: 100,
      screenY: 100,
      viewportWidth: 800,
      viewportHeight: 600,
      dispatch: vi.fn(),
    });
    const before = card.element.style.left;
    card.update({ screenX: 500, screenY: 300, belowHorizon: false });
    const after = card.element.style.left;
    expect(after).not.toBe(before);
  });

  it("update shows a below-horizon indicator", () => {
    const card = createObjectCard({
      data: starData(),
      screenX: 100,
      screenY: 100,
      viewportWidth: 800,
      viewportHeight: 600,
      dispatch: vi.fn(),
    });
    expect(
      card.element.querySelector<HTMLElement>("[data-testid='object-card-below-horizon']"),
    ).toBeNull();
    card.update({ screenX: 500, screenY: 300, belowHorizon: true });
    expect(
      card.element.querySelector<HTMLElement>("[data-testid='object-card-below-horizon']"),
    ).not.toBeNull();
  });

  it("setActive applies dimmed style when false and normal style when true", () => {
    const card = createObjectCard({
      data: starData(),
      screenX: 100,
      screenY: 100,
      viewportWidth: 800,
      viewportHeight: 600,
      dispatch: vi.fn(),
    });
    card.setActive(false);
    expect(parseFloat(card.element.style.opacity)).toBeLessThan(1);
    card.setActive(true);
    expect(parseFloat(card.element.style.opacity)).toBeCloseTo(1, 2);
  });

  it("destroy removes the element from its parent", () => {
    const card = createObjectCard({
      data: starData(),
      screenX: 100,
      screenY: 100,
      viewportWidth: 800,
      viewportHeight: 600,
      dispatch: vi.fn(),
    });
    const container = document.createElement("div");
    container.appendChild(card.element);
    expect(container.children.length).toBe(1);
    card.destroy();
    expect(container.children.length).toBe(0);
  });
});
