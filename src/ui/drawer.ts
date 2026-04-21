/* SPDX-License-Identifier: Apache-2.0 */
import { el } from "./dom";
import { PANEL_BG, PANEL_BORDER, TEXT_COLOR } from "./styles";

export type DrawerSide = "left" | "right";

export type DrawerOptions = {
  side: DrawerSide;
  width: string | number;
  onClose?: () => void;
  /**
   * Content to mount into the drawer body at creation time. Callers that hold
   * a stable content element and mutate its children (e.g. re-rendering on
   * state changes) should use this so the body is populated even while the
   * drawer is hidden. `open(content)` still replaces body children on each open.
   */
  initialContent?: HTMLElement;
};

export type Drawer = {
  element: HTMLElement;
  open: (content: HTMLElement) => void;
  close: () => void;
  isOpen: () => boolean;
};

/**
 * A reusable slide-in drawer primitive shared across milestones 1E/1F/1G.
 *
 * - `side` controls which edge the drawer is anchored to (`"right"` for the
 *   settings / events drawers; `"left"` reserved for future use).
 * - `width` is forwarded to the panel's CSS width (number → px).
 * - `onClose` fires whenever the drawer transitions from open → closed,
 *   regardless of trigger (explicit `close()`, Escape, backdrop click).
 *   It's the caller's hook for syncing "active drawer" state in the composer.
 *
 * The DOM is structured as `element > [backdrop, panel]`. `element.style.display`
 * is used to flip the whole overlay; CSS `translateX` on the panel mirrors
 * the help-modal slide pattern so future animation work has a hook.
 */
export function createDrawer(options: DrawerOptions): Drawer {
  const { side, width, onClose, initialContent } = options;

  const body = el("div", {
    testid: "drawer-body",
    style: { overflowY: "auto", padding: "12px 14px", flex: "1 1 auto" },
  });

  if (initialContent !== undefined) {
    body.replaceChildren(initialContent);
  }

  const closeBtn = el("button", {
    testid: "drawer-close",
    text: "×",
    attrs: { title: "Close (Esc)" },
    style: {
      background: "rgba(255,255,255,0.1)",
      border: "1px solid rgba(255,255,255,0.3)",
      borderRadius: "4px",
      color: TEXT_COLOR,
      cursor: "pointer",
      fontSize: "18px",
      lineHeight: "1",
      padding: "2px 10px",
    },
  });

  const panel = el("div", {
    testid: "drawer-panel",
    style: {
      position: "absolute",
      top: "0",
      bottom: "0",
      width: typeof width === "number" ? `${String(width)}px` : width,
      maxWidth: "100vw",
      background: PANEL_BG,
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      ...(side === "right"
        ? { right: "0", borderLeft: PANEL_BORDER }
        : { left: "0", borderRight: PANEL_BORDER }),
    },
    children: [
      el("div", {
        testid: "drawer-header",
        style: {
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          padding: "8px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.15)",
          flexShrink: "0",
        },
        children: [closeBtn],
      }),
      body,
    ],
  });

  const backdrop = el("div", {
    testid: "drawer-backdrop",
    style: {
      position: "absolute",
      inset: "0",
      background: "rgba(0,0,0,0.5)",
    },
  });

  const root = el("div", {
    testid: "drawer",
    style: {
      display: "none",
      position: "fixed",
      inset: "0",
      zIndex: "2000",
    },
    children: [backdrop, panel],
  });

  let open = false;

  function doOpen(content: HTMLElement): void {
    body.replaceChildren(content);
    open = true;
    root.style.display = "block";
  }

  function doClose(): void {
    if (!open) return;
    open = false;
    root.style.display = "none";
    onClose?.();
  }

  backdrop.addEventListener("click", doClose);
  closeBtn.addEventListener("click", doClose);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) {
      doClose();
    }
  });

  return {
    element: root,
    open: doOpen,
    close: doClose,
    isOpen: () => open,
  };
}
