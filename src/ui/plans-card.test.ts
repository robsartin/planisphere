/* SPDX-License-Identifier: Apache-2.0 */
import { describe, test, expect, vi } from "vitest";
import { createPlanCard } from "./plans-card";
import type { PlanSummary } from "../plans";

const SAMPLE: PlanSummary = {
  slug: "2026-04",
  title: "April — Lyrids",
  month: "2026-04",
  hemisphere: "both",
  summary: "Meteors over galaxies.",
  author: "Rob",
  publishedAt: "2026-04-01T00:00:00.000Z",
};

describe("createPlanCard", () => {
  test("renders title, month, summary, author", () => {
    const dispatch = vi.fn();
    const card = createPlanCard(SAMPLE, dispatch);
    expect(card.textContent).toContain("April — Lyrids");
    expect(card.textContent).toContain("2026-04");
    expect(card.textContent).toContain("Meteors over galaxies.");
    expect(card.textContent).toContain("Rob");
  });

  test("click dispatches set-active-plan with slug", () => {
    const dispatch = vi.fn();
    const card = createPlanCard(SAMPLE, dispatch);
    card.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "set-active-plan", slug: "2026-04" });
  });
});
