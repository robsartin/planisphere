/* SPDX-License-Identifier: Apache-2.0 */
import { el } from "./dom";
import {
  applyBaseText,
  applyButton,
  PANEL_BG,
  PANEL_BORDER,
  TEXT_COLOR,
  TEXT_MUTED,
} from "./styles";
import { renderMarkdownToSafeHtml } from "./markdown";
import type { UIIntent } from "./index";
import type { LinkedEntity, LinkedEntityKind, Plan, PlanError } from "../plans";

export type PlansModalOptions = {
  dispatch: (intent: UIIntent) => void;
};

export type PlansModal = {
  element: HTMLElement;
  setPlan: (plan: Plan | null) => void;
  setError: (slug: string, kind: PlanError["kind"]) => void;
};

// LinkedEntity uses `planet` while the object-card system uses `body`. Map at
// the dispatch boundary so the plan wire format stays author-friendly.
type ObjectCardIntentKind = "star" | "body" | "satellite" | "messier" | "constellation";
const LINKED_TO_CARD_KIND: Readonly<Record<LinkedEntityKind, ObjectCardIntentKind>> = {
  star: "star",
  messier: "messier",
  planet: "body",
  satellite: "satellite",
  constellation: "constellation",
};

function errorCopy(kind: PlanError["kind"]): string {
  if (kind === "not_found") return "We couldn't find that plan. It may have been removed.";
  if (kind === "not_pro") return "This plan is a Pro feature.";
  if (kind === "unauthenticated") return "Please sign in to read this plan.";
  return "Something went wrong loading that plan. Please try again.";
}

function buildChip(entity: LinkedEntity, dispatch: (intent: UIIntent) => void): HTMLButtonElement {
  const chip = el("button", {
    text: entity.label,
    dataset: { plansChip: `${entity.kind}:${entity.id}` },
    style: {
      padding: "6px 10px",
      marginRight: "6px",
      marginBottom: "6px",
      background: "transparent",
      border: PANEL_BORDER,
      borderRadius: "14px",
      fontSize: "12px",
      cursor: "pointer",
      color: TEXT_COLOR,
    },
  });
  applyBaseText(chip);

  const cardKind = LINKED_TO_CARD_KIND[entity.kind];

  chip.addEventListener("click", () => {
    dispatch({ type: "set-active-plan", slug: null });
    dispatch({
      type: "open-object-card",
      objectKind: cardKind,
      id: entity.id,
      screenX: Math.round(window.innerWidth / 2),
      screenY: Math.round(window.innerHeight / 2),
    });
  });
  return chip;
}

export function createPlansModal(options: PlansModalOptions): PlansModal {
  const title = el("h2", {
    style: { margin: "0 0 6px", fontSize: "22px", fontWeight: "600" },
  });
  const meta = el("div", {
    style: { fontSize: "12px", color: TEXT_MUTED, marginBottom: "16px" },
  });
  const pullQuote = el("blockquote", {
    style: {
      margin: "0 0 16px",
      padding: "8px 12px",
      borderLeft: `3px solid ${PANEL_BORDER}`,
      fontStyle: "italic",
      color: TEXT_MUTED,
    },
  });
  const body = el("div", {
    style: { fontSize: "14px", lineHeight: "1.6", marginBottom: "16px" },
  });
  const targetsLabel = el("div", {
    text: "Targets",
    style: {
      fontSize: "11px",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: TEXT_MUTED,
      marginBottom: "6px",
    },
  });
  const targetsStrip = el("div", { style: { display: "flex", flexWrap: "wrap" } });

  const closeBtn = el("button", {
    text: "×",
    dataset: { plansModalClose: "" },
    style: {
      position: "absolute",
      top: "12px",
      right: "12px",
      width: "32px",
      height: "32px",
      borderRadius: "16px",
      border: "none",
      background: "transparent",
      color: TEXT_COLOR,
      fontSize: "20px",
      cursor: "pointer",
    },
  });
  applyButton(closeBtn);
  closeBtn.addEventListener("click", () =>
    options.dispatch({ type: "set-active-plan", slug: null }),
  );

  const card = el("div", {
    dataset: { plansModalCard: "" },
    style: {
      position: "relative",
      maxWidth: "680px",
      width: "min(92vw, 680px)",
      maxHeight: "86vh",
      overflowY: "auto",
      margin: "auto",
      padding: "40px 32px 32px",
      background: PANEL_BG,
      border: PANEL_BORDER,
      borderRadius: "8px",
      color: TEXT_COLOR,
    },
    children: [title, meta, pullQuote, body, targetsLabel, targetsStrip, closeBtn],
  });
  applyBaseText(card);

  const backdrop = el("div", {
    dataset: { plansModalBackdrop: "" },
    style: {
      position: "fixed",
      inset: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0, 0, 0, 0.55)",
      zIndex: "2000",
    },
    children: [card],
  });
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) options.dispatch({ type: "set-active-plan", slug: null });
  });

  const root = el("div", { children: [backdrop] });
  root.hidden = true;

  function setVisible(visible: boolean): void {
    root.hidden = !visible;
    document.body.style.overflow = visible ? "hidden" : "";
  }

  function show(
    titleText: string,
    metaText: string,
    summaryText: string,
    bodyHtml: string,
    objects: readonly LinkedEntity[],
  ): void {
    title.textContent = titleText;
    meta.textContent = metaText;
    pullQuote.textContent = summaryText;
    body.innerHTML = bodyHtml;
    targetsStrip.innerHTML = "";
    if (objects.length === 0) {
      targetsLabel.hidden = true;
    } else {
      targetsLabel.hidden = false;
      for (const o of objects) targetsStrip.appendChild(buildChip(o, options.dispatch));
    }
    setVisible(true);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape" && !root.hidden) {
      options.dispatch({ type: "set-active-plan", slug: null });
    }
  }
  window.addEventListener("keydown", onKeyDown);

  return {
    element: root,
    setPlan: (plan) => {
      if (plan === null) {
        setVisible(false);
        return;
      }
      show(
        plan.title,
        `${plan.month} · ${plan.hemisphere.toUpperCase()} · ${plan.author}`,
        plan.summary,
        renderMarkdownToSafeHtml(plan.bodyMd),
        plan.objects,
      );
    },
    setError: (_slug, kind) => {
      show("Plan unavailable", "", errorCopy(kind), "", []);
    },
  };
}
