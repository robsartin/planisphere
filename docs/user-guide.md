# Planisphere User Guide

Planisphere is a live, interactive star chart that runs in your web browser. Point it at any place and time on Earth, and it shows you exactly what the sky looks like from there — stars (with true colors), planets, the Moon, the Sun, orbiting satellites, constellation stick figures, Messier deep-sky objects, the Milky Way, and more. No installation required.

---

## Overview

When you open Planisphere you are looking up at the sky as if lying flat on your back. The view is a full-hemisphere projection: the center of the screen is directly overhead (the zenith), and the edges of the view are the horizon in every direction. Compass labels (N, S, E, W) mark the cardinal directions along the horizon.

What you can see:

- **Stars** — colored dots whose color matches the star's real temperature (blue-white for hot stars, orange-red for cool ones). Brighter stars have larger dots.
- **Planets and Sun/Moon** — each rendered in a distinctive color (see [Reading the Sky](#reading-the-sky)).
- **Satellites** — bright green dots with a short trail showing direction of travel.
- **Constellation lines** — thin white lines connecting stars into familiar stick-figure patterns.
- **Constellation boundaries** — faint lines marking the official IAU borders between constellation regions.
- **Milky Way** — a soft glowing band across the sky.
- **Deep-sky objects** — Messier catalog galaxies, nebulae, and clusters, shown as small violet markers.
- **RA/Dec grid** — optional celestial coordinate gridlines.
- **Ecliptic** — the path the Sun traces through the sky across the year; planets stay close to this line.
- **Compass** — cardinal direction labels at the horizon.

---

## Getting Started

Open the Planisphere URL in any modern web browser. By default you are standing at **latitude 0°, longitude 0°** (the Gulf of Guinea, off the west coast of Africa) looking straight up at the zenith. The time defaults to **right now** — whenever you load the page — so the sky and upcoming events are both tied to the present moment. (You can pin a specific moment by putting a `t=` parameter in the URL.)

The star chart renders immediately. After a moment, satellites appear — they are loaded from a live orbital data source, so they need a brief download.

**First visit** — a short onboarding tour points at the pieces of the chrome you'll use most. Click **Next** to walk through it or **Skip** to dismiss. You can [replay it any time](#onboarding-tour) from the Help modal.

**To make the chart useful for your own location:** click the **📍 location chip** at the bottom of the screen and pick a city (or type your own coordinates), or run **📍 Now** from the Command Palette (see below) to set both time and GPS in one action.

---

## Chrome at a glance

Planisphere is sky-first: the star chart fills the whole window and the UI hangs off the edges rather than covering it.

- **Bottom HUD** — a thin strip at the bottom holds the time readout, the location chip, and a compass. Drag or use the keyboard to move time; the HUD dims out of the way when you're not touching it.
- **Top-right panel** — search box, location entry, view-direction controls, and telescope FOV. The panel header holds a row of icon buttons that open drawers, modals, and other utilities.
- **Drawer rail** — the icon buttons in the panel header open four side drawers plus a mode toggle: 📅 upcoming events, ⚙ settings, ♀ tonight's sky, ? help, and 🌃 ↔ 📓 planetarium/notebook.
- **Command palette (⌘K / Ctrl+K)** — a fuzzy-searched action bar that reaches every object, event, city, and setting. Faster than hunting through drawers once you know what you want.
- **Overlays** — location picker (fullscreen), object cards (float next to a clicked object), and the empty-sky popover (small readout wherever you click on empty sky).

The rest of this guide walks each of those surfaces in turn.

---

## Bottom HUD

The **bottom HUD** is the primary time and location surface. It sits pinned to the bottom edge of the screen.

Layout, left → right:

- **📍 location chip** — the current lat/lon and (if known) the nearest city name. Click it to open the fullscreen [Location Picker](#location-picker).
- **Time readout** — the current chart time in your computer's local timezone, plus a compact date. This is also the **scrub handle**.
- **▶ / ⏸ animation toggle** — plays the sky forward at accelerated time. Press again to pause. See also the Space key below.
- **Compass rose** — a mini north-up compass showing which way the camera is aimed.

### Scrub time with drag

Drag the time-readout region left or right to move the clock backwards or forwards. The sensitivity is **1 minute per pixel**, so a short drag nudges a few minutes and a long drag covers hours. The sky updates live as you drag.

### Keyboard time controls

Time also responds to the arrow keys anywhere on the page:

| Key                           | Effect                |
| ----------------------------- | --------------------- |
| **←** / **→**                 | ±1 minute             |
| **Shift + ←** / **Shift + →** | ±1 hour               |
| **Alt + ←** / **Alt + →**     | ±1 day                |
| **Space**                     | Toggle time animation |

Keyboard arrows also work in text fields inside the panel, but they only move the caret there — click the sky (or click empty space outside a control) first if you want the arrows to step time.

### Auto-dim

If you don't touch the mouse or keyboard for **~2 seconds**, the HUD fades to 20% opacity so it doesn't distract from the sky. Any pointer movement or keystroke wakes it back to full opacity.

---

## Drawer rail

The panel header at the top-right holds a row of icon buttons. Each one either flips a mode, opens a modal, or slides in a side drawer:

| Icon      | Opens                                                                 |
| --------- | --------------------------------------------------------------------- |
| **🔴**    | Toggles [Night vision](#night-vision) mode.                           |
| **🔗**    | Copies the current URL to your clipboard.                             |
| **📅**    | [Upcoming Events](#upcoming-events) drawer.                           |
| **♀**    | [Tonight's Sky](#tonights-sky) drawer.                                |
| **?**     | [Help modal](#help-modal) (this guide).                               |
| **⚙**    | [Settings drawer](#settings) — visibility, opacity, filters, display. |
| **🌃/📓** | [Planetarium ↔ Notebook](#notebook-mode-pro) mode toggle.            |
| **−/+**   | Collapse or expand the panel body.                                    |

Only one drawer is open at a time; opening a new one closes any drawer that's already open. Press **Esc** to close the current drawer.

---

## Command palette

Press **⌘K** (macOS) or **Ctrl+K** (Windows/Linux) anywhere on the page to open the command palette — a floating search bar in the middle of the screen. Press the same shortcut again, or press **Esc**, to close it.

The palette fuzzy-matches across:

- **Objects** — every star, constellation, planet, Solar System body, satellite, and Messier deep-sky object in the current chart.
- **Upcoming events** — every entry that would appear in the 📅 drawer (conjunctions, lunar eclipses, meteor-shower peaks, ISS passes).
- **Places** — the built-in city presets that also appear in the Location Picker.
- **Actions and settings** — one-shot actions like "📍 Now" (set time and GPS location), "Copy link", "Toggle night vision", and jumps to individual settings sections.

Results are ranked and grouped by kind. Keyboard controls:

| Key       | Effect                          |
| --------- | ------------------------------- |
| **↑ / ↓** | Move highlight up / down.       |
| **Enter** | Execute the highlighted result. |
| **Esc**   | Close the palette.              |

### Recents

Your **last 10 selections** are remembered locally and shown at the top of the palette when you open it with no query. They persist across page loads (stored in `localStorage` under `planisphere.palette.recents.v1`). This is the fastest way to jump back to a target you've been watching all evening.

---

## Search

The panel also carries a search box for objects — same catalog as the palette's object group, but scoped to it. Type at least two characters and a dropdown appears with matches. Click a result to swing the view toward that object. If the object is below the horizon, the view still rotates toward its compass direction — useful for "where will Jupiter rise?"

For anything beyond objects (events, cities, settings), reach for the [Command Palette](#command-palette) instead.

---

## Location

You have three ways to set your location:

- **Location chip in the bottom HUD** — click it to open the fullscreen [Location Picker](#location-picker) with a 24-city quick-pick grid, an in-line "Use my location" button, and lat/lon inputs.
- **📍 Now** — invoke this from the Command Palette to snap both time _and_ GPS position in one action. The first time you use it, your browser will prompt for location permission. If you deny or your browser has no GPS, only the time is updated.
- **Panel location controls** — lat/lon number inputs live in the top-right panel. Press Tab or Enter after each field to apply.

### Location Picker

The Location Picker is a fullscreen overlay with three columns:

- **Use my location** — one-click GPS.
- **Lat / Lon inputs** — precise coordinates. Values outside the valid range are clamped to −90/+90° latitude and −180/+180° longitude when you press **Set**.
- **City grid** — 24 built-in city presets (New York, London, Tokyo, Sydney, São Paulo, Cape Town, Los Angeles, Mumbai, Austin, and more). Clicking a city sets the location and closes the picker.

Close the picker with **Esc**, the **×** button, or by clicking the backdrop outside the panel.

---

## Time

The Bottom HUD is the main time control (see [Bottom HUD](#bottom-hud) above for scrub + keyboard). Additional time actions live in the Command Palette:

- **📍 Now** — jump to the current real-world time and request your location.
- **Now** — jump to the current real-world time only.

The date/time is always shown in your computer's local timezone.

---

## Upcoming Events

Click the **📅** icon in the panel header to open the **Upcoming Events** drawer.

Four kinds of events show up here, sorted by date:

- **Planetary conjunctions** — pairs of Solar System bodies (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn) that come within about 5° of each other. Looks ahead 30 days.
- **Lunar eclipses** — penumbral, partial, or total. Looks ahead one year.
- **Meteor-shower peaks** — annual showers (Perseids, Geminids, etc.) at their yearly peak. Looks ahead one year.
- **ISS passes** — upcoming International Space Station passes over your location. Looks ahead 48 hours. Requires your location to be set.

Each row shows a colored title, the event's local date and time, and a short description. The title color hints at the kind — blue for conjunctions, orange for lunar eclipses, green for meteor showers, yellow for ISS passes.

### Go to

Every event has a **Go to** button. Click it to:

1. Jump the chart's time to the event's peak moment.
2. Aim the camera at whatever's worth looking at:
   - **Conjunctions** — the midpoint between the two bodies.
   - **Lunar eclipses** — the Moon. (If the Moon is below your horizon at peak, the view still rotates that way — you'll see empty sky where it would be.)
   - **Meteor showers** — the radiant (the point the meteors appear to streak away from).
   - **ISS passes** — the peak-altitude point of the pass.

Meteor showers use **~03:00 on the peak day in your local time**, not midnight UTC — that's closer to when the radiant is highest for most observers under dark skies.

### ISS pass details

ISS rows carry extra information:

- The title includes an **estimated visual magnitude at peak**, e.g. _"ISS pass — mag −3.1, peaks at 68°"_. Lower (more negative) numbers are brighter; anything brighter than about mag 0 is a very easy naked-eye pass.
- Passes where the station is **in Earth's shadow** at peak stay in the list but render at **50% opacity** so you can tell at a glance they're not visible. Their title reads _"ISS pass — in Earth's shadow (42° peak)"_ and the description calls out that the satellite won't be lit.

If no events match the lookahead windows for your location, the drawer shows "No upcoming events."

---

## Tonight's Sky

Click the **♀** icon in the panel header to open **Tonight's Sky** — a drawer that lists all seven Solar System bodies with:

- **Name** — colored to match its dot on the chart. Names of bodies currently **above the horizon are clickable** — click to swing the view onto that body. Bodies below the horizon show "↓ below" in grey and are not clickable.
- **Alt / Az** — where it is in your sky right now.
- **Rise / Set times** — local times for the current day. `↑ HH:MM` is the rise time, `↓ HH:MM` is the set time. If a body does not rise or set on the chosen date (e.g. circumpolar, or the Sun at high latitudes in summer) the field shows `--`.
- **Show path / Hide path** — for above-horizon bodies only. Click **Show path** to draw a future trail across the sky showing where that body will be over the next four hours (sampled every five minutes). The button changes to **Hide path** while the trail is displayed; only one trail can be shown at a time. The trail is not saved in the URL.

---

## Settings

Click the **⚙** icon in the panel header to open the **Settings** drawer. Controls are organised into four tabs across the top of the drawer:

- **Visibility** — layer toggles for stars, planets, satellites, compass, and deep-sky.
- **Opacity** — sliders for the line-like layers (constellation lines, constellation boundaries, satellite trails, RA/Dec grid, ecliptic, Milky Way).
- **Filters** — the **Mag ≤** star-magnitude cutoff.
- **Display** — constellation-name language and skyculture (asterism set).

The drawer **remembers the last-open tab** across reloads (stored in `localStorage` under `planisphere.settings.lastSection.v1`). Reopening Settings snaps back to whichever tab you were last using.

### Visibility

Each checkbox shows or hides a whole layer independently:

- **Stars ☆** — the star field
- **Planets ☾** — Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn
- **Satellites 🛰** — orbiting satellites with motion trails
- **Compass ◎** — cardinal direction labels at the horizon
- **Deep Sky ✦** — Messier catalog galaxies, nebulae, and clusters

### Opacity

Six sliders control the visibility of line-like overlays. Each runs 0–100; drag to 0 to hide the layer entirely, or anywhere in between to ease it back.

- **Constellation Lines** — stick-figure outlines
- **Constellation Boundaries** — IAU region borders
- **Satellite Trails** — motion trails drawn behind each satellite
- **RA/Dec Grid** — right-ascension / declination celestial grid
- **Ecliptic** — the Sun's annual path (a good reference for finding planets)
- **Milky Way** — the bright galactic band

### Filters

The **Mag ≤** slider controls how dim a star has to be before it drops out of the chart. Drag left toward `Mag ≤ 1.0` to keep only the brightest stars (a minimal view, good for learning constellations); drag right toward `Mag ≤ 6.0` to show everything down to the naked-eye limit.

### Display

**Constellation Names (language)** sets the language used for constellation labels on the Western (IAU) asterism set:

- **Latin** (default — e.g. _Ursa Major_)
- **English** (_Great Bear_)
- **中文** (Chinese)
- **العربية** (Arabic)
- **Ελληνικά** (Greek)

Star names and planet names stay in their conventional English/Latin form regardless of this setting.

Language overrides are only defined for the Western asterism set. If you change the language while viewing a non-Western skyculture, the **Skyculture** dropdown snaps back to _Western (IAU)_ automatically — that's the only set whose constellation IDs the language files know how to rename. Switch back to a non-Western skyculture whenever you like; the labels there are always shown in the culture's own language.

**Skyculture** chooses which set of stick-figure asterisms is drawn on top of the star field. Every culture names and connects the stars differently, so this is a one-click way to see the same sky through a different tradition.

Options:

- **Western (IAU)** — the familiar 88 IAU constellations (default). Respects the Constellation Names language dropdown.
- **Chinese (Xingguan) 星官** — Chinese star mansions / officials. Labels in Chinese.
- **Indian (Vedic) वैदिक** — Vedic asterisms. Labels in Devanagari.
- **Norse (Edda)** — figures from the Poetic and Prose Edda.
- **Hawaiian Starlines** — the four Polynesian voyaging starlines.
- **Māori** — Māori constellations. Labels in te reo Māori.

Non-Western skycultures display names in the culture's own language — they don't use the Constellation Names language dropdown.

---

## View Direction

By default the chart looks straight up (zenith). The panel's **View Direction** section lets you turn toward any part of the sky.

**Preset buttons** snap to common directions:

- **Zenith** — straight up
- **N** — looking north at about 30° altitude
- **E** — looking east at about 30° altitude
- **S** — looking south at about 30° altitude
- **W** — looking west at about 30° altitude

Below the buttons are two number inputs for precise aiming:

- **Az** (azimuth, 0–360°): 0° = north, 90° = east, 180° = south, 270° = west.
- **Alt** (altitude, 0–90°): 0° = horizon, 90° = straight up.

You can also drag on the sky view itself with the mouse to swing the view around. Pinch (touchpad) or scroll the wheel to zoom; double-tap or double-click resets the camera.

---

## Telescope FOV Reticle

The **Telescope FOV** dropdown (in the panel) overlays a circular reticle in the center of the screen at a real-world field-of-view size. Use it to see how much sky you would actually catch through common optics.

Options:

- **Off** — no reticle (default).
- **Naked eye (5°)**
- **Binoculars (7°)**
- **Small scope (1°)**
- **Large scope (0.5°)**

Combined with the View Direction controls, this is a quick way to plan what a given instrument will show when pointed at a specific target.

---

## Object cards

Click any object on the sky — a star, planet, satellite, deep-sky object, or constellation — to **pin** an info card next to it. The card stays open as you pan around, and it follows its object as time advances. Multiple cards can be open at once; each has an **×** to close it.

Each card shows the object's identifying attributes (see [Reading the Sky](#reading-the-sky) for what appears per kind) plus a small row of actions along the bottom:

- **Pin** — copies the object's ID into a URL-persisted pin so it survives a reload.
- **Trail** — for solar-system bodies, draws the same 4-hour forward path Tonight's Sky offers.
- **Go to peak** — when an upcoming event references this object (e.g. an ISS pass), jumps time and view to the peak instant.
- **Copy link** — copies a URL that frames the sky on this object.

### Empty-sky popover

Click on **empty sky** (no object under the cursor) and a small **reticle popover** appears at the click point. It shows the alt/az of the point you clicked and offers a **Look here** action to rotate the camera onto that spot. Use it as a fast way to say "aim exactly there" without hunting for the closest catalog object.

---

## Night Vision

Click the **🔴** button in the panel header to toggle night vision mode. The whole page (including the star chart) is filtered to deep red, which preserves dark adaptation when you're using Planisphere out under the sky on a phone or laptop.

Click the button again to return to full color. The setting is preserved in the URL (`?nv=1`), so shared links can open already in night-vision mode.

---

## Copy Link

Click the **🔗** button in the panel header to copy the current URL to your clipboard. The button briefly changes to "Copied!" to confirm.

Because Planisphere keeps every setting in the URL (time, location, view direction, layers, opacities, magnitude limit, night vision, language, skyculture, telescope FOV), the copied link reproduces the exact view you see when opened in any browser.

---

## Help modal

Click the **?** icon in the panel header to open the **Help** modal. It renders this same user guide inline so you can browse it without leaving the page.

Two extras live in the help modal:

- **Replay tour** — restart the [onboarding tour](#onboarding-tour) even if you dismissed it on your first visit.
- **About / license / links** — Apache 2.0 license, GitHub link, and short attribution for data sources.

Press **Esc** or click outside the modal to close it.

---

## Onboarding tour

The first time you open Planisphere, a short **onboarding tour** walks you through the pieces of the chrome you'll use most (Bottom HUD, panel, drawer rail, command palette). Each step highlights one region with a spotlight and shows a card explaining it.

Controls:

- **Next** / **Back** — step through the tour.
- **Skip** or **Esc** — dismiss the tour and remember not to show it again.

The dismissal is stored in `localStorage` under `planisphere.onboarding.v1`. If you clear the key (or open the app in a fresh browser profile) the tour will run again on the next visit. You can also **Replay tour** from the Help modal at any time.

---

## Notebook mode (Pro)

Planisphere ships with a second mode: **Notebook**. It's a personal notebook where you can jot observing notes tied to specific objects and moments, and pull them back up later. Notebook mode is a Pro feature — free users can preview the editor, and Pro users get save/load.

### Entering Notebook mode

Click the **🌃 / 📓** toggle in the panel header. The icon shows the current mode (🌃 = Planetarium, 📓 = Notebook), and clicking it flips.

If you're not signed in as Pro, clicking 🌃 opens a **Sign in** modal instead of switching modes. Signing in is a magic-link email flow — see below.

Once you're in Notebook mode, the panel shrinks and a notebook workspace opens next to the sky. The sky stays live behind it, so you can keep observing while writing.

### Magic-link sign-in

The sign-in modal asks for your email address. Submit it and:

1. Planisphere sends you an email with a one-tap sign-in link (via [Resend](https://resend.com)).
2. Click the link on the same device (or copy it into the Planisphere tab).
3. You're signed in. Session cookies are HMAC-signed and stored server-side in Cloudflare D1.

No password to remember; no third-party OAuth. You can sign out from the Help modal or by clearing the session cookie.

### Writing notes

The notebook editor is a rich-text surface (tiptap / ProseMirror) with standard formatting shortcuts — bold, italic, headings, bullet lists, code blocks. The editor autosaves as you type; there's no "Save" button to hunt for.

### `@` mentions

Type **`@`** anywhere in a note to open the **mention popover**. It searches across:

- **`@body`** — Solar System bodies (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn).
- **`@constellation`** — all 88 IAU constellations.
- **`@event`** — annual meteor-shower peaks.

Pick a result and a mention chip is inserted inline. Mentions link back to Planisphere: hover one and you can jump the sky to that object; click the follow-through action to open the corresponding card.

### Free vs Pro

Free users can open Notebook mode and try the editor, but the workspace runs in **preview mode** — a small "Pro" pill is shown next to gated affordances (e.g. **Insert link to this view**), and saved notebooks are not persisted. Signing in as Pro removes the gate. See the pricing page linked from the sign-in modal for current availability.

---

## Reading the Sky

**Stars** are shown in their natural color, mapped from each star's B−V color index:

| Color         | Spectral type | Examples              |
| ------------- | ------------- | --------------------- |
| Blue-white    | O, B          | Rigel, Spica          |
| White         | A             | Sirius, Vega          |
| Yellow-white  | F             | Procyon               |
| Yellow        | G             | Sun, Alpha Centauri A |
| Yellow-orange | K             | Arcturus, Aldebaran   |
| Orange-red    | M             | Betelgeuse, Antares   |

Size corresponds to brightness: magnitude −1 stars like Sirius show as large dots, while magnitude 6 stars (the faintest naked-eye limit) show as tiny specks. The chart renders only stars above the horizon. Use the **Mag ≤** slider in Settings → Filters to filter out dim stars you don't want to see.

**Planets** each have a distinctive color so you can tell them apart at a glance:

- **Sun** — large golden-yellow glow
- **Moon** — pale white, shaped as a crescent that matches its current phase
- **Venus** — pale yellow-white
- **Mars** — red-orange
- **Jupiter** — warm pinkish-white
- **Saturn** — golden tan
- **Mercury** — muted gray-pink

**Satellites** appear as small bright green dots, each with a short trail behind it showing direction of travel.

**Constellation lines** are thin white lines forming familiar connect-the-dots patterns. They are drawn at a lower opacity than stars so they don't overwhelm the view.

**Constellation boundaries** are even fainter lines that mark the official IAU rectangular borders between constellation regions.

**Milky Way** appears as a soft glowing band arching across the sky. Drag the Milky Way opacity slider (Settings → Opacity) to taste.

**Messier deep-sky objects** appear as small violet markers. Hover one for its name and catalog number (e.g. "M31 — Andromeda Galaxy").

**RA/Dec grid** (when enabled) is a web of right-ascension and declination lines — the celestial equivalent of latitude/longitude. Useful for verifying a coordinate by eye.

**Ecliptic** is the single highlighted curve where the Sun, Moon, and planets travel. Good shortcut for scanning a planet-friendly strip of sky.

**Compass** labels appear at the horizon edge of the view: N, S, E, W. They help you orient the chart to the real sky.

### Object card content

Click any object to open a card next to it (see [Object cards](#object-cards)). What each kind shows:

**Star card:**

- Name (or HIP catalog number if the star has no common name)
- Magnitude
- Alt / Az (current sky position)
- RA / Dec (fixed celestial coordinates)

**Planet / body card:**

- Name
- Magnitude
- Alt / Az
- RA / Dec
- For the Moon: percentage of the disk that is illuminated
- Rise / Set for the current day (when the observer location is set)

**Satellite card:**

- Name
- NORAD catalog ID
- Alt / Az
- Orbital altitude in kilometers
- Orbital velocity in km/s

**Deep-sky card:**

- Messier number and name (e.g. "M42 — Orion Nebula")
- Type (galaxy, nebula, open cluster, globular cluster, …)
- Magnitude
- Alt / Az
- RA / Dec

**Constellation card:**

- Name
- Centroid alt / az
- Count of visible connecting lines

---

## URL Parameters

You can link directly to a specific sky view by adding parameters to the URL. This is handy for bookmarking your backyard, sharing a sky event with a friend, or embedding a particular moment in a blog post.

| Parameter | What it does                            | Example                        |
| --------- | --------------------------------------- | ------------------------------ |
| `lat`     | Observer latitude, −90 to +90           | `lat=30.27`                    |
| `lon`     | Observer longitude, −180 to +180        | `lon=-97.74`                   |
| `t`       | UTC date/time (ISO 8601)                | `t=2026-08-12T03:00:00.000Z`   |
| `layers`  | Comma-separated list of visible layers  | `layers=stars,planets,compass` |
| `op_cl`   | Constellation Lines opacity, 0–100      | `op_cl=50`                     |
| `op_cb`   | Constellation Boundaries opacity, 0–100 | `op_cb=30`                     |
| `op_st`   | Satellite Trails opacity, 0–100         | `op_st=75`                     |
| `op_grid` | RA/Dec Grid opacity, 0–100              | `op_grid=40`                   |
| `op_ecl`  | Ecliptic opacity, 0–100                 | `op_ecl=60`                    |
| `op_mw`   | Milky Way opacity, 0–100                | `op_mw=50`                     |
| `vaz`     | View azimuth, 0–360°                    | `vaz=180`                      |
| `valt`    | View altitude, 0–90°                    | `valt=45`                      |
| `mag`     | Star magnitude limit, 1.0–6.0           | `mag=4`                        |
| `lang`    | Constellation-name language             | `lang=en`                      |
| `fov`     | Telescope FOV reticle preset            | `fov=binoculars`               |
| `sky`     | Skyculture / asterism set               | `sky=chinese`                  |
| `nv`      | Night vision (`1` = on)                 | `nv=1`                         |

**Layer names for the `layers` parameter:** `stars`, `planets`, `satellites`, `compass`, `deepSky`. Omit the parameter to show every layer; include it to show only the layers you list.

**Language codes for `lang`:** `la` (Latin, default), `en` (English), `zh` (Chinese), `ar` (Arabic), `el` (Greek).

**FOV preset ids for `fov`:** `off` (default), `naked-eye`, `binoculars`, `small-scope`, `large-scope`.

**Skyculture ids for `sky`:** `western` (default), `chinese`, `indian`, `norse_edda`, `hawaiian_starlines`, `maori`.

Opacity values are integers 0 (invisible) to 100 (full opacity). If you omit an opacity parameter, it uses the default shown on the slider.

If you omit `t`, the chart opens at the current moment rather than a fixed date. Leave `t` out of shared links when you want the recipient to see "the sky right now from this location" instead of a specific instant.

The easiest way to build a URL is just to set things how you want them in the UI and hit **🔗 Copy link**.

**Examples:**

Austin, Texas, stars and planets only, no constellation clutter, with binoculars FOV:

```
?lat=30.27&lon=-97.74&t=2026-04-15T04:00:00.000Z&layers=stars,planets,compass&fov=binoculars
```

London at night with night vision enabled and constellation names in English:

```
?lat=51.51&lon=-0.13&t=2026-04-15T22:00:00.000Z&nv=1&lang=en
```

Tokyo, looking east at 30° altitude, faint stars filtered out:

```
?lat=35.69&lon=139.69&t=2026-04-15T18:30:00.000Z&vaz=90&valt=30&mag=4
```

---

## Tips

**Fastest way to a target** — ⌘K, type the first few letters, hit Enter. The command palette reaches every object, event, city, and setting; use it in place of hunting through drawers.

**Best time to see satellites** — Satellites are only visible when sunlight catches them. This happens in the hour or so after sunset or before sunrise, when the sky is dark but the satellite is still in sunlight high above you. During the middle of the night or the middle of the day, satellites are either in Earth's shadow or lost in the daytime glare.

**Finding ISS passes** — Set your location (📍 chip, then either "Use my location" or a city preset). Any ISS passes in the next 48 hours show up in the 📅 drawer with an estimated brightness and peak altitude. Click **Go to** on a pass to jump the chart to peak and aim the camera at the right spot. Passes rendered at 50% opacity are in Earth's shadow — real but invisible — so skip those and pick a brighter one. You can also type "ISS" into the palette or search box.

**Scrubbing an event** — After a **Go to**, drag the bottom HUD time readout to watch the event unfold either side of peak. 1 minute per pixel is small enough for a conjunction and coarse enough for a pass.

**Planning through an eyepiece** — Pick your telescope's FOV from the Telescope FOV dropdown, search for your target (palette or panel search), click the result, and you'll see exactly what the eyepiece will frame.

**Reducing clutter** — Drag the Constellation Lines and Boundaries sliders (Settings → Opacity) to 0 if you just want stars. Or use **Mag ≤** in Settings → Filters to filter out faint stars so only the bright ones remain, which makes constellations easier to learn.

**Finding planets** — Turn the Ecliptic opacity up (Settings → Opacity). Every planet sits near that line. Combined with Tonight's Sky rise/set times, that's enough to plan when and where to look.

**Sharing a sky event** — After you set things the way you want, click **🔗** in the panel header to copy the URL. Anyone you share that link with will see the exact same sky.

**Using outdoors** — Toggle 🔴 night vision mode once you're dark-adapted. All of the UI and the sky chart go deep red so the screen doesn't wreck your night vision. The bottom HUD auto-dims after 2 seconds of inactivity, so once your view is set the screen goes almost quiet on its own.

**Keeping a log** — Turn on Notebook mode (🌃 → 📓 in the panel header) and jot what you saw. `@Jupiter` or `@Orion` in your notes creates a mention chip that jumps back to the object next time you open the notebook.

---

## Screenshots

Screenshots throughout this guide are captured from the current release. The gallery below is a snapshot of the main surfaces; individual sections above may reference more targeted captures. Some captures are still pending after the Phase 1 chrome refactor and are marked _pending_ inline — please file an issue if any screenshot is clearly stale.

### Default view

_Placeholder — screenshot of the default zenith view at lat 0, lon 0 with the current sky-first chrome._

### Sky-first chrome

_Placeholder — screenshot highlighting the bottom HUD, top-right panel, and drawer rail all visible at once._

### Different locations

_Placeholder — comparison screenshots from Austin, TX and Sydney, Australia showing how the sky orientation changes by hemisphere._

### Notebook mode

_Placeholder — screenshot of Notebook mode with the sky in the background and an active editor with a couple of `@` mentions._
