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

  describe("layout — does not overlap the right-side panel", () => {
    it("anchors to the left edge, not the right", () => {
      const { element } = createNotebookWorkspace({});
      // Right-side is occupied by the 280px side panel (z-index 1000). Notebook
      // pins to the left edge so both are visible simultaneously.
      expect(element.style.left).toBe("0px");
      expect(element.style.right).toBe("");
    });

    it("uses a z-index lower than drawers/modals but high enough to sit above the sky", () => {
      const { element } = createNotebookWorkspace({});
      // Drawers are 2000, help modal 2000, onboarding 4000+. Notebook stays below
      // those so a drawer can be opened on top of it when needed.
      const z = Number(element.style.zIndex);
      expect(z).toBeGreaterThanOrEqual(900);
      expect(z).toBeLessThan(2000);
    });
  });

  describe("insert link to current view", () => {
    const TEST_HREF = "http://localhost:5173/?lat=40.7&lon=-74&t=2026-08-12T04:30:00.000Z";
    const TEST_TIME = new Date("2026-08-12T04:30:00.000Z");

    function pad(n: number): string {
      return String(n).padStart(2, "0");
    }
    function expectedLocalStamp(d: Date): string {
      return (
        `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
        `${pad(d.getHours())}:${pad(d.getMinutes())}`
      );
    }

    it("renders an 'Insert link' button", () => {
      const { element } = createNotebookWorkspace({
        getCurrentView: () => ({ href: TEST_HREF, timeUtc: TEST_TIME }),
      });
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='notebook-insert-link']");
      expect(btn).not.toBeNull();
    });

    it("clicking inserts a markdown link with local-time label at the cursor", () => {
      const { element } = createNotebookWorkspace({
        getCurrentView: () => ({ href: TEST_HREF, timeUtc: TEST_TIME }),
      });
      const textarea = element.querySelector<HTMLTextAreaElement>(
        "[data-testid='notebook-scratch']",
      )!;
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='notebook-insert-link']")!;
      textarea.value = "";
      textarea.selectionStart = 0;
      textarea.selectionEnd = 0;
      btn.click();
      const stamp = expectedLocalStamp(TEST_TIME);
      expect(textarea.value).toContain(`[${stamp}](${TEST_HREF})`);
    });

    it("insert preserves surrounding text and lands at the cursor", () => {
      const { element } = createNotebookWorkspace({
        getCurrentView: () => ({ href: TEST_HREF, timeUtc: TEST_TIME }),
      });
      const textarea = element.querySelector<HTMLTextAreaElement>(
        "[data-testid='notebook-scratch']",
      )!;
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='notebook-insert-link']")!;
      textarea.value = "before\nafter";
      textarea.selectionStart = 7; // after "before\n"
      textarea.selectionEnd = 7;
      btn.click();
      expect(textarea.value.startsWith("before\n")).toBe(true);
      expect(textarea.value.endsWith("after")).toBe(true);
      expect(textarea.value).toContain(TEST_HREF);
    });

    it("insert triggers autosave to localStorage", () => {
      const { element } = createNotebookWorkspace({
        getCurrentView: () => ({ href: TEST_HREF, timeUtc: TEST_TIME }),
      });
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='notebook-insert-link']")!;
      btn.click();
      const saved = globalThis.localStorage.getItem(NOTEBOOK_SCRATCH_STORAGE_KEY) ?? "";
      expect(saved).toContain(TEST_HREF);
    });

    it("is a no-op when getCurrentView is not supplied (button hidden)", () => {
      const { element } = createNotebookWorkspace({});
      const btn = element.querySelector<HTMLButtonElement>("[data-testid='notebook-insert-link']");
      expect(btn).toBeNull();
    });
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
