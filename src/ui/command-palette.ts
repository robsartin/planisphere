/* SPDX-License-Identifier: Apache-2.0 */
import { el } from "./dom";
import { buildPaletteResults, type PaletteResult, type PaletteSources } from "./palette-results";
import type { PaletteSettingSource } from "./palette-results";
import { FONT_FAMILY, PANEL_BG, PANEL_BORDER, TEXT_COLOR } from "./styles";
import type { UIIntent } from "./index";

export type CommandPaletteOptions = {
  /** Called each time the palette needs fresh sources (on open / on query change). */
  readonly getSources: () => PaletteSources;
  /** Dispatch an intent — the palette calls this when the user picks a result. */
  readonly dispatch: (intent: UIIntent) => void;
  /** Called when the user picks something, so the caller can persist it to recents. */
  readonly onRecentSelected: (entry: PaletteSettingSource) => void;
};

export type CommandPalette = {
  readonly element: HTMLElement;
  open(): void;
  close(): void;
  isOpen(): boolean;
};

const TYPE_LABEL_MAP: Record<string, string> = {
  object_star: "star",
  object_constellation: "constellation",
  object_body: "planet",
  object_satellite: "satellite",
  object_messier: "deep sky",
  event: "event",
  place: "place",
  action: "action",
  recent: "recent",
};

const MONO_FONT = "ui-monospace, SFMono-Regular, Menlo, monospace";
const SELECTED_BG = "rgba(100,160,255,0.15)";

const ITEM_STYLE: Partial<CSSStyleDeclaration> = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 14px",
  cursor: "pointer",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const ITEM_LEFT_STYLE: Partial<CSSStyleDeclaration> = {
  display: "flex",
  flexDirection: "column",
  minWidth: "0",
  flex: "1",
};

const LABEL_STYLE: Partial<CSSStyleDeclaration> = {
  color: TEXT_COLOR,
  fontSize: "14px",
  fontFamily: FONT_FAMILY,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const HINT_STYLE: Partial<CSSStyleDeclaration> = {
  color: "rgba(255,255,255,0.55)",
  fontSize: "11px",
  fontFamily: FONT_FAMILY,
  marginTop: "2px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const EMPTY_STYLE: Partial<CSSStyleDeclaration> = {
  padding: "16px 14px",
  color: "rgba(255,255,255,0.55)",
  fontSize: "13px",
  fontFamily: FONT_FAMILY,
};

function resultTypeLabel(r: PaletteResult): string {
  if (r.kind === "object") return TYPE_LABEL_MAP[`object_${r.type}`] ?? "object";
  return TYPE_LABEL_MAP[r.kind] ?? r.kind;
}

function resultColor(r: PaletteResult): string {
  switch (r.kind) {
    case "object":
      return "#9fd8ff";
    case "event":
      return "#ffe08a";
    case "place":
      return "#b6ff8e";
    case "action":
    case "recent":
      return "#cfbfff";
  }
}

function subLine(r: PaletteResult): string | null {
  if (r.kind === "place" && r.country !== undefined) return r.country;
  if (r.kind === "event" && r.description !== undefined && r.description.length > 0) {
    return r.description;
  }
  if ((r.kind === "action" || r.kind === "recent") && r.hint !== undefined) return r.hint;
  return null;
}

function makeItem(r: PaletteResult, selected: boolean): HTMLElement {
  const hint = subLine(r);

  const left = el("div", {
    style: ITEM_LEFT_STYLE,
    children: [
      el("span", { text: r.label, style: LABEL_STYLE }),
      hint !== null ? el("span", { text: hint, style: HINT_STYLE }) : null,
    ],
  });

  const typeLabel = el("span", {
    text: resultTypeLabel(r),
    style: {
      color: resultColor(r),
      fontSize: "11px",
      fontFamily: FONT_FAMILY,
      marginLeft: "10px",
      whiteSpace: "nowrap",
      flexShrink: "0",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
    },
  });

  return el("div", {
    testid: "palette-item",
    dataset: { resultId: r.id, resultKind: r.kind },
    attrs: { role: "option", "aria-selected": String(selected) },
    style: { ...ITEM_STYLE, background: selected ? SELECTED_BG : "transparent" },
    children: [left, typeLabel],
  });
}

/**
 * Translate a chosen PaletteResult into zero or more UIIntents, dispatch them,
 * and report the action to `onRecentSelected` so the caller can remember it.
 *
 * Objects dispatch `{ type: "pin-object" }`. Places dispatch `set-observer`.
 * Events dispatch `set-time` and, if a view direction is present, `set-view`.
 * Actions dispatch the intent attached to the source entry (if any).
 */
function executeResult(
  r: PaletteResult,
  dispatch: (intent: UIIntent) => void,
  onRecentSelected: (entry: PaletteSettingSource) => void,
): void {
  switch (r.kind) {
    case "object":
      dispatch({ type: "pin-object", id: r.id });
      onRecentSelected({ id: `object:${r.id}`, label: r.label });
      return;
    case "place":
      dispatch({ type: "set-observer", lat: r.lat, lon: r.lon });
      onRecentSelected({ id: `place:${r.id}`, label: r.label });
      return;
    case "event": {
      if (r.when !== undefined) dispatch({ type: "set-time", time: r.when });
      if (r.viewAz !== undefined && r.viewAlt !== undefined) {
        dispatch({ type: "set-view", az: r.viewAz, alt: r.viewAlt });
      }
      onRecentSelected({ id: `event:${r.id}`, label: r.label });
      return;
    }
    case "action":
    case "recent": {
      if (r.intent !== undefined) dispatch(r.intent);
      onRecentSelected({
        id: r.id,
        label: r.label,
        ...(r.intent !== undefined ? { intent: r.intent } : {}),
      });
      return;
    }
  }
}

/**
 * Create the command palette modal.
 *
 * The modal is shown centred-top of the viewport, wraps a monospace input and
 * a scrollable result list. It owns its own keyboard navigation (arrow up/down
 * highlight, Enter executes, Esc closes); the caller is responsible for the
 * global ⌘K/Ctrl+K keybinding that toggles open/close.
 */
export function createCommandPalette(opts: CommandPaletteOptions): CommandPalette {
  const kbd = el("span", {
    text: "⌘K",
    style: {
      color: "rgba(255,255,255,0.5)",
      fontFamily: MONO_FONT,
      fontSize: "11px",
      marginRight: "10px",
      padding: "2px 6px",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: "4px",
    },
  });

  const input = el("input", {
    testid: "palette-input",
    type: "text",
    placeholder: "Search objects, events, places, settings…",
    attrs: { "aria-label": "Command palette" },
    style: {
      flex: "1",
      background: "transparent",
      border: "none",
      outline: "none",
      color: TEXT_COLOR,
      fontSize: "16px",
      fontFamily: MONO_FONT,
    },
  });

  const inputWrapper = el("div", {
    style: {
      display: "flex",
      alignItems: "center",
      padding: "10px 14px",
      borderBottom: "1px solid rgba(255,255,255,0.12)",
    },
    children: [kbd, input],
  });

  const list = el("div", {
    testid: "palette-list",
    attrs: { role: "listbox" },
    style: { maxHeight: "50vh", overflowY: "auto" },
  });

  const panel = el("div", {
    style: {
      position: "absolute",
      top: "12vh",
      left: "50%",
      transform: "translateX(-50%)",
      width: "min(96vw, 620px)",
      background: PANEL_BG,
      border: PANEL_BORDER,
      borderRadius: "10px",
      boxShadow: "0 18px 60px rgba(0,0,0,0.6)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      boxSizing: "border-box",
    },
    children: [inputWrapper, list],
  });

  const backdrop = el("div", {
    testid: "palette-backdrop",
    style: {
      position: "absolute",
      inset: "0",
      background: "rgba(0,0,0,0.55)",
      backdropFilter: "blur(2px)",
    },
  });

  const root = el("div", {
    testid: "palette-root",
    style: { display: "none", position: "fixed", inset: "0", zIndex: "3000" },
    children: [backdrop, panel],
  });

  // Prevent the backdrop-click handler from firing when the user clicks inside the panel.
  panel.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  let open = false;
  let results: PaletteResult[] = [];
  let selectedIndex = 0;

  function render(): void {
    if (results.length === 0) {
      list.replaceChildren(
        el("div", {
          testid: "palette-empty",
          text: input.value.trim().length === 0 ? "No actions available" : "No results",
          style: EMPTY_STYLE,
        }),
      );
      return;
    }
    const items = results.map((r, i) => {
      const item = makeItem(r, i === selectedIndex);
      item.addEventListener("click", () => {
        selectedIndex = i;
        executeResult(r, opts.dispatch, opts.onRecentSelected);
        close();
      });
      item.addEventListener("mouseenter", () => {
        selectedIndex = i;
        updateSelection();
      });
      return item;
    });
    list.replaceChildren(...items);
  }

  function updateSelection(): void {
    const items = list.querySelectorAll<HTMLElement>("[data-testid='palette-item']");
    items.forEach((node, i) => {
      const sel = i === selectedIndex;
      node.setAttribute("aria-selected", String(sel));
      node.style.background = sel ? SELECTED_BG : "transparent";
    });
    const current = items[selectedIndex];
    if (current !== undefined && typeof current.scrollIntoView === "function") {
      current.scrollIntoView({ block: "nearest" });
    }
  }

  function refresh(): void {
    results = buildPaletteResults(input.value, opts.getSources());
    selectedIndex = 0;
    render();
  }

  function executeSelected(): void {
    const r = results[selectedIndex];
    if (r === undefined) return;
    executeResult(r, opts.dispatch, opts.onRecentSelected);
    close();
  }

  function open_(): void {
    open = true;
    root.style.display = "block";
    input.value = "";
    refresh();
    input.focus();
  }

  function close(): void {
    open = false;
    root.style.display = "none";
    input.value = "";
    results = [];
    list.replaceChildren();
  }

  input.addEventListener("input", refresh);

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length === 0) return;
      selectedIndex = (selectedIndex + 1) % results.length;
      updateSelection();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length === 0) return;
      selectedIndex = (selectedIndex - 1 + results.length) % results.length;
      updateSelection();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      executeSelected();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });

  backdrop.addEventListener("click", () => {
    close();
  });

  return {
    element: root,
    open: open_,
    close,
    isOpen: () => open,
  };
}
