/* SPDX-License-Identifier: Apache-2.0 */
import { applyButton, applyBaseText, GAP } from "./styles";
import type { UIIntent } from "./index";

const STEPS: Array<{ label: string; deltaMs: number }> = [
  { label: "-1d", deltaMs: -86_400_000 },
  { label: "-1h", deltaMs: -3_600_000 },
  { label: "-1m", deltaMs: -60_000 },
  { label: "+1m", deltaMs: 60_000 },
  { label: "+1h", deltaMs: 3_600_000 },
  { label: "+1d", deltaMs: 86_400_000 },
];

/** Format a Date to a value suitable for <input type="datetime-local"> (local time, no Z). */
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export type TimeControls = {
  readonly element: HTMLElement;
  setTime(d: Date): void;
};

export function createTimeControls(
  initial: Date,
  dispatch: (intent: UIIntent) => void,
): TimeControls {
  let current = new Date(initial);

  const section = document.createElement("div");
  section.style.marginBottom = GAP;

  const heading = document.createElement("div");
  heading.textContent = "Time";
  heading.style.fontWeight = "bold";
  heading.style.marginBottom = GAP;
  applyBaseText(heading);
  section.appendChild(heading);

  const input = document.createElement("input");
  input.type = "datetime-local";
  input.value = toDatetimeLocal(current);
  input.style.width = "100%";
  input.style.background = "rgba(255,255,255,0.1)";
  input.style.border = "1px solid rgba(255,255,255,0.3)";
  input.style.borderRadius = "4px";
  input.style.color = "#fff";
  input.style.fontSize = "12px";
  input.style.padding = "4px";
  input.style.boxSizing = "border-box";
  input.style.marginBottom = GAP;
  section.appendChild(input);

  input.addEventListener("change", () => {
    const d = new Date(input.value);
    if (!Number.isNaN(d.getTime())) {
      current = d;
      dispatch({ type: "set-time", time: d });
    }
  });

  // Step buttons row
  const buttonsRow = document.createElement("div");
  buttonsRow.style.display = "flex";
  buttonsRow.style.gap = "4px";
  buttonsRow.style.flexWrap = "wrap";
  buttonsRow.style.marginBottom = GAP;

  for (const step of STEPS) {
    const btn = document.createElement("button");
    btn.textContent = step.label;
    applyButton(btn);
    btn.addEventListener("click", () => {
      current = new Date(current.getTime() + step.deltaMs);
      input.value = toDatetimeLocal(current);
      dispatch({ type: "set-time", time: new Date(current) });
    });
    buttonsRow.appendChild(btn);
  }
  section.appendChild(buttonsRow);

  // Now button row: "Now" + "📍 Now" (with geolocation)
  const nowRow = document.createElement("div");
  nowRow.style.display = "flex";
  nowRow.style.gap = "4px";

  const nowBtn = document.createElement("button");
  nowBtn.textContent = "Now";
  applyButton(nowBtn);
  nowBtn.style.flex = "1";
  nowBtn.addEventListener("click", () => {
    const now = new Date();
    current = now;
    input.value = toDatetimeLocal(now);
    dispatch({ type: "set-time", time: new Date(now) });
  });
  nowRow.appendChild(nowBtn);

  const liveBtn = document.createElement("button");
  liveBtn.textContent = "📍 Now";
  liveBtn.title = "Snap to current time and GPS location";
  applyButton(liveBtn);
  liveBtn.style.flex = "1";
  liveBtn.addEventListener("click", () => {
    liveBtn.textContent = "Locating…";
    liveBtn.disabled = true;
    dispatch({ type: "now" });
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {
          liveBtn.textContent = "📍 Now";
          liveBtn.disabled = false;
        },
        () => {
          liveBtn.textContent = "📍 Now";
          liveBtn.disabled = false;
        },
      );
    } else {
      liveBtn.textContent = "📍 Now";
      liveBtn.disabled = false;
    }
  });
  nowRow.appendChild(liveBtn);

  section.appendChild(nowRow);

  return {
    element: section,
    setTime(d: Date): void {
      current = new Date(d);
      input.value = toDatetimeLocal(current);
    },
  };
}
