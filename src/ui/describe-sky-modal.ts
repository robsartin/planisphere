/* SPDX-License-Identifier: Apache-2.0 */
import { el } from "./dom";
import { PANEL_BG, PANEL_BORDER, TEXT_COLOR } from "./styles";

/**
 * "Describe this sky" modal (#381). Renders the current sky snapshot as
 * prose so screen-reader users can hear what's actually visible on the
 * WebGL canvas.
 *
 * The modal owns no astronomy math — the caller supplies a summary
 * string via `open(summary)` (or refresh-getter) so this UI stays free
 * of any `astro/` imports.
 */

export type DescribeSkyModal = {
  readonly element: HTMLElement;
  open(summary: string): void;
  close(): void;
  isOpen(): boolean;
};

export type DescribeSkyModalOptions = {
  /** Getter called when the user hits the "Refresh" button so the
   *  summary can reflect the current time / camera / visible list. */
  readonly getSummary: () => string;
};

export function createDescribeSkyModal(options: DescribeSkyModalOptions): DescribeSkyModal {
  const summaryEl = el("p", {
    testid: "describe-sky-summary",
    attrs: {
      role: "status",
      "aria-live": "polite",
      "aria-atomic": "true",
    },
    style: {
      color: TEXT_COLOR,
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: "16px",
      lineHeight: "1.55",
      margin: "0",
      padding: "0",
      whiteSpace: "pre-wrap",
    },
  });

  const copyBtn = el("button", {
    testid: "describe-sky-copy",
    type: "button",
    text: "Copy",
    attrs: { title: "Copy the summary text to the clipboard" },
    style: {
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.25)",
      borderRadius: "6px",
      color: TEXT_COLOR,
      cursor: "pointer",
      fontSize: "13px",
      padding: "4px 12px",
    },
  });

  const refreshBtn = el("button", {
    testid: "describe-sky-refresh",
    type: "button",
    text: "Refresh",
    attrs: { title: "Recompute the summary against the current view" },
    style: {
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.25)",
      borderRadius: "6px",
      color: TEXT_COLOR,
      cursor: "pointer",
      fontSize: "13px",
      padding: "4px 12px",
    },
  });

  const closeBtn = el("button", {
    testid: "describe-sky-close",
    type: "button",
    text: "×",
    attrs: { title: "Close (Esc)" },
    style: {
      background: "rgba(255,255,255,0.1)",
      border: "1px solid rgba(255,255,255,0.3)",
      borderRadius: "4px",
      color: TEXT_COLOR,
      cursor: "pointer",
      fontSize: "18px",
      lineHeight: "1",
      padding: "2px 10px",
    },
  });

  const title = el("h2", {
    text: "Sky summary",
    attrs: { id: "describe-sky-title" },
    style: {
      color: TEXT_COLOR,
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: "18px",
      margin: "0",
    },
  });

  const header = el("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 16px",
      borderBottom: "1px solid rgba(255,255,255,0.15)",
      gap: "8px",
    },
    children: [title, closeBtn],
  });

  const buttonRow = el("div", {
    style: {
      display: "flex",
      gap: "8px",
      padding: "12px 16px 0",
    },
    children: [copyBtn, refreshBtn],
  });

  const body = el("div", {
    style: { padding: "16px" },
    children: [summaryEl],
  });

  const panel = el("div", {
    testid: "describe-sky-panel",
    attrs: {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "describe-sky-title",
    },
    style: {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "min(80vw, 600px)",
      maxWidth: "calc(100vw - 24px)",
      background: PANEL_BG,
      border: PANEL_BORDER,
      borderRadius: "8px",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
    },
    children: [header, body, buttonRow],
  });

  const backdrop = el("div", {
    testid: "describe-sky-backdrop",
    style: { position: "absolute", inset: "0", background: "rgba(0,0,0,0.6)" },
  });

  const root = el("div", {
    testid: "describe-sky-modal",
    style: { display: "none", position: "fixed", inset: "0", zIndex: "2000" },
    children: [backdrop, panel],
  });

  let open = false;

  function setOpen(value: boolean): void {
    open = value;
    root.style.display = value ? "block" : "none";
    document.body.style.overflow = value ? "hidden" : "";
  }

  function doOpen(summary: string): void {
    summaryEl.textContent = summary;
    setOpen(true);
    // Move focus to the summary itself so screen readers announce it.
    summaryEl.setAttribute("tabindex", "-1");
    summaryEl.focus();
  }

  function doClose(): void {
    setOpen(false);
  }

  backdrop.addEventListener("click", doClose);
  closeBtn.addEventListener("click", doClose);
  refreshBtn.addEventListener("click", () => {
    summaryEl.textContent = options.getSummary();
  });
  copyBtn.addEventListener("click", () => {
    const clipboard = navigator.clipboard as
      { writeText?: (s: string) => Promise<void> } | undefined;
    if (clipboard === undefined || typeof clipboard.writeText !== "function") return;
    const text = summaryEl.textContent ?? "";
    void clipboard.writeText(text).catch(() => {
      // Clipboard denied — silent per app convention.
    });
  });

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
