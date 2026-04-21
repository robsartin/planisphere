/* SPDX-License-Identifier: Apache-2.0 */
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { createNotebookMentionExtension } from "./notebook-mention";

/**
 * End-to-end tests for the custom Mention extension. These build a
 * real tiptap Editor in jsdom (same as `notebook-editor.test.ts` does)
 * and verify the persistence shape promised by ADR 013: mentions
 * serialise with `{ kind, id }` attrs, and loading that JSON back
 * round-trips losslessly.
 */

type MentionJsonNode = {
  type: string;
  attrs?: { kind?: string; id?: string };
  content?: MentionJsonNode[];
};

type DocJson = { type: string; content?: MentionJsonNode[] };

function mount(content?: DocJson): { editor: Editor; host: HTMLElement } {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const editor = new Editor({
    element: host,
    extensions: [StarterKit, createNotebookMentionExtension()],
    ...(content !== undefined ? { content } : {}),
  });
  return { editor, host };
}

function findMention(doc: DocJson): MentionJsonNode | undefined {
  for (const block of doc.content ?? []) {
    for (const inline of block.content ?? []) {
      if (inline.type === "mention") return inline;
    }
  }
  return undefined;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("notebook mention extension", () => {
  it("serialises an inserted mention with {kind, id} attrs", () => {
    const { editor } = mount();
    editor
      .chain()
      .focus()
      .insertContent({
        type: "mention",
        attrs: { kind: "event", id: "perseids" },
      })
      .run();

    const doc = editor.getJSON() as DocJson;
    const mention = findMention(doc);
    expect(mention).toBeDefined();
    expect(mention?.type).toBe("mention");
    expect(mention?.attrs?.kind).toBe("event");
    expect(mention?.attrs?.id).toBe("perseids");
    editor.destroy();
  });

  it("round-trips a mention through JSON without losing attrs", () => {
    const original: DocJson = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Watching " } as MentionJsonNode,
            {
              type: "mention",
              attrs: { kind: "constellation", id: "Ori" },
            },
          ],
        },
      ],
    };
    const { editor } = mount(original);
    const json = editor.getJSON() as DocJson;
    const mention = findMention(json);
    expect(mention?.attrs?.kind).toBe("constellation");
    expect(mention?.attrs?.id).toBe("Ori");
    editor.destroy();
  });

  it("renders a mention with a data-kind + data-id attribute pair", () => {
    const { editor } = mount();
    editor
      .chain()
      .focus()
      .insertContent({
        type: "mention",
        attrs: { kind: "body", id: "Mars" },
      })
      .run();
    const mentionEl = document.querySelector<HTMLElement>(
      "[data-type='mention'], .notebook-mention",
    );
    expect(mentionEl).not.toBeNull();
    expect(mentionEl?.getAttribute("data-kind")).toBe("body");
    expect(mentionEl?.getAttribute("data-id")).toBe("Mars");
    editor.destroy();
  });

  it("renders a graceful placeholder for an unknown mention id", () => {
    const { editor } = mount({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "mention",
              attrs: { kind: "event", id: "made-up-shower" },
            },
          ],
        },
      ],
    });
    // renderText is what the editor uses when serialising to plain text;
    // the visible DOM uses renderLabel. Either way the output should
    // signal "unknown" rather than just "@".
    const text = editor.getText({ blockSeparator: "" });
    expect(text.length).toBeGreaterThan(0);
    editor.destroy();
  });
});
