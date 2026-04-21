/* SPDX-License-Identifier: Apache-2.0 */
import { isPro } from "../features";
import { el } from "./dom";
import {
  PANEL_BG,
  PANEL_BORDER,
  PANEL_RADIUS,
  PANEL_WIDTH,
  TEXT_COLOR,
  applyButton,
  createProPill,
} from "./styles";
import type { UIIntent } from "./index";
import type { AppMode } from "../state/state";

const MODE_ICON_PLANETARIUM = "\u{1F303}"; // 🌃 shown while in planetarium mode
const MODE_ICON_NOTEBOOK = "\u{1F4D3}"; // 📓 shown while in notebook mode

export type Panel = {
  element: HTMLElement;
  setContent: (child: HTMLElement) => void;
  setCollapsed: (collapsed: boolean) => void;
  setNightVision: (on: boolean) => void;
  setMode: (mode: AppMode) => void;
};

export type PanelOptions = {
  onOpenHelp?: () => void;
  onOpenEvents?: () => void;
  onOpenSettings?: () => void;
  onOpenTonight?: () => void;
  /**
   * Invoked when a non-Pro user clicks the mode-toggle while planetarium is
   * the active mode (i.e. they're trying to enter Notebook). When supplied,
   * the panel calls this instead of dispatching `set-mode` so the caller can
   * open the email-gate modal. No-op fallback is safe.
   */
  onProRequired?: () => void;
  /** Current app mode — controls the 🌃/📓 toggle icon. Defaults to "planetarium". */
  mode?: AppMode;
};

/** Build an icon button with the common title + applyButton styling. */
function iconButton(testid: string, icon: string, title: string): HTMLButtonElement {
  const btn = el("button", { testid, text: icon, attrs: { title } });
  applyButton(btn);
  return btn;
}

export function createPanel(
  container: HTMLElement,
  dispatch: (intent: UIIntent) => void = () => {},
  options: PanelOptions = {},
): Panel {
  let currentMode: AppMode = options.mode ?? "planetarium";

  const nightVisionBtn = iconButton("panel-night-vision", "🔴", "Toggle night vision");
  const copyLinkBtn = iconButton("panel-copy-link", "🔗", "Copy link");
  const eventsBtn = iconButton("panel-events", "\u{1F4C5}", "Upcoming events");
  const tonightBtn = iconButton("panel-tonight", "♀", "Tonight's sky");
  const helpBtn = iconButton("panel-help", "?", "Help");
  const settingsBtn = iconButton("panel-settings", "⚙", "Settings");
  const toggleBtn = iconButton("panel-toggle", "−", "Toggle panel");

  const modeIcon = el("span", {
    testid: "panel-mode-icon",
    text: currentMode === "notebook" ? MODE_ICON_NOTEBOOK : MODE_ICON_PLANETARIUM,
  });
  const modeBtn = el("button", {
    testid: "panel-mode",
    attrs: { title: "Toggle Planetarium / Notebook" },
    style: { display: "inline-flex", alignItems: "center", gap: "4px" },
    children: [modeIcon, isPro() ? null : createProPill("panel-mode-pro")],
  });
  applyButton(modeBtn);

  const body = el("div", {
    testid: "panel-body",
    style: { padding: "8px 12px" },
  });

  const panel = el("div", {
    style: {
      position: "fixed",
      top: "16px",
      right: "16px",
      width: PANEL_WIDTH,
      // Let the panel auto-size to its (post-Phase-1) short content. The old
      // 80vh cap + overflow-y:auto was sized for the pre-Phase-1 UI and now
      // renders an unwanted scrollbar. See issue #228.
      overflowY: "visible",
      background: PANEL_BG,
      border: PANEL_BORDER,
      borderRadius: PANEL_RADIUS,
      zIndex: "1000",
      boxSizing: "border-box",
    },
    children: [
      el("div", {
        testid: "panel-header",
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          // Title + 7 icon buttons don't fit on one row inside PANEL_WIDTH.
          // Allow wrap so the header can't force horizontal overflow.
          flexWrap: "wrap",
          gap: "4px",
          padding: "8px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.15)",
        },
        children: [
          el("span", {
            text: "Planisphere",
            style: {
              color: TEXT_COLOR,
              fontSize: "14px",
              fontWeight: "bold",
              fontFamily: "sans-serif",
            },
          }),
          el("div", {
            style: {
              display: "flex",
              flexWrap: "wrap",
              gap: "4px",
              alignItems: "center",
            },
            children: [
              nightVisionBtn,
              copyLinkBtn,
              eventsBtn,
              tonightBtn,
              helpBtn,
              settingsBtn,
              modeBtn,
              toggleBtn,
            ],
          }),
        ],
      }),
      body,
    ],
  });
  container.appendChild(panel);

  let collapsed = false;

  nightVisionBtn.addEventListener("click", () => {
    dispatch({ type: "toggle-night-vision" });
  });

  helpBtn.addEventListener("click", () => {
    options.onOpenHelp?.();
  });

  eventsBtn.addEventListener("click", () => {
    options.onOpenEvents?.();
  });

  tonightBtn.addEventListener("click", () => {
    options.onOpenTonight?.();
  });

  settingsBtn.addEventListener("click", () => {
    options.onOpenSettings?.();
  });

  modeBtn.addEventListener("click", () => {
    const next: AppMode = currentMode === "planetarium" ? "notebook" : "planetarium";
    // Gate entry into notebook mode for non-Pro users. Exit back to
    // planetarium is always free.
    if (next === "notebook" && !isPro()) {
      options.onProRequired?.();
      return;
    }
    dispatch({ type: "set-mode", mode: next });
  });

  copyLinkBtn.addEventListener("click", () => {
    const url = window.location.href;
    const copy = (text: string): void => {
      if (navigator.clipboard) {
        void navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
    };
    copy(url);
    copyLinkBtn.textContent = "Copied!";
    setTimeout(() => {
      copyLinkBtn.textContent = "🔗";
    }, 2000);
  });

  toggleBtn.addEventListener("click", () => {
    collapsed = !collapsed;
    body.style.display = collapsed ? "none" : "";
    toggleBtn.textContent = collapsed ? "+" : "−";
  });

  function setCollapsed(value: boolean): void {
    collapsed = value;
    body.style.display = value ? "none" : "";
    toggleBtn.textContent = value ? "+" : "−";
  }

  function setContent(child: HTMLElement): void {
    body.replaceChildren(child);
  }

  function setNightVision(on: boolean): void {
    if (on) {
      nightVisionBtn.style.boxShadow = "0 0 6px 2px red";
      nightVisionBtn.style.borderColor = "red";
    } else {
      nightVisionBtn.style.boxShadow = "";
      nightVisionBtn.style.borderColor = "";
    }
  }

  function setMode(mode: AppMode): void {
    currentMode = mode;
    modeIcon.textContent = mode === "notebook" ? MODE_ICON_NOTEBOOK : MODE_ICON_PLANETARIUM;
  }

  return { element: panel, setContent, setCollapsed, setNightVision, setMode };
}
