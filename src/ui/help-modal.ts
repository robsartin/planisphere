/* SPDX-License-Identifier: Apache-2.0 */
import guideMarkdown from "../../docs/user-guide.md?raw";
import { el } from "./dom";
import { renderMarkdownToSafeHtml } from "./markdown";
import { PANEL_BG, PANEL_BORDER, TEXT_COLOR } from "./styles";

export type HelpModal = {
  element: HTMLElement;
  open(): void;
  close(): void;
  isOpen(): boolean;
};

export type HelpModalOptions = {
  /** Optional callback: when provided, the modal renders a small "Replay tour"
   *  button at the top that invokes this callback and then closes the modal.
   *  Omitted by default so the API stays backward-compatible with callers that
   *  don't yet wire the onboarding overlay. */
  readonly onReplayTour?: () => void;
};

/**
 * Styles injected once into the document so the rendered markdown has
 * readable typography (links, headings, tables, code blocks) inside the
 * dark help modal. Kept narrow via a `[data-testid='help-modal-content']`
 * prefix so it never bleeds onto anything else.
 */
const HELP_STYLES = `
[data-testid='help-modal-content'] {
  color: ${TEXT_COLOR};
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  max-width: 720px;
  margin: 0 auto;
}
[data-testid='help-modal-content'] h1 { font-size: 28px; margin-top: 0; }
[data-testid='help-modal-content'] h2 { font-size: 22px; margin-top: 1.6em; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 0.3em; }
[data-testid='help-modal-content'] h3 { font-size: 18px; margin-top: 1.4em; }
[data-testid='help-modal-content'] h4 { font-size: 16px; margin-top: 1.2em; }
[data-testid='help-modal-content'] p { margin: 0.8em 0; }
[data-testid='help-modal-content'] ul, [data-testid='help-modal-content'] ol { padding-left: 1.4em; }
[data-testid='help-modal-content'] li { margin: 0.3em 0; }
[data-testid='help-modal-content'] a { color: #4da8ff; text-decoration: underline; }
[data-testid='help-modal-content'] a:hover { color: #8ac7ff; }
[data-testid='help-modal-content'] code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Courier New", monospace;
  background: rgba(255,255,255,0.1);
  padding: 0.1em 0.35em;
  border-radius: 3px;
  font-size: 0.9em;
}
[data-testid='help-modal-content'] pre {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 4px;
  padding: 12px;
  overflow-x: auto;
}
[data-testid='help-modal-content'] pre code { background: transparent; padding: 0; }
[data-testid='help-modal-content'] hr { border: 0; border-top: 1px solid rgba(255,255,255,0.15); margin: 2em 0; }
[data-testid='help-modal-content'] table { border-collapse: collapse; margin: 1em 0; }
[data-testid='help-modal-content'] th, [data-testid='help-modal-content'] td {
  border: 1px solid rgba(255,255,255,0.2);
  padding: 6px 10px;
  text-align: left;
}
[data-testid='help-modal-content'] th { background: rgba(255,255,255,0.05); }
[data-testid='help-modal-content'] img { max-width: 100%; height: auto; display: block; margin: 0.8em auto; }
[data-testid='help-modal-content'] blockquote {
  border-left: 3px solid rgba(255,255,255,0.2);
  margin: 1em 0;
  padding-left: 1em;
  color: rgba(255,255,255,0.85);
}
`;

let stylesInjected = false;

function injectStylesOnce(): void {
  if (stylesInjected) return;
  const style = el("style", { testid: "help-modal-styles", text: HELP_STYLES });
  document.head.appendChild(style);
  stylesInjected = true;
}

export function createHelpModal(options: HelpModalOptions = {}): HelpModal {
  injectStylesOnce();

  const replayBtn =
    options.onReplayTour !== undefined
      ? el("button", {
          testid: "help-modal-replay-tour",
          type: "button",
          text: "Replay tour",
          attrs: { title: "Replay the first-load guided tour" },
          style: {
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: "6px",
            color: TEXT_COLOR,
            cursor: "pointer",
            fontSize: "12px",
            padding: "4px 10px",
          },
          on: {
            click: () => {
              doClose();
              options.onReplayTour?.();
            },
          },
        })
      : null;

  const headerLeft = el("div", {
    style: { display: "flex", alignItems: "center", gap: "8px" },
    children: [replayBtn],
  });

  const closeBtn = el("button", {
    testid: "help-modal-close",
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

  const header = el("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 12px",
      borderBottom: "1px solid rgba(255,255,255,0.15)",
      flexShrink: "0",
      gap: "8px",
    },
    children: [headerLeft, closeBtn],
  });

  const content = el("article", { testid: "help-modal-content" });

  const scroll = el("div", {
    style: { overflowY: "auto", padding: "20px 24px", flex: "1 1 auto" },
    children: [content],
  });

  const panel = el("div", {
    style: {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "min(80vw, 900px)",
      maxWidth: "calc(100vw - 24px)",
      maxHeight: "calc(100vh - 48px)",
      background: PANEL_BG,
      border: PANEL_BORDER,
      borderRadius: "8px",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
    },
    children: [header, scroll],
  });

  const backdrop = el("div", {
    testid: "help-modal-backdrop",
    style: { position: "absolute", inset: "0", background: "rgba(0,0,0,0.6)" },
  });

  const root = el("div", {
    testid: "help-modal",
    style: { display: "none", position: "fixed", inset: "0", zIndex: "2000" },
    children: [backdrop, panel],
  });

  let open = false;
  let rendered = false;

  function setOpen(value: boolean): void {
    open = value;
    root.style.display = value ? "block" : "none";
    document.body.style.overflow = value ? "hidden" : "";
  }

  function doOpen(): void {
    if (!rendered) {
      content.innerHTML = renderMarkdownToSafeHtml(guideMarkdown);
      rendered = true;
    }
    setOpen(true);
    // Scroll back to top each time the modal is opened
    scroll.scrollTop = 0;
  }

  function doClose(): void {
    setOpen(false);
  }

  backdrop.addEventListener("click", doClose);
  closeBtn.addEventListener("click", doClose);

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
