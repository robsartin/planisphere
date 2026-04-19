/* SPDX-License-Identifier: Apache-2.0 */
import { PANEL_BG, PANEL_BORDER, TEXT_COLOR, FONT_FAMILY } from "./styles";

/**
 * localStorage key for the placeholder scratch textarea. This is a temporary
 * v1 shape: a single opaque string. Milestone #219 replaces this with a real
 * structured editor; bumping the suffix (`.v2`) at that point avoids loading
 * free-form text into a schema-aware store.
 */
export const NOTEBOOK_SCRATCH_STORAGE_KEY = "planisphere.notebook.scratch.v1";

export type NotebookWorkspaceOptions = {
  /** Initial visibility — defaults to false. */
  initiallyVisible?: boolean;
  /**
   * Supplies the current shareable URL + time. When provided, an "Insert link"
   * button appears that stamps a markdown link into the scratch textarea at
   * the cursor. Omitted in tests that don't care about the button.
   */
  getCurrentView?: () => { readonly href: string; readonly timeUtc: Date };
};

export type NotebookWorkspace = {
  element: HTMLElement;
  setVisible: (visible: boolean) => void;
  destroy: () => void;
};

function safeGetScratch(): string {
  try {
    return globalThis.localStorage?.getItem(NOTEBOOK_SCRATCH_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function safeSetScratch(value: string): void {
  try {
    globalThis.localStorage?.setItem(NOTEBOOK_SCRATCH_STORAGE_KEY, value);
  } catch {
    // Storage quota exceeded / disabled — placeholder surface, ignore.
  }
}

/**
 * Notebook workspace shell (Plan 07 milestone 2A, issue #216).
 *
 * Right-side fixed panel shown when the app is in notebook mode. For this
 * milestone the body is an intentional placeholder with a single scratch
 * textarea that autosaves to localStorage. The real structured editor lands
 * in #219.
 */
export function createNotebookWorkspace(options: NotebookWorkspaceOptions = {}): NotebookWorkspace {
  const root = document.createElement("aside");
  root.dataset.testid = "notebook-workspace";
  root.style.position = "fixed";
  root.style.top = "0";
  root.style.left = "0";
  root.style.bottom = "0";
  root.style.width = "400px";
  root.style.maxWidth = "100vw";
  root.style.background = PANEL_BG;
  root.style.borderRight = PANEL_BORDER;
  root.style.color = TEXT_COLOR;
  root.style.fontFamily = FONT_FAMILY;
  root.style.display = options.initiallyVisible === true ? "flex" : "none";
  root.style.flexDirection = "column";
  root.style.padding = "20px 22px";
  root.style.gap = "14px";
  root.style.boxSizing = "border-box";
  root.style.zIndex = "1200";
  root.style.overflowY = "auto";

  // Responsive: on narrow viewports the shell goes full-width. Applied once at
  // creation using window.innerWidth as a cheap heuristic; the real responsive
  // layout arrives in #219.
  const isMobile =
    typeof window !== "undefined" && window.innerWidth > 0 && window.innerWidth < 600;
  if (isMobile) {
    root.style.width = "100vw";
  }

  const heading = document.createElement("h2");
  heading.dataset.testid = "notebook-heading";
  heading.textContent = "Notebook";
  heading.style.margin = "0";
  heading.style.fontSize = "20px";
  heading.style.fontWeight = "600";
  heading.style.letterSpacing = "0.01em";

  const description = document.createElement("p");
  description.dataset.testid = "notebook-description";
  description.textContent =
    "Your observation notes live here. Coming soon: rich editor, linked events, saved sessions.";
  description.style.margin = "0";
  description.style.fontSize = "13px";
  description.style.lineHeight = "1.5";
  description.style.color = "rgba(255,255,255,0.72)";

  const scratchLabel = document.createElement("label");
  scratchLabel.textContent = "Scratch";
  scratchLabel.style.fontSize = "11px";
  scratchLabel.style.textTransform = "uppercase";
  scratchLabel.style.letterSpacing = "0.08em";
  scratchLabel.style.color = "rgba(255,255,255,0.55)";
  scratchLabel.style.marginTop = "6px";

  const scratch = document.createElement("textarea");
  scratch.dataset.testid = "notebook-scratch";
  scratch.placeholder = "Jot a quick note — it autosaves locally and carries over between visits.";
  scratch.value = safeGetScratch();
  scratch.style.flex = "1 1 auto";
  scratch.style.minHeight = "140px";
  scratch.style.resize = "vertical";
  scratch.style.background = "rgba(255,255,255,0.06)";
  scratch.style.border = "1px solid rgba(255,255,255,0.18)";
  scratch.style.borderRadius = "6px";
  scratch.style.color = TEXT_COLOR;
  scratch.style.fontFamily = FONT_FAMILY;
  scratch.style.fontSize = "13px";
  scratch.style.padding = "10px 12px";
  scratch.style.boxSizing = "border-box";
  scratchLabel.htmlFor = "notebook-scratch-textarea";
  scratch.id = "notebook-scratch-textarea";

  function onScratchInput(): void {
    safeSetScratch(scratch.value);
  }
  scratch.addEventListener("input", onScratchInput);

  // Optional "Insert link to current view" button. Only mounts when a
  // getCurrentView callback is supplied so the notebook-alone test paths stay
  // dependency-free. Format: Markdown link `- [YYYY-MM-DD HH:MM](href)\n` so
  // a future slideshow parser can extract views as ordered list items.
  let insertLinkBtn: HTMLButtonElement | null = null;
  if (options.getCurrentView !== undefined) {
    const getCurrentView = options.getCurrentView;
    insertLinkBtn = document.createElement("button");
    insertLinkBtn.type = "button";
    insertLinkBtn.dataset.testid = "notebook-insert-link";
    insertLinkBtn.textContent = "\u2192 Insert link to this view";
    insertLinkBtn.style.background = "rgba(255,255,255,0.08)";
    insertLinkBtn.style.border = "1px solid rgba(255,255,255,0.2)";
    insertLinkBtn.style.borderRadius = "4px";
    insertLinkBtn.style.color = TEXT_COLOR;
    insertLinkBtn.style.cursor = "pointer";
    insertLinkBtn.style.fontFamily = FONT_FAMILY;
    insertLinkBtn.style.fontSize = "12px";
    insertLinkBtn.style.padding = "6px 10px";
    insertLinkBtn.style.alignSelf = "flex-start";

    insertLinkBtn.addEventListener("click", () => {
      const view = getCurrentView();
      const pad = (n: number): string => String(n).padStart(2, "0");
      const d = view.timeUtc;
      const stamp =
        `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
        `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      const line = `- [${stamp}](${view.href})\n`;

      const start = scratch.selectionStart ?? scratch.value.length;
      const end = scratch.selectionEnd ?? scratch.value.length;
      scratch.value = scratch.value.slice(0, start) + line + scratch.value.slice(end);
      // Move cursor to end of inserted line so user can type a caption.
      const caret = start + line.length;
      scratch.selectionStart = caret;
      scratch.selectionEnd = caret;
      scratch.focus();
      // Trigger the existing autosave handler explicitly. Setting .value in
      // code does not fire 'input'; dispatching matches the handler's contract.
      scratch.dispatchEvent(new Event("input"));
    });
  }

  root.appendChild(heading);
  root.appendChild(description);
  root.appendChild(scratchLabel);
  if (insertLinkBtn !== null) {
    root.appendChild(insertLinkBtn);
  }
  root.appendChild(scratch);

  function setVisible(visible: boolean): void {
    root.style.display = visible ? "flex" : "none";
  }

  function destroy(): void {
    scratch.removeEventListener("input", onScratchInput);
    root.parentNode?.removeChild(root);
  }

  return { element: root, setVisible, destroy };
}
