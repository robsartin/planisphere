/* SPDX-License-Identifier: Apache-2.0 */
import type { UIIntent } from "./index";

type ViewPreset = { label: string; az: number; alt: number };

const PRESETS: ViewPreset[] = [
  { label: "Zenith", az: 0, alt: 89.9 },
  { label: "N", az: 0, alt: 30 },
  { label: "E", az: 90, alt: 30 },
  { label: "S", az: 180, alt: 30 },
  { label: "W", az: 270, alt: 30 },
];

export function createViewControls(
  initialAz: number,
  initialAlt: number,
  onIntent: (intent: UIIntent) => void,
): HTMLElement {
  const section = document.createElement("div");
  section.style.cssText = "padding:8px 0;border-top:1px solid rgba(255,255,255,0.1)";

  const heading = document.createElement("div");
  heading.textContent = "View Direction";
  heading.style.cssText = "color:#fff;font:bold 12px sans-serif;margin-bottom:6px";
  section.appendChild(heading);

  // Preset buttons
  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap";
  for (const preset of PRESETS) {
    const btn = document.createElement("button");
    btn.textContent = preset.label;
    btn.dataset.testid = `view-${preset.label.toLowerCase()}`;
    btn.style.cssText =
      "background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);" +
      "border-radius:4px;padding:4px 8px;cursor:pointer;font:12px sans-serif";
    btn.addEventListener("click", () => {
      azInput.value = String(preset.az);
      altInput.value = String(preset.alt);
      onIntent({ type: "set-view", az: preset.az, alt: preset.alt });
    });
    btnRow.appendChild(btn);
  }
  section.appendChild(btnRow);

  // Az/Alt inputs
  const inputRow = document.createElement("div");
  inputRow.style.cssText = "display:flex;gap:8px;align-items:center";

  const azLabel = document.createElement("label");
  azLabel.textContent = "Az";
  azLabel.style.cssText = "color:rgba(255,255,255,0.6);font:12px sans-serif";
  const azInput = document.createElement("input");
  azInput.type = "number";
  azInput.min = "0";
  azInput.max = "360";
  azInput.step = "1";
  azInput.value = String(initialAz);
  azInput.dataset.testid = "view-az";
  azInput.style.cssText =
    "width:60px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);" +
    "border-radius:4px;padding:4px;font:12px sans-serif";

  const altLabel = document.createElement("label");
  altLabel.textContent = "Alt";
  altLabel.style.cssText = "color:rgba(255,255,255,0.6);font:12px sans-serif";
  const altInput = document.createElement("input");
  altInput.type = "number";
  altInput.min = "0";
  altInput.max = "90";
  altInput.step = "1";
  altInput.value = String(initialAlt);
  altInput.dataset.testid = "view-alt";
  altInput.style.cssText =
    "width:60px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);" +
    "border-radius:4px;padding:4px;font:12px sans-serif";

  function onInputChange(): void {
    const az = Number(azInput.value);
    const alt = Number(altInput.value);
    if (Number.isFinite(az) && Number.isFinite(alt)) {
      onIntent({ type: "set-view", az, alt });
    }
  }

  azInput.addEventListener("change", onInputChange);
  altInput.addEventListener("change", onInputChange);

  inputRow.appendChild(azLabel);
  inputRow.appendChild(azInput);
  inputRow.appendChild(altLabel);
  inputRow.appendChild(altInput);
  section.appendChild(inputRow);

  return section;
}
