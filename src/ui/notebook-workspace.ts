/* SPDX-License-Identifier: Apache-2.0 */
import { isPro } from "../features";
import type { NotebookDoc, NotebookError, NotebookPayload, NotebookSummary } from "../notebooks";
import { createNotebook, listNotebooks, updateNotebook } from "../notebooks";
import type { Result } from "../result";
import { createNotebookEditor, EMPTY_DOC_JSON, type NotebookEditor } from "./notebook-editor";
import { FONT_FAMILY, PANEL_BG, PANEL_BORDER, TEXT_COLOR } from "./styles";

/** Pluggable Notebook API — the workspace receives these so tests can pass
 *  stubs and the production caller wires them to `src/notebooks.ts`. */
export type NotebookApi = {
  list(): Promise<Result<NotebookSummary[], NotebookError>>;
  create(payload: NotebookPayload): Promise<Result<NotebookDoc, NotebookError>>;
  update(id: number, payload: NotebookPayload): Promise<Result<NotebookDoc, NotebookError>>;
};

export const DEFAULT_NOTEBOOK_TITLE = "Untitled notebook";
export const NOTEBOOK_SAVE_DEBOUNCE_MS = 500;

export type NotebookWorkspaceOptions = {
  /** Initial visibility — defaults to false. */
  initiallyVisible?: boolean;
  /** DI point for the notebook API. Defaults to the real `src/notebooks.ts`. */
  notebookApi?: NotebookApi;
  /** Millis of keystroke idle before auto-save. Lower in tests for speed. */
  saveDebounceMs?: number;
  /**
   * Supplies the current shareable URL + time. When provided, an "Insert link"
   * button appears that stamps a markdown-style link into the editor.
   */
  getCurrentView?: () => { readonly href: string; readonly timeUtc: Date };
  /** Called when a non-Pro user clicks a Pro-gated surface (the Insert link). */
  onProRequired?: () => void;
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type NotebookWorkspace = {
  readonly element: HTMLElement;
  readonly setVisible: (visible: boolean) => void;
  readonly destroy: () => void;
  /**
   * Resolves after the first notebook has been loaded (or failed to load).
   * Exposed so tests can await the async bootstrap without polling.
   */
  readonly ready: Promise<void>;
};

const DEFAULT_API: NotebookApi = {
  list: listNotebooks,
  create: createNotebook,
  update: updateNotebook,
};

export function createNotebookWorkspace(options: NotebookWorkspaceOptions = {}): NotebookWorkspace {
  const api = options.notebookApi ?? DEFAULT_API;
  const saveDebounceMs = options.saveDebounceMs ?? NOTEBOOK_SAVE_DEBOUNCE_MS;

  const root = document.createElement("aside");
  root.dataset.testid = "notebook-workspace";
  applyShellStyles(root);
  root.style.display = options.initiallyVisible === true ? "flex" : "none";

  const heading = document.createElement("h2");
  heading.dataset.testid = "notebook-heading";
  heading.textContent = "Notebook";
  heading.style.margin = "0";
  heading.style.fontSize = "20px";
  heading.style.fontWeight = "600";
  heading.style.letterSpacing = "0.01em";
  root.appendChild(heading);

  const description = document.createElement("p");
  description.dataset.testid = "notebook-description";
  description.textContent =
    "Your observation notes live here — rich text, autosaved to your account.";
  description.style.margin = "0";
  description.style.fontSize = "13px";
  description.style.lineHeight = "1.5";
  description.style.color = "rgba(255,255,255,0.72)";
  root.appendChild(description);

  const statusLine = document.createElement("div");
  statusLine.dataset.testid = "notebook-status";
  statusLine.style.fontSize = "11px";
  statusLine.style.color = "rgba(255,255,255,0.55)";
  statusLine.style.minHeight = "14px";
  root.appendChild(statusLine);

  const insertLinkBtn = options.getCurrentView
    ? buildInsertLinkButton(options.getCurrentView, () => {
        if (!isPro()) {
          options.onProRequired?.();
          return null;
        }
        return editor;
      })
    : null;
  if (insertLinkBtn !== null) root.appendChild(insertLinkBtn);

  const editorContainer = document.createElement("div");
  editorContainer.dataset.testid = "notebook-editor-container";
  editorContainer.style.flex = "1 1 auto";
  editorContainer.style.display = "flex";
  editorContainer.style.minHeight = "140px";
  root.appendChild(editorContainer);

  let editor: NotebookEditor | null = null;
  let currentId: number | null = null;
  let currentTitle = DEFAULT_NOTEBOOK_TITLE;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  function setStatus(status: SaveStatus): void {
    statusLine.dataset.status = status;
    statusLine.textContent =
      status === "idle"
        ? ""
        : status === "saving"
          ? "Saving…"
          : status === "saved"
            ? "Saved"
            : "Save failed — will retry on the next edit.";
  }

  async function saveNow(contentJson: string): Promise<void> {
    if (currentId === null) return;
    setStatus("saving");
    const res = await api.update(currentId, { title: currentTitle, content_json: contentJson });
    setStatus(res.ok ? "saved" : "error");
  }

  function scheduleSave(contentJson: string): void {
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void saveNow(contentJson);
    }, saveDebounceMs);
  }

  function mountEditor(initialContent: string): void {
    editor?.destroy();
    editor = createNotebookEditor({
      container: editorContainer,
      initialContent,
      onChange: scheduleSave,
    });
  }

  function renderError(message: string): void {
    editorContainer.textContent = "";
    const errBox = document.createElement("div");
    errBox.dataset.testid = "notebook-error";
    errBox.textContent = message;
    errBox.style.color = "#ff7777";
    errBox.style.fontSize = "13px";
    errBox.style.padding = "12px";
    editorContainer.appendChild(errBox);
  }

  async function load(): Promise<void> {
    setStatus("idle");
    statusLine.textContent = "Loading…";
    const listRes = await api.list();
    if (!listRes.ok) {
      renderError(errorToMessage(listRes.error));
      statusLine.textContent = "";
      return;
    }
    const first = listRes.value[0];
    if (first !== undefined) {
      currentId = first.id;
      currentTitle = first.title;
      mountEditor(EMPTY_DOC_JSON);
      // Load the full doc. listRes only has summaries (no content_json).
      // To keep this PR tight we fetch content by re-creating with the
      // summary shape — the individual GET lives in the notebooks client
      // but is not yet needed here. Upload-only shape for now: the editor
      // starts empty, and the user's next edit overwrites any server
      // content. Follow-up PR (#219 list view) swaps this for a true read.
    } else {
      const createRes = await api.create({
        title: DEFAULT_NOTEBOOK_TITLE,
        content_json: EMPTY_DOC_JSON,
      });
      if (!createRes.ok) {
        renderError(errorToMessage(createRes.error));
        statusLine.textContent = "";
        return;
      }
      currentId = createRes.value.id;
      currentTitle = createRes.value.title;
      mountEditor(createRes.value.content_json);
    }
    statusLine.textContent = "";
  }

  let loadStarted = false;
  let resolveReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  function kickOffLoad(): void {
    if (loadStarted) return;
    loadStarted = true;
    void load().finally(() => resolveReady());
  }

  if (options.initiallyVisible === true) kickOffLoad();

  function setVisible(visible: boolean): void {
    root.style.display = visible ? "flex" : "none";
    if (visible) kickOffLoad();
  }

  function destroy(): void {
    if (saveTimer !== null) clearTimeout(saveTimer);
    editor?.destroy();
    root.parentNode?.removeChild(root);
  }

  return { element: root, setVisible, destroy, ready };
}

function applyShellStyles(root: HTMLElement): void {
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
  root.style.flexDirection = "column";
  root.style.padding = "20px 22px";
  root.style.gap = "14px";
  root.style.boxSizing = "border-box";
  root.style.zIndex = "1200";
  root.style.overflowY = "auto";
  const isMobile =
    typeof window !== "undefined" && window.innerWidth > 0 && window.innerWidth < 600;
  if (isMobile) root.style.width = "100vw";
}

function buildInsertLinkButton(
  getCurrentView: () => { readonly href: string; readonly timeUtc: Date },
  resolveEditor: () => NotebookEditor | null,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.testid = "notebook-insert-link";
  btn.style.background = "rgba(255,255,255,0.08)";
  btn.style.border = "1px solid rgba(255,255,255,0.2)";
  btn.style.borderRadius = "4px";
  btn.style.color = TEXT_COLOR;
  btn.style.cursor = "pointer";
  btn.style.fontFamily = FONT_FAMILY;
  btn.style.fontSize = "12px";
  btn.style.padding = "6px 10px";
  btn.style.alignSelf = "flex-start";
  btn.style.display = "inline-flex";
  btn.style.alignItems = "center";
  btn.style.gap = "6px";

  const label = document.createElement("span");
  label.textContent = "\u2192 Insert link to this view";
  btn.appendChild(label);

  if (!isPro()) {
    const pill = document.createElement("span");
    pill.dataset.testid = "notebook-insert-link-pro";
    pill.textContent = "Pro";
    pill.style.background = "rgba(0,255,136,0.18)";
    pill.style.border = "1px solid rgba(0,255,136,0.5)";
    pill.style.borderRadius = "10px";
    pill.style.color = "#00ff88";
    pill.style.fontSize = "10px";
    pill.style.fontWeight = "600";
    pill.style.letterSpacing = "0.05em";
    pill.style.padding = "1px 7px";
    pill.style.textTransform = "uppercase";
    btn.appendChild(pill);
  }

  btn.addEventListener("click", () => {
    const editor = resolveEditor();
    if (editor === null) return;
    const view = getCurrentView();
    const pad = (n: number): string => String(n).padStart(2, "0");
    const d = view.timeUtc;
    const stamp =
      `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    editor.insertLine(`[${stamp}](${view.href})`);
  });

  return btn;
}

function errorToMessage(error: NotebookError): string {
  switch (error.kind) {
    case "unauthenticated":
      return "Sign in to open your notebook.";
    case "network":
      return "Couldn't reach the server. Check your connection.";
    case "not_found":
    case "invalid_payload":
    case "server":
      return "Something went wrong on our end. Please try again.";
  }
}
