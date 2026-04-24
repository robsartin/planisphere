/* SPDX-License-Identifier: Apache-2.0 */
import { el } from "./dom";
import { createDrawer } from "./drawer";
import { applyBaseText, applyButton, TEXT_MUTED } from "./styles";
import { createPlanCard } from "./plans-card";
import type { UIIntent } from "./index";
import type { PlanSummary } from "../plans";

export type PlansDrawerView =
  | { kind: "loading" }
  | { kind: "unauthenticated" }
  | { kind: "not_pro" }
  | { kind: "error" }
  | { kind: "list"; plans: readonly PlanSummary[] };

export type PlansDrawer = {
  element: HTMLElement;
  openPanel: () => void;
  close: () => void;
  isOpen: () => boolean;
  setView: (view: PlansDrawerView, observerLat: number) => void;
};

export type PlansDrawerOptions = {
  dispatch: (intent: UIIntent) => void;
};

function filterByHemisphere(plans: readonly PlanSummary[], lat: number): readonly PlanSummary[] {
  const observerHemi = lat >= 0 ? "n" : "s";
  return plans.filter((p) => p.hemisphere === "both" || p.hemisphere === observerHemi);
}

function emptyCopyForLat(lat: number): string {
  const h = lat >= 0 ? "Northern" : "Southern";
  return `No plans for the ${h} hemisphere yet.`;
}

function renderBody(
  view: PlansDrawerView,
  observerLat: number,
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  if (view.kind === "loading") {
    return el("div", { text: "Loading plans…", style: { padding: "12px", color: TEXT_MUTED } });
  }
  if (view.kind === "unauthenticated") {
    const btn = el("button", { text: "Sign in", dataset: { plansSignin: "" } });
    applyButton(btn);
    btn.addEventListener("click", () => dispatch({ type: "open-sign-in" }));
    return el("div", {
      style: { padding: "12px" },
      children: [el("p", { text: "Sign in to read monthly viewing plans." }), btn],
    });
  }
  if (view.kind === "not_pro") {
    return el("div", {
      style: { padding: "12px" },
      children: [
        el("p", { text: "Viewing Plans is a Pro feature." }),
        el("p", {
          text: "Upgrade details coming soon.",
          style: { color: TEXT_MUTED, fontSize: "12px" },
        }),
      ],
    });
  }
  if (view.kind === "error") {
    const retry = el("button", { text: "Try again", dataset: { plansRetry: "" } });
    applyButton(retry);
    retry.addEventListener("click", () => dispatch({ type: "retry-plans" }));
    return el("div", {
      style: { padding: "12px" },
      children: [el("p", { text: "Couldn't load plans. Try again." }), retry],
    });
  }
  const filtered = filterByHemisphere(view.plans, observerLat);
  if (filtered.length === 0) {
    return el("div", {
      text: emptyCopyForLat(observerLat),
      style: { padding: "12px", color: TEXT_MUTED },
    });
  }
  return el("div", {
    style: { padding: "8px" },
    children: filtered.map((p) => createPlanCard(p, dispatch)),
  });
}

export function createPlansDrawer(options: PlansDrawerOptions): PlansDrawer {
  const content = el("div", { dataset: { testid: "plans-drawer-content" } });
  applyBaseText(content);

  const drawer = createDrawer({
    side: "right",
    width: 360,
    initialContent: content,
  });

  let currentView: PlansDrawerView = { kind: "loading" };
  let currentLat = 0;

  function rerender(): void {
    content.innerHTML = "";
    content.appendChild(
      el("div", {
        text: "Viewing Plans",
        style: { padding: "12px 12px 8px", fontSize: "14px", fontWeight: "600" },
      }),
    );
    content.appendChild(renderBody(currentView, currentLat, options.dispatch));
  }

  rerender();

  return {
    element: drawer.element,
    openPanel: () => drawer.open(content),
    close: drawer.close,
    isOpen: drawer.isOpen,
    setView: (view, lat) => {
      currentView = view;
      currentLat = lat;
      rerender();
    },
  };
}
