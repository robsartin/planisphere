/* SPDX-License-Identifier: Apache-2.0 */
import type { AuthError } from "../auth";
import type { Result } from "../result";
import { el } from "./dom";
import { messageFor } from "./error-messages";
import { FONT_FAMILY, PANEL_BG, PANEL_BORDER, SURFACE, TEXT_COLOR } from "./styles";

/**
 * Minimal modal for the magic-link login flow.
 *
 * Two states: an email-entry form, and a "Check your email" confirmation.
 * The caller injects `requestMagicLink` so the modal is trivially testable
 * with a mock — no `fetch` plumbing in the UI layer.
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

// Styled "primary" button (send link / done) and "secondary" (cancel) — both
// share the same shape but different palette. Defined once, reused.
const ACCENT_BG = "rgba(100,180,255,0.25)";
const ACCENT_BORDER = "1px solid rgba(100,180,255,0.7)";
const INPUT_BORDER = "1px solid rgba(255,255,255,0.25)";
const ERROR_COLOR = "#ff9a9a";
const MUTED_TEXT = "rgba(255,255,255,0.7)";

export function createLoginModal(options: LoginModalOptions): LoginModal {
  let open = false;

  const body = el("div");
  const backdrop = el("div", {
    testid: "login-modal-backdrop",
    style: { position: "absolute", inset: "0", background: "rgba(0,0,0,0.6)" },
    on: { click: () => doClose() },
  });
  const panel = el("div", {
    style: {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "min(92vw, 420px)",
      background: PANEL_BG,
      border: PANEL_BORDER,
      borderRadius: "8px",
      color: TEXT_COLOR,
      fontFamily: FONT_FAMILY,
      padding: "20px 24px",
      boxSizing: "border-box",
    },
    children: [body],
  });
  const root = el("div", {
    testid: "login-modal",
    style: { display: "none", position: "fixed", inset: "0", zIndex: "2000" },
    children: [backdrop, panel],
  });

  function setOpen(value: boolean): void {
    open = value;
    root.style.display = value ? "block" : "none";
  }

  function renderForm(): void {
    const input = el("input", {
      testid: "login-modal-email",
      type: "email",
      placeholder: "you@example.com",
      attrs: { autocomplete: "email", required: "" },
      style: {
        background: SURFACE,
        border: INPUT_BORDER,
        borderRadius: "4px",
        color: TEXT_COLOR,
        fontSize: "14px",
        padding: "8px 10px",
      },
    });

    const errorBox = el("div", {
      testid: "login-modal-error",
      style: { display: "none", color: ERROR_COLOR, fontSize: "12px" },
    });

    const cancel = el("button", {
      testid: "login-modal-cancel",
      type: "button",
      text: "Cancel",
      style: {
        background: SURFACE,
        border: INPUT_BORDER,
        borderRadius: "4px",
        color: TEXT_COLOR,
        cursor: "pointer",
        fontSize: "13px",
        padding: "6px 12px",
      },
      on: { click: () => doClose() },
    });

    const submit = el("button", {
      testid: "login-modal-submit",
      type: "submit",
      text: "Send login link",
      style: {
        background: ACCENT_BG,
        border: ACCENT_BORDER,
        borderRadius: "4px",
        color: TEXT_COLOR,
        cursor: "pointer",
        fontSize: "13px",
        padding: "6px 12px",
      },
    });

    const form = el("form", {
      testid: "login-modal-form",
      style: { display: "flex", flexDirection: "column", gap: "12px" },
      children: [
        input,
        errorBox,
        el("div", {
          style: { display: "flex", gap: "8px", justifyContent: "flex-end" },
          children: [cancel, submit],
        }),
      ],
      on: {
        submit: (event) => {
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
        },
      },
    });

    body.replaceChildren(
      el("h2", { text: "Sign in", style: { margin: "0 0 8px", fontSize: "20px" } }),
      el("p", {
        text: "Enter your email — we'll send you a one-time login link.",
        style: { margin: "0 0 16px", fontSize: "13px", color: "rgba(255,255,255,0.75)" },
      }),
      form,
    );

    // Focus the email input for keyboard users.
    setTimeout(() => input.focus(), 0);
  }

  function renderSent(email: string): void {
    const sent = el("div", {
      testid: "login-modal-sent",
      style: { fontSize: "13px", lineHeight: "1.5" },
      children: [
        el("p", {
          text: `We sent a one-time login link to ${email}.`,
          style: { margin: "0 0 8px" },
        }),
        el("p", {
          text: "Click the link to finish signing in. You can close this dialog.",
          style: { margin: "0 0 16px", color: MUTED_TEXT },
        }),
      ],
    });

    const closeBtn = el("button", {
      testid: "login-modal-done",
      type: "button",
      text: "Done",
      style: {
        background: ACCENT_BG,
        border: ACCENT_BORDER,
        borderRadius: "4px",
        color: TEXT_COLOR,
        cursor: "pointer",
        fontSize: "13px",
        padding: "6px 12px",
        float: "right",
      },
      on: { click: () => doClose() },
    });

    body.replaceChildren(
      el("h2", { text: "Check your email", style: { margin: "0 0 12px", fontSize: "20px" } }),
      sent,
      closeBtn,
    );
  }

  function doOpen(): void {
    renderForm();
    setOpen(true);
  }

  function doClose(): void {
    setOpen(false);
  }

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
