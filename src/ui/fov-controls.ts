/* SPDX-License-Identifier: Apache-2.0 */
import { FOV_PRESETS, type FovPresetId, isFovPresetId } from "../astro/fov-presets";
import type { UIIntent } from "./index";

export function createFovControls(
  initialPreset: FovPresetId,
  onIntent: (intent: UIIntent) => void,
): HTMLElement {
  const section = document.createElement("div");
  section.style.cssText = "padding:8px 0;border-top:1px solid rgba(255,255,255,0.1)";

  const heading = document.createElement("div");
  heading.textContent = "Telescope FOV";
  heading.style.cssText = "color:#fff;font:bold 12px sans-serif;margin-bottom:6px";
  section.appendChild(heading);

  const row = document.createElement("div");
  row.style.cssText = "display:flex;align-items:center;gap:8px";

  const label = document.createElement("label");
  label.textContent = "Reticle";
  label.style.cssText = "color:rgba(255,255,255,0.6);font:12px sans-serif";
  row.appendChild(label);

  const select = document.createElement("select");
  select.dataset.fov = "preset";
  select.style.cssText =
    "flex:1;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);" +
    "border-radius:4px;padding:4px;font:12px sans-serif";

  for (const preset of FOV_PRESETS) {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.label;
    select.appendChild(option);
  }

  select.value = initialPreset;

  select.addEventListener("change", () => {
    const value = select.value;
    if (!isFovPresetId(value)) return;
    onIntent({ type: "set-fov", preset: value });
  });

  row.appendChild(select);
  section.appendChild(row);

  return section;
}
