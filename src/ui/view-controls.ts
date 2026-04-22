/* SPDX-License-Identifier: Apache-2.0 */
import { el } from "./dom";
import type { UIIntent } from "./index";

type ViewPreset = { label: string; az: number; alt: number };

const PRESETS: ViewPreset[] = [
  { label: "Zenith", az: 0, alt: 89.9 },
  { label: "N", az: 0, alt: 30 },
  { label: "E", az: 90, alt: 30 },
  { label: "S", az: 180, alt: 30 },
  { label: "W", az: 270, alt: 30 },
];

const PRESET_BTN_STYLE: Partial<CSSStyleDeclaration> = {
  background: "rgba(255,255,255,0.1)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "4px",
  padding: "4px 8px",
  cursor: "pointer",
  font: "12px sans-serif",
};

const INPUT_STYLE: Partial<CSSStyleDeclaration> = {
  width: "60px",
  background: "rgba(255,255,255,0.1)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "4px",
  padding: "4px",
  font: "12px sans-serif",
};

const LABEL_STYLE: Partial<CSSStyleDeclaration> = {
  color: "rgba(255,255,255,0.6)",
  font: "12px sans-serif",
};

export function createViewControls(
  initialAz: number,
  initialAlt: number,
  onIntent: (intent: UIIntent) => void,
): HTMLElement {
  const azInput = el("input", {
    testid: "view-az",
    type: "number",
    style: INPUT_STYLE,
  });
  azInput.min = "0";
  azInput.max = "360";
  azInput.step = "1";
  azInput.value = String(initialAz);

  const altInput = el("input", {
    testid: "view-alt",
    type: "number",
    style: INPUT_STYLE,
  });
  altInput.min = "0";
  altInput.max = "90";
  altInput.step = "1";
  altInput.value = String(initialAlt);

  function onInputChange(): void {
    const az = Number(azInput.value);
    const alt = Number(altInput.value);
    if (Number.isFinite(az) && Number.isFinite(alt)) {
      onIntent({ type: "set-view", az, alt });
    }
  }
  azInput.addEventListener("change", onInputChange);
  altInput.addEventListener("change", onInputChange);

  const presetButtons = PRESETS.map((preset) => {
    const btn = el("button", {
      testid: `view-${preset.label.toLowerCase()}`,
      text: preset.label,
      style: PRESET_BTN_STYLE,
    });
    btn.addEventListener("click", () => {
      azInput.value = String(preset.az);
      altInput.value = String(preset.alt);
      onIntent({ type: "set-view", az: preset.az, alt: preset.alt });
    });
    return btn;
  });

  return el("div", {
    style: { padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.1)" },
    children: [
      el("div", {
        text: "View Direction",
        style: { color: "#fff", font: "bold 12px sans-serif", marginBottom: "6px" },
      }),
      el("div", {
        style: { display: "flex", gap: "4px", marginBottom: "8px", flexWrap: "wrap" },
        children: presetButtons,
      }),
      el("div", {
        style: { display: "flex", gap: "8px", alignItems: "center" },
        children: [
          el("label", { text: "Az", style: LABEL_STYLE }),
          azInput,
          el("label", { text: "Alt", style: LABEL_STYLE }),
          altInput,
        ],
      }),
    ],
  });
}
