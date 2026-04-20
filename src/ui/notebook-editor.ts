/* SPDX-License-Identifier: Apache-2.0 */
import { Editor, type Content } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { FONT_FAMILY, TEXT_COLOR } from "./styles";

/**
 * Thin wrapper around a tiptap `Editor` that exposes only the surface the
 * workspace needs: get/set the tiptap-JSON document (matches
 * `notebooks.content_json` on the wire), append a line of text (used by the
 * "Insert link to this view" button), and subscribe to changes.
 *
 * `content_json` strings on the wire are ProseMirror docs. An empty
 * notebook is `EMPTY_DOC_JSON` — the canonical shape produced by tiptap
 * when the editor contains a single empty paragraph.
 */

export const EMPTY_DOC_JSON: string = JSON.stringify({ type: "doc", content: [] });

export type NotebookEditorOptions = {
  readonly container: HTMLElement;
  /** Initial JSON doc (tiptap shape). If blank or unparseable, starts empty. */
  readonly initialContent?: string;
  /** Fires after every user-visible edit with the latest JSON string. */
  readonly onChange?: (contentJson: string) => void;
};

export type NotebookEditor = {
  readonly element: HTMLElement;
  /** Returns the current document as a JSON string. */
  readonly getContent: () => string;
  /** Replaces the document with the given JSON string. No-ops on parse failure. */
  readonly setContent: (contentJson: string) => void;
  /**
   * Append a paragraph containing `text` at the end of the document, then
   * focus the editor with the caret at the end. Used for stamping
   * "Insert link to this view"-style entries.
   */
  readonly insertLine: (text: string) => void;
  readonly focus: () => void;
  readonly destroy: () => void;
};

function parseOrNull(s: string | undefined): Content {
  if (!s) return null;
  try {
    return JSON.parse(s) as Content;
  } catch {
    return null;
  }
}

export function createNotebookEditor(options: NotebookEditorOptions): NotebookEditor {
  const { container, initialContent, onChange } = options;

  const host = document.createElement("div");
  host.dataset.testid = "notebook-editor";
  host.style.flex = "1 1 auto";
  host.style.minHeight = "200px";
  host.style.background = "rgba(255,255,255,0.06)";
  host.style.border = "1px solid rgba(255,255,255,0.18)";
  host.style.borderRadius = "6px";
  host.style.color = TEXT_COLOR;
  host.style.fontFamily = FONT_FAMILY;
  host.style.fontSize = "13px";
  host.style.padding = "10px 12px";
  host.style.boxSizing = "border-box";
  host.style.overflowY = "auto";
  container.appendChild(host);

  const initialDoc: Content = parseOrNull(initialContent) ?? parseOrNull(EMPTY_DOC_JSON);

  const editor = new Editor({
    element: host,
    extensions: [StarterKit],
    content: initialDoc,
    editorProps: {
      attributes: {
        "data-testid": "notebook-editor-surface",
        role: "textbox",
        "aria-label": "Notebook content",
      },
    },
  });

  editor.on("update", () => {
    onChange?.(JSON.stringify(editor.getJSON()));
  });

  function getContent(): string {
    return JSON.stringify(editor.getJSON());
  }

  function setContent(contentJson: string): void {
    const parsed = parseOrNull(contentJson);
    if (parsed === null) return;
    // `emitUpdate: false` — setContent is how we load server state, which
    // should not re-trigger the onChange -> save loop.
    editor.commands.setContent(parsed, { emitUpdate: false });
  }

  function insertLine(text: string): void {
    editor.chain().focus().insertContent(text).insertContent({ type: "paragraph" }).run();
  }

  function focus(): void {
    editor.commands.focus();
  }

  function destroy(): void {
    editor.destroy();
    host.parentNode?.removeChild(host);
  }

  return { element: host, getContent, setContent, insertLine, focus, destroy };
}
