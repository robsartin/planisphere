/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createNotebookWorkspace, NOTEBOOK_SCRATCH_STORAGE_KEY } from "./notebook-workspace";

describe("createNotebookWorkspace", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear();
  });

  afterEach(() => {
    globalThis.localStorage?.clear();
  });

  it("returns an object with element, setVisible, and destroy", () => {
    const ws = createNotebookWorkspace({});
    expect(ws).toHaveProperty("element");
    expect(ws).toHaveProperty("setVisible");
    expect(ws).toHaveProperty("destroy");
  });

  it("is hidden by default (display: none)", () => {
    const { element } = createNotebookWorkspace({});
    expect(element.style.display).toBe("none");
  });

  it("setVisible(true) shows the workspace", () => {
    const { element, setVisible } = createNotebookWorkspace({});
    setVisible(true);
    expect(element.style.display).not.toBe("none");
  });

  it("setVisible(false) hides the workspace", () => {
    const { element, setVisible } = createNotebookWorkspace({});
    setVisible(true);
    setVisible(false);
    expect(element.style.display).toBe("none");
  });

  it("renders the placeholder headline and description", () => {
    const { element } = createNotebookWorkspace({});
    expect(element.querySelector("[data-testid='notebook-heading']")).not.toBeNull();
    expect(element.textContent).toMatch(/Notebook/);
    expect(element.textContent).toMatch(/observation notes/i);
  });

  it("renders a scratch textarea users can type into", () => {
    const { element } = createNotebookWorkspace({});
    const textarea = element.querySelector<HTMLTextAreaElement>("[data-testid='notebook-scratch']");
    expect(textarea).not.toBeNull();
    expect(textarea!.tagName).toBe("TEXTAREA");
  });

  it("restores persisted scratch contents from localStorage on mount", () => {
    globalThis.localStorage.setItem(NOTEBOOK_SCRATCH_STORAGE_KEY, "prior notes");
    const { element } = createNotebookWorkspace({});
    const textarea = element.querySelector<HTMLTextAreaElement>(
      "[data-testid='notebook-scratch']",
    )!;
    expect(textarea.value).toBe("prior notes");
  });

  it("autosaves scratch input to localStorage on input event", () => {
    const { element } = createNotebookWorkspace({});
    const textarea = element.querySelector<HTMLTextAreaElement>(
      "[data-testid='notebook-scratch']",
    )!;
    textarea.value = "Saturday night — Perseids peaked.";
    textarea.dispatchEvent(new Event("input"));
    expect(globalThis.localStorage.getItem(NOTEBOOK_SCRATCH_STORAGE_KEY)).toBe(
      "Saturday night — Perseids peaked.",
    );
  });

  it("starts with empty textarea when no prior content is saved", () => {
    const { element } = createNotebookWorkspace({});
    const textarea = element.querySelector<HTMLTextAreaElement>(
      "[data-testid='notebook-scratch']",
    )!;
    expect(textarea.value).toBe("");
  });

  it("destroy() detaches the element from its parent", () => {
    const container = document.createElement("div");
    const { element, destroy } = createNotebookWorkspace({});
    container.appendChild(element);
    expect(container.contains(element)).toBe(true);
    destroy();
    expect(container.contains(element)).toBe(false);
  });

  it("handles localStorage unavailable (e.g. private browsing) without throwing", () => {
    const orig = globalThis.localStorage;
    const broken = {
      getItem: () => {
        throw new Error("storage denied");
      },
      setItem: () => {
        throw new Error("storage denied");
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } satisfies Storage;
    Object.defineProperty(globalThis, "localStorage", {
      value: broken,
      configurable: true,
    });
    try {
      expect(() => {
        const { element } = createNotebookWorkspace({});
        const textarea = element.querySelector<HTMLTextAreaElement>(
          "[data-testid='notebook-scratch']",
        )!;
        textarea.value = "x";
        textarea.dispatchEvent(new Event("input"));
      }).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        value: orig,
        configurable: true,
      });
    }
  });
});
