/* SPDX-License-Identifier: Apache-2.0 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createNotebook,
  deleteNotebook,
  getNotebook,
  listNotebooks,
  updateNotebook,
  type NotebookDoc,
  type NotebookSummary,
} from "./notebooks";

/**
 * Client-side tests for the /api/notebooks fetch helpers. Each test stubs
 * `global.fetch` and asserts the Result shape the rest of the SPA consumes.
 */

type FetchStub = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function setFetch(stub: FetchStub): void {
  globalThis.fetch = stub as typeof fetch;
}

beforeEach(() => {
  setFetch(async () => {
    throw new Error("fetch not stubbed for this test");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const SAMPLE_DOC = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
});

describe("listNotebooks", () => {
  it("returns the summaries when the server responds with 200", async () => {
    const summaries: NotebookSummary[] = [
      { id: 2, title: "B", created_at: 2, updated_at: 4 },
      { id: 1, title: "A", created_at: 1, updated_at: 3 },
    ];
    setFetch(async () => jsonResponse({ notebooks: summaries }));
    const result = await listNotebooks();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(summaries);
  });

  it("returns `unauthenticated` on a 401", async () => {
    setFetch(async () => jsonResponse({ error: "unauthenticated" }, 401));
    const result = await listNotebooks();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("unauthenticated");
  });

  it("returns `server` on a 500", async () => {
    setFetch(async () => jsonResponse({ error: "server_error" }, 500));
    const result = await listNotebooks();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("server");
  });

  it("returns `network` when fetch rejects", async () => {
    setFetch(() => Promise.reject(new Error("offline")));
    const result = await listNotebooks();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("network");
  });

  it("returns `server` when the body is malformed", async () => {
    setFetch(
      async () =>
        new Response("not json", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const result = await listNotebooks();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("server");
  });

  it("sends credentials", async () => {
    let capturedInit: RequestInit | undefined;
    setFetch(async (_input, init) => {
      capturedInit = init;
      return jsonResponse({ notebooks: [] });
    });
    await listNotebooks();
    expect(capturedInit?.credentials).toBe("include");
  });
});

describe("createNotebook", () => {
  it("POSTs the payload and returns the created doc on 201", async () => {
    let capturedBody: unknown;
    setFetch(async (_input, init) => {
      capturedBody = init?.body;
      return jsonResponse(
        {
          id: 7,
          title: "T",
          content_json: SAMPLE_DOC,
          created_at: 10,
          updated_at: 10,
        },
        201,
      );
    });
    const result = await createNotebook({ title: "T", content_json: SAMPLE_DOC });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc: NotebookDoc = result.value;
      expect(doc.id).toBe(7);
      expect(doc.content_json).toBe(SAMPLE_DOC);
    }
    expect(capturedBody).toBe(JSON.stringify({ title: "T", content_json: SAMPLE_DOC }));
  });

  it("returns `invalid_payload` on 400", async () => {
    setFetch(async () => jsonResponse({ error: "invalid_payload" }, 400));
    const result = await createNotebook({ title: "", content_json: "{}" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("invalid_payload");
  });

  it("returns `unauthenticated` on 401", async () => {
    setFetch(async () => jsonResponse({ error: "unauthenticated" }, 401));
    const result = await createNotebook({ title: "T", content_json: SAMPLE_DOC });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("unauthenticated");
  });
});

describe("getNotebook", () => {
  it("returns the doc on 200", async () => {
    setFetch(async () =>
      jsonResponse({
        id: 3,
        title: "X",
        content_json: SAMPLE_DOC,
        created_at: 1,
        updated_at: 2,
      }),
    );
    const result = await getNotebook(3);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.title).toBe("X");
  });

  it("returns `not_found` on 404", async () => {
    setFetch(async () => jsonResponse({ error: "not_found" }, 404));
    const result = await getNotebook(99);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("not_found");
  });
});

describe("updateNotebook", () => {
  it("PUTs the payload and returns the updated doc on 200", async () => {
    let capturedMethod: string | undefined;
    setFetch(async (_input, init) => {
      capturedMethod = init?.method;
      return jsonResponse({
        id: 5,
        title: "new",
        content_json: SAMPLE_DOC,
        created_at: 1,
        updated_at: 9,
      });
    });
    const result = await updateNotebook(5, { title: "new", content_json: SAMPLE_DOC });
    expect(result.ok).toBe(true);
    expect(capturedMethod).toBe("PUT");
    if (result.ok) expect(result.value.updated_at).toBe(9);
  });

  it("returns `not_found` on 404", async () => {
    setFetch(async () => jsonResponse({ error: "not_found" }, 404));
    const result = await updateNotebook(99, { title: "x", content_json: SAMPLE_DOC });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("not_found");
  });

  it("returns `invalid_payload` on 400", async () => {
    setFetch(async () => jsonResponse({ error: "invalid_payload" }, 400));
    const result = await updateNotebook(1, { title: "", content_json: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("invalid_payload");
  });
});

describe("deleteNotebook", () => {
  it("returns ok on 204", async () => {
    setFetch(async () => new Response(null, { status: 204 }));
    const result = await deleteNotebook(5);
    expect(result.ok).toBe(true);
  });

  it("returns `not_found` on 404", async () => {
    setFetch(async () => jsonResponse({ error: "not_found" }, 404));
    const result = await deleteNotebook(5);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("not_found");
  });

  it("returns `network` when fetch rejects", async () => {
    setFetch(() => Promise.reject(new Error("offline")));
    const result = await deleteNotebook(5);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("network");
  });
});
