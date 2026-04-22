/* SPDX-License-Identifier: Apache-2.0 */
import { el } from "./dom";
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
  const pad = (n: number): string => String(n).padStart(2, "0");
  return (
    `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
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

  const input = el("input", {
    type: "datetime-local",
    style: {
      width: "100%",
      background: "rgba(255,255,255,0.1)",
      border: "1px solid rgba(255,255,255,0.3)",
      borderRadius: "4px",
      color: "#fff",
      fontSize: "12px",
      padding: "4px",
      boxSizing: "border-box",
      marginBottom: GAP,
    },
  });
  input.value = toDatetimeLocal(current);
  input.addEventListener("change", () => {
    const d = new Date(input.value);
    if (!Number.isNaN(d.getTime())) {
      current = d;
      dispatch({ type: "set-time", time: d });
    }
  });

  const stepButtons = STEPS.map((step) => {
    const btn = el("button", { text: step.label });
    applyButton(btn);
    btn.addEventListener("click", () => {
      current = new Date(current.getTime() + step.deltaMs);
      input.value = toDatetimeLocal(current);
      dispatch({ type: "set-time", time: new Date(current) });
    });
    return btn;
  });

  const buttonsRow = el("div", {
    style: { display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: GAP },
    children: stepButtons,
  });

  const nowBtn = el("button", { text: "Now" });
  applyButton(nowBtn);
  nowBtn.style.flex = "1";
  nowBtn.addEventListener("click", () => {
    const now = new Date();
    current = now;
    input.value = toDatetimeLocal(now);
    dispatch({ type: "set-time", time: new Date(now) });
  });

  const liveBtn = el("button", {
    text: "📍 Now",
    attrs: { title: "Snap to current time and GPS location" },
  });
  applyButton(liveBtn);
  liveBtn.style.flex = "1";
  liveBtn.addEventListener("click", () => {
    liveBtn.textContent = "Locating…";
    liveBtn.disabled = true;
    dispatch({ type: "now" });
    const restore = (): void => {
      liveBtn.textContent = "📍 Now";
      liveBtn.disabled = false;
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(restore, restore);
    } else {
      restore();
    }
  });

  const nowRow = el("div", {
    style: { display: "flex", gap: "4px" },
    children: [nowBtn, liveBtn],
  });

  const heading = el("div", {
    text: "Time",
    style: { fontWeight: "bold", marginBottom: GAP },
  });
  applyBaseText(heading);

  const section = el("div", {
    style: { marginBottom: GAP },
    children: [heading, input, buttonsRow, nowRow],
  });

  return {
    element: section,
    setTime(d: Date): void {
      current = new Date(d);
      input.value = toDatetimeLocal(current);
    },
  };
}
