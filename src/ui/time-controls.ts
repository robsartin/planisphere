/* SPDX-License-Identifier: Apache-2.0 */
import { applyButton, applyBaseText, ACCENT_COLOR, GAP } from "./styles";
import type { UIIntent } from "./index";

const STEPS: Array<{ label: string; deltaMs: number }> = [
  { label: "-1d", deltaMs: -86_400_000 },
  { label: "-1h", deltaMs: -3_600_000 },
  { label: "-1m", deltaMs: -60_000 },
  { label: "+1m", deltaMs: 60_000 },
  { label: "+1h", deltaMs: 3_600_000 },
  { label: "+1d", deltaMs: 86_400_000 },
];

const SPEED_OPTIONS: Array<{ label: string; value: number }> = [
  { label: "1x", value: 1 },
  { label: "10x", value: 10 },
  { label: "100x", value: 100 },
  { label: "1000x", value: 1000 },
];

/** Format a Date to a value suitable for <input type="datetime-local"> (local time, no Z). */
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export function createTimeControls(
  initial: Date,
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  let current = new Date(initial);
  let playing = false;
  let speedFactor = 1;
  let rafId: number | null = null;
  let lastFrameTime: number | null = null;

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

  // Now button
  const nowBtn = document.createElement("button");
  nowBtn.textContent = "Now";
  applyButton(nowBtn);
  nowBtn.style.width = "100%";
  nowBtn.addEventListener("click", () => {
    const now = new Date();
    current = now;
    input.value = toDatetimeLocal(now);
    dispatch({ type: "set-time", time: new Date(now) });
  });
  section.appendChild(nowBtn);

  // Play/pause + speed controls row
  const animRow = document.createElement("div");
  animRow.style.display = "flex";
  animRow.style.gap = "4px";
  animRow.style.alignItems = "center";
  animRow.style.marginTop = GAP;

  const playBtn = document.createElement("button");
  playBtn.textContent = "▶";
  applyButton(playBtn);
  playBtn.style.flexShrink = "0";

  const speedSelect = document.createElement("select");
  speedSelect.dataset.speed = "";
  speedSelect.style.background = "rgba(255,255,255,0.1)";
  speedSelect.style.border = "1px solid rgba(255,255,255,0.3)";
  speedSelect.style.borderRadius = "4px";
  speedSelect.style.color = "#fff";
  speedSelect.style.fontSize = "12px";
  speedSelect.style.padding = "2px 4px";
  speedSelect.style.cursor = "pointer";

  for (const opt of SPEED_OPTIONS) {
    const option = document.createElement("option");
    option.value = String(opt.value);
    option.textContent = opt.label;
    speedSelect.appendChild(option);
  }

  speedSelect.addEventListener("change", () => {
    speedFactor = Number(speedSelect.value);
  });

  function tick(timestamp: number): void {
    if (!playing) return;
    if (lastFrameTime === null) {
      // First frame: record time and schedule next without advancing
      lastFrameTime = timestamp;
      rafId = requestAnimationFrame(tick);
      return;
    }
    const elapsedReal = timestamp - lastFrameTime;
    lastFrameTime = timestamp;
    const elapsedSim = elapsedReal * speedFactor;
    current = new Date(current.getTime() + elapsedSim);
    input.value = toDatetimeLocal(current);
    dispatch({ type: "set-time", time: new Date(current) });
    rafId = requestAnimationFrame(tick);
  }

  function startPlaying(): void {
    playing = true;
    lastFrameTime = null;
    playBtn.textContent = "⏸";
    playBtn.style.color = ACCENT_COLOR;
    rafId = requestAnimationFrame(tick);
  }

  function stopPlaying(): void {
    playing = false;
    playBtn.textContent = "▶";
    playBtn.style.color = "";
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  playBtn.addEventListener("click", () => {
    if (playing) {
      stopPlaying();
    } else {
      startPlaying();
    }
  });

  animRow.appendChild(playBtn);
  animRow.appendChild(speedSelect);
  section.appendChild(animRow);

  return section;
}
