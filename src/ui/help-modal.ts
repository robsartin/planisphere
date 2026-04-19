/* SPDX-License-Identifier: Apache-2.0 */
import guideMarkdown from "../../docs/user-guide.md?raw";
import { renderMarkdownToSafeHtml } from "./markdown";
import { PANEL_BG, PANEL_BORDER, TEXT_COLOR } from "./styles";

export type HelpModal = {
  element: HTMLElement;
  open(): void;
  close(): void;
  isOpen(): boolean;
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
  const style = document.createElement("style");
  style.dataset.testid = "help-modal-styles";
  style.textContent = HELP_STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}

export function createHelpModal(): HelpModal {
  injectStylesOnce();

  const root = document.createElement("div");
  root.dataset.testid = "help-modal";
  root.style.display = "none";
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.zIndex = "2000";

  const backdrop = document.createElement("div");
  backdrop.dataset.testid = "help-modal-backdrop";
  backdrop.style.position = "absolute";
  backdrop.style.inset = "0";
  backdrop.style.background = "rgba(0,0,0,0.6)";

  const panel = document.createElement("div");
  panel.style.position = "absolute";
  panel.style.top = "50%";
  panel.style.left = "50%";
  panel.style.transform = "translate(-50%, -50%)";
  panel.style.width = "min(80vw, 900px)";
  panel.style.maxWidth = "calc(100vw - 24px)";
  panel.style.maxHeight = "calc(100vh - 48px)";
  panel.style.background = PANEL_BG;
  panel.style.border = PANEL_BORDER;
  panel.style.borderRadius = "8px";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.boxSizing = "border-box";

  // Header with close button
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "flex-end";
  header.style.alignItems = "center";
  header.style.padding = "8px 12px";
  header.style.borderBottom = "1px solid rgba(255,255,255,0.15)";
  header.style.flexShrink = "0";

  const closeBtn = document.createElement("button");
  closeBtn.dataset.testid = "help-modal-close";
  closeBtn.textContent = "×";
  closeBtn.title = "Close (Esc)";
  closeBtn.style.background = "rgba(255,255,255,0.1)";
  closeBtn.style.border = "1px solid rgba(255,255,255,0.3)";
  closeBtn.style.borderRadius = "4px";
  closeBtn.style.color = TEXT_COLOR;
  closeBtn.style.cursor = "pointer";
  closeBtn.style.fontSize = "18px";
  closeBtn.style.lineHeight = "1";
  closeBtn.style.padding = "2px 10px";
  header.appendChild(closeBtn);

  // Scrollable content area
  const scroll = document.createElement("div");
  scroll.style.overflowY = "auto";
  scroll.style.padding = "20px 24px";
  scroll.style.flex = "1 1 auto";

  const content = document.createElement("article");
  content.dataset.testid = "help-modal-content";
  scroll.appendChild(content);

  panel.appendChild(header);
  panel.appendChild(scroll);
  root.appendChild(backdrop);
  root.appendChild(panel);

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
