/* SPDX-License-Identifier: Apache-2.0 */
import { isPro } from "../features";
import type { NotebookDoc, NotebookError, NotebookPayload, NotebookSummary } from "../notebooks";
import {
  createNotebook,
  deleteNotebook,
  getNotebook,
  listNotebooks,
  updateNotebook,
} from "../notebooks";
import type { Result } from "../result";
import { createNotebookEditor, EMPTY_DOC_JSON, type NotebookEditor } from "./notebook-editor";
import { FONT_FAMILY, PANEL_BG, PANEL_BORDER, TEXT_COLOR } from "./styles";

/** Pluggable Notebook API — the workspace receives these so tests can pass
 *  stubs and the production caller wires them to `src/notebooks.ts`. */
export type NotebookApi = {
  list(): Promise<Result<NotebookSummary[], NotebookError>>;
  create(payload: NotebookPayload): Promise<Result<NotebookDoc, NotebookError>>;
  get(id: number): Promise<Result<NotebookDoc, NotebookError>>;
  update(id: number, payload: NotebookPayload): Promise<Result<NotebookDoc, NotebookError>>;
  delete(id: number): Promise<Result<void, NotebookError>>;
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
  get: getNotebook,
  update: updateNotebook,
  delete: deleteNotebook,
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

  // Title row: editable current title + new / delete action buttons.
  const titleRow = document.createElement("div");
  titleRow.style.display = "flex";
  titleRow.style.gap = "6px";
  titleRow.style.alignItems = "center";

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.dataset.testid = "notebook-title";
  titleInput.placeholder = "Untitled notebook";
  titleInput.style.flex = "1 1 auto";
  titleInput.style.background = "rgba(255,255,255,0.06)";
  titleInput.style.border = "1px solid rgba(255,255,255,0.18)";
  titleInput.style.borderRadius = "4px";
  titleInput.style.color = TEXT_COLOR;
  titleInput.style.fontFamily = FONT_FAMILY;
  titleInput.style.fontSize = "14px";
  titleInput.style.padding = "6px 10px";

  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.dataset.testid = "notebook-new";
  newBtn.textContent = "+ New";
  styleActionButton(newBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.dataset.testid = "notebook-delete";
  deleteBtn.textContent = "Delete";
  styleActionButton(deleteBtn);

  titleRow.appendChild(titleInput);
  titleRow.appendChild(newBtn);
  titleRow.appendChild(deleteBtn);
  root.appendChild(titleRow);

  // Tab list (horizontal, scrollable if overflows). One entry per summary.
  const tabList = document.createElement("div");
  tabList.dataset.testid = "notebook-tabs";
  tabList.style.display = "flex";
  tabList.style.flexWrap = "wrap";
  tabList.style.gap = "6px";
  root.appendChild(tabList);

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
  let summaries: NotebookSummary[] = [];
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

  function renderTabs(): void {
    tabList.textContent = "";
    for (const s of summaries) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.dataset.testid = "notebook-tab";
      tab.dataset.notebookId = String(s.id);
      tab.dataset.active = s.id === currentId ? "true" : "false";
      tab.textContent = s.title;
      tab.style.background =
        s.id === currentId ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)";
      tab.style.border = "1px solid rgba(255,255,255,0.2)";
      tab.style.borderRadius = "999px";
      tab.style.color = TEXT_COLOR;
      tab.style.cursor = "pointer";
      tab.style.fontFamily = FONT_FAMILY;
      tab.style.fontSize = "12px";
      tab.style.padding = "4px 10px";
      tab.style.maxWidth = "150px";
      tab.style.overflow = "hidden";
      tab.style.textOverflow = "ellipsis";
      tab.style.whiteSpace = "nowrap";
      tab.addEventListener("click", () => {
        if (s.id !== currentId) void switchTo(s.id);
      });
      tabList.appendChild(tab);
    }
  }

  function syncTitleInput(): void {
    if (titleInput.value !== currentTitle) titleInput.value = currentTitle;
  }

  function updateSummary(next: NotebookDoc): void {
    summaries = summaries.filter((s) => s.id !== next.id);
    summaries.unshift({
      id: next.id,
      title: next.title,
      created_at: next.created_at,
      updated_at: next.updated_at,
    });
    renderTabs();
  }

  async function saveNow(contentJson: string): Promise<void> {
    if (currentId === null) return;
    setStatus("saving");
    const res = await api.update(currentId, { title: currentTitle, content_json: contentJson });
    if (res.ok) {
      updateSummary(res.value);
      setStatus("saved");
    } else {
      setStatus("error");
    }
  }

  function scheduleSave(contentJson: string): void {
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void saveNow(contentJson);
    }, saveDebounceMs);
  }

  async function flushPendingSave(): Promise<void> {
    if (saveTimer === null || editor === null) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    await saveNow(editor.getContent());
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

  async function adopt(doc: NotebookDoc): Promise<void> {
    currentId = doc.id;
    currentTitle = doc.title;
    mountEditor(doc.content_json);
    syncTitleInput();
    renderTabs();
    statusLine.textContent = "";
    await Promise.resolve();
  }

  async function switchTo(id: number): Promise<void> {
    await flushPendingSave();
    statusLine.textContent = "Loading…";
    const res = await api.get(id);
    if (!res.ok) {
      renderError(errorToMessage(res.error));
      statusLine.textContent = "";
      return;
    }
    await adopt(res.value);
  }

  async function createFresh(): Promise<boolean> {
    const res = await api.create({
      title: DEFAULT_NOTEBOOK_TITLE,
      content_json: EMPTY_DOC_JSON,
    });
    if (!res.ok) {
      renderError(errorToMessage(res.error));
      statusLine.textContent = "";
      return false;
    }
    summaries.unshift({
      id: res.value.id,
      title: res.value.title,
      created_at: res.value.created_at,
      updated_at: res.value.updated_at,
    });
    await adopt(res.value);
    return true;
  }

  async function deleteCurrent(): Promise<void> {
    if (currentId === null) return;
    const ok = globalThis.confirm("Delete this notebook? This can't be undone.");
    if (!ok) return;
    const id = currentId;
    // Cancel any pending save for the doomed notebook.
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    const res = await api.delete(id);
    if (!res.ok) {
      setStatus("error");
      return;
    }
    summaries = summaries.filter((s) => s.id !== id);
    currentId = null;
    if (summaries.length > 0) {
      await switchTo(summaries[0]!.id);
    } else {
      await createFresh();
    }
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
    summaries = [...listRes.value];
    const first = summaries[0];
    if (first !== undefined) {
      const getRes = await api.get(first.id);
      if (!getRes.ok) {
        renderError(errorToMessage(getRes.error));
        statusLine.textContent = "";
        return;
      }
      await adopt(getRes.value);
    } else {
      await createFresh();
    }
  }

  // --- listeners

  titleInput.addEventListener("change", () => {
    if (currentId === null) return;
    const next = titleInput.value.trim();
    if (next.length === 0 || next === currentTitle) {
      syncTitleInput();
      return;
    }
    currentTitle = next;
    // PUT with the current content so the title change is durable even if
    // the user is also mid-typing in the editor.
    if (editor !== null) void saveNow(editor.getContent());
  });

  newBtn.addEventListener("click", () => {
    void (async () => {
      await flushPendingSave();
      await createFresh();
    })();
  });

  deleteBtn.addEventListener("click", () => {
    void deleteCurrent();
  });

  // --- bootstrap

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

function styleActionButton(btn: HTMLButtonElement): void {
  btn.style.background = "rgba(255,255,255,0.08)";
  btn.style.border = "1px solid rgba(255,255,255,0.2)";
  btn.style.borderRadius = "4px";
  btn.style.color = TEXT_COLOR;
  btn.style.cursor = "pointer";
  btn.style.fontFamily = FONT_FAMILY;
  btn.style.fontSize = "12px";
  btn.style.padding = "6px 10px";
  btn.style.whiteSpace = "nowrap";
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
  label.textContent = "→ Insert link to this view";
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
