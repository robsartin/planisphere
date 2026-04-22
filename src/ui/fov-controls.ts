/* SPDX-License-Identifier: Apache-2.0 */
import { el } from "./dom";
import { FOV_PRESETS, type FovPresetId, isFovPresetId } from "../astro/fov-presets";
import type { UIIntent } from "./index";

export function createFovControls(
  initialPreset: FovPresetId,
  onIntent: (intent: UIIntent) => void,
): HTMLElement {
  const select = el("select", {
    dataset: { fov: "preset" },
    style: {
      flex: "1",
      background: "rgba(255,255,255,0.1)",
      color: "#fff",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: "4px",
      padding: "4px",
      font: "12px sans-serif",
    },
    children: FOV_PRESETS.map((preset) => {
      const opt = el("option", { text: preset.label });
      opt.value = preset.id;
      return opt;
    }),
  });
  select.value = initialPreset;
  select.addEventListener("change", () => {
    if (!isFovPresetId(select.value)) return;
    onIntent({ type: "set-fov", preset: select.value });
  });

  return el("div", {
    style: { padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.1)" },
    children: [
      el("div", {
        text: "Telescope FOV",
        style: { color: "#fff", font: "bold 12px sans-serif", marginBottom: "6px" },
      }),
      el("div", {
        style: { display: "flex", alignItems: "center", gap: "8px" },
        children: [
          el("label", {
            text: "Reticle",
            style: { color: "rgba(255,255,255,0.6)", font: "12px sans-serif" },
          }),
          select,
        ],
      }),
    ],
  });
}
