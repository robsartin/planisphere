/* SPDX-License-Identifier: Apache-2.0 */

/**
 * Typed helpers for Cesium's `BillboardCollection` / `PolylineCollection`
 * / `LabelCollection`. The collections expose `.show`, `.length`, and
 * `.get(i)` at runtime, but Cesium's bundled type definitions don't
 * surface those members — so every caller otherwise needs to reach
 * through `as unknown as { show: boolean }` etc. That cast is repeated
 * 15+ times across `src/scene/*`.
 *
 * Concentrating the cast here means individual layer files read as
 * plain function calls, and the day Cesium's types grow these members
 * (or we switch to module augmentation) we flip this one file instead
 * of 11.
 */

type ShowTarget = { show: boolean };
type LengthTarget = { length: unknown };
type IndexedCollection<T> = { get(i: number): T };

export function setCollectionVisible(collection: unknown, visible: boolean): void {
  (collection as ShowTarget).show = visible;
}

export function collectionLength(collection: unknown): number {
  const raw = (collection as LengthTarget).length;
  return typeof raw === "number" ? raw : 0;
}

export function collectionAt<T>(collection: unknown, index: number): T {
  return (collection as IndexedCollection<T>).get(index);
}
