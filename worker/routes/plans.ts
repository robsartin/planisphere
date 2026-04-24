/* SPDX-License-Identifier: Apache-2.0 */
import type { Env } from "../types";
import { getAuthenticatedUserId } from "../session";
import {
  getUserTier,
  listPlanSummaries,
  getPlanBySlug,
  type PlanRow,
  type PlanSummaryRow,
} from "../db";

const SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorJson(error: string, status: number): Response {
  return json({ error }, status);
}

async function requireProUser(
  req: Request,
  env: Env,
): Promise<{ ok: true; userId: number } | { ok: false; res: Response }> {
  const userId = await getAuthenticatedUserId(req, env);
  if (userId === null) return { ok: false, res: errorJson("unauthenticated", 401) };
  const tier = await getUserTier(env.DB, userId);
  if (tier !== "pro") return { ok: false, res: errorJson("not_pro", 402) };
  return { ok: true, userId };
}

function summaryToWire(row: PlanSummaryRow) {
  return {
    slug: row.slug,
    title: row.title,
    month: row.month,
    hemisphere: row.hemisphere,
    summary: row.summary,
    author: row.author,
    publishedAt: new Date(row.publishedAtMs).toISOString(),
  };
}

function planToWire(row: PlanRow) {
  // Fail closed: if objects_json is corrupted, surface an empty list rather than 500.
  let objects: readonly unknown[] = [];
  try {
    const parsed = JSON.parse(row.objectsJson);
    if (Array.isArray(parsed)) objects = parsed;
  } catch {
    objects = [];
  }
  return {
    ...summaryToWire(row),
    bodyMd: row.bodyMd,
    objects,
  };
}

export async function handleListPlans(req: Request, env: Env): Promise<Response> {
  const auth = await requireProUser(req, env);
  if (!auth.ok) return auth.res;
  const rows = await listPlanSummaries(env.DB);
  return json({ plans: rows.map(summaryToWire) });
}

export async function handleGetPlan(req: Request, env: Env, slug: string): Promise<Response> {
  if (!SLUG_PATTERN.test(slug)) return errorJson("not_found", 404);
  const auth = await requireProUser(req, env);
  if (!auth.ok) return auth.res;
  const row = await getPlanBySlug(env.DB, slug);
  if (row === null) return errorJson("not_found", 404);
  return json(planToWire(row));
}
