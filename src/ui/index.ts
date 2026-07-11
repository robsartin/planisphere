/* SPDX-License-Identifier: Apache-2.0 */
export type { Panel, PanelOptions } from "./panel";
export { createPanel } from "./panel";
export { createTimeControls } from "./time-controls";
export type { TimeControls } from "./time-controls";
export { createLocationControls } from "./location-controls";
export {
  createVisibilitySection,
  createOpacitySection,
  createMagnitudeFilterSection,
  createLanguageSection,
  createSkycultureSection,
  createConstellationArtSection,
} from "./layer-controls";
export type { Drawer, DrawerOptions, DrawerSide } from "./drawer";
export { createDrawer } from "./drawer";
export type { SettingsDrawer, SettingsDrawerOptions } from "./settings-drawer";
export { createSettingsDrawer, SETTINGS_SECTION_STORAGE_KEY } from "./settings-drawer";
export { createViewControls } from "./view-controls";
export { createPlanetInfo } from "./planet-info";
export { createSearch } from "./search";
export { createFovControls } from "./fov-controls";
export { createEventsPanel } from "./events-panel";
export { createEventsDrawer } from "./events-drawer";
export type { EventsDrawer, EventsDrawerOptions } from "./events-drawer";
export { createTonightDrawer } from "./tonight-drawer";
export type { TonightDrawer, TonightDrawerOptions } from "./tonight-drawer";
export type { HelpModal, HelpModalOptions } from "./help-modal";
export { createHelpModal } from "./help-modal";
export type { LoginModal, LoginModalOptions } from "./login-modal";
export { createLoginModal } from "./login-modal";
export { createOnboardingOverlay, ONBOARDING_STORAGE_KEY } from "./onboarding-overlay";
export type {
  OnboardingOverlay,
  OnboardingOverlayOptions,
  OnboardingStep,
  OnboardingStepPosition,
} from "./onboarding-overlay";
export { createBottomHud } from "./bottom-hud";
export type { BottomHud } from "./bottom-hud";
export { createLocationPickerOverlay } from "./location-picker-overlay";
export type {
  LocationPickerOverlay,
  LocationPickerOverlayOptions,
} from "./location-picker-overlay";
export { createCommandPalette } from "./command-palette";
export type { CommandPalette, CommandPaletteOptions } from "./command-palette";
// createNotebookWorkspace is intentionally NOT re-exported from this barrel —
// it lives behind a dynamic import in src/app.ts so tiptap/ProseMirror (~432
// KB) never enters the initial chunk for free-tier or planetarium users
// (#372). Import it directly from "./ui/notebook-workspace" when needed.
export type {
  NotebookApi,
  NotebookWorkspace,
  NotebookWorkspaceOptions,
} from "./notebook-workspace";
export { buildPaletteResults, fuzzyScore } from "./palette-results";
export type {
  PaletteResult,
  PaletteSources,
  PaletteObjectSource,
  PaletteEventSource,
  PalettePlaceSource,
  PaletteSettingSource,
  PaletteObjectType,
} from "./palette-results";
export { createObjectCard } from "./object-card";
export type { ObjectCard, ObjectCardData, ObjectCardProps } from "./object-card";
export { createEmptySkyPopover } from "./empty-sky-popover";
export type { EmptySkyPopover, EmptySkyPopoverOptions } from "./empty-sky-popover";
export { createObjectCardsManager } from "./object-cards-manager";
export type {
  ObjectCardsManager,
  CardsManagerOptions,
  CardKey,
  ObjectCardKind,
  ScreenPosition,
  ObjectPosition,
  OpenCardRequest,
} from "./object-cards-manager";

import type { LayerVisibility, LayerOpacity, AppMode } from "../state/state";
import type { Language } from "../astro/constellation-names";
import type { FovPresetId } from "../astro/fov-presets";
import type { SkycultureId } from "../astro/skycultures";

export type UIIntent =
  | { type: "set-time"; time: Date }
  | { type: "set-observer"; lat: number; lon: number }
  | { type: "toggle-layer"; layer: keyof LayerVisibility }
  | { type: "set-opacity"; layer: keyof LayerOpacity; value: number }
  | { type: "set-view"; az: number; alt: number }
  | { type: "toggle-night-vision" }
  | { type: "set-mag-limit"; value: number }
  | { type: "show-trail"; objectKind: "body"; id: string }
  | { type: "hide-trail" }
  | { type: "set-language"; language: Language }
  | { type: "set-skyculture"; id: SkycultureId }
  | { type: "set-fov"; preset: FovPresetId }
  | { type: "set-mode"; mode: AppMode }
  | { type: "now" }
  | { type: "open-location-picker" }
  | { type: "toggle-animation" }
  | { type: "set-animation-speed"; speed: 1 | 10 | 100 }
  | { type: "pin-object"; id: string }
  | { type: "copy-link" }
  | {
      type: "open-object-card";
      objectKind: "star" | "body" | "satellite" | "messier" | "constellation";
      id: string;
      screenX: number;
      screenY: number;
    }
  | {
      type: "open-empty-sky-popover";
      alt: number;
      az: number;
      screenX: number;
      screenY: number;
    }
  | { readonly type: "set-active-plan"; readonly slug: string | null }
  | { readonly type: "open-sign-in" }
  | { readonly type: "retry-plans" }
  | { readonly type: "open-help" }
  // #350 — constellation art overlay
  | { readonly type: "toggle-constellation-art" }
  | { readonly type: "set-constellation-art-opacity"; readonly value: number };

export { createPlanCard } from "./plans-card";
export { createPlansDrawer } from "./plans-drawer";
export type { PlansDrawer, PlansDrawerOptions, PlansDrawerView } from "./plans-drawer";
export { createPlansModal } from "./plans-modal";
export type { PlansModal, PlansModalOptions } from "./plans-modal";
