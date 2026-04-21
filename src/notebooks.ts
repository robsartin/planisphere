/* SPDX-License-Identifier: Apache-2.0 */
import { err, ok, type Result } from "./result";

/**
 * Client-side wrapper for the Phase 2 `/api/notebooks` Worker surface
 * (ADR 013, worker/routes/notebooks.ts). Every call returns a
 * `Result<T, NotebookError>` per CLAUDE.md — this module is the boundary
 * where HTTP responses become the typed domain union the rest of the SPA
 * consumes.
 *
 * `content_json` is a tiptap JSON document serialised as a string. The
 * client chooses not to parse it here — the editor module is the only
 * place that understands the document schema, and round-tripping a parse
 * + stringify at the boundary would not catch anything the Worker did
 * not already validate.
 */

export type NotebookDoc = {
  readonly id: number;
  readonly title: string;
  readonly content_json: string;
  readonly created_at: number;
  readonly updated_at: number;
};

export type NotebookSummary = {
  readonly id: number;
  readonly title: string;
  readonly created_at: number;
  readonly updated_at: number;
};

export type NotebookError =
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "not_found" }
  | { readonly kind: "invalid_payload" }
  | { readonly kind: "network" }
  | { readonly kind: "server" };

export type NotebookPayload = {
  readonly title: string;
  readonly content_json: string;
};

function errFromStatus(status: number): NotebookError {
  if (status === 401) return { kind: "unauthenticated" };
  if (status === 400) return { kind: "invalid_payload" };
  if (status === 404) return { kind: "not_found" };
  return { kind: "server" };
}

/**
 * Single code path every `/api/notebooks` request flows through. Handles
 * the `credentials: "include"` default, the `network` / status-mapping /
 * `server` error branches, and leaves body parsing to the caller via
 * `parse`. Returning a Result here means every new route inherits the
 * right error model without manual wiring.
 */
async function apiRequest<T>(
  path: string,
  init: Omit<RequestInit, "credentials">,
  parse: (res: Response) => Promise<Result<T, NotebookError>>,
): Promise<Result<T, NotebookError>> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, credentials: "include" });
  } catch {
    return err({ kind: "network" });
  }
  if (!response.ok) return err(errFromStatus(response.status));
  return parse(response);
}

async function parseDoc(response: Response): Promise<Result<NotebookDoc, NotebookError>> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return err({ kind: "server" });
  }
  const doc = asNotebookDoc(body);
  if (doc === null) return err({ kind: "server" });
  return ok(doc);
}

async function parseSummaryList(
  response: Response,
): Promise<Result<NotebookSummary[], NotebookError>> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return err({ kind: "server" });
  }
  const list = asSummaryList(body);
  if (list === null) return err({ kind: "server" });
  return ok(list);
}

// eslint-disable-next-line @typescript-eslint/require-await
async function parseVoid(_response: Response): Promise<Result<void, NotebookError>> {
  return ok(undefined);
}

function jsonBody(payload: NotebookPayload): RequestInit {
  return {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: payload.title, content_json: payload.content_json }),
  };
}

function asNotebookDoc(body: unknown): NotebookDoc | null {
  if (typeof body !== "object" || body === null) return null;
  const { id, title, content_json, created_at, updated_at } = body as Record<string, unknown>;
  if (
    typeof id !== "number" ||
    typeof title !== "string" ||
    typeof content_json !== "string" ||
    typeof created_at !== "number" ||
    typeof updated_at !== "number"
  ) {
    return null;
  }
  return { id, title, content_json, created_at, updated_at };
}

function asSummaryList(body: unknown): NotebookSummary[] | null {
  if (typeof body !== "object" || body === null) return null;
  const { notebooks } = body as { notebooks?: unknown };
  if (!Array.isArray(notebooks)) return null;
  const out: NotebookSummary[] = [];
  for (const raw of notebooks) {
    if (typeof raw !== "object" || raw === null) return null;
    const { id, title, created_at, updated_at } = raw as Record<string, unknown>;
    if (
      typeof id !== "number" ||
      typeof title !== "string" ||
      typeof created_at !== "number" ||
      typeof updated_at !== "number"
    ) {
      return null;
    }
    out.push({ id, title, created_at, updated_at });
  }
  return out;
}

export function listNotebooks(): Promise<Result<NotebookSummary[], NotebookError>> {
  return apiRequest("/api/notebooks", { method: "GET" }, parseSummaryList);
}

export function createNotebook(
  payload: NotebookPayload,
): Promise<Result<NotebookDoc, NotebookError>> {
  return apiRequest("/api/notebooks", { method: "POST", ...jsonBody(payload) }, parseDoc);
}

export function getNotebook(id: number): Promise<Result<NotebookDoc, NotebookError>> {
  return apiRequest(`/api/notebooks/${String(id)}`, { method: "GET" }, parseDoc);
}

export function updateNotebook(
  id: number,
  payload: NotebookPayload,
): Promise<Result<NotebookDoc, NotebookError>> {
  return apiRequest(
    `/api/notebooks/${String(id)}`,
    { method: "PUT", ...jsonBody(payload) },
    parseDoc,
  );
}

export function deleteNotebook(id: number): Promise<Result<void, NotebookError>> {
  return apiRequest(`/api/notebooks/${String(id)}`, { method: "DELETE" }, parseVoid);
}
