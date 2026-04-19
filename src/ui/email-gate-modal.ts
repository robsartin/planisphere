/* SPDX-License-Identifier: Apache-2.0 */
import { isPro, setUser } from "../features";
import { PANEL_BG, PANEL_BORDER, TEXT_COLOR, FONT_FAMILY, applyButton } from "./styles";

export type EmailGateModal = {
  element: HTMLElement;
  open(): void;
  close(): void;
  isOpen(): boolean;
};

export type EmailGateModalOptions = {
  /** Invoked after a successful (allowlisted) email is entered. The modal
   *  closes itself before this fires. */
  readonly onGranted: () => void;
};

const PRO_CONTACT_EMAIL = "rob.sartin@gmail.com";

/**
 * Centered modal that collects an email, normalises it, and grants access iff
 * the email is on the Pro allowlist. Non-allowlisted emails swap the modal
 * body to a "request access" call-to-action with a mailto link. No loading
 * states — everything is synchronous by design (Rung 1 of the entitlement
 * ladder; see `src/features.ts`).
 */
export function createEmailGateModal(options: EmailGateModalOptions): EmailGateModal {
  const root = document.createElement("div");
  root.dataset.testid = "email-gate-modal";
  root.style.display = "none";
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.zIndex = "2100";

  const backdrop = document.createElement("div");
  backdrop.dataset.testid = "email-gate-backdrop";
  backdrop.style.position = "absolute";
  backdrop.style.inset = "0";
  backdrop.style.background = "rgba(0,0,0,0.6)";

  const panel = document.createElement("div");
  panel.style.position = "absolute";
  panel.style.top = "50%";
  panel.style.left = "50%";
  panel.style.transform = "translate(-50%, -50%)";
  panel.style.width = "min(90vw, 420px)";
  panel.style.background = PANEL_BG;
  panel.style.border = PANEL_BORDER;
  panel.style.borderRadius = "8px";
  panel.style.padding = "22px 24px";
  panel.style.color = TEXT_COLOR;
  panel.style.fontFamily = FONT_FAMILY;
  panel.style.boxSizing = "border-box";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.gap = "14px";

  const body = document.createElement("div");
  body.style.display = "flex";
  body.style.flexDirection = "column";
  body.style.gap = "14px";

  panel.appendChild(body);
  root.appendChild(backdrop);
  root.appendChild(panel);

  let open = false;

  function setOpen(value: boolean): void {
    open = value;
    root.style.display = value ? "block" : "none";
  }

  function doClose(): void {
    setOpen(false);
  }

  function renderForm(): void {
    body.replaceChildren();

    const heading = document.createElement("h2");
    heading.textContent = "Notebook is a Pro feature";
    heading.style.margin = "0";
    heading.style.fontSize = "18px";
    heading.style.fontWeight = "600";

    const blurb = document.createElement("p");
    blurb.textContent =
      "Enter the email associated with your Pro access to continue. We'll remember it on this device.";
    blurb.style.margin = "0";
    blurb.style.fontSize = "13px";
    blurb.style.lineHeight = "1.5";
    blurb.style.color = "rgba(255,255,255,0.78)";

    const form = document.createElement("form");
    form.dataset.testid = "email-gate-form";
    form.style.display = "flex";
    form.style.flexDirection = "column";
    form.style.gap = "10px";

    const input = document.createElement("input");
    input.dataset.testid = "email-gate-input";
    input.type = "email";
    input.placeholder = "you@example.com";
    input.autocomplete = "email";
    input.style.background = "rgba(255,255,255,0.06)";
    input.style.border = "1px solid rgba(255,255,255,0.25)";
    input.style.borderRadius = "6px";
    input.style.color = TEXT_COLOR;
    input.style.fontFamily = FONT_FAMILY;
    input.style.fontSize = "14px";
    input.style.padding = "10px 12px";
    input.style.boxSizing = "border-box";

    const btnRow = document.createElement("div");
    btnRow.style.display = "flex";
    btnRow.style.justifyContent = "flex-end";
    btnRow.style.gap = "8px";

    const cancelBtn = document.createElement("button");
    cancelBtn.dataset.testid = "email-gate-cancel";
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    applyButton(cancelBtn);
    cancelBtn.style.padding = "6px 14px";

    const continueBtn = document.createElement("button");
    continueBtn.dataset.testid = "email-gate-continue";
    continueBtn.type = "submit";
    continueBtn.textContent = "Continue";
    applyButton(continueBtn);
    continueBtn.style.padding = "6px 14px";
    continueBtn.style.background = "rgba(0,255,136,0.15)";
    continueBtn.style.borderColor = "rgba(0,255,136,0.45)";

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(continueBtn);

    form.appendChild(input);
    form.appendChild(btnRow);

    body.appendChild(heading);
    body.appendChild(blurb);
    body.appendChild(form);

    cancelBtn.addEventListener("click", doClose);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      handleSubmit(input.value);
    });
  }

  function renderRequestAccessState(): void {
    body.replaceChildren();

    const wrap = document.createElement("div");
    wrap.dataset.testid = "email-gate-request-state";
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "14px";

    const heading = document.createElement("h2");
    heading.textContent = "Pro access required";
    heading.style.margin = "0";
    heading.style.fontSize = "18px";
    heading.style.fontWeight = "600";

    const blurb = document.createElement("p");
    blurb.textContent = `That email isn't on the Pro allowlist yet. Request access by emailing ${PRO_CONTACT_EMAIL}, and we'll add you.`;
    blurb.style.margin = "0";
    blurb.style.fontSize = "13px";
    blurb.style.lineHeight = "1.5";
    blurb.style.color = "rgba(255,255,255,0.78)";

    const btnRow = document.createElement("div");
    btnRow.style.display = "flex";
    btnRow.style.justifyContent = "flex-end";
    btnRow.style.gap = "8px";

    const closeBtn = document.createElement("button");
    closeBtn.dataset.testid = "email-gate-close-request";
    closeBtn.type = "button";
    closeBtn.textContent = "Close";
    applyButton(closeBtn);
    closeBtn.style.padding = "6px 14px";

    const mailto = document.createElement("a");
    mailto.dataset.testid = "email-gate-mailto";
    mailto.href = `mailto:${PRO_CONTACT_EMAIL}?subject=${encodeURIComponent(
      "Planisphere Pro access request",
    )}`;
    mailto.textContent = `Email ${PRO_CONTACT_EMAIL}`;
    mailto.style.display = "inline-block";
    mailto.style.background = "rgba(0,255,136,0.15)";
    mailto.style.border = "1px solid rgba(0,255,136,0.45)";
    mailto.style.borderRadius = "4px";
    mailto.style.color = TEXT_COLOR;
    mailto.style.fontFamily = FONT_FAMILY;
    mailto.style.fontSize = "12px";
    mailto.style.padding = "6px 14px";
    mailto.style.textDecoration = "none";

    btnRow.appendChild(closeBtn);
    btnRow.appendChild(mailto);

    wrap.appendChild(heading);
    wrap.appendChild(blurb);
    wrap.appendChild(btnRow);
    body.appendChild(wrap);

    closeBtn.addEventListener("click", doClose);
  }

  function handleSubmit(raw: string): void {
    const trimmed = raw.trim();
    if (trimmed === "") return;
    setUser(trimmed);
    if (isPro()) {
      doClose();
      options.onGranted();
      return;
    }
    renderRequestAccessState();
  }

  function doOpen(): void {
    // Always re-render the form on open so the user returns to the entry
    // state after a miss + close + reopen.
    renderForm();
    setOpen(true);
  }

  backdrop.addEventListener("click", doClose);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) {
      doClose();
    }
  });

  return {
    element: root,
    open: doOpen,
    close: doClose,
    isOpen: () => open,
  };
}
