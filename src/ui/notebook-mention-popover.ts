/* SPDX-License-Identifier: Apache-2.0 */
import type { EntityRecord } from "../astro/entities";
import { resolveEntityLabel, type EntityKind } from "../astro/entities";
import { FONT_FAMILY, PANEL_BG, PANEL_BORDER, TEXT_COLOR, TEXT_MUTED } from "./styles";

/**
 * Suggestion popover for the Notebook's @-mention feature (ADR 013).
 * Rendered outside the editor's host so tiptap's selection handling
 * doesn't clash. Keyboard nav: Arrow Up/Down cycles, Enter commits,
 * Escape closes. Mouse click on a row also commits.
 */

export type MentionCommand = (attrs: { readonly kind: EntityKind; readonly id: string }) => void;

export type MentionPopoverOptions = {
  readonly items: readonly EntityRecord[];
  readonly clientRect: (() => DOMRect | null) | null;
  readonly command: MentionCommand;
};

export type MentionPopover = {
  readonly element: HTMLElement;
  update(options: {
    readonly items: readonly EntityRecord[];
    readonly clientRect: (() => DOMRect | null) | null;
  }): void;
  onKeyDown(event: KeyboardEvent): boolean;
  destroy(): void;
};

export function createMentionPopover(options: MentionPopoverOptions): MentionPopover {
  let items: readonly EntityRecord[] = options.items;
  let selectedIndex = 0;
  let clientRect: (() => DOMRect | null) | null = options.clientRect;

  const root = document.createElement("div");
  root.dataset.testid = "notebook-mention-popover";
  root.style.position = "fixed";
  root.style.background = PANEL_BG;
  root.style.border = PANEL_BORDER;
  root.style.borderRadius = "6px";
  root.style.color = TEXT_COLOR;
  root.style.fontFamily = FONT_FAMILY;
  root.style.fontSize = "13px";
  root.style.padding = "4px";
  root.style.minWidth = "200px";
  root.style.maxWidth = "320px";
  root.style.boxShadow = "0 6px 20px rgba(0,0,0,0.5)";
  root.style.zIndex = "1400";
  document.body.appendChild(root);

  function commit(idx: number): void {
    const item = items[idx];
    if (item !== undefined) options.command({ kind: item.kind, id: item.id });
  }

  function render(): void {
    root.textContent = "";
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.dataset.testid = "notebook-mention-empty";
      empty.textContent = "No matches";
      empty.style.padding = "8px 10px";
      empty.style.color = TEXT_MUTED;
      root.appendChild(empty);
      return;
    }
    items.forEach((item, idx) => {
      const row = document.createElement("button");
      row.type = "button";
      row.dataset.testid = "notebook-mention-item";
      row.dataset.index = String(idx);
      row.dataset.kind = item.kind;
      row.dataset.entityId = item.id;
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";
      row.style.gap = "10px";
      row.style.width = "100%";
      row.style.textAlign = "left";
      row.style.border = "none";
      row.style.background = idx === selectedIndex ? "rgba(255,255,255,0.12)" : "transparent";
      row.style.color = TEXT_COLOR;
      row.style.fontFamily = FONT_FAMILY;
      row.style.fontSize = "13px";
      row.style.padding = "6px 10px";
      row.style.borderRadius = "4px";
      row.style.cursor = "pointer";

      const label = document.createElement("span");
      label.textContent = item.label;
      row.appendChild(label);

      const kindPill = document.createElement("span");
      kindPill.textContent = item.kind;
      kindPill.style.fontSize = "10px";
      kindPill.style.textTransform = "uppercase";
      kindPill.style.letterSpacing = "0.05em";
      kindPill.style.color = TEXT_MUTED;
      row.appendChild(kindPill);

      row.addEventListener("mousedown", (ev) => {
        // mousedown, not click — click fires after the editor loses
        // focus, which tears down the suggestion plugin before the
        // handler runs.
        ev.preventDefault();
        commit(idx);
      });
      root.appendChild(row);
    });
  }

  function position(): void {
    if (clientRect === null) return;
    const rect = clientRect();
    if (rect === null) return;
    root.style.top = `${String(rect.bottom + 4)}px`;
    root.style.left = `${String(rect.left)}px`;
  }

  function update(next: {
    readonly items: readonly EntityRecord[];
    readonly clientRect: (() => DOMRect | null) | null;
  }): void {
    items = next.items;
    clientRect = next.clientRect;
    if (selectedIndex >= items.length) selectedIndex = 0;
    render();
    position();
  }

  function destroy(): void {
    root.parentNode?.removeChild(root);
  }

  function onKeyDown(event: KeyboardEvent): boolean {
    if (items.length === 0) {
      if (event.key === "Escape") {
        destroy();
        return true;
      }
      return false;
    }
    if (event.key === "ArrowDown") {
      selectedIndex = (selectedIndex + 1) % items.length;
      render();
      return true;
    }
    if (event.key === "ArrowUp") {
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      render();
      return true;
    }
    if (event.key === "Enter") {
      commit(selectedIndex);
      return true;
    }
    if (event.key === "Escape") {
      destroy();
      return true;
    }
    return false;
  }

  render();
  position();

  return { element: root, update, onKeyDown, destroy };
}

// Re-export the `resolveEntityLabel` signature so the mention extension
// can import it from the same module family.
export { resolveEntityLabel };
