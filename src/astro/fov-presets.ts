/* SPDX-License-Identifier: Apache-2.0 */

export type FovPresetId = "off" | "naked-eye" | "binoculars" | "small-scope" | "large-scope";

export type FovPreset = {
  readonly id: FovPresetId;
  readonly label: string;
  readonly degrees: number;
};

export const FOV_PRESETS: readonly FovPreset[] = [
  { id: "off", label: "Off", degrees: 0 },
  { id: "naked-eye", label: "Naked eye (5\u00B0)", degrees: 5 },
  { id: "binoculars", label: "Binoculars (7\u00B0)", degrees: 7 },
  { id: "small-scope", label: "Small scope (1\u00B0)", degrees: 1 },
  { id: "large-scope", label: "Large scope (0.5\u00B0)", degrees: 0.5 },
];

const ID_SET = new Set<string>(FOV_PRESETS.map((p) => p.id));

export function isFovPresetId(value: string): value is FovPresetId {
  return ID_SET.has(value);
}

export function parseFovPreset(raw: string | null | undefined): FovPresetId {
  if (raw === null || raw === undefined) return "off";
  return isFovPresetId(raw) ? raw : "off";
}

export function getFovDegrees(id: FovPresetId): number {
  const preset = FOV_PRESETS.find((p) => p.id === id);
  return preset ? preset.degrees : 0;
}
