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
    title: "ISS pass — peaks at 43° altitude",
    description: "Peaks 43° in the SSE at 21:34 local, sets 21:38 local (4 min pass).",
    peakAltDeg: 43,
    peakAzDeg: 157,
    durationSec: 240,
  };
}

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
