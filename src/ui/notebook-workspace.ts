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
import { el } from "./dom";
import { messageFor } from "./error-messages";
import { createNotebookEditor, EMPTY_DOC_JSON, type NotebookEditor } from "./notebook-editor";
import {
  BORDER_SUBTLE,
  createProPill,
  FONT_FAMILY,
  PANEL_BG,
  PANEL_BORDER,
  SURFACE,
  SURFACE_ACTIVE,
  SURFACE_LOW,
  TEXT_COLOR,
  TEXT_MUTED,
} from "./styles";

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

const ACTION_BUTTON_STYLE: Partial<CSSStyleDeclaration> = {
  background: SURFACE,
  border: PANEL_BORDER,
  borderRadius: "4px",
  color: TEXT_COLOR,
  cursor: "pointer",
  fontFamily: FONT_FAMILY,
  fontSize: "12px",
  padding: "6px 10px",
  whiteSpace: "nowrap",
};

export function createNotebookWorkspace(options: NotebookWorkspaceOptions = {}): NotebookWorkspace {
  const api = options.notebookApi ?? DEFAULT_API;
  const saveDebounceMs = options.saveDebounceMs ?? NOTEBOOK_SAVE_DEBOUNCE_MS;

  const titleInput = el("input", {
    type: "text",
    testid: "notebook-title",
    placeholder: "Untitled notebook",
    style: {
      flex: "1 1 auto",
      background: SURFACE_LOW,
      border: BORDER_SUBTLE,
      borderRadius: "4px",
      color: TEXT_COLOR,
      fontFamily: FONT_FAMILY,
      fontSize: "14px",
      padding: "6px 10px",
    },
  });

  const newBtn = el("button", {
    type: "button",
    testid: "notebook-new",
    text: "+ New",
    style: ACTION_BUTTON_STYLE,
  });

  const deleteBtn = el("button", {
    type: "button",
    testid: "notebook-delete",
    text: "Delete",
    style: ACTION_BUTTON_STYLE,
  });

  const tabList = el("div", {
    testid: "notebook-tabs",
    style: { display: "flex", flexWrap: "wrap", gap: "6px" },
  });

  const statusLine = el("div", {
    testid: "notebook-status",
    style: { fontSize: "11px", color: TEXT_MUTED, minHeight: "14px" },
  });

  const editorContainer = el("div", {
    testid: "notebook-editor-container",
    style: { flex: "1 1 auto", display: "flex", minHeight: "140px" },
  });

  const insertLinkBtn = options.getCurrentView
    ? buildInsertLinkButton(options.getCurrentView, () => {
        if (!isPro()) {
          options.onProRequired?.();
          return null;
        }
        return editor;
      })
    : null;

  const root = el("aside", {
    testid: "notebook-workspace",
    style: {
      position: "fixed",
      top: "0",
      left: "0",
      bottom: "0",
      width: isMobileViewport() ? "100vw" : "400px",
      maxWidth: "100vw",
      background: PANEL_BG,
      borderRight: PANEL_BORDER,
      color: TEXT_COLOR,
      fontFamily: FONT_FAMILY,
      display: options.initiallyVisible === true ? "flex" : "none",
      flexDirection: "column",
      padding: "20px 22px",
      gap: "14px",
      boxSizing: "border-box",
      zIndex: "1200",
      overflowY: "auto",
    },
    children: [
      el("h2", {
        testid: "notebook-heading",
        text: "Notebook",
        style: {
          margin: "0",
          fontSize: "20px",
          fontWeight: "600",
          letterSpacing: "0.01em",
        },
      }),
      // Title row: editable current title + new / delete action buttons.
      el("div", {
        style: { display: "flex", gap: "6px", alignItems: "center" },
        children: [titleInput, newBtn, deleteBtn],
      }),
      tabList,
      statusLine,
      insertLinkBtn,
      editorContainer,
    ],
  });

  let editor: NotebookEditor | null = null;
  let summaries: NotebookSummary[] = [];
  let currentId: number | null = null;
  let currentTitle = DEFAULT_NOTEBOOK_TITLE;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  function setStatus(status: SaveStatus): void {
    statusLine.dataset["status"] = status;
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
    tabList.replaceChildren(
      ...summaries.map((s) =>
        el("button", {
          type: "button",
          testid: "notebook-tab",
          text: s.title,
          dataset: {
            notebookId: String(s.id),
            active: s.id === currentId ? "true" : "false",
          },
          style: {
            background: s.id === currentId ? SURFACE_ACTIVE : SURFACE_LOW,
            border: PANEL_BORDER,
            borderRadius: "999px",
            color: TEXT_COLOR,
            cursor: "pointer",
            fontFamily: FONT_FAMILY,
            fontSize: "12px",
            padding: "4px 10px",
            maxWidth: "150px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          },
          on: {
            click: () => {
              if (s.id !== currentId) void switchTo(s.id);
            },
          },
        }),
      ),
    );
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
    editorContainer.replaceChildren(
      el("div", {
        testid: "notebook-error",
        text: message,
        style: { color: "#ff7777", fontSize: "13px", padding: "12px" },
      }),
    );
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
      renderError(messageFor(res.error));
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
      renderError(messageFor(res.error));
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
      renderError(messageFor(listRes.error));
      statusLine.textContent = "";
      return;
    }
    summaries = [...listRes.value];
    const first = summaries[0];
    if (first !== undefined) {
      const getRes = await api.get(first.id);
      if (!getRes.ok) {
        renderError(messageFor(getRes.error));
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

function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth > 0 && window.innerWidth < 600;
}

function buildInsertLinkButton(
  getCurrentView: () => { readonly href: string; readonly timeUtc: Date },
  resolveEditor: () => NotebookEditor | null,
): HTMLButtonElement {
  const proPill = isPro() ? null : createProPill("notebook-insert-link-pro");

  return el("button", {
    type: "button",
    testid: "notebook-insert-link",
    style: {
      background: SURFACE,
      border: PANEL_BORDER,
      borderRadius: "4px",
      color: TEXT_COLOR,
      cursor: "pointer",
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      padding: "6px 10px",
      alignSelf: "flex-start",
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
    },
    children: [el("span", { text: "→ Insert link to this view" }), proPill],
    on: {
      click: () => {
        const editor = resolveEditor();
        if (editor === null) return;
        const view = getCurrentView();
        const pad = (n: number): string => String(n).padStart(2, "0");
        const d = view.timeUtc;
        const stamp =
          `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
          `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        editor.insertLine(`[${stamp}](${view.href})`);
      },
    },
  });
}
