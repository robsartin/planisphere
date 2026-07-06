/* SPDX-License-Identifier: Apache-2.0 */
import { parseStateFromSearchParams, serializeStateToSearchParams } from "./state";
import type { AppState, LayerVisibility } from "./state/state";
import {
  parseCatalog,
  filterVisibleStars,
  computeBodyPositions,
  parseConstellations,
  filterVisibleConstellations,
  parseBoundaries,
  filterVisibleBoundaries,
  computeRaDecGrid,
  computeEclipticLine,
  parseMessier,
  filterVisibleMessier,
  computeMilkyWayPoints,
  computeBodyTrail,
  parseConstellationNames,
  parseAsterismSet,
  filterVisibleAsterisms,
} from "./astro";
import type {
  StarRecord,
  Language,
  ConstellationNameMap,
  SkycultureId,
  AsterismSet,
} from "./astro";
import { AstroWorkerClient } from "./workers/astro-worker-client";
import { buildRaDecArray, buildAltAzStars } from "./workers/star-builder";
import {
  createViewer,
  initCamera,
  setupTrackballControls,
  setupGestures,
  createStarLayer,
  createBodyLayer,
  createTooltip,
  createConstellationLayer,
  createConstellationArtLayer,
  createCompassLayer,
  createSatelliteLayer,
  createBoundaryLayer,
  createGridLayer,
  createEclipticLayer,
  createMessierLayer,
  createMilkyWayLayer,
  createTrailLayer,
  createReticleLayer,
  setCameraView,
  getCameraHeadingDeg,
  projectAltAzToScreen,
  screenToAltAz,
} from "./scene";
import type { AzAltPosition, PickedObject } from "./scene";
import type {
  StarLayer,
  BodyLayer,
  ConstellationLayer,
  ConstellationArtLayer,
  BoundaryLayer,
  SatelliteLayer,
  CompassLayer,
  GridLayer,
  EclipticLayer,
  MessierLayer,
  MilkyWayLayer,
  TrailLayer,
  ReticleLayer,
} from "./scene";
import { fetchTle, parseTle, propagateSatellites } from "./sat";
import type { SatelliteRecord, TleParseError } from "./sat";
import type { Result } from "./result";
import {
  createPanel,
  createLocationControls,
  createViewControls,
  createSearch,
  createFovControls,
  createEventsDrawer,
  createHelpModal,
  createBottomHud,
  createCommandPalette,
  createSettingsDrawer,
  createTonightDrawer,
  createObjectCardsManager,
  createLocationPickerOverlay,
  createEmptySkyPopover,
  createOnboardingOverlay,
  createNotebookWorkspace,
  createLoginModal,
  createPlansDrawer,
  createPlansModal,
  ONBOARDING_STORAGE_KEY,
} from "./ui";
import type { PlansDrawerView } from "./ui";
import { getPlan, listPlans } from "./plans";
import { currentUser, requestMagicLink } from "./auth";
import { isPro, setUser } from "./features";
import type { OnboardingStep } from "./ui";
import type {
  BottomHud,
  EventsDrawer,
  EmptySkyPopover,
  ObjectCardsManager,
  ObjectCardData,
  ObjectPosition,
  CardKey,
  TonightDrawer,
} from "./ui";
import type {
  CommandPalette,
  PaletteSources,
  PaletteObjectSource,
  PaletteEventSource,
  PaletteSettingSource,
  PalettePlaceSource,
  PaletteObjectType,
} from "./ui";
import { computeUpcomingEvents } from "./astro/events";
import type { CelestialEvent } from "./astro/events";
import type { UIIntent } from "./ui";
import { buildSearchIndex, searchObjects } from "./astro/search";
import type { SearchIndex, SearchResultType } from "./astro/search";
import rawStars from "../data/stars.json";
import rawConstellations from "../data/constellations.json";
import rawBoundaries from "../data/boundaries.json";
import rawMessier from "../data/messier.json";
import rawCities from "../data/cities.json";
import rawNamesEn from "../data/constellation-names/en.json";
import rawNamesZh from "../data/constellation-names/zh.json";
import rawNamesAr from "../data/constellation-names/ar.json";
import rawNamesEl from "../data/constellation-names/el.json";
import rawAsterismsWestern from "../data/asterisms/western.json";
import rawAsterismsChinese from "../data/asterisms/chinese.json";
import rawAsterismsIndian from "../data/asterisms/indian.json";
import rawAsterismsNorseEdda from "../data/asterisms/norse_edda.json";
import rawAsterismsHawaiian from "../data/asterisms/hawaiian_starlines.json";
import rawAsterismsMaori from "../data/asterisms/maori.json";

const CONSTELLATION_NAMES_RAW: Partial<Record<Language, unknown>> = {
  en: rawNamesEn,
  zh: rawNamesZh,
  ar: rawNamesAr,
  el: rawNamesEl,
};

function loadNameOverridesForLanguage(lang: Language): ConstellationNameMap | null {
  if (lang === "la") return null;
  const raw = CONSTELLATION_NAMES_RAW[lang];
  if (raw === undefined) return null;
  const parsed = parseConstellationNames(raw);
  if (!parsed.ok) {
    console.warn(`Constellation names for '${lang}' invalid: ${parsed.error.kind}`);
    return null;
  }
  return parsed.value;
}

const ASTERISM_SETS_RAW: Record<SkycultureId, unknown> = {
  western: rawAsterismsWestern,
  chinese: rawAsterismsChinese,
  indian: rawAsterismsIndian,
  norse_edda: rawAsterismsNorseEdda,
  hawaiian_starlines: rawAsterismsHawaiian,
  maori: rawAsterismsMaori,
};

function loadAsterismSet(id: SkycultureId): AsterismSet | null {
  const parsed = parseAsterismSet(ASTERISM_SETS_RAW[id]);
  if (!parsed.ok) {
    console.warn(`Asterism set '${id}' invalid: ${parsed.error.kind}`);
    return null;
  }
  return parsed.value;
}

type CityRecord = {
  readonly name: string;
  readonly country: string;
  readonly lat: number;
  readonly lon: number;
};

const RECENTS_STORAGE_KEY = "planisphere.palette.recents.v1";
const RECENTS_MAX = 10;

function mapSearchTypeToPaletteType(t: SearchResultType): PaletteObjectType {
  // The existing search index only knows star/constellation/body/satellite.
  // Messier isn't in the index yet, but we keep the union forward-compatible.
  switch (t) {
    case "star":
      return "star";
    case "constellation":
      return "constellation";
    case "body":
      return "body";
    case "satellite":
      return "satellite";
  }
}

function buildPaletteObjects(index: SearchIndex): PaletteObjectSource[] {
  const out: PaletteObjectSource[] = [];
  for (const entry of index.entries) {
    out.push({ id: entry.name, label: entry.name, type: mapSearchTypeToPaletteType(entry.type) });
  }
  return out;
}

function buildPaletteEvents(events: readonly CelestialEvent[]): PaletteEventSource[] {
  return events.map((e) => ({
    id: `${e.kind}-${String(e.when.getTime())}`,
    label: e.title,
    description: e.description,
    when: e.when,
    ...(e.kind === "iss-pass"
      ? { viewAz: e.peakAzDeg, viewAlt: e.peakAltDeg }
      : e.viewAz !== undefined && e.viewAlt !== undefined
        ? { viewAz: e.viewAz, viewAlt: e.viewAlt }
        : {}),
  }));
}

const CITIES_RAW = rawCities as readonly CityRecord[];

function buildPalettePlaces(): PalettePlaceSource[] {
  return CITIES_RAW.map((c) => ({
    id: `${c.name}-${c.country}`,
    label: c.name,
    country: c.country,
    lat: c.lat,
    lon: c.lon,
  }));
}

function buildPaletteSettings(): PaletteSettingSource[] {
  return [
    {
      id: "toggle-night-vision",
      label: "Toggle night vision",
      hint: "Flip the red overlay on/off",
      intent: { type: "toggle-night-vision" },
    },
    {
      id: "copy-link",
      label: "Copy link",
      hint: "Copy this sky to clipboard",
      intent: { type: "copy-link" },
    },
    {
      id: "fov-naked",
      label: "Naked-eye FOV",
      hint: "Reticle preset: none",
      intent: { type: "set-fov", preset: "off" },
    },
    {
      id: "fov-binoculars",
      label: "2\u00d7 binoculars FOV",
      hint: "Reticle preset: binoculars",
      intent: { type: "set-fov", preset: "binoculars" },
    },
    {
      id: "fov-small-scope",
      label: "Small telescope FOV",
      hint: "Reticle preset: small scope",
      intent: { type: "set-fov", preset: "small-scope" },
    },
    {
      id: "lang-en",
      label: "Language: English",
      intent: { type: "set-language", language: "en" },
    },
    {
      id: "lang-la",
      label: "Language: Latin (IAU default)",
      intent: { type: "set-language", language: "la" },
    },
    {
      id: "now",
      label: "Now (time + location)",
      hint: "Jump to current time and geolocated observer",
      intent: { type: "now" },
    },
  ];
}

function buildPaletteSources(
  index: SearchIndex,
  events: readonly CelestialEvent[],
): Omit<PaletteSources, "recents"> {
  return {
    objects: buildPaletteObjects(index),
    events: buildPaletteEvents(events),
    places: buildPalettePlaces(),
    settings: buildPaletteSettings(),
  };
}

function loadRecents(): PaletteSettingSource[] {
  try {
    const raw = globalThis.localStorage?.getItem(RECENTS_STORAGE_KEY);
    if (raw === null || raw === undefined) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: PaletteSettingSource[] = [];
    for (const entry of parsed) {
      if (typeof entry !== "object" || entry === null) continue;
      const e = entry as Record<string, unknown>;
      if (typeof e.id !== "string" || typeof e.label !== "string") continue;
      const rec: PaletteSettingSource = { id: e.id, label: e.label };
      out.push(rec);
    }
    return out.slice(0, RECENTS_MAX);
  } catch {
    return [];
  }
}

function persistRecents(recents: readonly PaletteSettingSource[]): void {
  try {
    const payload = recents.slice(0, RECENTS_MAX).map((r) => ({ id: r.id, label: r.label }));
    globalThis.localStorage?.setItem(RECENTS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage quota / disabled — ignore.
  }
}

function setupCommandPalette(
  getPaletteSources: () => Omit<PaletteSources, "recents">,
  handleIntent: (intent: UIIntent) => void,
): CommandPalette {
  let recents: PaletteSettingSource[] = loadRecents();

  const palette = createCommandPalette({
    getSources: () => ({ ...getPaletteSources(), recents }),
    dispatch: handleIntent,
    onRecentSelected: (entry) => {
      recents = [entry, ...recents.filter((r) => r.id !== entry.id)].slice(0, RECENTS_MAX);
      persistRecents(recents);
    },
  });

  document.addEventListener("keydown", (e) => {
    const isMod = e.metaKey || e.ctrlKey;
    if (!isMod) return;
    if (e.key !== "k" && e.key !== "K") return;
    e.preventDefault();
    if (palette.isOpen()) {
      palette.close();
    } else {
      palette.open();
    }
  });

  return palette;
}

type Layers = {
  star: StarLayer;
  body: BodyLayer;
  constellation: ConstellationLayer;
  constellationArt: ConstellationArtLayer;
  boundary: BoundaryLayer;
  satellite: SatelliteLayer | null;
  compass: CompassLayer;
  grid: GridLayer;
  ecliptic: EclipticLayer;
  messier: MessierLayer;
  milkyWay: MilkyWayLayer;
  trail: TrailLayer;
  reticle: ReticleLayer | null;
};

const TRAIL_DURATION_HOURS = 4;
const TRAIL_STEP_MINUTES = 5;

function applyLayerVisibility(layers: Layers, visibility: LayerVisibility): void {
  layers.star.setVisible(visibility.stars);
  layers.body.setVisible(visibility.planets);
  layers.compass.setVisible(visibility.compass);
  layers.messier.setVisible(visibility.deepSky);
  if (layers.satellite) layers.satellite.setVisible(visibility.satellites);
}

/**
 * #350 — apply the constellation-art overlay's URL-synced show flag and
 * opacity together. Kept as a helper so both rerender paths (sync + worker-
 * accelerated) and the toggle-intent handlers stay in sync.
 */
function applyConstellationArtState(layers: Layers, state: AppState): void {
  layers.constellationArt.setVisible(state.constellationArt);
  layers.constellationArt.setOpacity(state.constellationArtOpacity);
}

type ParsedData = {
  stars: ReturnType<typeof parseCatalog>;
  constellations: ReturnType<typeof parseConstellations>;
  boundaries: ReturnType<typeof parseBoundaries>;
  messierObjects: ReturnType<typeof parseMessier>;
  satelliteRecords: Result<SatelliteRecord[], TleParseError> | null;
  activeAsterisms: AsterismSet | null;
};

/** Live alt/az positions for every object currently visible in the sky — populated
 *  on each rerender and consulted by the object-cards manager so open cards follow
 *  their target objects as time advances. Keys are `objectKind + '|' + id`. */
type LatestPositions = Map<string, ObjectPosition>;

function positionKey(kind: string, id: string): string {
  return `${kind}|${id}`;
}

function fillLatestFromVisible(
  latest: LatestPositions,
  visibleStars: ReturnType<typeof filterVisibleStars>,
  bodies: ReturnType<typeof computeBodyPositions>,
  visibleMessier: ReturnType<typeof filterVisibleMessier>,
  visibleSats: ReturnType<typeof propagateSatellites> | null,
  visibleConstellations: readonly { id: string; centroid: { alt: number; az: number } }[],
): void {
  latest.clear();
  for (const s of visibleStars) {
    const id = s.name ?? `HIP ${String(s.hip)}`;
    latest.set(positionKey("star", id), { alt: s.alt, az: s.az, belowHorizon: s.alt <= 0 });
  }
  for (const b of bodies) {
    latest.set(positionKey("body", b.id), { alt: b.alt, az: b.az, belowHorizon: b.alt <= 0 });
  }
  for (const m of visibleMessier) {
    latest.set(positionKey("messier", `M${String(m.m)}`), {
      alt: m.alt,
      az: m.az,
      belowHorizon: m.alt <= 0,
    });
  }
  if (visibleSats) {
    for (const sat of visibleSats) {
      latest.set(positionKey("satellite", sat.name), {
        alt: sat.alt,
        az: sat.az,
        belowHorizon: sat.alt <= 0,
      });
    }
  }
  for (const c of visibleConstellations) {
    latest.set(positionKey("constellation", c.id), {
      alt: c.centroid.alt,
      az: c.centroid.az,
      belowHorizon: c.centroid.alt <= 0,
    });
  }
}

let rerenderTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Try to create an AstroWorkerClient. Returns null if workers are unavailable
 * (e.g. test environment, old browsers, or bundler restrictions).
 */
function tryCreateWorker(): AstroWorkerClient | null {
  try {
    return new AstroWorkerClient();
  } catch {
    return null;
  }
}

function rerenderSatellites(
  layers: Layers,
  data: ParsedData,
  lat: number,
  lon: number,
  time: Date,
): ReturnType<typeof propagateSatellites> | null {
  if (!data.satelliteRecords?.ok || !layers.satellite) return null;
  const visibleSats = propagateSatellites(data.satelliteRecords.value, lat, lon, time, true);
  layers.satellite.update(visibleSats, lat, lon);
  return visibleSats;
}

function updateConstellationLayer(
  layers: Layers,
  data: ParsedData,
  visibleStars: ReturnType<typeof filterVisibleStars>,
  lat: number,
  lon: number,
): readonly { id: string; centroid: { alt: number; az: number } }[] {
  if (data.activeAsterisms !== null) {
    const visible = filterVisibleAsterisms(data.activeAsterisms, visibleStars);
    layers.constellation.update(visible, lat, lon);
    // #350 — mirror the same visible list into the constellation-art overlay
    // so its billboards sit on the current-frame centroids. Visibility /
    // opacity are applied downstream from the URL-synced state.
    layers.constellationArt.update(visible, lat, lon);
    return visible;
  }
  if (data.constellations.ok) {
    const visible = filterVisibleConstellations(data.constellations.value, visibleStars);
    layers.constellation.update(visible, lat, lon);
    layers.constellationArt.update(visible, lat, lon);
    return visible;
  }
  return [];
}

function doRerender(
  state: AppState,
  layers: Layers,
  data: ParsedData,
  latest?: LatestPositions,
): void {
  if (!data.stars.ok) return;
  const { observer, timeUtc } = state;

  const visibleStars = filterVisibleStars(
    data.stars.value,
    observer.lat,
    observer.lon,
    timeUtc,
    state.magLimit,
  );
  layers.star.update(visibleStars, observer.lat, observer.lon);

  const bodies = computeBodyPositions(observer.lat, observer.lon, timeUtc, true);
  layers.body.update(bodies, observer.lat, observer.lon);

  const visibleConstellations = updateConstellationLayer(
    layers,
    data,
    visibleStars,
    observer.lat,
    observer.lon,
  );

  if (data.boundaries.ok) {
    const namesByCode = data.constellations.ok
      ? new Map<string, string>(data.constellations.value.map((c) => [c.id, c.name] as const))
      : undefined;
    const visibleBoundaries = filterVisibleBoundaries(
      data.boundaries.value,
      observer.lat,
      observer.lon,
      timeUtc,
      namesByCode !== undefined ? { namesByCode } : undefined,
    );
    layers.boundary.update(visibleBoundaries, observer.lat, observer.lon);
  }

  const visibleSats = rerenderSatellites(layers, data, observer.lat, observer.lon, timeUtc);

  let visibleMessier: ReturnType<typeof filterVisibleMessier> = [];
  if (data.messierObjects.ok) {
    visibleMessier = filterVisibleMessier(
      data.messierObjects.value,
      observer.lat,
      observer.lon,
      timeUtc,
    );
    layers.messier.update(visibleMessier, observer.lat, observer.lon);
  }

  const gridData = computeRaDecGrid(observer.lat, observer.lon, timeUtc);
  layers.grid.update(gridData, observer.lat, observer.lon);

  const eclipticPoints = computeEclipticLine(observer.lat, observer.lon, timeUtc);
  layers.ecliptic.update(eclipticPoints, observer.lat, observer.lon);

  const milkyWayPoints = computeMilkyWayPoints(observer.lat, observer.lon, timeUtc);
  layers.milkyWay.update(milkyWayPoints, observer.lat, observer.lon);

  layers.compass.update(observer.lat, observer.lon);

  applyLayerVisibility(layers, state.layers);
  layers.constellation.setOpacity(state.opacity.constellationLines * 0.25);
  layers.boundary.setOpacity(state.opacity.constellationBoundaries * 0.15);
  layers.grid.setOpacity(state.opacity.raDecGrid);
  layers.ecliptic.setOpacity(state.opacity.ecliptic);
  layers.milkyWay.setOpacity(state.opacity.milkyWay);
  if (layers.satellite) layers.satellite.setOpacity(state.opacity.satelliteTrails * 0.3);
  applyConstellationArtState(layers, state);

  if (latest !== undefined) {
    fillLatestFromVisible(
      latest,
      visibleStars,
      bodies,
      visibleMessier,
      visibleSats,
      visibleConstellations,
    );
  }
}

/**
 * Worker-accelerated rerender for subsequent renders (after initial).
 *
 * Offloads the hot alt/az math for stars to the worker. Grid/ecliptic/boundaries use
 * fastRaDecToAltAz on the main thread (they're much smaller datasets).
 * Falls back to synchronous doRerender if the worker promise rejects.
 */
async function doRerenderWithWorker(
  state: AppState,
  layers: Layers,
  data: ParsedData,
  worker: AstroWorkerClient,
  catalog: StarRecord[],
  capturedState: AppState,
  latest?: LatestPositions,
): Promise<void> {
  if (!data.stars.ok) return;
  const { observer, timeUtc } = capturedState;

  // Kick off worker computation for stars (largest dataset, ~5000 entries)
  const raDecs = buildRaDecArray(catalog);
  const workerPromise = worker.computeAltAz(raDecs, observer.lat, observer.lon, timeUtc);

  // On the main thread, compute smaller datasets and solar system bodies (need precise ephemeris)
  const bodies = computeBodyPositions(observer.lat, observer.lon, timeUtc, true);
  layers.body.update(bodies, observer.lat, observer.lon);

  const visibleSats = rerenderSatellites(layers, data, observer.lat, observer.lon, timeUtc);

  const gridData = computeRaDecGrid(observer.lat, observer.lon, timeUtc);
  layers.grid.update(gridData, observer.lat, observer.lon);

  const eclipticPoints = computeEclipticLine(observer.lat, observer.lon, timeUtc);
  layers.ecliptic.update(eclipticPoints, observer.lat, observer.lon);

  const milkyWayPoints = computeMilkyWayPoints(observer.lat, observer.lon, timeUtc);
  layers.milkyWay.update(milkyWayPoints, observer.lat, observer.lon);

  if (data.boundaries.ok) {
    const namesByCode = data.constellations.ok
      ? new Map<string, string>(data.constellations.value.map((c) => [c.id, c.name] as const))
      : undefined;
    const visibleBoundaries = filterVisibleBoundaries(
      data.boundaries.value,
      observer.lat,
      observer.lon,
      timeUtc,
      namesByCode !== undefined ? { namesByCode } : undefined,
    );
    layers.boundary.update(visibleBoundaries, observer.lat, observer.lon);
  }

  let visibleMessier: ReturnType<typeof filterVisibleMessier> = [];
  if (data.messierObjects.ok) {
    visibleMessier = filterVisibleMessier(
      data.messierObjects.value,
      observer.lat,
      observer.lon,
      timeUtc,
    );
    layers.messier.update(visibleMessier, observer.lat, observer.lon);
  }

  layers.compass.update(observer.lat, observer.lon);

  // Apply the current state's opacity/visibility (fast, no computation)
  applyLayerVisibility(layers, capturedState.layers);
  layers.constellation.setOpacity(capturedState.opacity.constellationLines * 0.25);
  layers.boundary.setOpacity(capturedState.opacity.constellationBoundaries * 0.15);
  layers.grid.setOpacity(capturedState.opacity.raDecGrid);
  layers.ecliptic.setOpacity(capturedState.opacity.ecliptic);
  layers.milkyWay.setOpacity(capturedState.opacity.milkyWay);
  if (layers.satellite) layers.satellite.setOpacity(capturedState.opacity.satelliteTrails * 0.3);
  applyConstellationArtState(layers, capturedState);

  // Wait for worker result, then update stars + constellations
  let visibleStars: ReturnType<typeof filterVisibleStars>;
  let visibleConstellations: readonly { id: string; centroid: { alt: number; az: number } }[];
  try {
    const { altAzs, visibleIndices } = await workerPromise;
    // Check that state hasn't changed since we started (avoid stale updates)
    if (capturedState !== state) return;
    visibleStars = buildAltAzStars(catalog, altAzs, visibleIndices, capturedState.magLimit);
    layers.star.update(visibleStars, observer.lat, observer.lon);
    visibleConstellations = updateConstellationLayer(
      layers,
      data,
      visibleStars,
      observer.lat,
      observer.lon,
    );
  } catch {
    // Worker failed — fall back to synchronous star computation
    visibleStars = filterVisibleStars(
      catalog,
      observer.lat,
      observer.lon,
      timeUtc,
      capturedState.magLimit,
    );
    layers.star.update(visibleStars, observer.lat, observer.lon);
    visibleConstellations = updateConstellationLayer(
      layers,
      data,
      visibleStars,
      observer.lat,
      observer.lon,
    );
  }

  if (latest !== undefined) {
    fillLatestFromVisible(
      latest,
      visibleStars,
      bodies,
      visibleMessier,
      visibleSats,
      visibleConstellations,
    );
  }
}

function findUpcomingEventForKey(
  key: CardKey,
  events: readonly CelestialEvent[],
): { when: Date; viewAz: number; viewAlt: number } | undefined {
  for (const e of events) {
    if (key.objectKind === "satellite" && e.kind === "iss-pass" && key.id.startsWith("ISS")) {
      return { when: e.when, viewAz: e.peakAzDeg, viewAlt: e.peakAltDeg };
    }
    if (
      key.objectKind === "body" &&
      e.kind === "conjunction" &&
      (e.body1 === key.id || e.body2 === key.id) &&
      e.viewAz !== undefined &&
      e.viewAlt !== undefined
    ) {
      return { when: e.when, viewAz: e.viewAz, viewAlt: e.viewAlt };
    }
    if (
      key.objectKind === "body" &&
      key.id === "Moon" &&
      e.kind === "lunar-eclipse" &&
      e.viewAz !== undefined &&
      e.viewAlt !== undefined
    ) {
      return { when: e.when, viewAz: e.viewAz, viewAlt: e.viewAlt };
    }
  }
  return undefined;
}

function pickedToCardData(
  picked: PickedObject,
  observer: { lat: number; lon: number },
  time: Date,
): ObjectCardData | null {
  switch (picked.kind) {
    case "star":
      return { kind: "star", star: picked.star };
    case "body":
      return { kind: "body", body: picked.body, observer, time };
    case "satellite":
      return { kind: "satellite", satellite: picked.satellite };
    case "messier":
      return { kind: "messier", messier: picked.messier };
    case "constellation":
      return { kind: "constellation", constellation: picked.constellation };
    case "boundary":
      // Boundaries currently render only a hover-name popup (#307). No
      // pinned-card variant yet — return null so the click handler
      // treats the boundary click as "no card".
      return null;
  }
}

function idForCardData(data: ObjectCardData): string {
  switch (data.kind) {
    case "star":
      return data.star.name ?? `HIP ${String(data.star.hip)}`;
    case "body":
      return data.body.id;
    case "satellite":
      return data.satellite.name;
    case "messier":
      return `M${String(data.messier.m)}`;
    case "constellation":
      return data.constellation.id;
  }
}

function updateUrl(state: AppState): void {
  const params = serializeStateToSearchParams(state);
  const url = `${globalThis.location.pathname}?${params.toString()}`;
  globalThis.history.replaceState(null, "", url);
}

export async function bootstrap(
  root: HTMLElement | null,
  params: URLSearchParams = new URLSearchParams(globalThis.location?.search ?? ""),
): Promise<void> {
  if (!root) return;

  const errorDiv = root.querySelector<HTMLElement>("#error");

  const stateResult = parseStateFromSearchParams(params);
  if (!stateResult.ok) {
    showError(errorDiv, `State error: ${stateResult.error.kind}`);
    return;
  }
  let state = stateResult.value;

  const catalogResult = parseCatalog(rawStars);
  if (!catalogResult.ok) {
    showError(errorDiv, `Catalog error: ${catalogResult.error.message}`);
    return;
  }

  const viewerResult = createViewer("cesium-container");
  if (!viewerResult.ok) {
    showError(errorDiv, `Scene error: ${viewerResult.error.message}`);
    return;
  }
  const viewer = viewerResult.value;

  setCameraView(
    viewer.camera,
    state.observer.lat,
    state.observer.lon,
    state.view.az,
    state.view.alt,
  );
  setupTrackballControls(viewer, {
    onPan: (az, alt) => {
      handleIntent({ type: "set-view", az, alt });
    },
  });

  // Create all layers
  const cesiumContainerEl = document.getElementById("cesium-container");
  const layers: Layers = {
    star: createStarLayer(viewer.scene),
    body: createBodyLayer(viewer.scene),
    constellation: createConstellationLayer(viewer.scene),
    constellationArt: createConstellationArtLayer(viewer.scene),
    boundary: createBoundaryLayer(viewer.scene),
    satellite: null,
    compass: createCompassLayer(viewer.scene),
    grid: createGridLayer(viewer.scene),
    ecliptic: createEclipticLayer(viewer.scene),
    messier: createMessierLayer(viewer.scene),
    milkyWay: createMilkyWayLayer(viewer.scene),
    trail: createTrailLayer(viewer.scene),
    reticle: cesiumContainerEl ? createReticleLayer(viewer.scene, cesiumContainerEl) : null,
  };

  // Apply initial reticle preset from URL state
  layers.reticle?.setPreset(state.fov);

  // Current trail selection (ephemeral — not URL-persisted)
  let trailBodyId: string | null = null;

  function rerenderTrail(s: AppState): void {
    if (trailBodyId === null) {
      layers.trail.hide();
      return;
    }
    const result = computeBodyTrail(
      trailBodyId,
      s.observer.lat,
      s.observer.lon,
      s.timeUtc,
      TRAIL_DURATION_HOURS,
      TRAIL_STEP_MINUTES,
    );
    if (!result.ok) {
      layers.trail.hide();
      return;
    }
    layers.trail.setPoints(result.value, s.observer.lat, s.observer.lon);
    layers.trail.show();
  }

  // Parse static data once
  const constellationResult = parseConstellations(rawConstellations);
  const boundaryResult = parseBoundaries(rawBoundaries);
  if (!boundaryResult.ok) {
    console.warn(`Boundary load warning: ${boundaryResult.error.message}`);
  }
  const messierResult = parseMessier(rawMessier);
  if (!messierResult.ok) {
    console.warn(`Messier catalog load warning: ${messierResult.error.message}`);
  }

  const data: ParsedData = {
    stars: catalogResult,
    constellations: constellationResult,
    boundaries: boundaryResult,
    messierObjects: messierResult,
    satelliteRecords: null,
    activeAsterisms: state.skyculture === "western" ? null : loadAsterismSet(state.skyculture),
  };

  // Apply initial constellation name overrides based on language
  layers.constellation.setNameOverrides(loadNameOverridesForLanguage(state.language));

  // Live positions of every visible object, refreshed on every rerender. The
  // object-cards manager consults this to follow pinned objects as time advances.
  const latestPositions: LatestPositions = new Map();

  // Initial render (synchronous, no debounce — ensures immediate display)
  doRerender(state, layers, data, latestPositions);

  // Initialise worker for subsequent rerenders (falls back to sync if unavailable)
  const worker = tryCreateWorker();
  const catalog = catalogResult.value;

  // scheduleRerender debounces rapid state changes, then runs rerender
  function scheduleRerender(capturedState: AppState): void {
    if (rerenderTimer !== null) clearTimeout(rerenderTimer);
    rerenderTimer = setTimeout(() => {
      rerenderTimer = null;
      if (worker !== null) {
        // Worker path: star math off main thread
        void doRerenderWithWorker(
          state,
          layers,
          data,
          worker,
          catalog,
          capturedState,
          latestPositions,
        ).then(() => {
          objectCardsManager?.update();
        });
      } else {
        // Fallback: synchronous (also used in test environment)
        doRerender(capturedState, layers, data, latestPositions);
        objectCardsManager?.update();
      }
    }, 50);
  }

  // Satellite layer (async)
  let satelliteRecords: SatelliteRecord[] = [];
  // Captured across the fetchTle boundary so we can decide whether to surface
  // the offline-TLE staleness pill in the bottom HUD (#354).
  let tleUsedFallback = false;
  let tleSourceAgeSeconds = 0;
  const tleResult = await fetchTle();
  if (tleResult.ok) {
    tleUsedFallback = tleResult.value.usedFallback;
    tleSourceAgeSeconds = tleResult.value.sourceAgeSeconds;
    const satResult = parseTle(tleResult.value.text);
    if (satResult.ok) {
      satelliteRecords = satResult.value;
      data.satelliteRecords = satResult;
      const satLayer = createSatelliteLayer(viewer.scene);
      layers.satellite = satLayer;
      const visibleSats = propagateSatellites(
        satResult.value,
        state.observer.lat,
        state.observer.lon,
        state.timeUtc,
        true,
      );
      satLayer.update(visibleSats, state.observer.lat, state.observer.lon);
      satLayer.setVisible(state.layers.satellites);
      satLayer.setOpacity(state.opacity.satelliteTrails * 0.3);
    } else {
      console.warn(`TLE parse warning: ${satResult.error.message}`);
    }
  }

  // Build search index after all data (including satellites) is loaded
  const BODY_NAMES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
  let searchIndex: SearchIndex = buildSearchIndex(
    catalog,
    constellationResult.ok ? constellationResult.value : [],
    BODY_NAMES,
    satelliteRecords,
    state.observer.lat,
    state.observer.lon,
    state.timeUtc,
  );

  // Object cards manager — floating cards pinned on click. Replaces the previous
  // single pinned tooltip. The manager is created before the tooltip so the click
  // callback can dispatch open-object-card intents into a live target.
  //
  // Pending card data: the tooltip's click callback stashes the freshly-picked
  // ObjectCardData here, then dispatches an `open-object-card` intent. The intent
  // handler pops this and feeds it to the manager. This keeps the intent shape
  // URL-safe (just id + kind + coords) while preserving the typed data the card
  // needs to render its initial content.
  const pendingCardData = new Map<string, ObjectCardData>();
  let objectCardsManager: ObjectCardsManager | null = null;
  let emptySkyPopover: EmptySkyPopover | null = null;
  const cesiumContainer = document.getElementById("cesium-container");
  if (cesiumContainer) {
    objectCardsManager = createObjectCardsManager({
      container: cesiumContainer,
      dispatch: (intent) => {
        handleIntent(intent);
      },
      projector: (alt, az) =>
        projectAltAzToScreen(viewer.scene, alt, az, state.observer.lat, state.observer.lon),
      resolver: (key: CardKey) => latestPositions.get(positionKey(key.objectKind, key.id)) ?? null,
      getViewport: () => ({
        width: cesiumContainer.clientWidth || window.innerWidth,
        height: cesiumContainer.clientHeight || window.innerHeight,
      }),
      findUpcomingEvent: (key: CardKey) => findUpcomingEventForKey(key, cachedEvents),
    });

    // Empty-sky popover — small floating card + reticle shown when the user
    // clicks a patch of sky with nothing in it. Created alongside the object-cards
    // manager so we can route both pick and no-pick clicks from the tooltip layer.
    emptySkyPopover = createEmptySkyPopover({
      dispatch: (intent) => {
        handleIntent(intent);
      },
      initialFov: state.fov,
      // Read straight from the mutable caches — `cachedEvents` is refreshed on every
      // observer/time change (see refreshEvents), so on-open() the popover always
      // renders the freshest upcoming-events list against the current viewing time.
      getEvents: () => cachedEvents,
      getNow: () => state.timeUtc,
    });
    cesiumContainer.appendChild(emptySkyPopover.element);

    createTooltip(viewer, cesiumContainer, {
      onObjectClicked: (picked: PickedObject | null, screenX: number, screenY: number) => {
        if (picked === null) {
          // Empty-sky click: compute alt/az for the clicked direction and dispatch
          // the open-empty-sky-popover intent. Close any existing object card — a
          // click on empty sky replaces the pinned card with the empty-sky popover.
          const dir = screenToAltAz(
            viewer.scene,
            screenX,
            screenY,
            state.observer.lat,
            state.observer.lon,
          );
          if (dir === null) return;
          objectCardsManager?.closeActive();
          handleIntent({
            type: "open-empty-sky-popover",
            alt: dir.alt,
            az: dir.az,
            screenX,
            screenY,
          });
          return;
        }
        // Clicking an object replaces the empty-sky popover with the object card.
        emptySkyPopover?.close();
        const cardData = pickedToCardData(picked, state.observer, state.timeUtc);
        if (cardData === null) {
          // Boundary picks (#307) hover-only; no pinned card yet.
          return;
        }
        const objectKind = cardData.kind;
        const id = idForCardData(cardData);
        pendingCardData.set(positionKey(objectKind, id), cardData);
        handleIntent({ type: "open-object-card", objectKind, id, screenX, screenY });
      },
    });
  }

  // Gesture polish (Plan 07 1J):
  //   - scroll-wheel / pinch zoom → adjust camera FOV in-place (not persisted
  //     as a free-form value in URL state; the FOV preset reticle stays what
  //     the user last chose, and the reticle layer rerenders after zoom so
  //     its displayed angular size matches the new camera vFOV).
  //   - double-tap empty sky → animated return to zenith.
  //   - double-tap on an object → animated center on its current az/alt.
  function resolveObjectAt(x: number, y: number): AzAltPosition | null {
    const picker = viewer.scene as unknown as { pick?: (pos: { x: number; y: number }) => unknown };
    if (typeof picker.pick !== "function") return null;
    const picked = picker.pick({ x, y }) as { id?: { az?: unknown; alt?: unknown } } | undefined;
    const id = picked?.id;
    if (!id || typeof id.az !== "number" || typeof id.alt !== "number") return null;
    return { az: id.az, alt: id.alt };
  }

  setupGestures(viewer, {
    getObserver: () => ({ lat: state.observer.lat, lon: state.observer.lon }),
    resolveObjectAt,
    onZoom: () => layers.reticle?.render(),
    onPan: (az, alt) => {
      // Mirror the wheel-pan into AppState so the URL serialiser picks up
      // the new view direction (`?vaz=…&valt=…`). Without this, panning
      // visually moves the camera but the URL stays bare — "Copy link"
      // produces a default-pointing URL instead of the user's current view.
      handleIntent({ type: "set-view", az, alt });
    },
  });

  // Events drawer — celestial event alerts (conjunctions / lunar eclipses / meteor showers / ISS).
  // Drawer is created at bootstrap (lives on <body>) and refreshed on any observer/time change
  // regardless of whether it's currently open, so it's always fresh when the user taps 📅.
  let cachedEvents: readonly CelestialEvent[] = [];
  let eventsDrawer: EventsDrawer | null = null;
  // Tonight drawer (milestone 1G) — slide-in surface holding the Planet Info list (replaces
  // the always-on side-panel section). Refreshed on observer/time/trail changes so it's
  // always current when the user taps ♀.
  let tonightDrawer: TonightDrawer | null = null;

  function refreshEvents(s: AppState): void {
    const result = computeUpcomingEvents(
      s.timeUtc,
      { lat: s.observer.lat, lon: s.observer.lon },
      satelliteRecords,
    );
    cachedEvents = result.ok ? result.value : [];
    eventsDrawer?.setEvents(cachedEvents);
  }

  function refreshTonight(s: AppState): void {
    if (tonightDrawer === null) return;
    const bodies = computeBodyPositions(s.observer.lat, s.observer.lon, s.timeUtc, false);
    tonightDrawer.setBodies(bodies, s.observer.lat, s.observer.lon, s.timeUtc, trailBodyId);
  }

  function rebuildSearchIndex(s: AppState): void {
    searchIndex = buildSearchIndex(
      catalog,
      constellationResult.ok ? constellationResult.value : [],
      BODY_NAMES,
      satelliteRecords,
      s.observer.lat,
      s.observer.lon,
      s.timeUtc,
    );
  }

  let bottomHud: BottomHud | null = null;

  // #136 — time animation state. Since #348, URL-synced via ?anim / ?speed so
  // that "Copy link" while animating captures the play state and speed. The
  // authoritative store is `state.animation`; RAF bookkeeping stays local.
  let animationRafId: number | null = null;
  let animationLastFrameMs = 0;
  const ANIMATION_BASE_MS_PER_MS = 60_000; // 1× wall-second = 1 minute of sky time

  function startAnimationLoop(): void {
    if (animationRafId !== null) return;
    animationLastFrameMs = 0;
    const raf =
      typeof globalThis.requestAnimationFrame === "function"
        ? globalThis.requestAnimationFrame.bind(globalThis)
        : null;
    if (raf === null) return;
    const tick = (): void => {
      if (!state.animation.playing) {
        animationRafId = null;
        return;
      }
      const now =
        typeof globalThis.performance?.now === "function" ? globalThis.performance.now() : 0;
      const dt = animationLastFrameMs === 0 ? 16 : now - animationLastFrameMs;
      animationLastFrameMs = now;
      const advanceMs = dt * state.animation.speed * (ANIMATION_BASE_MS_PER_MS / 1000);
      const next = new Date(state.timeUtc.getTime() + advanceMs);
      handleIntent({ type: "set-time", time: next });
      animationRafId = raf(tick);
    };
    animationRafId = raf(tick);
  }

  function stopAnimationLoop(): void {
    if (animationRafId === null) return;
    const caf =
      typeof globalThis.cancelAnimationFrame === "function"
        ? globalThis.cancelAnimationFrame.bind(globalThis)
        : null;
    if (caf !== null) caf(animationRafId);
    animationRafId = null;
  }
  let locationPicker: ReturnType<typeof createLocationPickerOverlay> | null = null;
  let notebookWorkspace: ReturnType<typeof createNotebookWorkspace> | null = null;
  let loginModal: ReturnType<typeof createLoginModal> | null = null;
  let plansDrawer: ReturnType<typeof createPlansDrawer> | null = null;
  let plansModal: ReturnType<typeof createPlansModal> | null = null;

  // Intent handler — dispatches to category-specific handlers below. Each
  // handler mutates `state` and fires whatever side effects the category
  // needs. Shared sequences (the "refresh-everything-derived" one that
  // follows any time/observer change) live in helpers so additions can't
  // accidentally skip a step.

  function refreshAllDerived(nextState: typeof state): void {
    scheduleRerender(nextState);
    refreshTonight(nextState);
    refreshEvents(nextState);
    rebuildSearchIndex(nextState);
    rerenderTrail(nextState);
  }

  function applyTimeChange(time: Date): void {
    state = { ...state, timeUtc: time };
    refreshAllDerived(state);
    bottomHud?.setTime(time);
    updateUrl(state);
  }

  function applyObserverChange(lat: number, lon: number): void {
    state = { ...state, observer: { lat, lon } };
    initCamera(viewer.camera, lat, lon);
    refreshAllDerived(state);
    bottomHud?.setObserver(lat, lon);
    updateUrl(state);
  }

  function handleTimeIntent(intent: UIIntent & { type: "set-time" | "now" }): void {
    switch (intent.type) {
      case "set-time":
        applyTimeChange(intent.time);
        return;
      case "now":
        applyTimeChange(new Date());
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              applyObserverChange(position.coords.latitude, position.coords.longitude);
            },
            () => {
              // Geolocation denied or failed — time already set, keep current location.
            },
          );
        }
        return;
    }
  }

  function handleLayerIntent(
    intent: UIIntent & {
      type: "toggle-layer" | "set-opacity" | "set-language" | "set-skyculture";
    },
  ): void {
    switch (intent.type) {
      case "toggle-layer": {
        const newLayers = { ...state.layers, [intent.layer]: !state.layers[intent.layer] };
        state = { ...state, layers: newLayers };
        applyLayerVisibility(layers, state.layers);
        updateUrl(state);
        return;
      }
      case "set-opacity": {
        const newOpacity = { ...state.opacity, [intent.layer]: intent.value };
        state = { ...state, opacity: newOpacity };
        layers.constellation.setOpacity(state.opacity.constellationLines * 0.25);
        layers.boundary.setOpacity(state.opacity.constellationBoundaries * 0.15);
        layers.grid.setOpacity(state.opacity.raDecGrid);
        layers.ecliptic.setOpacity(state.opacity.ecliptic);
        layers.milkyWay.setOpacity(state.opacity.milkyWay);
        if (layers.satellite) layers.satellite.setOpacity(state.opacity.satelliteTrails * 0.3);
        updateUrl(state);
        return;
      }
      case "set-language": {
        // Name overrides are only defined for the Western (IAU) asterism set, so a
        // language change implies Western skyculture — otherwise the labels stay in
        // the non-Western culture's native names and the user's choice is ignored.
        state = { ...state, language: intent.language, skyculture: "western" };
        data.activeAsterisms = null;
        layers.constellation.setNameOverrides(loadNameOverridesForLanguage(state.language));
        scheduleRerender(state);
        updateUrl(state);
        return;
      }
      case "set-skyculture":
        state = { ...state, skyculture: intent.id };
        data.activeAsterisms = intent.id === "western" ? null : loadAsterismSet(intent.id);
        scheduleRerender(state);
        updateUrl(state);
        return;
    }
  }

  function handleViewIntent(
    intent: UIIntent & {
      type: "set-view" | "set-mag-limit" | "set-fov" | "toggle-night-vision" | "pin-object";
    },
  ): void {
    switch (intent.type) {
      case "set-view":
        state = { ...state, view: { az: intent.az, alt: intent.alt } };
        setCameraView(viewer.camera, state.observer.lat, state.observer.lon, intent.az, intent.alt);
        updateUrl(state);
        return;
      case "set-mag-limit":
        state = { ...state, magLimit: intent.value };
        scheduleRerender(state);
        updateUrl(state);
        return;
      case "set-fov":
        state = { ...state, fov: intent.preset };
        layers.reticle?.setPreset(intent.preset);
        updateUrl(state);
        return;
      case "toggle-night-vision":
        state = { ...state, nightVision: !state.nightVision };
        document.body.classList.toggle("night-vision", state.nightVision);
        nightVisionPanel?.setNightVision(state.nightVision);
        updateUrl(state);
        return;
      case "pin-object": {
        // The scene layer currently pins via click; from the palette we can't
        // reach into the canvas picker directly, so we mirror the on-screen
        // search's behavior: aim the camera at the object. The pinned tooltip
        // stays a scene-level affordance (mouse click) until we expose a
        // pin-by-id API on the scene layer.
        const entry = searchIndex.entries.find(
          (e) => e.name === intent.id || e.nameLower === intent.id.toLowerCase(),
        );
        if (entry !== undefined) {
          state = { ...state, view: { az: entry.az, alt: entry.alt } };
          setCameraView(viewer.camera, state.observer.lat, state.observer.lon, entry.az, entry.alt);
          updateUrl(state);
        }
        return;
      }
    }
  }

  function handleTrailIntent(intent: UIIntent & { type: "show-trail" | "hide-trail" }): void {
    if (intent.type === "show-trail") {
      trailBodyId = intent.id;
      rerenderTrail(state);
    } else {
      trailBodyId = null;
      layers.trail.hide();
    }
    refreshTonight(state);
  }

  function handleModeIntent(
    intent: UIIntent & { type: "set-mode" | "toggle-animation" | "set-animation-speed" },
  ): void {
    if (intent.type === "toggle-animation") {
      const nextPlaying = !state.animation.playing;
      state = { ...state, animation: { ...state.animation, playing: nextPlaying } };
      bottomHud?.setAnimation(nextPlaying, state.animation.speed);
      if (nextPlaying) {
        startAnimationLoop();
      } else {
        stopAnimationLoop();
      }
      updateUrl(state);
      return;
    }
    if (intent.type === "set-animation-speed") {
      state = { ...state, animation: { ...state.animation, speed: intent.speed } };
      bottomHud?.setAnimation(state.animation.playing, state.animation.speed);
      updateUrl(state);
      return;
    }
    // Notebook is a Pro feature (issue #224). Non-Pro users attempting to
    // enter it are shown the login modal instead of flipping mode.
    // Exiting back to planetarium is always free.
    if (intent.mode === "notebook" && !isPro()) {
      loginModal?.open();
      return;
    }
    state = { ...state, mode: intent.mode };
    notebookWorkspace?.setVisible(intent.mode === "notebook");
    nightVisionPanel?.setMode(intent.mode);
    updateUrl(state);
  }

  function handleUIIntent(
    intent: UIIntent & {
      type: "open-location-picker" | "copy-link" | "open-object-card" | "open-empty-sky-popover";
    },
  ): void {
    switch (intent.type) {
      case "open-location-picker":
        locationPicker?.open();
        return;
      case "copy-link": {
        // Fire-and-forget: clipboard is optional; failure is silent.
        const href = globalThis.location?.href ?? "";
        const clipboard = navigator.clipboard as
          { writeText?: (s: string) => Promise<void> } | undefined;
        if (clipboard !== undefined && typeof clipboard.writeText === "function") {
          void clipboard.writeText(href).catch(() => {
            // Clipboard access denied — nothing we can do.
          });
        }
        return;
      }
      case "open-object-card": {
        if (objectCardsManager === null) return;
        const key = positionKey(intent.objectKind, intent.id);
        const cardData = pendingCardData.get(key);
        if (cardData === undefined) return;
        pendingCardData.delete(key);
        objectCardsManager.open({
          data: cardData,
          screenX: intent.screenX,
          screenY: intent.screenY,
        });
        return;
      }
      case "open-empty-sky-popover":
        emptySkyPopover?.open(intent.alt, intent.az, intent.screenX, intent.screenY);
        return;
    }
  }

  async function refreshPlansView(): Promise<void> {
    plansDrawer?.setView({ kind: "loading" }, state.observer.lat);
    const res = await listPlans();
    if (res.ok) {
      plansDrawer?.setView({ kind: "list", plans: res.value }, state.observer.lat);
      return;
    }
    const view: PlansDrawerView =
      res.error.kind === "unauthenticated"
        ? { kind: "unauthenticated" }
        : res.error.kind === "not_pro"
          ? { kind: "not_pro" }
          : { kind: "error" };
    plansDrawer?.setView(view, state.observer.lat);
  }

  async function openPlanBySlug(slug: string): Promise<void> {
    const res = await getPlan(slug);
    if (res.ok) {
      plansModal?.setPlan(res.value);
      return;
    }
    plansModal?.setError(slug, res.error.kind);
    // Clear the active slug so a reload doesn't render the broken state forever.
    handleIntent({ type: "set-active-plan", slug: null });
  }

  function handleIntent(intent: UIIntent): void {
    switch (intent.type) {
      case "set-time":
      case "now":
        return handleTimeIntent(intent);
      case "set-observer":
        return applyObserverChange(intent.lat, intent.lon);
      case "toggle-layer":
      case "set-opacity":
      case "set-language":
      case "set-skyculture":
        return handleLayerIntent(intent);
      case "set-view":
      case "set-mag-limit":
      case "set-fov":
      case "toggle-night-vision":
      case "pin-object":
        return handleViewIntent(intent);
      case "show-trail":
      case "hide-trail":
        return handleTrailIntent(intent);
      case "set-mode":
      case "toggle-animation":
      case "set-animation-speed":
        return handleModeIntent(intent);
      case "open-location-picker":
      case "copy-link":
      case "open-object-card":
      case "open-empty-sky-popover":
        return handleUIIntent(intent);
      case "set-active-plan": {
        state = { ...state, activePlanSlug: intent.slug };
        updateUrl(state);
        if (intent.slug === null) {
          plansModal?.setPlan(null);
        } else {
          void openPlanBySlug(intent.slug);
        }
        return;
      }
      case "open-sign-in": {
        loginModal?.open();
        return;
      }
      case "retry-plans": {
        void refreshPlansView();
        return;
      }
      case "toggle-constellation-art": {
        state = { ...state, constellationArt: !state.constellationArt };
        applyConstellationArtState(layers, state);
        updateUrl(state);
        return;
      }
      case "set-constellation-art-opacity": {
        state = { ...state, constellationArtOpacity: intent.value };
        applyConstellationArtState(layers, state);
        updateUrl(state);
        return;
      }
      case "open-help": {
        helpModal?.open();
        return;
      }
    }
  }

  // Apply initial night vision state from URL
  if (state.nightVision) {
    document.body.classList.add("night-vision");
  }

  // Onboarding overlay (milestone 1I, issue #200) — multi-step first-load tour.
  // Created before the help modal so we can pass its `replay()` into the help
  // modal's `onReplayTour` option.
  const onboardingSteps: readonly OnboardingStep[] = [
    {
      title: "Tap a star or planet to pin it",
      body: "Click any object in the sky to open a card with its details. Click empty sky to see where you're looking.",
      selector: "#cesium-container",
      position: "center",
    },
    {
      title: "Drag the time bar to move through time",
      body: "The bottom bar shows the current time. Drag it left or right to scrub, or use ← / → for one-minute steps — hold Shift for hours, Alt for days. Space plays real-time.",
      selector: "[data-testid='hud-scrub']",
      position: "top",
    },
    {
      title: "Explore with the top-right icons",
      body: "Tap \u2699 for layer settings, \u{1F4C5} for upcoming events, \u2640 for tonight's planets, ? for help, and \u{1F303}/\u{1F4D3} to switch to Notebook mode (Pro). \u{1F534} toggles night vision.",
      selector: "[data-testid='panel-header']",
      position: "left",
    },
    {
      title: "Change where you're viewing from",
      body: "Tap the \u{1F4CD} location chip in the bottom-left to pick a city, enter coordinates, or use your device location.",
      selector: "[data-testid='hud-location']",
      position: "top",
    },
    {
      title: "Press \u2318K (Ctrl+K) to jump anywhere",
      body: "The command palette searches stars, planets, events, and places — and lets you run any setting from the keyboard.",
      position: "center",
    },
  ];
  const onboardingOverlay = createOnboardingOverlay({ steps: onboardingSteps });
  document.body.appendChild(onboardingOverlay.element);

  // Help modal — created once at bootstrap, appended to <body> so it overlays everything.
  // Wires a "Replay tour" button into the modal header so users can re-run the
  // onboarding after dismissing it.
  const helpModal = createHelpModal({
    onReplayTour: () => {
      onboardingOverlay.replay();
    },
  });
  document.body.appendChild(helpModal.element);

  // Events drawer — slide-in surface holding the upcoming-events list (replaces
  // the always-on side-panel section). Created here (after handleIntent is in
  // scope) and refreshed with the first event list below once satellites load.
  eventsDrawer = createEventsDrawer({ dispatch: handleIntent });
  document.body.appendChild(eventsDrawer.element);
  eventsDrawer.setEvents(cachedEvents);

  // Settings drawer (Plan 07 1E) — slide-in ⚙ drawer that replaces the
  // Layer block previously rendered in the side panel.
  const settingsDrawer = createSettingsDrawer({
    visibility: state.layers,
    opacity: state.opacity,
    magLimit: state.magLimit,
    language: state.language,
    skyculture: state.skyculture,
    constellationArt: state.constellationArt,
    constellationArtOpacity: state.constellationArtOpacity,
    dispatch: (intent) => {
      handleIntent(intent);
    },
  });
  document.body.appendChild(settingsDrawer.element);

  // Tonight drawer (Plan 07 1G) — slide-in ♀ drawer that replaces the always-on
  // Planet Info side-panel section. Created at bootstrap (so tests / headless
  // environments still mount it) and populated with the initial body list.
  tonightDrawer = createTonightDrawer({ dispatch: handleIntent });
  document.body.appendChild(tonightDrawer.element);
  refreshTonight(state);

  // Bottom HUD — ambient bar with time, location chip, and compass. Replaces the
  // side-panel Time section (milestone 1A of Plan 07). Appended to <body> so it
  // sits above the cesium canvas independently of the side panel.
  bottomHud = createBottomHud(
    {
      timeUtc: state.timeUtc,
      lat: state.observer.lat,
      lon: state.observer.lon,
      tleUsedFallback,
      tleSourceAgeSeconds,
    },
    handleIntent,
  );
  document.body.appendChild(bottomHud.element);
  bottomHud.setCompass(getCameraHeadingDeg(viewer.camera));

  // #348 — hydrate the animation state that came in from ?anim / ?speed.
  // Reflects to the HUD immediately so the play button and speed pill match
  // the URL, and kicks off the RAF loop when the link was captured mid-play.
  if (state.animation.playing || state.animation.speed !== 1) {
    bottomHud.setAnimation(state.animation.playing, state.animation.speed);
  }
  if (state.animation.playing) {
    startAnimationLoop();
  }

  // Location picker overlay (milestone 1B of Plan 07, issue #193). Created once at
  // bootstrap and opened via the `open-location-picker` intent fired from the bottom
  // HUD's location chip.
  locationPicker = createLocationPickerOverlay({
    dispatch: handleIntent,
    initialLat: state.observer.lat,
    initialLon: state.observer.lon,
  });
  document.body.appendChild(locationPicker.element);

  // Login modal (issue #218 follow-up to #227) — surfaced whenever a non-Pro
  // user hits a Pro-gated action. Wires the client `requestMagicLink` helper
  // directly into the modal so `fetch` never leaks into `src/ui/`. Success is
  // "link sent"; the real "you're signed in" moment happens server-side on
  // magic-link callback and is picked up by the currentUser() sync below.
  loginModal = createLoginModal({
    requestMagicLink: (email) => requestMagicLink(email),
  });
  document.body.appendChild(loginModal.element);

  // Viewing Plans drawer + reader modal (#220). Drawer renders six states
  // (loading / list / empty / error / unauthenticated / not_pro). Modal
  // opens on `set-active-plan` with a slug; fetched via the Pro-gated
  // `/api/plans/:slug` route through `src/plans.ts`.
  plansDrawer = createPlansDrawer({ dispatch: handleIntent });
  document.body.appendChild(plansDrawer.element);
  plansModal = createPlansModal({ dispatch: handleIntent });
  document.body.appendChild(plansModal.element);

  // Pick up any existing server session — if the ps_session cookie is valid
  // the Worker will return the authenticated user; mirror the email into
  // features.setUser so isPro() still reflects the Rung-1 allowlist during
  // the transitional window. Fire-and-forget so bootstrap isn't gated on a
  // network roundtrip; users who land here straight from a magic-link
  // callback have plenty of idle time before their first click.
  void currentUser().then((user) => {
    if (user !== null) setUser(user.email);
  });

  // Notebook workspace (milestone 2A / 2D of Plan 07, issues #216 + #219).
  // Right-side shell shown only when state.mode === "notebook". The tiptap
  // editor inside autosaves to /api/notebooks via the default NotebookApi.
  notebookWorkspace = createNotebookWorkspace({
    getCurrentView: () => ({
      href: globalThis.location.href,
      timeUtc: state.timeUtc,
    }),
    onProRequired: () => {
      loginModal?.open();
    },
  });
  document.body.appendChild(notebookWorkspace.element);
  notebookWorkspace.setVisible(state.mode === "notebook");

  // Poll the camera heading on each animation frame so the compass chip mirrors
  // drag-rotation of the view. Cesium's camera doesn't emit a change event.
  const raf =
    typeof globalThis.requestAnimationFrame === "function"
      ? globalThis.requestAnimationFrame.bind(globalThis)
      : null;
  if (raf !== null) {
    const tickCompass = (): void => {
      bottomHud?.setCompass(getCameraHeadingDeg(viewer.camera));
      raf(tickCompass);
    };
    raf(tickCompass);
  }

  // Command palette (⌘K / Ctrl+K) — bootstrap once, keyboard-triggered.
  const palette = setupCommandPalette(
    () => buildPaletteSources(searchIndex, cachedEvents),
    handleIntent,
  );
  document.body.appendChild(palette.element);

  // Refresh events now that the drawer is mounted and satelliteRecords are known.
  // This gives the drawer its first population regardless of whether the side panel
  // exists (headless / test environments include).
  refreshEvents(state);

  // Build UI panel
  let nightVisionPanel: ReturnType<typeof createPanel> | null = null;
  const panelRoot = document.getElementById("ui-panel-root");
  if (panelRoot) {
    const panel = createPanel(panelRoot, handleIntent, {
      onOpenHelp: () => helpModal.open(),
      onOpenEvents: () => {
        // Mutual exclusion: close other open surfaces before opening the drawer.
        if (helpModal.isOpen()) helpModal.close();
        if (settingsDrawer.isOpen()) settingsDrawer.close();
        if (tonightDrawer?.isOpen()) tonightDrawer.close();
        eventsDrawer?.open();
      },
      onOpenSettings: () => {
        if (helpModal.isOpen()) helpModal.close();
        if (eventsDrawer?.isOpen()) eventsDrawer.close();
        if (tonightDrawer?.isOpen()) tonightDrawer.close();
        settingsDrawer.open();
      },
      onOpenTonight: () => {
        if (helpModal.isOpen()) helpModal.close();
        if (eventsDrawer?.isOpen()) eventsDrawer.close();
        if (settingsDrawer.isOpen()) settingsDrawer.close();
        tonightDrawer?.open();
      },
      onOpenPlans: () => {
        if (helpModal.isOpen()) helpModal.close();
        if (eventsDrawer?.isOpen()) eventsDrawer.close();
        if (settingsDrawer.isOpen()) settingsDrawer.close();
        if (tonightDrawer?.isOpen()) tonightDrawer.close();
        plansDrawer?.openPanel();
        void refreshPlansView();
      },
      onProRequired: () => {
        loginModal?.open();
      },
      mode: state.mode,
    });
    nightVisionPanel = panel;
    if (state.nightVision) {
      panel.setNightVision(true);
    }

    const uiContainer = document.createElement("div");

    // Search box — at the top of the panel
    const searchEl = createSearch((query) => searchObjects(searchIndex, query), handleIntent);
    uiContainer.appendChild(searchEl);

    const locationEl = createLocationControls(state.observer.lat, state.observer.lon, handleIntent);
    uiContainer.appendChild(locationEl);

    const viewEl = createViewControls(0, 89.9, handleIntent);
    uiContainer.appendChild(viewEl);

    const fovEl = createFovControls(state.fov, handleIntent);
    uiContainer.appendChild(fovEl);

    panel.setContent(uiContainer);
  }

  // First-load onboarding tour — start after a small delay so Cesium has a
  // chance to paint before the dimmed overlay comes up. Skipped when the user
  // has previously dismissed the tour (persisted in localStorage), and skipped
  // when a plan slug is in the URL (#353): the reader modal is about to open
  // and the transparent tour click-shield would sit above it, blocking the
  // modal's close button. Don't persist "dismissed" on that path — the tour
  // still deserves to fire on a later open without a slug.
  const onboardingFlag = (() => {
    try {
      return globalThis.localStorage?.getItem(ONBOARDING_STORAGE_KEY);
    } catch {
      return null;
    }
  })();
  if (onboardingFlag !== "dismissed" && state.activePlanSlug === null) {
    setTimeout(() => {
      onboardingOverlay.start();
    }, 500);
  }

  // Hydrate ?plan=<slug> on boot so reload / share-links open the reader modal.
  // The malformed-slug case is already dropped to null by parseStateFromSearchParams.
  if (state.activePlanSlug !== null) {
    void openPlanBySlug(state.activePlanSlug);
  }
}

function showError(el: HTMLElement | null, message: string): void {
  if (!el) return;
  el.textContent = message;
  el.style.display = "block";
}
