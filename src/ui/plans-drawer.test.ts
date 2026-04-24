/* SPDX-License-Identifier: Apache-2.0 */
import { describe, test, expect, vi } from "vitest";
import { createPlansDrawer, type PlansDrawerView } from "./plans-drawer";
import type { PlanSummary } from "../plans";

const PLAN_N: PlanSummary = {
  slug: "2026-04-n",
  title: "N-only plan",
  month: "2026-04",
  hemisphere: "n",
  summary: "Northern",
  author: "Rob",
  publishedAt: "2026-04-01T00:00:00.000Z",
};
const PLAN_S: PlanSummary = { ...PLAN_N, slug: "2026-03-s", title: "S-only plan", hemisphere: "s" };
const PLAN_BOTH: PlanSummary = {
  ...PLAN_N,
  slug: "2026-02-both",
  title: "Anywhere",
  hemisphere: "both",
};

function render(view: PlansDrawerView, lat = 0): HTMLElement {
  const dispatch = vi.fn();
  const drawer = createPlansDrawer({ dispatch });
  drawer.setView(view, lat);
  drawer.openPanel();
  return drawer.element;
}

describe("plans drawer states", () => {
  test("loading", () => {
    const el = render({ kind: "loading" });
    expect(el.textContent).toMatch(/Loading plans/i);
  });

  test("unauthenticated", () => {
    const el = render({ kind: "unauthenticated" });
    expect(el.textContent).toMatch(/Sign in/i);
  });

  test("not_pro", () => {
    const el = render({ kind: "not_pro" });
    expect(el.textContent).toMatch(/Pro feature/i);
  });

  test("empty", () => {
    const el = render({ kind: "list", plans: [] }, 10);
    expect(el.textContent).toMatch(/No plans/i);
    expect(el.textContent).toMatch(/Northern/i);
  });

  test("error", () => {
    const el = render({ kind: "error" });
    expect(el.textContent).toMatch(/Couldn.t load/i);
  });

  test("list — northern observer keeps 'both' + 'n', drops 's'", () => {
    const el = render({ kind: "list", plans: [PLAN_N, PLAN_S, PLAN_BOTH] }, 10);
    expect(el.textContent).toContain("N-only plan");
    expect(el.textContent).not.toContain("S-only plan");
    expect(el.textContent).toContain("Anywhere");
  });

  test("list — southern observer keeps 'both' + 's', drops 'n'", () => {
    const el = render({ kind: "list", plans: [PLAN_N, PLAN_S, PLAN_BOTH] }, -10);
    expect(el.textContent).not.toContain("N-only plan");
    expect(el.textContent).toContain("S-only plan");
    expect(el.textContent).toContain("Anywhere");
  });
});

describe("plans drawer intent wiring", () => {
  test("retry button in error state dispatches retry-plans", () => {
    const dispatch = vi.fn();
    const drawer = createPlansDrawer({ dispatch });
    drawer.setView({ kind: "error" }, 0);
    drawer.openPanel();
    const btn = drawer.element.querySelector<HTMLElement>("[data-plans-retry]");
    btn?.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "retry-plans" });
  });

  test("sign-in button in unauthenticated state dispatches open-sign-in", () => {
    const dispatch = vi.fn();
    const drawer = createPlansDrawer({ dispatch });
    drawer.setView({ kind: "unauthenticated" }, 0);
    drawer.openPanel();
    const btn = drawer.element.querySelector<HTMLElement>("[data-plans-signin]");
    btn?.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "open-sign-in" });
  });
});
