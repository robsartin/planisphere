/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi } from "vitest";
import { createEventsPanel } from "./events-panel";
import type { CelestialEvent } from "../astro/events";

function makeConjunction(when: Date): CelestialEvent {
  return {
    kind: "conjunction",
    when,
    title: "Venus – Mars conjunction",
    description: "Venus and Mars appear within 1.2° of each other.",
    body1: "Venus",
    body2: "Mars",
    separationDeg: 1.2,
  };
}

function makeEclipse(when: Date): CelestialEvent {
  return {
    kind: "lunar-eclipse",
    when,
    title: "Lunar eclipse (partial)",
    description: "Partial lunar eclipse; peak obscuration 65%.",
    eclipseKind: "partial",
    obscuration: 0.65,
  };
}

function makeShower(when: Date): CelestialEvent {
  return {
    kind: "meteor-shower-peak",
    when,
    title: "Perseids meteor shower peak",
    description: "Expect up to ~100 meteors per hour at peak under dark skies.",
    showerId: "perseids",
    showerName: "Perseids",
    zhr: 100,
  };
}

function makeIssPass(when: Date): CelestialEvent {
  return {
    kind: "iss-pass",
    when,
    title: "ISS pass — mag -1.8, peaks at 43°",
    description: "Peaks 43° in the SSE at 21:34 local, sets 21:38 local (4 min pass).",
    peakAltDeg: 43,
    peakAzDeg: 157,
    durationSec: 240,
    eclipsed: false,
    magnitudeAtPeak: -1.8,
  };
}

function makeEclipsedIssPass(when: Date): CelestialEvent {
  return {
    kind: "iss-pass",
    when,
    title: "ISS pass — in Earth's shadow (22° peak)",
    description:
      "Peaks 22° in the N at 02:14 local, sets 02:18 local (4 min pass). Satellite is in Earth's shadow at peak — not visible.",
    peakAltDeg: 22,
    peakAzDeg: 0,
    durationSec: 240,
    eclipsed: true,
    magnitudeAtPeak: null,
  };
}

describe("createEventsPanel — Go-to dispatches view aim for any event with view data", () => {
  it("conjunction with view fields → dispatches set-view with its az/alt", () => {
    const dispatch = vi.fn();
    const when = new Date("2026-06-10T10:00:00Z");
    const conjEvent: CelestialEvent = {
      kind: "conjunction",
      when,
      title: "Venus – Mars conjunction",
      description: "within 1°",
      body1: "Venus",
      body2: "Mars",
      separationDeg: 1,
      viewAz: 123,
      viewAlt: 45,
    };
    const el = createEventsPanel([conjEvent], dispatch);
    const btn = el.querySelector<HTMLButtonElement>("[data-testid='event-goto']")!;
    btn.click();
    const calls = dispatch.mock.calls.map((c) => c[0] as { type: string });
    expect(calls.some((c) => c.type === "set-time")).toBe(true);
    const view = calls.find((c) => c.type === "set-view") as
      { type: "set-view"; az: number; alt: number } | undefined;
    expect(view).toBeDefined();
    expect(view?.az).toBe(123);
    expect(view?.alt).toBe(45);
  });

  it("lunar eclipse with view fields → dispatches set-view with Moon az/alt", () => {
    const dispatch = vi.fn();
    const when = new Date("2026-07-20T18:00:00Z");
    const eclipseEvent: CelestialEvent = {
      kind: "lunar-eclipse",
      when,
      title: "Lunar eclipse (total)",
      description: "100% obscuration",
      eclipseKind: "total",
      obscuration: 1,
      viewAz: 210,
      viewAlt: 30,
    };
    const el = createEventsPanel([eclipseEvent], dispatch);
    const btn = el.querySelector<HTMLButtonElement>("[data-testid='event-goto']")!;
    btn.click();
    const calls = dispatch.mock.calls.map((c) => c[0] as { type: string });
    const view = calls.find((c) => c.type === "set-view") as
      { type: "set-view"; az: number; alt: number } | undefined;
    expect(view).toBeDefined();
    expect(view?.az).toBe(210);
    expect(view?.alt).toBe(30);
  });

  it("meteor shower with view fields → dispatches set-view with radiant az/alt", () => {
    const dispatch = vi.fn();
    const when = new Date("2026-08-12T09:00:00Z");
    const showerEvent: CelestialEvent = {
      kind: "meteor-shower-peak",
      when,
      title: "Perseids meteor shower peak",
      description: "~100/hr",
      showerId: "perseids",
      showerName: "Perseids",
      zhr: 100,
      viewAz: 50,
      viewAlt: 60,
    };
    const el = createEventsPanel([showerEvent], dispatch);
    const btn = el.querySelector<HTMLButtonElement>("[data-testid='event-goto']")!;
    btn.click();
    const calls = dispatch.mock.calls.map((c) => c[0] as { type: string });
    const view = calls.find((c) => c.type === "set-view") as
      { type: "set-view"; az: number; alt: number } | undefined;
    expect(view).toBeDefined();
    expect(view?.az).toBe(50);
    expect(view?.alt).toBe(60);
  });
});

describe("createEventsPanel — ISS Go-to dispatches view aim", () => {
  it("on 'Go to' for an ISS pass, dispatches set-time AND set-view to peak az/alt so the camera points at the ISS", () => {
    const dispatch = vi.fn();
    const when = new Date("2026-06-10T10:00:00Z");
    const issEvent = makeIssPass(when);
    const el = createEventsPanel([issEvent], dispatch);
    const btn = el.querySelector<HTMLButtonElement>("[data-testid='event-goto']")!;
    btn.click();
    const calls = dispatch.mock.calls.map((c) => c[0] as { type: string });
    const hasSetTime = calls.some((c) => c.type === "set-time");
    const hasSetView = calls.some((c) => c.type === "set-view");
    expect(hasSetTime).toBe(true);
    expect(hasSetView).toBe(true);
    const viewIntent = calls.find((c) => c.type === "set-view") as
      { type: "set-view"; az: number; alt: number } | undefined;
    expect(viewIntent?.az).toBe(157);
    expect(viewIntent?.alt).toBe(43);
  });

  it("on 'Go to' for a non-ISS event, only dispatches set-time (no set-view)", () => {
    const dispatch = vi.fn();
    const when = new Date("2026-06-10T10:00:00Z");
    const conjEvent: CelestialEvent = {
      kind: "conjunction",
      when,
      title: "Moon — Venus conjunction",
      description: "within 2°",
      body1: "Moon",
      body2: "Venus",
      separationDeg: 2,
    };
    const el = createEventsPanel([conjEvent], dispatch);
    const btn = el.querySelector<HTMLButtonElement>("[data-testid='event-goto']")!;
    btn.click();
    const calls = dispatch.mock.calls.map((c) => c[0] as { type: string });
    expect(calls.some((c) => c.type === "set-time")).toBe(true);
    expect(calls.some((c) => c.type === "set-view")).toBe(false);
  });
});

describe("createEventsPanel", () => {
  it("returns an HTMLElement", () => {
    const el = createEventsPanel([], vi.fn());
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it("renders a section heading", () => {
    const el = createEventsPanel([], vi.fn());
    const heading = el.querySelector("[data-testid='events-heading']");
    expect(heading).not.toBeNull();
  });

  it("shows 'no upcoming events' when list is empty", () => {
    const el = createEventsPanel([], vi.fn());
    const empty = el.querySelector("[data-testid='events-empty']");
    expect(empty).not.toBeNull();
  });

  it("renders a row per event", () => {
    const events = [
      makeConjunction(new Date("2026-06-10T10:00:00Z")),
      makeEclipse(new Date("2026-07-20T18:00:00Z")),
      makeShower(new Date("2026-08-12T06:00:00Z")),
    ];
    const el = createEventsPanel(events, vi.fn());
    const rows = el.querySelectorAll("[data-testid='event-row']");
    expect(rows.length).toBe(3);
  });

  it("each row shows the event title", () => {
    const events = [
      makeConjunction(new Date("2026-06-10T10:00:00Z")),
      makeShower(new Date("2026-08-12T06:00:00Z")),
    ];
    const el = createEventsPanel(events, vi.fn());
    const titles = [...el.querySelectorAll("[data-testid='event-title']")].map(
      (n) => n.textContent,
    );
    expect(titles.some((t) => t?.includes("Venus"))).toBe(true);
    expect(titles.some((t) => t?.includes("Perseids"))).toBe(true);
  });

  it("each row shows a formatted date", () => {
    const events = [makeEclipse(new Date("2026-07-20T18:00:00Z"))];
    const el = createEventsPanel(events, vi.fn());
    const date = el.querySelector("[data-testid='event-date']");
    expect(date).not.toBeNull();
    expect(date!.textContent).toMatch(/2026/);
  });

  it("renders a 'Go to' button per row", () => {
    const events = [
      makeConjunction(new Date("2026-06-10T10:00:00Z")),
      makeEclipse(new Date("2026-07-20T18:00:00Z")),
    ];
    const el = createEventsPanel(events, vi.fn());
    const btns = el.querySelectorAll("[data-testid='event-goto']");
    expect(btns.length).toBe(2);
  });

  it("'Go to' button dispatches set-time intent with the event's time", () => {
    const dispatch = vi.fn();
    const when = new Date("2026-06-10T10:00:00Z");
    const events = [makeConjunction(when)];
    const el = createEventsPanel(events, dispatch);
    const btn = el.querySelector<HTMLButtonElement>("[data-testid='event-goto']")!;
    btn.click();
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith({ type: "set-time", time: when });
  });

  it("renders ISS pass events with title and description", () => {
    const events = [makeIssPass(new Date("2024-04-10T04:00:00Z"))];
    const el = createEventsPanel(events, vi.fn());
    const title = el.querySelector("[data-testid='event-title']");
    const desc = el.querySelector("[data-testid='event-description']");
    expect(title).not.toBeNull();
    expect(title!.textContent).toMatch(/ISS/);
    expect(desc).not.toBeNull();
    expect(desc!.textContent).toMatch(/min pass/);
  });

  it("'Go to' on an ISS pass dispatches set-time with rise time", () => {
    const dispatch = vi.fn();
    const when = new Date("2024-04-10T04:00:00Z");
    const el = createEventsPanel([makeIssPass(when)], dispatch);
    const btn = el.querySelector<HTMLButtonElement>("[data-testid='event-goto']")!;
    btn.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "set-time", time: when });
  });

  it("renders eclipsed ISS passes at reduced opacity so users can see they exist but won't try to watch", () => {
    const events = [makeEclipsedIssPass(new Date("2024-04-10T02:14:00Z"))];
    const el = createEventsPanel(events, vi.fn());
    const row = el.querySelector<HTMLElement>("[data-testid='event-row']")!;
    expect(row).not.toBeNull();
    // Expect a reduced opacity — anything < 1 signals "greyed out".
    const opacityStr = row.style.opacity;
    expect(opacityStr).not.toBe("");
    const opacity = parseFloat(opacityStr);
    expect(opacity).toBeLessThan(1);
    expect(opacity).toBeGreaterThan(0);
  });

  it("renders lit (non-eclipsed) ISS passes at full opacity", () => {
    const events = [makeIssPass(new Date("2024-04-10T04:00:00Z"))];
    const el = createEventsPanel(events, vi.fn());
    const row = el.querySelector<HTMLElement>("[data-testid='event-row']")!;
    // Empty opacity string (browser default = 1) is acceptable; a value of exactly "1" also.
    const opacityStr = row.style.opacity;
    if (opacityStr !== "") {
      expect(parseFloat(opacityStr)).toBe(1);
    }
  });

  it("is collapsible via a toggle", () => {
    const events = [makeConjunction(new Date("2026-06-10T10:00:00Z"))];
    const el = createEventsPanel(events, vi.fn());
    const toggle = el.querySelector<HTMLButtonElement>("[data-testid='events-toggle']")!;
    const body = el.querySelector<HTMLElement>("[data-testid='events-body']")!;
    expect(body.style.display).not.toBe("none");
    toggle.click();
    expect(body.style.display).toBe("none");
    toggle.click();
    expect(body.style.display).not.toBe("none");
  });
});
