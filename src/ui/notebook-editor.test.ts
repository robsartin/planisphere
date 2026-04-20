/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createNotebookEditor, EMPTY_DOC_JSON } from "./notebook-editor";

/**
 * jsdom-level tests for the tiptap wrapper. We exercise the thin surface
 * (get/set/insertLine/onChange/destroy) but don't simulate browser-only
 * behavior like selection or IME.
 */

const SAMPLE = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hello world" }] }],
});

type DocShape = {
  type: string;
  content?: Array<{ content?: Array<{ text?: string }> }>;
};

function parseDoc(json: string): DocShape {
  return JSON.parse(json) as DocShape;
}

function mountEditor(init?: {
  initialContent?: string;
  onChange?: (json: string) => void;
}): ReturnType<typeof createNotebookEditor> & { container: HTMLElement } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const editor = createNotebookEditor({ container, ...init });
  return Object.assign(editor, { container });
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createNotebookEditor", () => {
  it("mounts an editor host into the container", () => {
    const { container, destroy } = mountEditor();
    expect(container.querySelector("[data-testid=notebook-editor]")).not.toBeNull();
    destroy();
  });

  it("starts empty when no initial content is provided", () => {
    const e = mountEditor();
    const doc = parseDoc(e.getContent());
    expect(doc.type).toBe("doc");
    e.destroy();
  });

  it("loads the initial content", () => {
    const e = mountEditor({ initialContent: SAMPLE });
    const doc = parseDoc(e.getContent());
    expect(doc.content?.[0]?.content?.[0]?.text).toBe("Hello world");
    e.destroy();
  });

  it("ignores unparseable initial content", () => {
    const e = mountEditor({ initialContent: "{not json" });
    const doc = parseDoc(e.getContent());
    expect(doc.type).toBe("doc");
    e.destroy();
  });

  it("setContent replaces the document without firing onChange", () => {
    const onChange = vi.fn();
    const e = mountEditor({ onChange });
    onChange.mockClear(); // Ignore any construction-time events.
    e.setContent(SAMPLE);
    const doc = parseDoc(e.getContent());
    expect(doc.content?.[0]?.content?.[0]?.text).toBe("Hello world");
    expect(onChange).not.toHaveBeenCalled();
    e.destroy();
  });

  it("setContent no-ops on malformed JSON", () => {
    const e = mountEditor({ initialContent: SAMPLE });
    e.setContent("not json");
    const doc = parseDoc(e.getContent());
    expect(doc.content?.[0]?.content?.[0]?.text).toBe("Hello world");
    e.destroy();
  });

  it("insertLine appends text and fires onChange", () => {
    const onChange = vi.fn();
    const e = mountEditor({ onChange });
    e.insertLine("Perseids peak tonight");
    expect(onChange).toHaveBeenCalled();
    expect(e.getContent()).toContain("Perseids peak tonight");
    e.destroy();
  });

  it("destroy removes the editor host from the container", () => {
    const { container, destroy } = mountEditor();
    expect(container.querySelector("[data-testid=notebook-editor]")).not.toBeNull();
    destroy();
    expect(container.querySelector("[data-testid=notebook-editor]")).toBeNull();
  });

  it("EMPTY_DOC_JSON parses as a tiptap doc", () => {
    const parsed = parseDoc(EMPTY_DOC_JSON);
    expect(parsed.type).toBe("doc");
  });
});
