/* SPDX-License-Identifier: Apache-2.0 */
import { el } from "./dom";
import { FONT_FAMILY, PANEL_BORDER, SURFACE, TEXT_COLOR } from "./styles";
import type { UIIntent } from "./index";

const IDLE_FADE_MS = 2000;
const IDLE_OPACITY = 0.2;
const ACTIVE_OPACITY = 1;

const MIN_PER_MS = 60_000;
const HOUR_PER_MS = 3_600_000;
const DAY_PER_MS = 86_400_000;

/** SGP4 accuracy degrades noticeably beyond ~1 week from the TLE epoch — an
 *  ISS TLE two weeks old can be tens of km off. Above this threshold, and
 *  only when we're serving the bundled fallback, we surface the staleness
 *  pill (#354). */
const TLE_STALE_THRESHOLD_SECONDS = 7 * 86_400;

/**
 * Pixel-to-millisecond ratio while drag-scrubbing. Tuned so a full-width drag on
 * a ~1000px viewport covers roughly a 30-minute window — enough to feel responsive
 * without making small drags overshoot dramatically.
 */
const SCRUB_MS_PER_PIXEL = 60_000;

const CHIP_STYLE: Partial<CSSStyleDeclaration> = {
  background: SURFACE,
  border: "1px solid rgba(255,255,255,0.25)",
  borderRadius: "999px",
  padding: "6px 12px",
  color: TEXT_COLOR,
  fontFamily: FONT_FAMILY,
  fontSize: "13px",
};

export type AnimationSpeed = 1 | 10 | 100;

export type BottomHud = {
  readonly element: HTMLElement;
  setTime(d: Date): void;
  setObserver(lat: number, lon: number): void;
  setCompass(azDeg: number): void;
  /** Reflect the current animation state — updates the play/pause icon and
   *  the speed-cycle button label. Called by app.ts whenever it flips
   *  animation.playing or animation.speed (#136). */
  setAnimation(playing: boolean, speed: AnimationSpeed): void;
  destroy(): void;
};

/** Cycle 1x → 10x → 100x → 1x. Exported for the bottom-hud unit tests. */
export function nextAnimationSpeed(current: AnimationSpeed): AnimationSpeed {
  if (current === 1) return 10;
  if (current === 10) return 100;
  return 1;
}

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
  return `${cardinal(a)} ${String(Math.round(a))}°`;
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
  initial: {
    timeUtc: Date;
    lat: number;
    lon: number;
    /** Whether the current TLE dataset came from the bundled fallback (i.e.
     *  the live Celestrak fetch failed). Combined with `tleSourceAgeSeconds`
     *  to decide whether to surface the offline-staleness pill (#354). */
    tleUsedFallback?: boolean;
    /** Age (seconds) of the newest TLE epoch in the current dataset. */
    tleSourceAgeSeconds?: number;
  },
  dispatch: (intent: UIIntent) => void,
): BottomHud {
  let currentTime = new Date(initial.timeUtc);

  const locationChip = el("button", {
    testid: "hud-location",
    type: "button",
    text: formatObserver(initial.lat, initial.lon),
    attrs: { title: "Change location" },
    style: { ...CHIP_STYLE, cursor: "pointer" },
  });
  locationChip.addEventListener("click", () => {
    dispatch({ type: "open-location-picker" });
  });

  const utcEl = el("span", {
    testid: "hud-utc",
    text: formatUtc(currentTime),
    style: { fontWeight: "600", fontVariantNumeric: "tabular-nums" },
  });

  const localEl = el("span", {
    testid: "hud-local",
    text: formatLocal(currentTime),
    style: { opacity: "0.75", fontVariantNumeric: "tabular-nums" },
  });

  const timeRow = el("div", {
    style: { display: "flex", gap: "12px", alignItems: "baseline" },
    children: [utcEl, localEl],
  });

  // --- Play/pause + speed cycle (#136) ---
  //
  // The two buttons sit above the time readout inside the scrub-center area
  // so they don't steal room from the compass / location chips at the edges.
  // Click handlers dispatch intents that app.ts translates into rAF-loop
  // start/stop and speed change; the icon/label is updated via setAnimation
  // once the intent has been applied to state.
  let currentSpeed: AnimationSpeed = 1;

  const playBtn = el("button", {
    testid: "hud-play",
    type: "button",
    text: "▶",
    attrs: { title: "Play / pause (Space)", "aria-label": "Play animation" },
    style: {
      background: SURFACE,
      border: "1px solid rgba(255,255,255,0.25)",
      borderRadius: "999px",
      padding: "4px 10px",
      color: TEXT_COLOR,
      fontFamily: FONT_FAMILY,
      fontSize: "13px",
      cursor: "pointer",
    },
    on: {
      click: (e) => {
        e.stopPropagation();
        dispatch({ type: "toggle-animation" });
      },
    },
  });

  const speedBtn = el("button", {
    testid: "hud-speed",
    type: "button",
    text: `${String(currentSpeed)}×`,
    attrs: { title: "Cycle animation speed 1× → 10× → 100×", "aria-label": "Animation speed" },
    style: {
      background: SURFACE,
      border: "1px solid rgba(255,255,255,0.25)",
      borderRadius: "999px",
      padding: "4px 10px",
      color: TEXT_COLOR,
      fontFamily: FONT_FAMILY,
      fontSize: "13px",
      cursor: "pointer",
      fontVariantNumeric: "tabular-nums",
    },
    on: {
      click: (e) => {
        e.stopPropagation();
        dispatch({ type: "set-animation-speed", speed: nextAnimationSpeed(currentSpeed) });
      },
    },
  });

  const animateRow = el("div", {
    style: { display: "flex", gap: "6px", alignItems: "center" },
    children: [playBtn, speedBtn],
  });

  const center = el("div", {
    testid: "hud-scrub",
    attrs: {
      title: "Drag to scrub time; ← / → to step by minute (Shift hour, Alt day); Space play/pause",
    },
    style: {
      flex: "1",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      cursor: "ew-resize",
    },
    children: [animateRow, timeRow],
  });

  const compassChip = el("div", {
    testid: "hud-compass",
    text: formatCompass(0),
    style: { ...CHIP_STYLE, fontVariantNumeric: "tabular-nums" },
  });

  // TLE staleness pill (#354) — subtle amber warning surfaced only when the
  // network fetch fell back to the bundled snapshot AND that snapshot is
  // older than 7 days (satellite positions degrade fast — an ISS TLE two
  // weeks old can be tens of km off). Clicking opens the Help modal so the
  // user has a place to read what "offline TLE" means.
  const usedFallback = initial.tleUsedFallback ?? false;
  const ageSeconds = initial.tleSourceAgeSeconds ?? 0;
  const shouldShowStalenessPill = usedFallback && ageSeconds > TLE_STALE_THRESHOLD_SECONDS;
  const stalenessDays = Math.floor(ageSeconds / 86_400);
  const stalenessPill = el("button", {
    testid: "hud-tle-staleness",
    type: "button",
    text: shouldShowStalenessPill
      ? `Offline TLE — positions may be off (${String(stalenessDays)}d old)`
      : "",
    attrs: {
      title: "The live TLE fetch failed and the bundled snapshot is old — click for help",
      "aria-label": "TLE data is stale — click for help",
    },
    style: {
      background: "rgba(120, 80, 0, 0.35)",
      border: "1px solid rgba(255, 180, 60, 0.55)",
      borderRadius: "999px",
      padding: "4px 10px",
      color: "#ffcc80",
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      cursor: "pointer",
      display: shouldShowStalenessPill ? "" : "none",
    },
    on: {
      click: (e) => {
        e.stopPropagation();
        dispatch({ type: "open-help" });
      },
    },
  });

  const rightGroup = el("div", {
    style: { display: "flex", gap: "8px", alignItems: "center" },
    children: [stalenessPill, compassChip],
  });

  const root = el("div", {
    testid: "bottom-hud",
    style: {
      position: "fixed",
      left: "0",
      right: "0",
      bottom: "0",
      height: "56px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      padding: "0 16px",
      boxSizing: "border-box",
      background: "rgba(0, 0, 0, 0.55)",
      borderTop: PANEL_BORDER,
      color: TEXT_COLOR,
      fontFamily: FONT_FAMILY,
      fontSize: "13px",
      zIndex: "1000",
      opacity: String(ACTIVE_OPACITY),
      transition: "opacity 200ms ease",
      userSelect: "none",
      touchAction: "none",
    },
    children: [locationChip, center, rightGroup],
  });

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
      locationChip.textContent = formatObserver(lat, lon);
    },
    setCompass(azDeg: number): void {
      compassChip.textContent = formatCompass(azDeg);
    },
    setAnimation(playing: boolean, speed: AnimationSpeed): void {
      currentSpeed = speed;
      playBtn.textContent = playing ? "⏸" : "▶";
      playBtn.setAttribute("aria-label", playing ? "Pause animation" : "Play animation");
      speedBtn.textContent = `${String(speed)}×`;
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
