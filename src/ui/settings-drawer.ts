/* SPDX-License-Identifier: Apache-2.0 */
import { createDrawer, type Drawer } from "./drawer";
import {
  createVisibilitySection,
  createOpacitySection,
  createMagnitudeFilterSection,
  createLanguageSection,
  createSkycultureSection,
} from "./layer-controls";
import { applyBaseText, GAP, TEXT_COLOR } from "./styles";
import type { UIIntent } from "./index";
import type { LayerVisibility, LayerOpacity } from "../state/state";
import type { Language } from "../astro/constellation-names";
import type { SkycultureId } from "../astro/skycultures";

export const SETTINGS_SECTION_STORAGE_KEY = "planisphere.settings.lastSection.v1";

type SectionId = "visibility" | "opacity" | "filters" | "display";
const SECTION_IDS: readonly SectionId[] = ["visibility", "opacity", "filters", "display"];

function isSectionId(v: string | null): v is SectionId {
  return v !== null && (SECTION_IDS as readonly string[]).includes(v);
}

function loadLastSection(): SectionId {
  try {
    const raw = globalThis.localStorage?.getItem(SETTINGS_SECTION_STORAGE_KEY);
    if (isSectionId(raw)) return raw;
  } catch {
    // localStorage disabled / quota — fall through to default.
  }
  return "visibility";
}

function persistLastSection(section: SectionId): void {
  try {
    globalThis.localStorage?.setItem(SETTINGS_SECTION_STORAGE_KEY, section);
  } catch {
    // Ignore storage errors — the preference is a nice-to-have.
  }
}

export type SettingsDrawerOptions = {
  visibility: LayerVisibility;
  opacity: LayerOpacity;
  magLimit: number;
  language: Language;
  skyculture: SkycultureId;
  dispatch: (intent: UIIntent) => void;
};

export type SettingsDrawer = {
  element: HTMLElement;
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
};

type SectionHandle = {
  wrapper: HTMLElement;
  header: HTMLElement;
  body: HTMLElement;
};

function buildSection(id: SectionId, title: string, content: HTMLElement): SectionHandle {
  const wrapper = document.createElement("div");
  wrapper.dataset.testid = `settings-section-${id}`;
  wrapper.dataset.expanded = "false";
  wrapper.style.marginBottom = GAP;
  wrapper.style.border = "1px solid rgba(255,255,255,0.15)";
  wrapper.style.borderRadius = "6px";
  wrapper.style.overflow = "hidden";

  const header = document.createElement("button");
  header.dataset.testid = `settings-header-${id}`;
  header.type = "button";
  header.style.width = "100%";
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.padding = "8px 10px";
  header.style.background = "rgba(255,255,255,0.04)";
  header.style.border = "none";
  header.style.color = TEXT_COLOR;
  header.style.cursor = "pointer";
  header.style.textAlign = "left";
  applyBaseText(header);
  header.style.fontWeight = "bold";

  const titleEl = document.createElement("span");
  titleEl.textContent = title;
  const chevron = document.createElement("span");
  chevron.dataset.testid = `settings-chevron-${id}`;
  chevron.textContent = "▸";
  chevron.style.transition = "transform 120ms ease";
  header.appendChild(titleEl);
  header.appendChild(chevron);

  const body = document.createElement("div");
  body.dataset.testid = `settings-body-${id}`;
  body.style.padding = "8px 10px";
  body.style.display = "none";
  body.appendChild(content);

  wrapper.appendChild(header);
  wrapper.appendChild(body);

  return { wrapper, header, body };
}

/**
 * The 1E settings drawer. Wraps the shared drawer primitive and composes
 * the moved-from-side-panel controls into four collapsible sections. The
 * user's last-open section is remembered via localStorage so returning
 * users land on what they last touched.
 *
 * The drawer owns an always-live section DOM so dispatch handlers remain
 * wired across open/close cycles. `open()` just flips the shared drawer.
 */
export function createSettingsDrawer(options: SettingsDrawerOptions): SettingsDrawer {
  const { visibility, opacity, magLimit, language, skyculture, dispatch } = options;

  const container = document.createElement("div");
  container.dataset.testid = "settings-drawer-content";

  const title = document.createElement("h2");
  title.textContent = "Settings";
  applyBaseText(title);
  title.style.margin = "0 0 12px 0";
  title.style.fontSize = "16px";
  container.appendChild(title);

  const sections: Record<SectionId, SectionHandle> = {
    visibility: buildSection(
      "visibility",
      "Visibility",
      createVisibilitySection(visibility, dispatch),
    ),
    opacity: buildSection("opacity", "Opacity", createOpacitySection(opacity, dispatch)),
    filters: buildSection("filters", "Filters", createMagnitudeFilterSection(magLimit, dispatch)),
    display: buildSection(
      "display",
      "Display",
      buildDisplaySection(language, skyculture, dispatch),
    ),
  };

  for (const id of SECTION_IDS) {
    container.appendChild(sections[id].wrapper);
  }

  function expand(id: SectionId): void {
    for (const other of SECTION_IDS) {
      const s = sections[other];
      const expanded = other === id;
      s.wrapper.dataset.expanded = expanded ? "true" : "false";
      s.body.style.display = expanded ? "block" : "none";
      const chev = s.header.querySelector<HTMLElement>(`[data-testid='settings-chevron-${other}']`);
      if (chev !== null) chev.style.transform = expanded ? "rotate(90deg)" : "rotate(0deg)";
    }
  }

  for (const id of SECTION_IDS) {
    sections[id].header.addEventListener("click", () => {
      expand(id);
      persistLastSection(id);
    });
  }

  // Initial expanded section follows stored preference, defaulting to visibility.
  expand(loadLastSection());

  const drawer: Drawer = createDrawer({ side: "right", width: "320px" });

  function doOpen(): void {
    drawer.open(container);
  }

  return {
    element: drawer.element,
    open: doOpen,
    close: drawer.close,
    isOpen: drawer.isOpen,
  };
}

function buildDisplaySection(
  language: Language,
  skyculture: SkycultureId,
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  const wrapper = document.createElement("div");

  const langHeading = document.createElement("div");
  langHeading.textContent = "Constellation Names";
  applyBaseText(langHeading);
  langHeading.style.fontSize = "12px";
  langHeading.style.marginBottom = "2px";
  wrapper.appendChild(langHeading);
  wrapper.appendChild(createLanguageSection(language, dispatch));

  const skyHeading = document.createElement("div");
  skyHeading.textContent = "Skyculture";
  applyBaseText(skyHeading);
  skyHeading.style.fontSize = "12px";
  skyHeading.style.marginTop = "8px";
  skyHeading.style.marginBottom = "2px";
  wrapper.appendChild(skyHeading);
  wrapper.appendChild(createSkycultureSection(skyculture, dispatch));

  return wrapper;
}
