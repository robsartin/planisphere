/* SPDX-License-Identifier: Apache-2.0 */
import rawConstellations from "../../data/constellations.json";
import rawMeteorShowers from "../../data/meteor-showers.json";

/**
 * Catalog used by the Notebook's @-mention popover (ADR 013).
 *
 * Mentions persist as `{ kind, id }` attribute pairs in the tiptap doc;
 * the renderer calls `resolveEntityLabel` at display time so labels stay
 * correct as the underlying catalogs evolve. The entity set is
 * intentionally narrow for v1: planisphere-named bodies (Sun…Saturn),
 * the 88 IAU constellations, and IMO meteor showers. Stars and places
 * are deferred — they need fuzzy search beyond a 100ish-item substring
 * match.
 */

export type EntityKind = "body" | "constellation" | "event";

export type EntityRef = {
  readonly kind: EntityKind;
  readonly id: string;
};

export type EntityRecord = EntityRef & {
  readonly label: string;
};

const DEFAULT_LIMIT = 8;

/** Named bodies the planisphere renders. Mirrors `BODY_MAP` in
 *  `src/astro/search.ts`. Uranus / Neptune / Pluto are intentionally
 *  out of scope for v1. */
const BODY_ENTITIES: readonly EntityRecord[] = [
  { kind: "body", id: "Sun", label: "Sun" },
  { kind: "body", id: "Moon", label: "Moon" },
  { kind: "body", id: "Mercury", label: "Mercury" },
  { kind: "body", id: "Venus", label: "Venus" },
  { kind: "body", id: "Mars", label: "Mars" },
  { kind: "body", id: "Jupiter", label: "Jupiter" },
  { kind: "body", id: "Saturn", label: "Saturn" },
];

type ConstellationData = { readonly id: string; readonly name: string };
type MeteorShowerData = { readonly id: string; readonly name: string };

const CONSTELLATION_ENTITIES: readonly EntityRecord[] = (
  rawConstellations as readonly ConstellationData[]
).map((c) => ({ kind: "constellation", id: c.id, label: c.name }));

const EVENT_ENTITIES: readonly EntityRecord[] = (
  rawMeteorShowers as readonly MeteorShowerData[]
).map((m) => ({ kind: "event", id: m.id, label: m.name }));

const ALL_ENTITIES: readonly EntityRecord[] = [
  ...BODY_ENTITIES,
  ...CONSTELLATION_ENTITIES,
  ...EVENT_ENTITIES,
];

/** O(1) lookup from `${kind}:${id}` to the label. Built once at module load. */
const LABELS_BY_KEY: ReadonlyMap<string, string> = new Map(
  ALL_ENTITIES.map((e) => [`${e.kind}:${e.id}`, e.label]),
);

export function resolveEntityLabel(ref: EntityRef): string | null {
  return LABELS_BY_KEY.get(`${ref.kind}:${ref.id}`) ?? null;
}

/**
 * Substring (case-insensitive) search across all kinds. Trimmed empty
 * queries return `[]` so the popover stays closed on bare `@`. Results
 * are sorted alphabetically by label so the popover order is stable
 * across keystrokes.
 */
export function searchEntities(query: string, limit: number = DEFAULT_LIMIT): EntityRecord[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];
  const matches = ALL_ENTITIES.filter((e) => e.label.toLowerCase().includes(needle));
  matches.sort((a, b) => a.label.localeCompare(b.label));
  return matches.slice(0, limit);
}
