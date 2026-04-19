/* SPDX-License-Identifier: Apache-2.0 */
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

function makeItem(r: PaletteResult, selected: boolean): HTMLElement {
  const item = document.createElement("div");
  item.dataset.testid = "palette-item";
  item.dataset.resultId = r.id;
  item.dataset.resultKind = r.kind;
  item.setAttribute("role", "option");
  item.setAttribute("aria-selected", String(selected));
  item.style.cssText =
    "display:flex;justify-content:space-between;align-items:center;" +
    "padding:10px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.06);" +
    `background:${selected ? "rgba(100,160,255,0.15)" : "transparent"}`;

  const left = document.createElement("div");
  left.style.cssText = "display:flex;flex-direction:column;min-width:0;flex:1";

  const label = document.createElement("span");
  label.textContent = r.label;
  label.style.cssText = `color:${TEXT_COLOR};font-size:14px;font-family:${FONT_FAMILY};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
  left.appendChild(label);

  const hint = subLine(r);
  if (hint !== null) {
    const hintEl = document.createElement("span");
    hintEl.textContent = hint;
    hintEl.style.cssText = `color:rgba(255,255,255,0.55);font-size:11px;font-family:${FONT_FAMILY};margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
    left.appendChild(hintEl);
  }

  const typeLabel = document.createElement("span");
  typeLabel.textContent = resultTypeLabel(r);
  typeLabel.style.cssText = `color:${resultColor(r)};font-size:11px;font-family:${FONT_FAMILY};margin-left:10px;white-space:nowrap;flex-shrink:0;text-transform:uppercase;letter-spacing:0.04em`;

  item.appendChild(left);
  item.appendChild(typeLabel);
  return item;
}

function subLine(r: PaletteResult): string | null {
  if (r.kind === "place" && r.country !== undefined) return r.country;
  if (r.kind === "event" && r.description !== undefined && r.description.length > 0) {
    return r.description;
  }
  if ((r.kind === "action" || r.kind === "recent") && r.hint !== undefined) return r.hint;
  return null;
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
  const root = document.createElement("div");
  root.dataset.testid = "palette-root";
  root.style.display = "none";
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.zIndex = "3000";

  const backdrop = document.createElement("div");
  backdrop.dataset.testid = "palette-backdrop";
  backdrop.style.cssText =
    "position:absolute;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(2px)";
  root.appendChild(backdrop);

  const panel = document.createElement("div");
  panel.style.cssText =
    "position:absolute;top:12vh;left:50%;transform:translateX(-50%);" +
    `width:min(96vw, 620px);background:${PANEL_BG};border:${PANEL_BORDER};` +
    "border-radius:10px;box-shadow:0 18px 60px rgba(0,0,0,0.6);" +
    "display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box";

  const inputWrapper = document.createElement("div");
  inputWrapper.style.cssText =
    "display:flex;align-items:center;padding:10px 14px;" +
    "border-bottom:1px solid rgba(255,255,255,0.12)";

  const kbd = document.createElement("span");
  kbd.textContent = "\u2318K";
  kbd.style.cssText =
    `color:rgba(255,255,255,0.5);font-family:ui-monospace, SFMono-Regular, Menlo, monospace;` +
    "font-size:11px;margin-right:10px;padding:2px 6px;border:1px solid rgba(255,255,255,0.2);border-radius:4px";
  inputWrapper.appendChild(kbd);

  const input = document.createElement("input");
  input.type = "text";
  input.dataset.testid = "palette-input";
  input.placeholder = "Search objects, events, places, settings…";
  input.style.cssText =
    "flex:1;background:transparent;border:none;outline:none;" +
    `color:${TEXT_COLOR};font-size:16px;font-family:ui-monospace, SFMono-Regular, Menlo, monospace`;
  input.setAttribute("aria-label", "Command palette");
  inputWrapper.appendChild(input);

  const list = document.createElement("div");
  list.dataset.testid = "palette-list";
  list.style.cssText = "max-height:50vh;overflow-y:auto";
  list.setAttribute("role", "listbox");

  panel.appendChild(inputWrapper);
  panel.appendChild(list);
  root.appendChild(panel);

  // Prevent the backdrop-click handler from firing when the user clicks inside the panel.
  panel.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  let open = false;
  let results: PaletteResult[] = [];
  let selectedIndex = 0;

  function render(): void {
    list.replaceChildren();
    if (results.length === 0) {
      const empty = document.createElement("div");
      empty.dataset.testid = "palette-empty";
      empty.textContent = input.value.trim().length === 0 ? "No actions available" : "No results";
      empty.style.cssText =
        "padding:16px 14px;color:rgba(255,255,255,0.55);" +
        `font-size:13px;font-family:${FONT_FAMILY}`;
      list.appendChild(empty);
      return;
    }
    results.forEach((r, i) => {
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
      list.appendChild(item);
    });
  }

  function updateSelection(): void {
    const items = list.querySelectorAll<HTMLElement>("[data-testid='palette-item']");
    items.forEach((el, i) => {
      const sel = i === selectedIndex;
      el.setAttribute("aria-selected", String(sel));
      el.style.background = sel ? "rgba(100,160,255,0.15)" : "transparent";
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
