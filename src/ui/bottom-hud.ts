/* SPDX-License-Identifier: Apache-2.0 */
import { FONT_FAMILY, PANEL_BORDER, SURFACE, TEXT_COLOR } from "./styles";
import type { UIIntent } from "./index";

const IDLE_FADE_MS = 2000;
const IDLE_OPACITY = 0.2;
const ACTIVE_OPACITY = 1;

const MIN_PER_MS = 60_000;
const HOUR_PER_MS = 3_600_000;
const DAY_PER_MS = 86_400_000;

/**
 * Pixel-to-millisecond ratio while drag-scrubbing. Tuned so a full-width drag on
 * a ~1000px viewport covers roughly a 30-minute window — enough to feel responsive
 * without making small drags overshoot dramatically.
 */
const SCRUB_MS_PER_PIXEL = 60_000;

export type BottomHud = {
  readonly element: HTMLElement;
  setTime(d: Date): void;
  setObserver(lat: number, lon: number): void;
  setCompass(azDeg: number): void;
  destroy(): void;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatUtc(d: Date): string {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

function formatLocal(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} local`;
}

function formatObserver(lat: number, lon: number): string {
  const latStr = lat.toFixed(2).replace(/\.?0+$/, "");
  const lonStr = lon.toFixed(2).replace(/\.?0+$/, "");
  return `\u{1F4CD} ${latStr}, ${lonStr}`;
}

function cardinal(azDeg: number): string {
  const a = ((azDeg % 360) + 360) % 360;
  if (a < 22.5 || a >= 337.5) return "N";
  if (a < 67.5) return "NE";
  if (a < 112.5) return "E";
  if (a < 157.5) return "SE";
  if (a < 202.5) return "S";
  if (a < 247.5) return "SW";
  if (a < 292.5) return "W";
  return "NW";
}

function formatCompass(azDeg: number): string {
  const a = ((azDeg % 360) + 360) % 360;
  return `${cardinal(a)} ${Math.round(a)}\u00B0`;
}

function deltaForEvent(e: KeyboardEvent): number | null {
  const sign = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
  if (sign === 0) return null;
  if (e.altKey) return sign * DAY_PER_MS;
  if (e.shiftKey) return sign * HOUR_PER_MS;
  return sign * MIN_PER_MS;
}

/**
 * Input elements (text fields, datetime-local, textareas, contenteditable) should
 * keep native arrow-key behaviour. We also ignore events that have been
 * defaultPrevented upstream.
 */
function eventTargetsEditable(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (t === null) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (t.isContentEditable) return true;
  return false;
}

export function createBottomHud(
  initial: { timeUtc: Date; lat: number; lon: number },
  dispatch: (intent: UIIntent) => void,
): BottomHud {
  let currentTime = new Date(initial.timeUtc);
  let currentLat = initial.lat;
  let currentLon = initial.lon;

  const root = document.createElement("div");
  root.dataset.testid = "bottom-hud";
  root.style.position = "fixed";
  root.style.left = "0";
  root.style.right = "0";
  root.style.bottom = "0";
  root.style.height = "56px";
  root.style.display = "flex";
  root.style.alignItems = "center";
  root.style.justifyContent = "space-between";
  root.style.gap = "12px";
  root.style.padding = "0 16px";
  root.style.boxSizing = "border-box";
  root.style.background = "rgba(0, 0, 0, 0.55)";
  root.style.borderTop = PANEL_BORDER;
  root.style.color = TEXT_COLOR;
  root.style.fontFamily = FONT_FAMILY;
  root.style.fontSize = "13px";
  root.style.zIndex = "1000";
  root.style.opacity = String(ACTIVE_OPACITY);
  root.style.transition = "opacity 200ms ease";
  root.style.userSelect = "none";
  root.style.touchAction = "none";

  // Left chip — location
  const locationChip = document.createElement("button");
  locationChip.dataset.testid = "hud-location";
  locationChip.type = "button";
  locationChip.style.background = SURFACE;
  locationChip.style.border = "1px solid rgba(255,255,255,0.25)";
  locationChip.style.borderRadius = "999px";
  locationChip.style.padding = "6px 12px";
  locationChip.style.color = TEXT_COLOR;
  locationChip.style.fontFamily = FONT_FAMILY;
  locationChip.style.fontSize = "13px";
  locationChip.style.cursor = "pointer";
  locationChip.title = "Change location";
  locationChip.textContent = formatObserver(currentLat, currentLon);
  locationChip.addEventListener("click", () => {
    dispatch({ type: "open-location-picker" });
  });

  // Center — time readouts + invisible scrub region
  const center = document.createElement("div");
  center.dataset.testid = "hud-scrub";
  center.style.flex = "1";
  center.style.display = "flex";
  center.style.flexDirection = "column";
  center.style.alignItems = "center";
  center.style.justifyContent = "center";
  center.style.cursor = "ew-resize";
  center.title =
    "Drag to scrub time; ← / → to step by minute (Shift hour, Alt day); Space play/pause";

  const timeRow = document.createElement("div");
  timeRow.style.display = "flex";
  timeRow.style.gap = "12px";
  timeRow.style.alignItems = "baseline";

  const utcEl = document.createElement("span");
  utcEl.dataset.testid = "hud-utc";
  utcEl.style.fontWeight = "600";
  utcEl.style.fontVariantNumeric = "tabular-nums";
  utcEl.textContent = formatUtc(currentTime);

  const localEl = document.createElement("span");
  localEl.dataset.testid = "hud-local";
  localEl.style.opacity = "0.75";
  localEl.style.fontVariantNumeric = "tabular-nums";
  localEl.textContent = formatLocal(currentTime);

  timeRow.appendChild(utcEl);
  timeRow.appendChild(localEl);
  center.appendChild(timeRow);

  // Right chip — compass
  const compassChip = document.createElement("div");
  compassChip.dataset.testid = "hud-compass";
  compassChip.style.background = SURFACE;
  compassChip.style.border = "1px solid rgba(255,255,255,0.25)";
  compassChip.style.borderRadius = "999px";
  compassChip.style.padding = "6px 12px";
  compassChip.style.fontVariantNumeric = "tabular-nums";
  compassChip.textContent = formatCompass(0);

  root.appendChild(locationChip);
  root.appendChild(center);
  root.appendChild(compassChip);

  // --- Idle fade ---
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  function clearIdleTimer(): void {
    if (idleTimer !== null) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  function scheduleIdleFade(): void {
    clearIdleTimer();
    idleTimer = setTimeout(() => {
      root.style.opacity = String(IDLE_OPACITY);
      idleTimer = null;
    }, IDLE_FADE_MS);
  }

  function wake(): void {
    root.style.opacity = String(ACTIVE_OPACITY);
    scheduleIdleFade();
  }

  scheduleIdleFade();

  // --- Keyboard scrubbing ---
  function onKeyDown(e: KeyboardEvent): void {
    if (eventTargetsEditable(e)) return;
    wake();

    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      dispatch({ type: "toggle-animation" });
      return;
    }

    const delta = deltaForEvent(e);
    if (delta === null) return;
    e.preventDefault();
    const next = new Date(currentTime.getTime() + delta);
    dispatch({ type: "set-time", time: next });
  }

  // --- Pointer-based wake (for idle-fade) ---
  function onPointerMoveGlobal(): void {
    wake();
  }

  // --- Drag-scrub on the center bar ---
  let scrubPointerId: number | null = null;
  let scrubStartX = 0;
  let scrubStartMs = 0;

  function onScrubPointerDown(e: PointerEvent): void {
    scrubPointerId = e.pointerId;
    scrubStartX = e.clientX;
    scrubStartMs = currentTime.getTime();
    if (typeof center.setPointerCapture === "function") {
      try {
        center.setPointerCapture(e.pointerId);
      } catch {
        // pointer capture may fail in jsdom — non-fatal
      }
    }
    wake();
  }

  function onScrubPointerMove(e: PointerEvent): void {
    if (scrubPointerId === null || e.pointerId !== scrubPointerId) return;
    const dx = e.clientX - scrubStartX;
    const nextMs = scrubStartMs + dx * SCRUB_MS_PER_PIXEL;
    dispatch({ type: "set-time", time: new Date(nextMs) });
    wake();
  }

  function onScrubPointerUp(e: PointerEvent): void {
    if (scrubPointerId === null || e.pointerId !== scrubPointerId) return;
    scrubPointerId = null;
    if (typeof center.releasePointerCapture === "function") {
      try {
        center.releasePointerCapture(e.pointerId);
      } catch {
        // non-fatal
      }
    }
  }

  center.addEventListener("pointerdown", onScrubPointerDown);
  window.addEventListener("pointermove", onScrubPointerMove);
  window.addEventListener("pointerup", onScrubPointerUp);
  window.addEventListener("pointermove", onPointerMoveGlobal);
  window.addEventListener("keydown", onKeyDown);

  return {
    element: root,
    setTime(d: Date): void {
      currentTime = new Date(d);
      utcEl.textContent = formatUtc(currentTime);
      localEl.textContent = formatLocal(currentTime);
    },
    setObserver(lat: number, lon: number): void {
      currentLat = lat;
      currentLon = lon;
      locationChip.textContent = formatObserver(lat, lon);
    },
    setCompass(azDeg: number): void {
      compassChip.textContent = formatCompass(azDeg);
    },
    destroy(): void {
      clearIdleTimer();
      center.removeEventListener("pointerdown", onScrubPointerDown);
      window.removeEventListener("pointermove", onScrubPointerMove);
      window.removeEventListener("pointerup", onScrubPointerUp);
      window.removeEventListener("pointermove", onPointerMoveGlobal);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
