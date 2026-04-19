/* SPDX-License-Identifier: Apache-2.0 */
import {
  PANEL_BG,
  PANEL_BORDER,
  PANEL_RADIUS,
  PANEL_WIDTH,
  PANEL_MAX_HEIGHT,
  TEXT_COLOR,
  applyButton,
} from "./styles";
import type { UIIntent } from "./index";

export type Panel = {
  element: HTMLElement;
  setContent: (child: HTMLElement) => void;
  setCollapsed: (collapsed: boolean) => void;
  setNightVision: (on: boolean) => void;
};

export type PanelOptions = {
  onOpenHelp?: () => void;
  onOpenEvents?: () => void;
};

export function createPanel(
  container: HTMLElement,
  dispatch: (intent: UIIntent) => void = () => {},
  options: PanelOptions = {},
): Panel {
  const panel = document.createElement("div");
  panel.style.position = "fixed";
  panel.style.top = "16px";
  panel.style.right = "16px";
  panel.style.width = PANEL_WIDTH;
  panel.style.maxHeight = PANEL_MAX_HEIGHT;
  panel.style.overflowY = "auto";
  panel.style.background = PANEL_BG;
  panel.style.border = PANEL_BORDER;
  panel.style.borderRadius = PANEL_RADIUS;
  panel.style.zIndex = "1000";
  panel.style.boxSizing = "border-box";

  // Header
  const header = document.createElement("div");
  header.dataset.testid = "panel-header";
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.padding = "8px 12px";
  header.style.borderBottom = "1px solid rgba(255,255,255,0.15)";

  const title = document.createElement("span");
  title.textContent = "Planisphere";
  title.style.color = TEXT_COLOR;
  title.style.fontSize = "14px";
  title.style.fontWeight = "bold";
  title.style.fontFamily = "sans-serif";

  const btnGroup = document.createElement("div");
  btnGroup.style.display = "flex";
  btnGroup.style.gap = "4px";
  btnGroup.style.alignItems = "center";

  const nightVisionBtn = document.createElement("button");
  nightVisionBtn.dataset.testid = "panel-night-vision";
  nightVisionBtn.textContent = "🔴";
  nightVisionBtn.title = "Toggle night vision";
  applyButton(nightVisionBtn);

  const copyLinkBtn = document.createElement("button");
  copyLinkBtn.dataset.testid = "panel-copy-link";
  copyLinkBtn.textContent = "🔗";
  copyLinkBtn.title = "Copy link";
  applyButton(copyLinkBtn);

  const eventsBtn = document.createElement("button");
  eventsBtn.dataset.testid = "panel-events";
  eventsBtn.textContent = "\u{1F4C5}";
  eventsBtn.title = "Upcoming events";
  applyButton(eventsBtn);

  const helpBtn = document.createElement("button");
  helpBtn.dataset.testid = "panel-help";
  helpBtn.textContent = "?";
  helpBtn.title = "Help";
  applyButton(helpBtn);

  const toggleBtn = document.createElement("button");
  toggleBtn.dataset.testid = "panel-toggle";
  toggleBtn.textContent = "⚙";
  toggleBtn.title = "Toggle panel";
  applyButton(toggleBtn);

  btnGroup.appendChild(nightVisionBtn);
  btnGroup.appendChild(copyLinkBtn);
  btnGroup.appendChild(eventsBtn);
  btnGroup.appendChild(helpBtn);
  btnGroup.appendChild(toggleBtn);

  header.appendChild(title);
  header.appendChild(btnGroup);

  // Body
  const body = document.createElement("div");
  body.dataset.testid = "panel-body";
  body.style.padding = "8px 12px";

  panel.appendChild(header);
  panel.appendChild(body);
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
    toggleBtn.textContent = collapsed ? "⚙" : "×";
  });

  function setCollapsed(value: boolean): void {
    collapsed = value;
    body.style.display = value ? "none" : "";
    toggleBtn.textContent = value ? "⚙" : "×";
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

  return { element: panel, setContent, setCollapsed, setNightVision };
}
