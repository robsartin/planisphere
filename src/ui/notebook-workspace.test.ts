/* SPDX-License-Identifier: Apache-2.0 */
/* eslint-disable @typescript-eslint/require-await */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createNotebookWorkspace,
  DEFAULT_NOTEBOOK_TITLE,
  type NotebookApi,
} from "./notebook-workspace";
import { clearUser, setUser } from "../features";
import { err, ok } from "../result";
import type { NotebookDoc, NotebookError, NotebookSummary } from "../notebooks";

/**
 * Workspace integration tests. Real tiptap editor mounts in jsdom
 * (covered by notebook-editor.test.ts); here we stub the notebook API
 * to verify the load / switch / create / rename / delete choreography.
 */

type Calls = {
  list: number;
  create: number;
  gets: number[];
  updates: Array<{ id: number; content_json: string; title: string }>;
  deletes: number[];
};

type NotebookStore = Map<number, NotebookDoc>;

function makeStore(initial: NotebookDoc[] = []): NotebookStore {
  return new Map(initial.map((n) => [n.id, n]));
}

function summary(doc: NotebookDoc): NotebookSummary {
  return {
    id: doc.id,
    title: doc.title,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

function stubApi(
  store: NotebookStore = makeStore(),
  overrides: Partial<NotebookApi> = {},
): { api: NotebookApi; calls: Calls; store: NotebookStore } {
  const calls: Calls = { list: 0, create: 0, gets: [], updates: [], deletes: [] };
  let nextId = Math.max(0, ...[...store.keys()]) + 1;
  const api: NotebookApi = {
    list:
      overrides.list ??
      (async () => {
        calls.list += 1;
        const sorted = [...store.values()].sort((a, b) => b.updated_at - a.updated_at);
        return ok(sorted.map(summary));
      }),
    create:
      overrides.create ??
      (async (payload) => {
        calls.create += 1;
        const doc: NotebookDoc = {
          id: nextId,
          title: payload.title,
          content_json: payload.content_json,
          created_at: nextId * 10,
          updated_at: nextId * 10,
        };
        store.set(nextId, doc);
        nextId += 1;
        return ok(doc);
      }),
    get:
      overrides.get ??
      (async (id) => {
        calls.gets.push(id);
        const doc = store.get(id);
        if (!doc) return err<NotebookError>({ kind: "not_found" });
        return ok(doc);
      }),
    update:
      overrides.update ??
      (async (id, payload) => {
        calls.updates.push({ id, title: payload.title, content_json: payload.content_json });
        const current = store.get(id);
        if (!current) return err<NotebookError>({ kind: "not_found" });
        const next: NotebookDoc = {
          ...current,
          title: payload.title,
          content_json: payload.content_json,
          updated_at: current.updated_at + 1,
        };
        store.set(id, next);
        return ok(next);
      }),
    delete:
      overrides.delete ??
      (async (id) => {
        calls.deletes.push(id);
        if (!store.has(id)) return err<NotebookError>({ kind: "not_found" });
        store.delete(id);
        return ok(undefined);
      }),
  };
  return { api, calls, store };
}

const SAVE_DEBOUNCE = 10;

beforeEach(() => {
  vi.useFakeTimers();
  clearUser();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("createNotebookWorkspace — shell", () => {
  it("is hidden by default", () => {
    const { api } = stubApi();
    const { element, destroy } = createNotebookWorkspace({
      notebookApi: api,
      saveDebounceMs: SAVE_DEBOUNCE,
    });
    expect(element.style.display).toBe("none");
    destroy();
  });

  it("setVisible(true) shows; setVisible(false) hides", () => {
    const { api } = stubApi();
    const { element, setVisible, destroy } = createNotebookWorkspace({
      notebookApi: api,
      saveDebounceMs: SAVE_DEBOUNCE,
    });
    setVisible(true);
    expect(element.style.display).not.toBe("none");
    setVisible(false);
    expect(element.style.display).toBe("none");
    destroy();
  });

  it("destroy() detaches the element", () => {
    const { api } = stubApi();
    const container = document.createElement("div");
    const { element, destroy } = createNotebookWorkspace({
      notebookApi: api,
      saveDebounceMs: SAVE_DEBOUNCE,
    });
    container.appendChild(element);
    expect(container.contains(element)).toBe(true);
    destroy();
    expect(container.contains(element)).toBe(false);
  });
});

describe("createNotebookWorkspace — list view", () => {
  function makeDoc(id: number, title: string, body = "x"): NotebookDoc {
    return {
      id,
      title,
      content_json: JSON.stringify({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: body }] }],
      }),
      created_at: id,
      updated_at: id,
    };
  }

  it("creates a default notebook when the user has none", async () => {
    const { api, calls } = stubApi();
    const ws = createNotebookWorkspace({
      notebookApi: api,
      saveDebounceMs: SAVE_DEBOUNCE,
      initiallyVisible: true,
    });
    await vi.runAllTimersAsync();
    await ws.ready;
    expect(calls.create).toBe(1);
    const tabs = ws.element.querySelectorAll<HTMLElement>("[data-testid='notebook-tab']");
    expect(tabs.length).toBe(1);
    expect(tabs[0]?.textContent).toContain(DEFAULT_NOTEBOOK_TITLE);
    ws.destroy();
  });

  it("renders a tab per existing notebook, newest-updated first", async () => {
    const store = makeStore([makeDoc(1, "Older", "a"), makeDoc(2, "Newer", "b")]);
    const { api } = stubApi(store);
    const ws = createNotebookWorkspace({
      notebookApi: api,
      saveDebounceMs: SAVE_DEBOUNCE,
      initiallyVisible: true,
    });
    await vi.runAllTimersAsync();
    await ws.ready;
    const tabs = ws.element.querySelectorAll<HTMLElement>("[data-testid='notebook-tab']");
    expect([...tabs].map((t) => t.textContent)).toEqual(["Newer", "Older"]);
    ws.destroy();
  });

  it("marks the currently-open notebook's tab as active", async () => {
    const store = makeStore([makeDoc(1, "One"), makeDoc(2, "Two")]);
    const { api } = stubApi(store);
    const ws = createNotebookWorkspace({
      notebookApi: api,
      saveDebounceMs: SAVE_DEBOUNCE,
      initiallyVisible: true,
    });
    await vi.runAllTimersAsync();
    await ws.ready;
    const active = ws.element.querySelector<HTMLElement>(
      "[data-testid='notebook-tab'][data-active='true']",
    );
    expect(active?.textContent).toBe("Two");
    ws.destroy();
  });

  it("clicking a different tab loads its content into the editor", async () => {
    const store = makeStore([makeDoc(1, "One", "content-A"), makeDoc(2, "Two", "content-B")]);
    const { api, calls } = stubApi(store);
    const ws = createNotebookWorkspace({
      notebookApi: api,
      saveDebounceMs: SAVE_DEBOUNCE,
      initiallyVisible: true,
    });
    await vi.runAllTimersAsync();
    await ws.ready;
    expect(calls.gets).toEqual([2]); // adopted the newer one

    const oneTab = [
      ...ws.element.querySelectorAll<HTMLElement>("[data-testid='notebook-tab']"),
    ].find((t) => t.textContent === "One");
    oneTab!.click();
    await vi.runAllTimersAsync();
    expect(calls.gets.at(-1)).toBe(1);
    const surface = ws.element.querySelector<HTMLElement>(".ProseMirror");
    expect(surface?.textContent).toContain("content-A");
    ws.destroy();
  });

  it("the New button creates a fresh notebook and switches to it", async () => {
    const store = makeStore([makeDoc(1, "Existing")]);
    const { api, calls } = stubApi(store);
    const ws = createNotebookWorkspace({
      notebookApi: api,
      saveDebounceMs: SAVE_DEBOUNCE,
      initiallyVisible: true,
    });
    await vi.runAllTimersAsync();
    await ws.ready;
    const newBtn = ws.element.querySelector<HTMLButtonElement>("[data-testid='notebook-new']");
    newBtn!.click();
    await vi.runAllTimersAsync();
    expect(calls.create).toBe(1);
    const tabs = ws.element.querySelectorAll<HTMLElement>("[data-testid='notebook-tab']");
    expect(tabs.length).toBe(2);
    const active = ws.element.querySelector<HTMLElement>(
      "[data-testid='notebook-tab'][data-active='true']",
    );
    expect(active?.textContent).toBe(DEFAULT_NOTEBOOK_TITLE);
    ws.destroy();
  });

  it("renaming updates the title via api.update, preserving content", async () => {
    const store = makeStore([makeDoc(1, "Old", "body")]);
    const { api, calls } = stubApi(store);
    const ws = createNotebookWorkspace({
      notebookApi: api,
      saveDebounceMs: SAVE_DEBOUNCE,
      initiallyVisible: true,
    });
    await vi.runAllTimersAsync();
    await ws.ready;
    const titleInput = ws.element.querySelector<HTMLInputElement>("[data-testid='notebook-title']");
    titleInput!.value = "New name";
    titleInput!.dispatchEvent(new Event("change"));
    await vi.runAllTimersAsync();
    const lastUpdate = calls.updates.at(-1);
    expect(lastUpdate?.title).toBe("New name");
    expect(lastUpdate?.content_json).toContain("body");
    // Tab label updates in place.
    const active = ws.element.querySelector<HTMLElement>(
      "[data-testid='notebook-tab'][data-active='true']",
    );
    expect(active?.textContent).toBe("New name");
    ws.destroy();
  });

  it("delete removes the notebook and switches to the next one", async () => {
    const store = makeStore([makeDoc(1, "One"), makeDoc(2, "Two")]);
    const { api, calls } = stubApi(store);
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);
    const ws = createNotebookWorkspace({
      notebookApi: api,
      saveDebounceMs: SAVE_DEBOUNCE,
      initiallyVisible: true,
    });
    await vi.runAllTimersAsync();
    await ws.ready;
    // Currently active: Two (newer).
    const deleteBtn = ws.element.querySelector<HTMLButtonElement>(
      "[data-testid='notebook-delete']",
    );
    deleteBtn!.click();
    await vi.runAllTimersAsync();
    expect(calls.deletes).toEqual([2]);
    const tabs = ws.element.querySelectorAll<HTMLElement>("[data-testid='notebook-tab']");
    expect(tabs.length).toBe(1);
    expect(tabs[0]?.textContent).toBe("One");
    ws.destroy();
  });

  it("delete is a no-op if the user cancels the confirm prompt", async () => {
    const store = makeStore([makeDoc(1, "One"), makeDoc(2, "Two")]);
    const { api, calls } = stubApi(store);
    vi.spyOn(globalThis, "confirm").mockReturnValue(false);
    const ws = createNotebookWorkspace({
      notebookApi: api,
      saveDebounceMs: SAVE_DEBOUNCE,
      initiallyVisible: true,
    });
    await vi.runAllTimersAsync();
    await ws.ready;
    const deleteBtn = ws.element.querySelector<HTMLButtonElement>(
      "[data-testid='notebook-delete']",
    );
    deleteBtn!.click();
    await vi.runAllTimersAsync();
    expect(calls.deletes).toEqual([]);
    ws.destroy();
  });

  it("deleting the last notebook auto-creates a new default one", async () => {
    const store = makeStore([makeDoc(1, "Only")]);
    const { api, calls } = stubApi(store);
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);
    const ws = createNotebookWorkspace({
      notebookApi: api,
      saveDebounceMs: SAVE_DEBOUNCE,
      initiallyVisible: true,
    });
    await vi.runAllTimersAsync();
    await ws.ready;
    const deleteBtn = ws.element.querySelector<HTMLButtonElement>(
      "[data-testid='notebook-delete']",
    );
    deleteBtn!.click();
    await vi.runAllTimersAsync();
    expect(calls.deletes).toEqual([1]);
    expect(calls.create).toBe(1);
    const tabs = ws.element.querySelectorAll<HTMLElement>("[data-testid='notebook-tab']");
    expect(tabs.length).toBe(1);
    expect(tabs[0]?.textContent).toBe(DEFAULT_NOTEBOOK_TITLE);
    ws.destroy();
  });
});

describe("createNotebookWorkspace — load errors", () => {
  it("shows a sign-in message when list() returns unauthenticated", async () => {
    const { api } = stubApi(makeStore(), {
      list: async () => err<NotebookError>({ kind: "unauthenticated" }),
    });
    const ws = createNotebookWorkspace({
      notebookApi: api,
      saveDebounceMs: SAVE_DEBOUNCE,
      initiallyVisible: true,
    });
    await vi.runAllTimersAsync();
    await ws.ready;
    const errBox = ws.element.querySelector("[data-testid='notebook-error']");
    expect(errBox?.textContent ?? "").toMatch(/sign in/i);
    ws.destroy();
  });

  it("shows a connection message when list() errors with network", async () => {
    const { api } = stubApi(makeStore(), {
      list: async () => err<NotebookError>({ kind: "network" }),
    });
    const ws = createNotebookWorkspace({
      notebookApi: api,
      saveDebounceMs: SAVE_DEBOUNCE,
      initiallyVisible: true,
    });
    await vi.runAllTimersAsync();
    await ws.ready;
    const errBox = ws.element.querySelector("[data-testid='notebook-error']");
    expect(errBox?.textContent ?? "").toMatch(/connection|server|try/i);
    ws.destroy();
  });
});

describe("createNotebookWorkspace — insert link", () => {
  const TEST_HREF = "http://localhost:5173/?lat=40.7&lon=-74&t=2026-08-12T04:30:00.000Z";
  const TEST_TIME = new Date("2026-08-12T04:30:00.000Z");

  it("renders the insert-link button when getCurrentView is provided", async () => {
    const { api } = stubApi();
    const ws = createNotebookWorkspace({
      notebookApi: api,
      saveDebounceMs: SAVE_DEBOUNCE,
      initiallyVisible: true,
      getCurrentView: () => ({ href: TEST_HREF, timeUtc: TEST_TIME }),
    });
    await vi.runAllTimersAsync();
    await ws.ready;
    expect(ws.element.querySelector("[data-testid='notebook-insert-link']")).not.toBeNull();
    ws.destroy();
  });

  it("shows a Pro pill when the user is not Pro", async () => {
    const { api } = stubApi();
    const ws = createNotebookWorkspace({
      notebookApi: api,
      saveDebounceMs: SAVE_DEBOUNCE,
      initiallyVisible: true,
      getCurrentView: () => ({ href: TEST_HREF, timeUtc: TEST_TIME }),
    });
    await vi.runAllTimersAsync();
    await ws.ready;
    expect(ws.element.querySelector("[data-testid='notebook-insert-link-pro']")).not.toBeNull();
    ws.destroy();
  });

  it("non-Pro click invokes onProRequired and does not edit the notebook", async () => {
    const onProRequired = vi.fn();
    const { api, calls } = stubApi();
    const ws = createNotebookWorkspace({
      notebookApi: api,
      saveDebounceMs: SAVE_DEBOUNCE,
      initiallyVisible: true,
      getCurrentView: () => ({ href: TEST_HREF, timeUtc: TEST_TIME }),
      onProRequired,
    });
    await vi.runAllTimersAsync();
    await ws.ready;
    const btn = ws.element.querySelector<HTMLButtonElement>("[data-testid='notebook-insert-link']");
    btn!.click();
    expect(onProRequired).toHaveBeenCalledTimes(1);
    expect(calls.updates).toEqual([]);
    ws.destroy();
  });

  it("Pro click inserts the link", async () => {
    setUser("rob.sartin@gmail.com");
    const { api } = stubApi();
    const ws = createNotebookWorkspace({
      notebookApi: api,
      saveDebounceMs: SAVE_DEBOUNCE,
      initiallyVisible: true,
      getCurrentView: () => ({ href: TEST_HREF, timeUtc: TEST_TIME }),
    });
    await vi.runAllTimersAsync();
    await ws.ready;
    const btn = ws.element.querySelector<HTMLButtonElement>("[data-testid='notebook-insert-link']");
    btn!.click();
    await vi.runAllTimersAsync();
    const surface = ws.element.querySelector<HTMLElement>(".ProseMirror");
    expect(surface?.textContent).toContain(TEST_HREF);
    ws.destroy();
  });
});
