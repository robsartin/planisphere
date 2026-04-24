/* SPDX-License-Identifier: Apache-2.0 */
import { err, ok, type Result } from "./result";

export type LinkedEntityKind = "star" | "messier" | "planet" | "satellite" | "constellation";

const LINKED_ENTITY_KINDS: readonly LinkedEntityKind[] = [
  "star",
  "messier",
  "planet",
  "satellite",
  "constellation",
];

export type LinkedEntity = {
  readonly kind: LinkedEntityKind;
  readonly id: string;
  readonly label: string;
};

export type PlanSummary = {
  readonly slug: string;
  readonly title: string;
  readonly month: string;
  readonly hemisphere: "n" | "s" | "both";
  readonly summary: string;
  readonly author: string;
  readonly publishedAt: string;
};

export type Plan = PlanSummary & {
  readonly bodyMd: string;
  readonly objects: readonly LinkedEntity[];
};

export type PlanError =
  | { readonly kind: "not_found" }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "not_pro" }
  | { readonly kind: "invalid_payload" }
  | { readonly kind: "network" }
  | { readonly kind: "server" };

const planCache = new Map<string, Plan>();

export function __clearPlanCacheForTests(): void {
  planCache.clear();
}

function isHemisphere(v: unknown): v is "n" | "s" | "both" {
  return v === "n" || v === "s" || v === "both";
}

function isLinkedEntityKind(v: unknown): v is LinkedEntityKind {
  return typeof v === "string" && (LINKED_ENTITY_KINDS as readonly string[]).includes(v);
}

function parseSummary(raw: unknown): PlanSummary | null {
  if (raw === null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.slug !== "string") return null;
  if (typeof r.title !== "string") return null;
  if (typeof r.month !== "string") return null;
  if (!isHemisphere(r.hemisphere)) return null;
  if (typeof r.summary !== "string") return null;
  if (typeof r.author !== "string") return null;
  if (typeof r.publishedAt !== "string") return null;
  return {
    slug: r.slug,
    title: r.title,
    month: r.month,
    hemisphere: r.hemisphere,
    summary: r.summary,
    author: r.author,
    publishedAt: r.publishedAt,
  };
}

function parseLinkedEntity(raw: unknown): LinkedEntity | null {
  if (raw === null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isLinkedEntityKind(r.kind)) return null;
  if (typeof r.id !== "string") return null;
  if (typeof r.label !== "string") return null;
  return { kind: r.kind, id: r.id, label: r.label };
}

function parsePlan(raw: unknown): Plan | null {
  const summary = parseSummary(raw);
  if (summary === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.bodyMd !== "string") return null;
  if (!Array.isArray(r.objects)) return null;
  const objects: LinkedEntity[] = [];
  for (const o of r.objects) {
    const entity = parseLinkedEntity(o);
    if (entity === null) return null;
    objects.push(entity);
  }
  return { ...summary, bodyMd: r.bodyMd, objects };
}

function mapStatusToError(status: number): PlanError {
  if (status === 401) return { kind: "unauthenticated" };
  if (status === 402) return { kind: "not_pro" };
  if (status === 404) return { kind: "not_found" };
  return { kind: "server" };
}

async function apiRequest<T>(
  path: string,
  parse: (raw: unknown) => T | null,
): Promise<Result<T, PlanError>> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: "include" });
  } catch {
    return err({ kind: "network" });
  }
  if (!res.ok) return err(mapStatusToError(res.status));
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    return err({ kind: "invalid_payload" });
  }
  const parsed = parse(raw);
  if (parsed === null) return err({ kind: "invalid_payload" });
  return ok(parsed);
}

export async function listPlans(): Promise<Result<readonly PlanSummary[], PlanError>> {
  return apiRequest("/api/plans", (raw) => {
    if (raw === null || typeof raw !== "object") return null;
    const plans = (raw as { plans?: unknown }).plans;
    if (!Array.isArray(plans)) return null;
    const out: PlanSummary[] = [];
    for (const p of plans) {
      const s = parseSummary(p);
      if (s === null) return null;
      out.push(s);
    }
    return out;
  });
}

export async function getPlan(slug: string): Promise<Result<Plan, PlanError>> {
  const cached = planCache.get(slug);
  if (cached !== undefined) return ok(cached);
  const res = await apiRequest(`/api/plans/${encodeURIComponent(slug)}`, parsePlan);
  if (res.ok) planCache.set(slug, res.value);
  return res;
}
