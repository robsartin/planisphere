/* SPDX-License-Identifier: Apache-2.0 */
import { createObjectCard } from "./object-card";
import type { ObjectCard, ObjectCardData, UpcomingEvent } from "./object-card";
import type { UIIntent } from "./index";

export type ObjectCardKind = ObjectCardData["kind"];

/** Stable identifier per card: kind + id within kind. */
export type CardKey = { readonly objectKind: ObjectCardKind; readonly id: string };

export type ScreenPosition = {
  readonly x: number;
  readonly y: number;
  /** False if the object projects off the viewport (or behind the camera). */
  readonly onScreen: boolean;
};

export type ObjectPosition = {
  readonly alt: number;
  readonly az: number;
  readonly belowHorizon: boolean;
};

export type CardsManagerOptions = {
  /** DOM node that owns the cards (typically the Cesium container). */
  readonly container: HTMLElement;
  readonly dispatch: (intent: UIIntent) => void;
  /** Project an alt/az pair to viewport coordinates. Returns `null` if projection fails. */
  readonly projector: (alt: number, az: number) => ScreenPosition | null;
  /** Resolve the latest alt/az for a given object. Returns `null` if the object is no
   *  longer present (e.g. a satellite that left the visible set). */
  readonly resolver: (key: CardKey) => ObjectPosition | null;
  readonly getViewport: () => { readonly width: number; readonly height: number };
  /** Optional — lookup an upcoming event for this object, if one is in the feed. */
  readonly findUpcomingEvent?: (key: CardKey) => UpcomingEvent | undefined;
};

export type OpenCardRequest = {
  readonly data: ObjectCardData;
  readonly screenX: number;
  readonly screenY: number;
};

export type ObjectCardsManager = {
  open(req: OpenCardRequest): void;
  close(key: CardKey): void;
  closeActive(): void;
  update(): void;
  destroy(): void;
};

function keyForData(data: ObjectCardData): CardKey {
  switch (data.kind) {
    case "star":
      return { objectKind: "star", id: data.star.name ?? `HIP ${String(data.star.hip)}` };
    case "body":
      return { objectKind: "body", id: data.body.id };
    case "satellite":
      return { objectKind: "satellite", id: data.satellite.name };
    case "messier":
      return { objectKind: "messier", id: `M${String(data.messier.m)}` };
    case "constellation":
      return { objectKind: "constellation", id: data.constellation.id };
  }
}

function keyEquals(a: CardKey, b: CardKey): boolean {
  return a.objectKind === b.objectKind && a.id === b.id;
}

type Entry = {
  readonly key: CardKey;
  readonly card: ObjectCard;
};

export function createObjectCardsManager(opts: CardsManagerOptions): ObjectCardsManager {
  // Ordered by recency: entries[entries.length - 1] is the most recent (active).
  const entries: Entry[] = [];

  function setActiveState(): void {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry === undefined) continue;
      entry.card.setActive(i === entries.length - 1);
    }
  }

  function removeAt(index: number): void {
    const entry = entries[index];
    if (entry === undefined) return;
    entry.card.destroy();
    entries.splice(index, 1);
    setActiveState();
  }

  function findIndex(key: CardKey): number {
    return entries.findIndex((e) => keyEquals(e.key, key));
  }

  function open(req: OpenCardRequest): void {
    const key = keyForData(req.data);
    const existingIdx = findIndex(key);
    if (existingIdx !== -1) {
      // Move existing card to the end (most recent) and reposition it.
      const existing = entries[existingIdx]!;
      entries.splice(existingIdx, 1);
      existing.card.update({
        screenX: req.screenX,
        screenY: req.screenY,
        belowHorizon: false,
      });
      entries.push(existing);
      setActiveState();
      return;
    }
    const viewport = opts.getViewport();
    const upcomingEvent = opts.findUpcomingEvent?.(key);
    const card = createObjectCard({
      data: req.data,
      screenX: req.screenX,
      screenY: req.screenY,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      dispatch: opts.dispatch,
      onClose: () => {
        close(key);
      },
      ...(upcomingEvent !== undefined ? { upcomingEvent } : {}),
    });
    opts.container.appendChild(card.element);
    entries.push({ key, card });
    setActiveState();
  }

  function close(key: CardKey): void {
    const idx = findIndex(key);
    if (idx === -1) return;
    removeAt(idx);
  }

  function closeActive(): void {
    if (entries.length === 0) return;
    removeAt(entries.length - 1);
  }

  function update(): void {
    for (const entry of entries) {
      const pos = opts.resolver(entry.key);
      if (pos === null) {
        // Object has left the scene — keep the card visible with a below-horizon flag.
        entry.card.update({ screenX: -9999, screenY: -9999, belowHorizon: true });
        continue;
      }
      const screen = opts.projector(pos.alt, pos.az);
      if (screen === null || !screen.onScreen) {
        entry.card.update({ screenX: -9999, screenY: -9999, belowHorizon: pos.belowHorizon });
        continue;
      }
      entry.card.update({ screenX: screen.x, screenY: screen.y, belowHorizon: pos.belowHorizon });
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key !== "Escape") return;
    if (entries.length === 0) return;
    closeActive();
  }

  document.addEventListener("keydown", onKeyDown);

  function destroy(): void {
    for (const entry of entries) entry.card.destroy();
    entries.length = 0;
    document.removeEventListener("keydown", onKeyDown);
  }

  return { open, close, closeActive, update, destroy };
}
