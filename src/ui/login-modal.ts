/* SPDX-License-Identifier: Apache-2.0 */
import type { AuthError } from "../auth";
import type { Result } from "../result";
import { messageFor } from "./error-messages";
import { PANEL_BG, PANEL_BORDER, TEXT_COLOR } from "./styles";

/**
 * Minimal modal for the magic-link login flow.
 *
 * Two states: an email-entry form, and a "Check your email" confirmation.
 * The caller injects `requestMagicLink` so the modal is trivially testable
 * with a mock — no `fetch` plumbing in the UI layer.
 *
 * When #224 (`src/ui/email-gate-modal.ts`) lands, this modal is the real
 * implementation and the email-gate shell becomes a thin wrapper around it.
 */

export type LoginModal = {
  readonly element: HTMLElement;
  open(): void;
  close(): void;
  isOpen(): boolean;
};

export type LoginModalOptions = {
  readonly requestMagicLink: (email: string) => Promise<Result<void, AuthError>>;
};

export function createLoginModal(options: LoginModalOptions): LoginModal {
  const root = document.createElement("div");
  root.dataset.testid = "login-modal";
  root.style.display = "none";
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.zIndex = "2000";

  const backdrop = document.createElement("div");
  backdrop.dataset.testid = "login-modal-backdrop";
  backdrop.style.position = "absolute";
  backdrop.style.inset = "0";
  backdrop.style.background = "rgba(0,0,0,0.6)";

  const panel = document.createElement("div");
  panel.style.position = "absolute";
  panel.style.top = "50%";
  panel.style.left = "50%";
  panel.style.transform = "translate(-50%, -50%)";
  panel.style.width = "min(92vw, 420px)";
  panel.style.background = PANEL_BG;
  panel.style.border = PANEL_BORDER;
  panel.style.borderRadius = "8px";
  panel.style.color = TEXT_COLOR;
  panel.style.fontFamily = "sans-serif";
  panel.style.padding = "20px 24px";
  panel.style.boxSizing = "border-box";

  const body = document.createElement("div");
  panel.appendChild(body);

  root.appendChild(backdrop);
  root.appendChild(panel);

  let open = false;

  function setOpen(value: boolean): void {
    open = value;
    root.style.display = value ? "block" : "none";
  }

  function renderForm(): void {
    body.replaceChildren();

    const heading = document.createElement("h2");
    heading.textContent = "Sign in";
    heading.style.margin = "0 0 8px";
    heading.style.fontSize = "20px";
    body.appendChild(heading);

    const blurb = document.createElement("p");
    blurb.textContent = "Enter your email — we'll send you a one-time login link.";
    blurb.style.margin = "0 0 16px";
    blurb.style.fontSize = "13px";
    blurb.style.color = "rgba(255,255,255,0.75)";
    body.appendChild(blurb);

    const form = document.createElement("form");
    form.dataset.testid = "login-modal-form";
    form.style.display = "flex";
    form.style.flexDirection = "column";
    form.style.gap = "12px";

    const input = document.createElement("input");
    input.dataset.testid = "login-modal-email";
    input.type = "email";
    input.placeholder = "you@example.com";
    input.autocomplete = "email";
    input.required = true;
    input.style.background = "rgba(255,255,255,0.08)";
    input.style.border = "1px solid rgba(255,255,255,0.25)";
    input.style.borderRadius = "4px";
    input.style.color = TEXT_COLOR;
    input.style.fontSize = "14px";
    input.style.padding = "8px 10px";
    form.appendChild(input);

    const errorBox = document.createElement("div");
    errorBox.dataset.testid = "login-modal-error";
    errorBox.style.display = "none";
    errorBox.style.color = "#ff9a9a";
    errorBox.style.fontSize = "12px";
    form.appendChild(errorBox);

    const buttons = document.createElement("div");
    buttons.style.display = "flex";
    buttons.style.gap = "8px";
    buttons.style.justifyContent = "flex-end";

    const cancel = document.createElement("button");
    cancel.dataset.testid = "login-modal-cancel";
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.style.background = "rgba(255,255,255,0.08)";
    cancel.style.border = "1px solid rgba(255,255,255,0.25)";
    cancel.style.borderRadius = "4px";
    cancel.style.color = TEXT_COLOR;
    cancel.style.cursor = "pointer";
    cancel.style.fontSize = "13px";
    cancel.style.padding = "6px 12px";
    cancel.addEventListener("click", doClose);
    buttons.appendChild(cancel);

    const submit = document.createElement("button");
    submit.dataset.testid = "login-modal-submit";
    submit.type = "submit";
    submit.textContent = "Send login link";
    submit.style.background = "rgba(100,180,255,0.25)";
    submit.style.border = "1px solid rgba(100,180,255,0.7)";
    submit.style.borderRadius = "4px";
    submit.style.color = TEXT_COLOR;
    submit.style.cursor = "pointer";
    submit.style.fontSize = "13px";
    submit.style.padding = "6px 12px";
    buttons.appendChild(submit);

    form.appendChild(buttons);
    body.appendChild(form);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = input.value.trim();
      if (email.length === 0) return;
      submit.disabled = true;
      submit.textContent = "Sending…";
      errorBox.style.display = "none";
      errorBox.textContent = "";

      void options
        .requestMagicLink(email)
        .then((result) => {
          if (result.ok) {
            renderSent(email);
          } else {
            submit.disabled = false;
            submit.textContent = "Send login link";
            errorBox.textContent = messageFor(result.error);
            errorBox.style.display = "block";
          }
        })
        .catch(() => {
          submit.disabled = false;
          submit.textContent = "Send login link";
          errorBox.textContent = messageFor({ kind: "network" });
          errorBox.style.display = "block";
        });
    });

    // Focus the email input for keyboard users.
    setTimeout(() => input.focus(), 0);
  }

  function renderSent(email: string): void {
    body.replaceChildren();

    const heading = document.createElement("h2");
    heading.textContent = "Check your email";
    heading.style.margin = "0 0 12px";
    heading.style.fontSize = "20px";
    body.appendChild(heading);

    const sent = document.createElement("div");
    sent.dataset.testid = "login-modal-sent";
    sent.style.fontSize = "13px";
    sent.style.lineHeight = "1.5";
    sent.replaceChildren();
    const line1 = document.createElement("p");
    line1.style.margin = "0 0 8px";
    line1.textContent = `We sent a one-time login link to ${email}.`;
    const line2 = document.createElement("p");
    line2.style.margin = "0 0 16px";
    line2.style.color = "rgba(255,255,255,0.7)";
    line2.textContent = "Click the link to finish signing in. You can close this dialog.";
    sent.appendChild(line1);
    sent.appendChild(line2);
    body.appendChild(sent);

    const close = document.createElement("button");
    close.dataset.testid = "login-modal-done";
    close.type = "button";
    close.textContent = "Done";
    close.style.background = "rgba(100,180,255,0.25)";
    close.style.border = "1px solid rgba(100,180,255,0.7)";
    close.style.borderRadius = "4px";
    close.style.color = TEXT_COLOR;
    close.style.cursor = "pointer";
    close.style.fontSize = "13px";
    close.style.padding = "6px 12px";
    close.style.float = "right";
    close.addEventListener("click", doClose);
    body.appendChild(close);
  }

  function doOpen(): void {
    renderForm();
    setOpen(true);
  }

  function doClose(): void {
    setOpen(false);
  }

  backdrop.addEventListener("click", doClose);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && open) {
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
