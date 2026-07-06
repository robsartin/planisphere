/* SPDX-License-Identifier: Apache-2.0 */
import { createDrawer, type Drawer } from "./drawer";
import { el } from "./dom";
import {
  createVisibilitySection,
  createOpacitySection,
  createMagnitudeFilterSection,
  createLanguageSection,
  createSkycultureSection,
  createConstellationArtSection,
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
  // #350 — constellation art overlay. Off by default; opacity slider default 0.35.
  constellationArt: boolean;
  constellationArtOpacity: number;
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
  chevron: HTMLElement;
  body: HTMLElement;
};

function buildSection(id: SectionId, title: string, content: HTMLElement): SectionHandle {
  const chevron = el("span", {
    testid: `settings-chevron-${id}`,
    text: "▸",
    style: { transition: "transform 120ms ease" },
  });

  const header = el("button", {
    testid: `settings-header-${id}`,
    type: "button",
    style: {
      width: "100%",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 10px",
      background: "rgba(255,255,255,0.04)",
      border: "none",
      color: TEXT_COLOR,
      cursor: "pointer",
      textAlign: "left",
      fontWeight: "bold",
    },
    children: [el("span", { text: title }), chevron],
  });
  applyBaseText(header);

  const body = el("div", {
    testid: `settings-body-${id}`,
    style: { padding: "8px 10px", display: "none" },
    children: [content],
  });

  const wrapper = el("div", {
    testid: `settings-section-${id}`,
    dataset: { expanded: "false" },
    style: {
      marginBottom: GAP,
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: "6px",
      overflow: "hidden",
    },
    children: [header, body],
  });

  return { wrapper, header, chevron, body };
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
  const {
    visibility,
    opacity,
    magLimit,
    language,
    skyculture,
    constellationArt,
    constellationArtOpacity,
    dispatch,
  } = options;

  const sections: Record<SectionId, SectionHandle> = {
    visibility: buildSection(
      "visibility",
      "Visibility",
      el("div", {
        children: [
          createVisibilitySection(visibility, dispatch),
          // #350 — constellation art overlay lives inside Visibility so its
          // toggle and opacity slider both surface behind the same header the
          // user already reaches for. It's a distinct opt-in surface (?art=on)
          // rather than a member of LayerVisibility, so a dedicated mini-
          // section keeps the URL scheme separate from `layers=`.
          createConstellationArtSection(constellationArt, constellationArtOpacity, dispatch),
        ],
      }),
    ),
    opacity: buildSection("opacity", "Opacity", createOpacitySection(opacity, dispatch)),
    filters: buildSection("filters", "Filters", createMagnitudeFilterSection(magLimit, dispatch)),
    display: buildSection(
      "display",
      "Display",
      buildDisplaySection(language, skyculture, dispatch),
    ),
  };

  const title = el("h2", {
    text: "Settings",
    style: { margin: "0 0 12px 0", fontSize: "16px" },
  });
  applyBaseText(title);

  const container = el("div", {
    testid: "settings-drawer-content",
    children: [title, ...SECTION_IDS.map((id) => sections[id].wrapper)],
  });

  function expand(id: SectionId): void {
    for (const other of SECTION_IDS) {
      const s = sections[other];
      const expanded = other === id;
      s.wrapper.dataset.expanded = expanded ? "true" : "false";
      s.body.style.display = expanded ? "block" : "none";
      s.chevron.style.transform = expanded ? "rotate(90deg)" : "rotate(0deg)";
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
  const langHeading = el("div", {
    text: "Constellation Names",
    style: { fontSize: "12px", marginBottom: "2px" },
  });
  applyBaseText(langHeading);

  const skyHeading = el("div", {
    text: "Skyculture",
    style: { fontSize: "12px", marginTop: "8px", marginBottom: "2px" },
  });
  applyBaseText(skyHeading);

  return el("div", {
    children: [
      langHeading,
      createLanguageSection(language, dispatch),
      skyHeading,
      createSkycultureSection(skyculture, dispatch),
    ],
  });
}
