/* SPDX-License-Identifier: Apache-2.0 */
import { beforeEach, describe, expect, it } from "vitest";
import { TEST_BASE as BASE, authed, fetchWorker, login, resetDb } from "../test-helpers";

/**
 * End-to-end tests for /api/notebooks routes. Runs inside workerd via
 * @cloudflare/vitest-pool-workers with an in-memory D1 binding that has
 * both the auth tables and the notebooks table created by resetDb().
 */

type NotebookRow = {
  readonly id: number;
  readonly user_id: number;
  readonly title: string;
  readonly content_json: string;
  readonly created_at: number;
  readonly updated_at: number;
};

type NotebookSummary = Omit<NotebookRow, "content_json" | "user_id">;

type NotebookResponse = Omit<NotebookRow, "user_id">;

function sampleDoc(marker = "hello"): string {
  return JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: marker }] }],
  });
}

beforeEach(async () => {
  await resetDb();
});

describe("POST /api/notebooks", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await fetchWorker(
      new Request(`${BASE}/api/notebooks`, {
        method: "POST",
        body: JSON.stringify({ title: "x", content_json: sampleDoc() }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("creates a notebook and returns 201 with the row", async () => {
    const cookie = await login("alice@example.com");
    const res = await fetchWorker(
      authed("/api/notebooks", cookie, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Tonight", content_json: sampleDoc("Perseids") }),
      }),
    );
    expect(res.status).toBe(201);
    const body: NotebookResponse = await res.json();
    expect(body.title).toBe("Tonight");
    expect(body.content_json).toBe(sampleDoc("Perseids"));
    expect(typeof body.id).toBe("number");
    expect(typeof body.created_at).toBe("number");
    expect(body.updated_at).toBe(body.created_at);
  });

  it("returns 400 when body is not JSON", async () => {
    const cookie = await login("bob@example.com");
    const res = await fetchWorker(
      authed("/api/notebooks", cookie, { method: "POST", body: "not json" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when title is missing", async () => {
    const cookie = await login("carol@example.com");
    const res = await fetchWorker(
      authed("/api/notebooks", cookie, {
        method: "POST",
        body: JSON.stringify({ content_json: sampleDoc() }),
      }),
    );
    expect(res.status).toBe(400);
    const body: { error: string } = await res.json();
    expect(body.error).toBe("invalid_payload");
  });

  it("returns 400 when content_json is missing", async () => {
    const cookie = await login("dave@example.com");
    const res = await fetchWorker(
      authed("/api/notebooks", cookie, {
        method: "POST",
        body: JSON.stringify({ title: "x" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when title is empty after trimming", async () => {
    const cookie = await login("eve@example.com");
    const res = await fetchWorker(
      authed("/api/notebooks", cookie, {
        method: "POST",
        body: JSON.stringify({ title: "   ", content_json: sampleDoc() }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when title is too long (> 200 chars)", async () => {
    const cookie = await login("frank@example.com");
    const res = await fetchWorker(
      authed("/api/notebooks", cookie, {
        method: "POST",
        body: JSON.stringify({ title: "x".repeat(201), content_json: sampleDoc() }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when content_json is not valid JSON", async () => {
    const cookie = await login("gina@example.com");
    const res = await fetchWorker(
      authed("/api/notebooks", cookie, {
        method: "POST",
        body: JSON.stringify({ title: "x", content_json: "{not json" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when content_json exceeds the size cap", async () => {
    const cookie = await login("harry@example.com");
    // 256 KB cap — build a JSON string larger than that.
    const big = JSON.stringify({ t: "x".repeat(300_000) });
    const res = await fetchWorker(
      authed("/api/notebooks", cookie, {
        method: "POST",
        body: JSON.stringify({ title: "x", content_json: big }),
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/notebooks", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await fetchWorker(new Request(`${BASE}/api/notebooks`));
    expect(res.status).toBe(401);
  });

  it("returns an empty list for a new user", async () => {
    const cookie = await login("ivy@example.com");
    const res = await fetchWorker(authed("/api/notebooks", cookie));
    expect(res.status).toBe(200);
    const body: { notebooks: NotebookSummary[] } = await res.json();
    expect(body.notebooks).toEqual([]);
  });

  it("returns only the current user's notebooks, newest-updated first", async () => {
    const alice = await login("alice2@example.com");
    const bob = await login("bob2@example.com");

    // Alice writes two notebooks.
    const n1 = await fetchWorker(
      authed("/api/notebooks", alice, {
        method: "POST",
        body: JSON.stringify({ title: "First", content_json: sampleDoc("a") }),
      }),
    );
    expect(n1.status).toBe(201);
    // Small delay to ensure distinct created_at values.
    await new Promise((r) => setTimeout(r, 5));
    const n2 = await fetchWorker(
      authed("/api/notebooks", alice, {
        method: "POST",
        body: JSON.stringify({ title: "Second", content_json: sampleDoc("b") }),
      }),
    );
    expect(n2.status).toBe(201);

    // Bob writes one — should not appear in Alice's list.
    await fetchWorker(
      authed("/api/notebooks", bob, {
        method: "POST",
        body: JSON.stringify({ title: "Bobs", content_json: sampleDoc("c") }),
      }),
    );

    const res = await fetchWorker(authed("/api/notebooks", alice));
    const body: { notebooks: NotebookSummary[] } = await res.json();
    expect(body.notebooks.map((n) => n.title)).toEqual(["Second", "First"]);
  });

  it("excludes content_json from the list response", async () => {
    const cookie = await login("jane@example.com");
    await fetchWorker(
      authed("/api/notebooks", cookie, {
        method: "POST",
        body: JSON.stringify({ title: "k", content_json: sampleDoc("secret") }),
      }),
    );
    const res = await fetchWorker(authed("/api/notebooks", cookie));
    const body: { notebooks: Record<string, unknown>[] } = await res.json();
    expect(body.notebooks[0]).toBeDefined();
    expect(body.notebooks[0]!["content_json"]).toBeUndefined();
  });
});

describe("GET /api/notebooks/:id", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await fetchWorker(new Request(`${BASE}/api/notebooks/1`));
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown id", async () => {
    const cookie = await login("ken@example.com");
    const res = await fetchWorker(authed("/api/notebooks/999", cookie));
    expect(res.status).toBe(404);
  });

  it("returns 404 when id belongs to another user", async () => {
    const alice = await login("a3@example.com");
    const bob = await login("b3@example.com");
    const created = await fetchWorker(
      authed("/api/notebooks", alice, {
        method: "POST",
        body: JSON.stringify({ title: "mine", content_json: sampleDoc() }),
      }),
    );
    const body: NotebookResponse = await created.json();
    const res = await fetchWorker(authed(`/api/notebooks/${body.id}`, bob));
    expect(res.status).toBe(404);
  });

  it("returns the notebook when owned by the current user", async () => {
    const cookie = await login("leo@example.com");
    const created = await fetchWorker(
      authed("/api/notebooks", cookie, {
        method: "POST",
        body: JSON.stringify({ title: "My title", content_json: sampleDoc("body") }),
      }),
    );
    const createdBody: NotebookResponse = await created.json();
    const res = await fetchWorker(authed(`/api/notebooks/${createdBody.id}`, cookie));
    expect(res.status).toBe(200);
    const body: NotebookResponse = await res.json();
    expect(body.id).toBe(createdBody.id);
    expect(body.title).toBe("My title");
    expect(body.content_json).toBe(sampleDoc("body"));
  });

  it("returns 400 for a non-numeric id", async () => {
    const cookie = await login("mia@example.com");
    const res = await fetchWorker(authed("/api/notebooks/abc", cookie));
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/notebooks/:id", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await fetchWorker(
      new Request(`${BASE}/api/notebooks/1`, {
        method: "PUT",
        body: JSON.stringify({ title: "x", content_json: sampleDoc() }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when id belongs to another user", async () => {
    const alice = await login("a4@example.com");
    const bob = await login("b4@example.com");
    const created = await fetchWorker(
      authed("/api/notebooks", alice, {
        method: "POST",
        body: JSON.stringify({ title: "mine", content_json: sampleDoc() }),
      }),
    );
    const body: NotebookResponse = await created.json();
    const res = await fetchWorker(
      authed(`/api/notebooks/${body.id}`, bob, {
        method: "PUT",
        body: JSON.stringify({ title: "hijacked", content_json: sampleDoc() }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it("updates title and content_json, bumps updated_at, keeps created_at", async () => {
    const cookie = await login("noah@example.com");
    const created = await fetchWorker(
      authed("/api/notebooks", cookie, {
        method: "POST",
        body: JSON.stringify({ title: "old", content_json: sampleDoc("old") }),
      }),
    );
    const createdBody: NotebookResponse = await created.json();
    await new Promise((r) => setTimeout(r, 5));
    const res = await fetchWorker(
      authed(`/api/notebooks/${createdBody.id}`, cookie, {
        method: "PUT",
        body: JSON.stringify({ title: "new", content_json: sampleDoc("new") }),
      }),
    );
    expect(res.status).toBe(200);
    const body: NotebookResponse = await res.json();
    expect(body.title).toBe("new");
    expect(body.content_json).toBe(sampleDoc("new"));
    expect(body.created_at).toBe(createdBody.created_at);
    expect(body.updated_at).toBeGreaterThan(createdBody.updated_at);
  });

  it("returns 400 for invalid payload", async () => {
    const cookie = await login("olga@example.com");
    const created = await fetchWorker(
      authed("/api/notebooks", cookie, {
        method: "POST",
        body: JSON.stringify({ title: "x", content_json: sampleDoc() }),
      }),
    );
    const body: NotebookResponse = await created.json();
    const res = await fetchWorker(
      authed(`/api/notebooks/${body.id}`, cookie, {
        method: "PUT",
        body: JSON.stringify({ title: "" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown id", async () => {
    const cookie = await login("paul@example.com");
    const res = await fetchWorker(
      authed("/api/notebooks/9999", cookie, {
        method: "PUT",
        body: JSON.stringify({ title: "x", content_json: sampleDoc() }),
      }),
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/notebooks/:id", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await fetchWorker(new Request(`${BASE}/api/notebooks/1`, { method: "DELETE" }));
    expect(res.status).toBe(401);
  });

  it("returns 404 when id belongs to another user", async () => {
    const alice = await login("a5@example.com");
    const bob = await login("b5@example.com");
    const created = await fetchWorker(
      authed("/api/notebooks", alice, {
        method: "POST",
        body: JSON.stringify({ title: "mine", content_json: sampleDoc() }),
      }),
    );
    const body: NotebookResponse = await created.json();
    const res = await fetchWorker(authed(`/api/notebooks/${body.id}`, bob, { method: "DELETE" }));
    expect(res.status).toBe(404);
    // Confirm the row still exists for alice.
    const stillThere = await fetchWorker(authed(`/api/notebooks/${body.id}`, alice));
    expect(stillThere.status).toBe(200);
  });

  it("returns 204 on success and the notebook is gone", async () => {
    const cookie = await login("quinn@example.com");
    const created = await fetchWorker(
      authed("/api/notebooks", cookie, {
        method: "POST",
        body: JSON.stringify({ title: "x", content_json: sampleDoc() }),
      }),
    );
    const body: NotebookResponse = await created.json();
    const res = await fetchWorker(
      authed(`/api/notebooks/${body.id}`, cookie, { method: "DELETE" }),
    );
    expect(res.status).toBe(204);
    const gone = await fetchWorker(authed(`/api/notebooks/${body.id}`, cookie));
    expect(gone.status).toBe(404);
  });

  it("returns 404 for unknown id", async () => {
    const cookie = await login("rachel@example.com");
    const res = await fetchWorker(authed("/api/notebooks/9999", cookie, { method: "DELETE" }));
    expect(res.status).toBe(404);
  });
});

describe("notebooks routing", () => {
  it("returns 405 for an unsupported method on /api/notebooks", async () => {
    const cookie = await login("sam@example.com");
    const res = await fetchWorker(authed("/api/notebooks", cookie, { method: "DELETE" }));
    expect(res.status).toBe(405);
  });

  it("returns 405 for an unsupported method on /api/notebooks/:id", async () => {
    const cookie = await login("tina@example.com");
    const created = await fetchWorker(
      authed("/api/notebooks", cookie, {
        method: "POST",
        body: JSON.stringify({ title: "x", content_json: sampleDoc() }),
      }),
    );
    const body: NotebookResponse = await created.json();
    const res = await fetchWorker(authed(`/api/notebooks/${body.id}`, cookie, { method: "POST" }));
    expect(res.status).toBe(405);
  });
});
