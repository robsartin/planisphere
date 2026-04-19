# Plan 07 — UX transformation: Sky-First HUD, then Planetarium / Notebook

**Goal:** turn the planisphere from "acceptable" into a product users love — and make the second half billable.

Two phases. **Phase 1** (HUD) is pure UX, no backend, keeps the static-SPA promise. **Phase 2** (Notebook) introduces the first backend and a paid tier. Ship and learn from Phase 1 before committing to Phase 2 infrastructure.

---

## Phase 1 — Sky-First HUD

The sky fills the viewport. Controls appear where and when they're relevant. No side panel stacking every feature at once.

### Design principles

1. **Sky is the hero.** Chrome fades when idle (≥2s no mouse movement), returns instantly on any input.
2. **One panel at a time.** Drawer / card / modal surfaces are mutually exclusive; opening one closes the others.
3. **Contextual reveals.** Clicking an object gives you controls for _that_ object, not a global menu.
4. **Every action has a keyboard shortcut** so power users can skip chrome entirely.
5. **Mobile-first layout breakpoints.** On phones, overlays become bottom-sheets; on desktop, floating cards / side drawers.

### Milestones

Each milestone is independently shippable and TDD-tested per CLAUDE.md. All existing features from the current panel are preserved (see "feature map" at end).

#### 1A. Ambient bottom ring (time + location chip + compass)

- Thin horizontal bar pinned to the bottom; full-screen sky above it.
- Shows current UTC time + local time side-by-side; drag-scrub to move time.
- Left chip: observer location (`📍 lat, lon — City`). Click opens map picker overlay (next milestone).
- Right chip: live camera compass (`N ↑ 12°`) reflecting the scene's camera heading.
- Keyboard: `←`/`→` scrub time by 1 min; hold `Shift` for 1h; `Alt` for 1d. `Space` toggles play/pause (hook for Plan 08 animation, but arrow scrubbing ships here).
- Auto-hides after 2s idle; reappears on any pointer movement or key.
- **Tests:** scrub dispatches `set-time`; chip clicks open the right overlays; idle-fade behavior.

#### 1B. Location map picker overlay

- Opens when the location chip is clicked.
- Full-viewport darkened overlay with a simple interactive map (use existing map lib — no new dep preferred; lat/lon numeric input fallback).
- Big "Use my location" button (wraps existing `📍 Now` intent).
- Save = dispatch `set-observer`; Close = dismiss without change.
- On mobile: full-screen bottom sheet.
- **Tests:** save dispatches correct intent; cancel doesn't mutate state.

#### 1C. Object-click floating cards (replace current pinned tooltip)

- Clicking a star / body / satellite / deep-sky / constellation displays a card anchored near the click point (offset to avoid clipping).
- Card shows: object name, type, key attributes (RA/Dec, alt/az, magnitude, rise/set if applicable).
- Quick actions: `Pin`, `Trail` (bodies/sats), `Go to peak` (relevant events), `Copy link with this object framed`.
- Multiple cards can coexist (one per pinned object) but only the most recent is "active" for keyboard.
- Replaces current pinned-tooltip pattern; data sources are the same.
- **Tests:** click dispatches card show; action buttons dispatch correct intents; pin persists across time changes.

#### 1D. Empty-sky reticle popover

- Click anywhere with no object → small reticle at pointer + popover with az/alt readout and the FOV preset selector.
- "Look here" button sets the camera view direction to the clicked az/alt.
- FOV preset changes update the overlay reticle size (existing behavior), now accessible without a drawer trip.
- **Tests:** click-empty dispatches reticle show; preset change dispatches `set-fov`.

#### 1E. Settings drawer (⚙ icon top-right)

Consolidates:

- Layer visibility toggles (stars, planets, satellites, compass, deep-sky)
- Opacity sliders (constellation lines, boundaries, satellite trails, RA/Dec grid, ecliptic, Milky Way)
- Magnitude filter
- Language (constellation names)
- Skyculture (asterism set)

Design:

- Slides in from the right; never stacks on top of other overlays.
- Collapsible sub-sections (Visibility, Opacity, Filters, Display) so the drawer opens tight and expands per-user preference.
- Remembers last-opened section so returning users don't re-scroll.
- **Tests:** all existing layer / opacity / language / skyculture intents reachable; remembered section state.

#### 1F. Events panel (📅 icon top-right)

Behaves like today's events list but as a slide-in drawer instead of a permanent section. Same rendering (conjunctions, eclipses, meteor peaks, ISS passes with magnitude / shadow indicators). Go-to behavior unchanged.

#### 1G. "Tonight's sky" card (♀ icon top-right)

Replacement for the current always-on Planet Info panel. On open, shows all visible bodies + rise/set + trail toggles. Keeps the dashboard workflow for users who used Planet Info as a reference.

#### 1H. Command palette (⌘K / Ctrl+K)

Power-user accelerator:

- Fuzzy-search across objects (Sirius, Orion, ISS, Messier 31), places ("San Francisco"), events ("Perseids"), settings ("night vision", "bino FOV"), actions ("copy link").
- Picking an object pins it and aims the camera.
- Picking an event runs the existing Go-to.
- Picking a location dispatches `set-observer`.
- No new deps — fuzzysort is ~6KB and MIT (ADR required). Or write 30 lines.
- **Tests:** fuzzy match ordering, enter-to-execute, Esc-to-close.

#### 1I. Onboarding overlay (discoverability)

First-load experience:

- Three-step guided tour: "tap a star to pin it", "drag the time bar to move through time", "tap ⚙ for all settings".
- Skippable; dismissed state persisted in localStorage.
- After dismissal, ? help button still shows a re-run option.
- **Tests:** shows on first load only; dismiss + replay work.

#### 1J. Gesture polish

- Pinch-zoom on touch, scroll-to-zoom on desktop, both adjusting FOV (also updates reticle if active).
- Drag with inertia for camera pan.
- Double-tap sky → reset view to zenith.
- Double-tap object → center camera on it.
- **Tests:** gesture → intent dispatch mapping.

#### 1K. Cinematic / timelapse export (the billable hook, free tier)

- `⬛` icon: hide all chrome, lock to a recording state.
- Time animation runs from T1 → T2 at user-chosen speed.
- Export as WebM / MP4 via `MediaRecorder` + canvas stream (no backend — all client-side).
- 1080p free; 4K teased as the first "Pro" feature bridging into Phase 2.
- Already needs Plan 08's time-animation loop as a dependency — call that out explicitly here.
- **Tests:** recording lifecycle state machine; export produces a playable file (jsdom can assert MIME + blob size).

### Feature-map check (everything from today's panel)

| Current feature                  | Phase 1 location                                |
| -------------------------------- | ----------------------------------------------- |
| Search box                       | ⌘K palette + 🔍 icon                            |
| Time input + steps + Now + 📍Now | Ambient bottom ring + keyboard                  |
| Events panel                     | 📅 slide-in (milestone 1F)                      |
| Location lat/lon                 | Location chip → map picker (1B)                 |
| View Direction az/alt + presets  | Empty-sky reticle popover (1D)                  |
| FOV reticle preset               | Empty-sky reticle popover + drawer shortcut     |
| Layer toggles                    | ⚙ drawer (1E)                                  |
| Opacity sliders (6)              | ⚙ drawer (1E)                                  |
| Magnitude filter                 | ⚙ drawer (1E)                                  |
| Language dropdown                | ⚙ drawer (1E)                                  |
| Skyculture dropdown              | ⚙ drawer (1E)                                  |
| Planet Info (all 7 bodies)       | ♀ "Tonight's sky" card (1G)                    |
| Help (?)                         | stays as ? icon top-right, opens existing modal |
| Night vision (☼)                 | stays top-right                                 |
| Copy link (🔗)                   | stays top-right                                 |

No features dropped.

### Discoverability

Minimize discovery risk by writing a tutorial introduction to the UI. Do the first pass at this after the rest of phase I. Then update it with each new issue. Wite it for people with little astronomy background, but include technical details as aside. Consider using a walkthrough of the UI with overlay cards describing feature and next/prev buttons to continue through overlay until all are done. It should be accessible any time they want through the UI. Show it automatically when date of last tutorial update more recent than last visit. Use a cokie to encode our sessi0on state; include a way of saving last visit date/

### Risks / decisions for Phase 1

- **Discoverability.** Without the laundry-list panel, users might not know features exist. Mitigations: onboarding (1I), persistent icons top-right, command palette (1H).
- **Animation loop dependency.** Milestone 1K (cinematic export) and arrow-key time scrubbing both touch animation primitives. If Plan 08 hasn't shipped, 1K and full scrubbing slip.
- **Touch vs desktop parity.** Drawer slide-ins need to become bottom-sheets on narrow viewports. Allocate time for mobile testing.
- **No new heavy deps.** Aim to keep total bundle ≤ +40KB gzipped across Phase 1.

### Phase 1 → Phase 2 bridge

At end of Phase 1, the planisphere is lovable as a free product. Phase 2 is the business layer on top of it.

---

## Phase 2 — Planetarium / Notebook

Two explicit modes, one toggle. Free users get the Planetarium (Phase 1 plus polish). Paid users get the Notebook.

**This phase breaks the "no backend in v1" rule from `CLAUDE.md`.** That's intentional and requires an explicit go-ahead before starting.

### Mode concept

- **Planetarium (free, default):** everything Phase 1 delivered; shareable deep links get OpenGraph previews (so Twitter / Mastodon / iMessage show a sky thumbnail when links render).
- **Notebook (paid):** sky + a right-side canvas where users _write_ — "Saturday night: Perseids + ISS from the backyard." The app attaches computed events, sets reminders, saves a versioned session. A persistent feed of notebooks, sortable by date.

### Milestones

#### 2A. Mode toggle + OpenGraph previews (no backend)

- Top-right mode switch: 🌃 Planetarium / 📓 Notebook.
- Notebook mode reveals the right-hand workspace (empty at first).
- OpenGraph: server-side rendering of sky thumbnails is a backend feature, so this sub-milestone uses a screenshot-at-pageload approach with `<meta>` tags pointing at a static CDN image, generated client-side and uploaded on share. Decision point: cheap static tagged PNG vs. real SSR preview.
- Notebook needs a fast way to save lat/long, ra/dec, and all the control settings for a predefined view. I want paying users to be able to trivially generate a slide show. great for classroom or planetarium "What's Up in the Sky This Month" shows
- **Ship-gate:** even without a backend, Notebook mode works locally via localStorage for a preview audience.

#### 2B. Backend selection + ADR

**Decision required from Rob.** Options:

- Cloudflare Workers + D1 (matches current deploy target, cheap).

Recommended: **Cloudflare Workers + D1** for fit with existing infra. Add an ADR.

#### 2C. Account + auth

- Email magic-link or OAuth (Google, GitHub).
- Account → subscription state → paywall gate.
- Free trial mechanic: 14 days of Notebook features, no card, zero friction.

#### 2D. Notebook workspace UI

- Rich-text editor (tiptap or pure contenteditable — pick one, ADR required).
- Linked entities: `@` to insert an object/event/place, auto-updates when the reference changes.
- Save state per-notebook; list of notebooks sortable by date.
- **Tests:** entity linking round-trip, save/load, reference update propagation.

#### 2E. Curated viewing plans (paid content pipeline)

- Monthly "What's up above you" auto-generated per location.
- Feed of professionally-written viewing guides by season.
- Content creation is a _people_ problem, not a code problem. Decide: Rob writes? Hire a part-time astronomy writer? Community-submitted?

#### 2F. Billing (Stripe)

- Monthly ($6) + annual ($60) tiers.
- Trial-to-paid conversion events tracked.
- Revenue dashboard (admin-only).

#### 2G. Pro export

- 4K cinematic export (already prototyped in 1K).
- Watermark-free.
- Custom title / credit overlay for classroom / planetarium professional use.

### Risks / decisions for Phase 2

- **First backend.** Biggest operational step the project has taken. Rob needs to decide he's running a service, not a static site. Ops: uptime, backups, abuse handling, DMCA, GDPR. All real.
- **Content cost.** Curated plans are the differentiator but need a writer. Costs money or time.
- **Churn.** Viewing apps have weather-dependent usage — people cancel in winter. Mitigation: annual plans pitched as the primary option.
- **Scope creep.** Resist adding a social graph / public notebook feeds in v1 of Phase 2. Ship single-user notebooks first, add sharing once retention is proven.

---

## Sequencing summary

```
Phase 1 (free, no backend)
├── 1A Ambient bottom ring
├── 1B Location map picker
├── 1C Object-click cards
├── 1D Empty-sky reticle popover
├── 1E Settings drawer
├── 1F Events drawer
├── 1G Tonight's sky card
├── 1H Command palette
├── 1I Onboarding overlay
├── 1J Gesture polish
└── 1K Cinematic export  (depends on Plan 08 animation loop)

→ Ship Phase 1. Measure. Learn.

Phase 2 (paid, backend)
├── 2A Mode toggle + OG previews
├── 2B Backend + ADR           ← gate: Rob decides whether to go here
├── 2C Auth / accounts
├── 2D Notebook workspace
├── 2E Curated plans
├── 2F Stripe billing
└── 2G Pro export
```

### What this plan does NOT include

- Time animation loop (Plan 08 — `#136` is a predecessor for 1K and 1A keyboard scrubbing).
- Shadow / illumination refinements beyond what shipped in `#183`.
- Additional skycultures blocked by licensing (`#167` tail).
- Stellarium ephemeris depth (DE431, precession beyond what Astronomy Engine gives).

These stay tracked as separate issues.

---

## Next step

Rob says: looks good. start with everything in phase I marked ready and execute them in a sensible order using worktrees, tests!, prs. in parallel where reasonable.
