/* SPDX-License-Identifier: Apache-2.0 */
import { el } from "./dom";
import { applyBaseText, SURFACE, BORDER_SUBTLE, TEXT_MUTED } from "./styles";
import type { UIIntent } from "./index";
import type { PlanSummary } from "../plans";

export function createPlanCard(
  plan: PlanSummary,
  dispatch: (intent: UIIntent) => void,
): HTMLButtonElement {
  const title = el("div", {
    text: plan.title,
    style: { fontSize: "14px", fontWeight: "600", marginBottom: "4px" },
  });
  const meta = el("div", {
    text: `${plan.month} · ${plan.author}`,
    style: { fontSize: "11px", color: TEXT_MUTED, marginBottom: "4px" },
  });
  const summary = el("div", {
    text: plan.summary,
    style: {
      fontSize: "12px",
      lineHeight: "1.4",
      display: "-webkit-box",
      WebkitLineClamp: "2",
      WebkitBoxOrient: "vertical",
      overflow: "hidden",
    } as Partial<CSSStyleDeclaration>,
  });

  const card = el("button", {
    dataset: { planCard: plan.slug },
    style: {
      display: "block",
      textAlign: "left",
      width: "100%",
      padding: "10px 12px",
      marginBottom: "6px",
      background: SURFACE,
      border: BORDER_SUBTLE,
      borderRadius: "6px",
      cursor: "pointer",
    },
    children: [title, meta, summary],
  });
  applyBaseText(card);

  card.addEventListener("click", () => {
    dispatch({ type: "set-active-plan", slug: plan.slug });
  });

  return card;
}
