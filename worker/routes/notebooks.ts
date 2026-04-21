/* SPDX-License-Identifier: Apache-2.0 */
import {
  deleteNotebook,
  getNotebookById,
  insertNotebook,
  listNotebooksForUser,
  updateNotebook,
} from "../db";
import { errorJson, json } from "../http";
import { getAuthenticatedUserId } from "../session";
import {
  NOTEBOOK_CONTENT_MAX_BYTES,
  NOTEBOOK_TITLE_MAX_LEN,
  type ApiErrorCode,
  type Env,
  type NotebookRow,
} from "../types";

/**
 * Routes for `/api/notebooks` and `/api/notebooks/:id`. Every endpoint
 * requires an authenticated session; the shared auth check lives in
 * `worker/session.ts` so auth routes and notebooks stay consistent.
 */

type NotebookPayload = { title: string; contentJson: string };

/**
 * Parse and validate the body of a create/update request. Returns either a
 * normalised payload or an `ApiErrorCode` the caller should return as 400.
 */
async function parsePayload(req: Request): Promise<NotebookPayload | ApiErrorCode> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return "invalid_payload";
  }
  if (typeof body !== "object" || body === null) return "invalid_payload";
  const { title, content_json } = body as { title?: unknown; content_json?: unknown };
  if (typeof title !== "string" || typeof content_json !== "string") return "invalid_payload";
  const trimmed = title.trim();
  if (trimmed.length === 0 || trimmed.length > NOTEBOOK_TITLE_MAX_LEN) return "invalid_payload";
  if (byteLength(content_json) > NOTEBOOK_CONTENT_MAX_BYTES) return "invalid_payload";
  try {
    JSON.parse(content_json);
  } catch {
    return "invalid_payload";
  }
  return { title: trimmed, contentJson: content_json };
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).byteLength;
}

/** Shape we send back on the wire — same as the row but without `user_id`. */
function toResponse(row: NotebookRow): Omit<NotebookRow, "user_id"> {
  return {
    id: row.id,
    title: row.title,
    content_json: row.content_json,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function handleListNotebooks(req: Request, env: Env): Promise<Response> {
  const userId = await getAuthenticatedUserId(req, env);
  if (userId === null) return errorJson("unauthenticated", 401);
  const rows = await listNotebooksForUser(env.DB, userId);
  return json({ notebooks: rows });
}

export async function handleCreateNotebook(req: Request, env: Env): Promise<Response> {
  const userId = await getAuthenticatedUserId(req, env);
  if (userId === null) return errorJson("unauthenticated", 401);
  const payload = await parsePayload(req);
  if (typeof payload === "string") return errorJson(payload, 400);
  const row = await insertNotebook(env.DB, userId, payload.title, payload.contentJson);
  return json(toResponse(row), { status: 201 });
}

export async function handleGetNotebook(req: Request, env: Env, id: number): Promise<Response> {
  const userId = await getAuthenticatedUserId(req, env);
  if (userId === null) return errorJson("unauthenticated", 401);
  const row = await getNotebookById(env.DB, id, userId);
  if (!row) return errorJson("not_found", 404);
  return json(toResponse(row));
}

export async function handleUpdateNotebook(req: Request, env: Env, id: number): Promise<Response> {
  const userId = await getAuthenticatedUserId(req, env);
  if (userId === null) return errorJson("unauthenticated", 401);
  const payload = await parsePayload(req);
  if (typeof payload === "string") return errorJson(payload, 400);
  const row = await updateNotebook(env.DB, id, userId, payload.title, payload.contentJson);
  if (!row) return errorJson("not_found", 404);
  return json(toResponse(row));
}

export async function handleDeleteNotebook(req: Request, env: Env, id: number): Promise<Response> {
  const userId = await getAuthenticatedUserId(req, env);
  if (userId === null) return errorJson("unauthenticated", 401);
  const deleted = await deleteNotebook(env.DB, id, userId);
  if (!deleted) return errorJson("not_found", 404);
  return new Response(null, { status: 204 });
}
