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
export { createNotebookWorkspace, NOTEBOOK_SCRATCH_STORAGE_KEY } from "./notebook-workspace";
export type { NotebookWorkspace, NotebookWorkspaceOptions } from "./notebook-workspace";
export { createEmailGateModal } from "./email-gate-modal";
export type { EmailGateModal, EmailGateModalOptions } from "./email-gate-modal";
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
    };
