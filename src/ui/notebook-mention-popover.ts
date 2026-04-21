/* SPDX-License-Identifier: Apache-2.0 */
import type { EntityRecord } from "../astro/entities";
import { resolveEntityLabel, type EntityKind } from "../astro/entities";
import { el } from "./dom";
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

  const root = el("div", {
    testid: "notebook-mention-popover",
    style: {
      position: "fixed",
      background: PANEL_BG,
      border: PANEL_BORDER,
      borderRadius: "6px",
      color: TEXT_COLOR,
      fontFamily: FONT_FAMILY,
      fontSize: "13px",
      padding: "4px",
      minWidth: "200px",
      maxWidth: "320px",
      boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
      zIndex: "1400",
    },
  });
  document.body.appendChild(root);

  function commit(idx: number): void {
    const item = items[idx];
    if (item !== undefined) options.command({ kind: item.kind, id: item.id });
  }

  function render(): void {
    root.textContent = "";
    if (items.length === 0) {
      root.appendChild(
        el("div", {
          testid: "notebook-mention-empty",
          text: "No matches",
          style: { padding: "8px 10px", color: TEXT_MUTED },
        }),
      );
      return;
    }
    items.forEach((item, idx) => {
      const row = el("button", {
        type: "button",
        testid: "notebook-mention-item",
        dataset: { index: String(idx), kind: item.kind, entityId: item.id },
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
          width: "100%",
          textAlign: "left",
          border: "none",
          background: idx === selectedIndex ? "rgba(255,255,255,0.12)" : "transparent",
          color: TEXT_COLOR,
          fontFamily: FONT_FAMILY,
          fontSize: "13px",
          padding: "6px 10px",
          borderRadius: "4px",
          cursor: "pointer",
        },
        on: {
          // mousedown, not click — click fires after the editor loses
          // focus, which tears down the suggestion plugin before the
          // handler runs.
          mousedown: (ev: MouseEvent) => {
            ev.preventDefault();
            commit(idx);
          },
        },
        children: [
          el("span", { text: item.label }),
          el("span", {
            text: item.kind,
            style: {
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: TEXT_MUTED,
            },
          }),
        ],
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
