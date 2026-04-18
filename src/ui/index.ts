/* SPDX-License-Identifier: Apache-2.0 */
export type { Panel } from "./panel";
export { createPanel } from "./panel";
export { createTimeControls } from "./time-controls";
export { createLocationControls } from "./location-controls";
export { createLayerControls } from "./layer-controls";
export { createViewControls } from "./view-controls";
export { createPlanetInfo } from "./planet-info";
export { createSearch } from "./search";
export { createFovControls } from "./fov-controls";

import type { LayerVisibility, LayerOpacity } from "../state/state";
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
  | { type: "now" };
