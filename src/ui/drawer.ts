/* SPDX-License-Identifier: Apache-2.0 */
import { PANEL_BG, PANEL_BORDER, TEXT_COLOR } from "./styles";

export type DrawerSide = "left" | "right";

export type DrawerOptions = {
  side: DrawerSide;
  width: string | number;
  onClose?: () => void;
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
  const { side, width, onClose } = options;

  const root = document.createElement("div");
  root.dataset.testid = "drawer";
  root.style.display = "none";
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.zIndex = "2000";

  const backdrop = document.createElement("div");
  backdrop.dataset.testid = "drawer-backdrop";
  backdrop.style.position = "absolute";
  backdrop.style.inset = "0";
  backdrop.style.background = "rgba(0,0,0,0.5)";

  const panel = document.createElement("div");
  panel.dataset.testid = "drawer-panel";
  panel.style.position = "absolute";
  panel.style.top = "0";
  panel.style.bottom = "0";
  panel.style.width = typeof width === "number" ? `${String(width)}px` : width;
  panel.style.maxWidth = "100vw";
  panel.style.background = PANEL_BG;
  panel.style.boxSizing = "border-box";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  if (side === "right") {
    panel.style.right = "0";
    panel.style.borderLeft = PANEL_BORDER;
  } else {
    panel.style.left = "0";
    panel.style.borderRight = PANEL_BORDER;
  }

  // Header with close button. Consumers render their own title inside the body.
  const header = document.createElement("div");
  header.dataset.testid = "drawer-header";
  header.style.display = "flex";
  header.style.justifyContent = "flex-end";
  header.style.alignItems = "center";
  header.style.padding = "8px 12px";
  header.style.borderBottom = "1px solid rgba(255,255,255,0.15)";
  header.style.flexShrink = "0";

  const closeBtn = document.createElement("button");
  closeBtn.dataset.testid = "drawer-close";
  closeBtn.textContent = "×";
  closeBtn.title = "Close (Esc)";
  closeBtn.style.background = "rgba(255,255,255,0.1)";
  closeBtn.style.border = "1px solid rgba(255,255,255,0.3)";
  closeBtn.style.borderRadius = "4px";
  closeBtn.style.color = TEXT_COLOR;
  closeBtn.style.cursor = "pointer";
  closeBtn.style.fontSize = "18px";
  closeBtn.style.lineHeight = "1";
  closeBtn.style.padding = "2px 10px";
  header.appendChild(closeBtn);

  const body = document.createElement("div");
  body.dataset.testid = "drawer-body";
  body.style.overflowY = "auto";
  body.style.padding = "12px 14px";
  body.style.flex = "1 1 auto";

  panel.appendChild(header);
  panel.appendChild(body);
  root.appendChild(backdrop);
  root.appendChild(panel);

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
