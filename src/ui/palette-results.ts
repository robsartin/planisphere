/* SPDX-License-Identifier: Apache-2.0 */
import type { UIIntent } from "./index";

/**
 * Pure fuzzy-match helpers and result-building for the command palette.
 *
 * The palette merges four source lists (objects, events, places, settings) plus
 * a user-persisted `recents` list, and produces a ranked `PaletteResult[]` based
 * on a query string. This module has no DOM or state dependencies — the UI
 * module calls it and renders the output.
 *
 * Scoring (see `fuzzyScore`): exact (case-insensitive) > prefix > substring >
 * character-subsequence. Ties are broken by source priority — actions first
 * (user's own settings), then objects, events, and places. Empty queries fall
 * back to recent commands, and when none exist, to the static action list as
 * a "what can I do here?" hint.
 */

export type PaletteObjectType = "star" | "constellation" | "body" | "satellite" | "messier";

export type PaletteObjectSource = {
  readonly id: string;
  readonly label: string;
  readonly type: PaletteObjectType;
  readonly hint?: string;
};

export type PaletteEventSource = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly when?: Date;
  readonly viewAz?: number;
  readonly viewAlt?: number;
};

export type PalettePlaceSource = {
  readonly id: string;
  readonly label: string;
  readonly lat: number;
  readonly lon: number;
  readonly country?: string;
};

export type PaletteSettingSource = {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  /** Intent dispatched when the user selects this action. */
  readonly intent?: UIIntent;
};

export type PaletteSources = {
  readonly objects: readonly PaletteObjectSource[];
  readonly events: readonly PaletteEventSource[];
  readonly places: readonly PalettePlaceSource[];
  readonly settings: readonly PaletteSettingSource[];
  readonly recents: readonly PaletteSettingSource[];
};

export type PaletteResult =
  | {
      readonly kind: "object";
      readonly id: string;
      readonly label: string;
      readonly type: PaletteObjectType;
      readonly hint?: string;
      readonly score: number;
    }
  | {
      readonly kind: "event";
      readonly id: string;
      readonly label: string;
      readonly description?: string;
      readonly when?: Date;
      readonly viewAz?: number;
      readonly viewAlt?: number;
      readonly score: number;
    }
  | {
      readonly kind: "place";
      readonly id: string;
      readonly label: string;
      readonly lat: number;
      readonly lon: number;
      readonly country?: string;
      readonly score: number;
    }
  | {
      readonly kind: "action";
      readonly id: string;
      readonly label: string;
      readonly hint?: string;
      readonly intent?: UIIntent;
      readonly score: number;
    }
  | {
      readonly kind: "recent";
      readonly id: string;
      readonly label: string;
      readonly hint?: string;
      readonly intent?: UIIntent;
      readonly score: number;
    };

const MAX_RESULTS = 20;

// Score tiers — larger == better. Chosen so that a prefix match always beats
// any substring match, a substring always beats any subsequence match, and the
// "length" term (shorter label wins for the same tier) never crosses a tier.
const SCORE_EXACT = 10_000;
const SCORE_PREFIX = 1_000;
const SCORE_SUBSTRING = 100;
const SCORE_SUBSEQUENCE = 10;

/**
 * Score how well `query` matches `target`. Higher is better.
 *
 *  - exact (case-insensitive): ~10_000
 *  - prefix: ~1_000 (minus position)
 *  - substring: ~100 (minus position)
 *  - subsequence: ~10 (minus spread)
 *  - no match: 0
 */
export function fuzzyScore(query: string, target: string): number {
  if (query.length === 0) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (q === t) return SCORE_EXACT;
  if (t.startsWith(q)) {
    // Shorter labels beat longer ones for prefix ties.
    return SCORE_PREFIX - Math.min(99, t.length - q.length);
  }
  const idx = t.indexOf(q);
  if (idx !== -1) {
    // Earlier substring beats later substring.
    return SCORE_SUBSTRING - Math.min(99, idx);
  }
  // Subsequence: every char of q appears in order inside t.
  let ti = 0;
  let qi = 0;
  let firstIdx = -1;
  let lastIdx = -1;
  while (qi < q.length && ti < t.length) {
    if (q.charAt(qi) === t.charAt(ti)) {
      if (firstIdx === -1) firstIdx = ti;
      lastIdx = ti;
      qi++;
    }
    ti++;
  }
  if (qi === q.length) {
    const spread = lastIdx - firstIdx;
    return SCORE_SUBSEQUENCE - Math.min(9, Math.floor(spread / 2));
  }
  return 0;
}

// Source priority for tie-breaking (higher is better).
// Actions win because a power user typing "night" probably wants the toggle,
// not a dim star named "Night something". Objects beat events/places because
// an object query is the palette's most common use-case.
const SOURCE_PRIORITY = {
  recent: 5,
  action: 4,
  object: 3,
  event: 2,
  place: 1,
} as const;

/**
 * Build a ranked list of palette results from the given `sources` and `query`.
 *
 * Empty or whitespace-only queries return recent commands (if any), otherwise
 * the full settings list as a "what can I do?" hint.
 */
export function buildPaletteResults(query: string, sources: PaletteSources): PaletteResult[] {
  const trimmed = query.trim();

  if (trimmed.length === 0) {
    // Merge recents (first) with settings as a "what can I do?" help list.
    // Dedupe by id so a recent that aliases a setting (e.g. "copy-link") only
    // appears once, under its recent kind.
    const recentIds = new Set(sources.recents.map((r) => r.id));
    const out: PaletteResult[] = sources.recents.map((r) => ({
      kind: "recent" as const,
      id: r.id,
      label: r.label,
      ...(r.hint !== undefined ? { hint: r.hint } : {}),
      ...(r.intent !== undefined ? { intent: r.intent } : {}),
      score: 0,
    }));
    for (const a of sources.settings) {
      if (recentIds.has(a.id)) continue;
      out.push({
        kind: "action" as const,
        id: a.id,
        label: a.label,
        ...(a.hint !== undefined ? { hint: a.hint } : {}),
        ...(a.intent !== undefined ? { intent: a.intent } : {}),
        score: 0,
      });
    }
    return out;
  }

  const scored: PaletteResult[] = [];

  for (const a of sources.settings) {
    const score = fuzzyScore(trimmed, a.label);
    if (score > 0) {
      scored.push({
        kind: "action",
        id: a.id,
        label: a.label,
        ...(a.hint !== undefined ? { hint: a.hint } : {}),
        ...(a.intent !== undefined ? { intent: a.intent } : {}),
        score,
      });
    }
  }
  for (const o of sources.objects) {
    const score = fuzzyScore(trimmed, o.label);
    if (score > 0) {
      scored.push({
        kind: "object",
        id: o.id,
        label: o.label,
        type: o.type,
        ...(o.hint !== undefined ? { hint: o.hint } : {}),
        score,
      });
    }
  }
  for (const e of sources.events) {
    const score = fuzzyScore(trimmed, e.label);
    if (score > 0) {
      scored.push({
        kind: "event",
        id: e.id,
        label: e.label,
        ...(e.description !== undefined ? { description: e.description } : {}),
        ...(e.when !== undefined ? { when: e.when } : {}),
        ...(e.viewAz !== undefined ? { viewAz: e.viewAz } : {}),
        ...(e.viewAlt !== undefined ? { viewAlt: e.viewAlt } : {}),
        score,
      });
    }
  }
  for (const p of sources.places) {
    const score = fuzzyScore(trimmed, p.label);
    if (score > 0) {
      scored.push({
        kind: "place",
        id: p.id,
        label: p.label,
        lat: p.lat,
        lon: p.lon,
        ...(p.country !== undefined ? { country: p.country } : {}),
        score,
      });
    }
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return SOURCE_PRIORITY[b.kind] - SOURCE_PRIORITY[a.kind];
  });

  return scored.slice(0, MAX_RESULTS);
}
