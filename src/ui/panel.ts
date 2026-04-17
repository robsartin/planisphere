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

export type Panel = {
  element: HTMLElement;
  setContent: (child: HTMLElement) => void;
  setCollapsed: (collapsed: boolean) => void;
};

export function createPanel(container: HTMLElement): Panel {
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

  const toggleBtn = document.createElement("button");
  toggleBtn.dataset.testid = "panel-toggle";
  toggleBtn.textContent = "⚙";
  toggleBtn.title = "Toggle panel";
  applyButton(toggleBtn);

  header.appendChild(title);
  header.appendChild(toggleBtn);

  // Body
  const body = document.createElement("div");
  body.dataset.testid = "panel-body";
  body.style.padding = "8px 12px";

  panel.appendChild(header);
  panel.appendChild(body);
  container.appendChild(panel);

  let collapsed = false;

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

  return { element: panel, setContent, setCollapsed };
}
