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

Open the Planisphere URL in any modern web browser. By default you are standing at **latitude 0°, longitude 0°** (the Gulf of Guinea, off the west coast of Africa) looking straight up at the zenith. The time defaults to **right now** — whenever you load the page — so upcoming events and the sky are both tied to the present moment. (You can still pin a specific moment by putting a `t=` parameter in the URL.)

The star chart renders immediately. After a moment, satellites appear — they are loaded from a live orbital data source, so they need a brief download.

The interface is deliberately sky-first. Apart from a thin **bottom HUD** (time, location, compass) and a small **top-right panel** of icon buttons, everything else lives behind drawers that open only when you need them. The quickest way to make the chart useful is either:

- Click the **📍 location chip** in the bottom-left corner to open a fullscreen location picker, or
- Press **⌘K** (macOS) or **Ctrl+K** (Windows/Linux) to open the [Command Palette](#command-palette) and type what you're looking for.

First-time visitors see a short [onboarding tour](#onboarding-tour) highlighting the core surfaces.

---

## The Interface

Planisphere arranges controls around the sky, not on top of it:

- **Bottom HUD** — the ambient bar across the bottom of the screen. Shows the current time (UTC + local), observer coordinates, and compass readout. Drag the center to scrub time; click the location chip to change observer; use keyboard shortcuts for everything else.
- **Top-right panel** — a small header with icon buttons that open drawers and toggles, plus a body with search, location, view-direction, and telescope FOV controls. The `−` button collapses the body if you want only the icon rail visible.
- **Drawers** — slide-in surfaces for settings, upcoming events, tonight's sky, help, and (Pro) the Notebook. Only one drawer is open at a time — opening another closes the current one.
- **Command palette (⌘K)** — the fastest way to jump to an object, event, city, or setting without touching the panel.

![Interface overview](./screenshots/interface-overview.png)

_(Screenshot pending — the legacy screenshots were captured before the sky-first redesign and are being re-taken.)_

---

## Bottom HUD

The HUD is a single row at the bottom of the viewport:

- **📍 Location chip** (bottom-left) — shows the current observer latitude/longitude. Click to open the fullscreen **location picker** with "Use my location", lat/lon inputs, and a 24-city quick-pick grid.
- **Time readout** (center) — two lines showing UTC time and the browser-local time.
- **Compass readout** (bottom-right) — the cardinal direction and bearing your view is pointing toward, e.g. _N 12°_ or _SW 210°_.

### Drag-to-scrub time

Click and drag horizontally across the center area to move the chart through time. The scrub rate is approximately **1 minute per pixel**, so a typical full-width drag on a laptop display sweeps through about half an hour. Release to stop.

### Keyboard shortcuts

When no input field is focused, these keys control the chart globally:

| Key                            | Action                                       |
| ------------------------------ | -------------------------------------------- |
| `←` / `→`                      | Step time back / forward by **1 minute**     |
| `Shift + ←` / `Shift + →`      | Step time by **1 hour**                      |
| `Alt + ←` / `Alt + →`          | Step time by **1 day**                       |
| `Space`                        | Toggle real-time animation on/off            |
| `⌘K` (macOS) / `Ctrl+K` (else) | Open the [Command Palette](#command-palette) |

Keyboard shortcuts are suppressed while you're typing in a text box, select, textarea, or any contenteditable area, so the command palette's search input keeps its native arrow-key behaviour.

### Auto-dim

After **2 seconds of inactivity** the HUD fades to ~20% opacity so it never fights the sky. It restores to full opacity the moment you move the mouse, touch the screen, or press a key.

---

## Command Palette

Press **⌘K** (macOS) or **Ctrl+K** (Windows/Linux) anywhere in the app to open a single search box that spans the whole product. Press **Esc** to dismiss.

The palette searches, all together:

- **Objects** — stars (named or Hipparcos number), the 88 IAU constellations, the seven Solar System bodies (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn), satellites, and Messier deep-sky objects.
- **Upcoming events** — conjunctions, lunar eclipses, meteor-shower peaks, ISS passes. Selecting one jumps the time cursor and aims the camera, just like the **Go to** buttons in the events drawer.
- **Cities** — the 24 presets from the location picker. Selecting one snaps your observer coordinates to that city.
- **Settings and actions** — layer toggles, opacity levels, view-direction presets, language and skyculture choices, night-vision, copy-link, and similar.

Results are fuzzy-matched, ranked, and color-coded by category. Use the arrow keys (`↑` / `↓`) to move the selection and `Enter` to execute it.

The palette remembers your **last 10 selections** and surfaces them as "Recents" when you open it with an empty query — helpful for repeatedly hopping between the same few objects while you observe.

![Command palette](./screenshots/command-palette.png)

_(Screenshot pending.)_

---

## Onboarding Tour

On first visit Planisphere runs a short welcome tour that highlights:

1. Clicking an object to pin a card.
2. Dragging the bottom HUD to scrub time.
3. The top-right icon rail (events, settings, tonight, help).
4. Using the location chip to change observer.
5. Opening the command palette.

Use **Back** / **Next** to step through, or **Skip** / **Esc** to dismiss at any point. The dismissal is remembered in `localStorage` under the key `planisphere.onboarding.v1`, so subsequent visits start immediately without the tour.

You can re-run the tour from the Help modal (the `?` icon) using the **Replay tour** button.

---

## Top-right Panel

The top-right panel is the compact command center. The header is a rail of icon buttons; the body below it holds the controls you reach for most often.

### Icon rail

Left-to-right:

| Icon      | Button         | What it does                                                               |
| --------- | -------------- | -------------------------------------------------------------------------- |
| **🔴**    | Night vision   | Toggle deep-red filter (see [Night Vision](#night-vision)).                |
| **🔗**    | Copy link      | Copy the URL (every setting is reflected in it).                           |
| **📅**    | Events         | Open the **Upcoming events** drawer.                                       |
| **♀**    | Tonight        | Open the **Tonight's sky** drawer.                                         |
| **?**     | Help           | Open this help guide inside a modal, with a **Replay tour** button.        |
| **⚙**    | Settings       | Open the **Settings** drawer (layers, opacity, filters, display).          |
| **🌃/📓** | Mode toggle    | Switch between **Planetarium** and **Notebook** modes (Notebook is Pro).   |
| **−**     | Collapse panel | Hide the panel body (search / location / view / FOV); the icon rail stays. |

### Panel body

Below the icon rail you'll find, in order:

1. [Search](#search) — free-text jump-to-object.
2. [Location](#location) — lat/lon inputs and city presets.
3. [View Direction](#view-direction) — cardinal presets and explicit Az/Alt.
4. [Telescope FOV Reticle](#telescope-fov-reticle) — size a circle to your instrument's field of view.

Everything else has moved to drawers or the HUD.

![Top-right panel](./screenshots/top-right-panel.png)

_(Screenshot pending.)_

---

## Search

At the top of the panel body is a search box with the placeholder "Search stars, planets, satellites...".

Type at least two characters and a dropdown appears with matching objects. Each result shows:

- The object's **name**
- A small **type label** on the right (star / constellation / planet / satellite)
- **(below horizon)** in grey if the object is not currently above the horizon

Click any result to swing the view toward that object. If the object is above the horizon, the view rotates to face it. If the object is below the horizon the view still rotates toward its compass direction — useful for "where will Jupiter rise?"

The search covers the Hipparcos star catalog (named stars plus HIP numbers), all 88 IAU constellations, the seven Solar System bodies (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn), and every loaded satellite.

> **Tip:** The [Command Palette](#command-palette) is a superset of this search — plus events, cities, and settings — and is reachable from anywhere with **⌘K / Ctrl+K**.

---

## Location

Enter your **latitude** (−90 to +90, positive = north) and **longitude** (−180 to +180, positive = east) in the number fields in the panel body. Press Tab or Enter after each field to apply.

Below the number fields is a **City preset** dropdown with a list of built-in cities (New York, London, Tokyo, Sydney, São Paulo, Cape Town, Los Angeles, Mumbai, Austin, and many others). Selecting a city fills in the coordinates automatically.

### Location picker overlay

For the full experience — including "Use my location" GPS and the 24-city grid — click the **📍 location chip** in the bottom HUD. A fullscreen overlay opens with:

- **Use my location** — asks your browser for GPS and fills in the result. The first time you click this, the browser prompts for permission. If you deny or no GPS is available, nothing happens.
- **Lat / Lon inputs** — the same number fields as the panel, but bigger.
- **City quick-pick grid** — 24 commonly-used cities, tap one to snap.

Press **Esc** or click outside the overlay to dismiss it.

---

## View Direction

By default the chart looks straight up (zenith). This section lets you turn toward any part of the sky.

**Preset buttons** snap to common directions:

- **Zenith** — straight up
- **N** — looking north at about 30° altitude
- **E** — looking east at about 30° altitude
- **S** — looking south at about 30° altitude
- **W** — looking west at about 30° altitude

Below the buttons are two number inputs for precise aiming:

- **Az** (azimuth, 0–360°): 0° = north, 90° = east, 180° = south, 270° = west.
- **Alt** (altitude, 0–90°): 0° = horizon, 90° = straight up.

You can also drag on the sky view itself with the mouse to swing the view around. The compass readout in the bottom HUD updates to match.

---

## Telescope FOV Reticle

The **Telescope FOV** dropdown overlays a circular reticle in the center of the screen at a real-world field-of-view size. Use it to see how much sky you would actually catch through common optics.

Options:

- **Off** — no reticle (default).
- **Naked eye (5°)**
- **Binoculars (7°)**
- **Small scope (1°)**
- **Large scope (0.5°)**

Combined with the View Direction controls, this is a quick way to plan what a given instrument will show when pointed at a specific target.

---

## Settings Drawer

Click the **⚙ Settings** icon in the panel header to open the settings drawer. It organises display controls into **four collapsible sections**, each with a `▸` / `▾` chevron. Only one section is expanded at a time; click another header to swap. The drawer remembers the **last section you had open** across reloads (stored in `localStorage` under `planisphere.settings.lastSection.v1`).

### 1. Visibility

Each checkbox shows or hides a whole layer:

- **Stars ☆** — the star field
- **Planets ☾** — Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn
- **Satellites 🛰** — orbiting satellites with motion trails
- **Compass ◎** — cardinal direction labels at the horizon
- **Deep Sky ✦** — Messier catalog galaxies, nebulae, and clusters

### 2. Opacity

Six sliders control the visibility of line-like overlays. Each slider runs 0–100; drag to 0 to hide, or anywhere in between to ease it back.

- **Constellation Lines** — stick-figure outlines
- **Constellation Boundaries** — IAU region borders
- **Satellite Trails** — motion trails drawn behind each satellite
- **RA/Dec Grid** — right-ascension / declination celestial grid
- **Ecliptic** — the Sun's annual path (a good reference for finding planets)
- **Milky Way** — the bright galactic band

### 3. Filters

- **Mag ≤ slider** — controls how dim a star has to be before it drops out of the chart. Drag left toward `Mag ≤ 1.0` to keep only the brightest stars (good for learning constellations); drag right toward `Mag ≤ 6.0` to show everything down to the naked-eye limit.

### 4. Display

- **Constellation Names language** — sets the language used for Western (IAU) asterism labels:

  - **Latin** (default — e.g. _Ursa Major_)
  - **English** (_Great Bear_)
  - **中文** (Chinese)
  - **العربية** (Arabic)
  - **Ελληνικά** (Greek)

  Star and planet names stay in their conventional English/Latin form regardless of this setting. Language overrides are only defined for the Western asterism set; switching language while viewing a non-Western skyculture snaps the **Skyculture** dropdown back to _Western (IAU)_ automatically.

- **Skyculture** — choose which set of stick-figure asterisms is drawn on top of the star field:

  - **Western (IAU)** — the familiar 88 IAU constellations (default).
  - **Chinese (Xingguan) 星官** — Chinese star mansions / officials.
  - **Indian (Vedic) वैदिक** — Vedic asterisms.
  - **Norse (Edda)** — figures from the Poetic and Prose Edda.
  - **Hawaiian Starlines** — the four Polynesian voyaging starlines.
  - **Māori** — Māori constellations.

  Non-Western skycultures display names in the culture's own language and don't use the Constellation Names language dropdown.

![Settings drawer](./screenshots/settings-drawer.png)

_(Screenshot pending.)_

---

## Upcoming Events Drawer

Click the **📅 Events** icon in the panel header to open the **Upcoming events** drawer — a list of noteworthy things happening in the sky from your current chart location, sorted by date.

Four kinds of events show up here:

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

- The title includes an **estimated visual magnitude at peak**, e.g. _"ISS pass — mag -3.1, peaks at 68°"_. Lower (more negative) numbers are brighter; anything brighter than about mag 0 is a very easy naked-eye pass.
- Passes where the station is **in Earth's shadow** at peak are kept in the list but rendered at **50% opacity** so you can tell at a glance they're not visible. Their title reads _"ISS pass — in Earth's shadow (42° peak)"_ and the description calls out that the satellite won't be lit.

If no events match the lookahead windows for your location, the drawer shows "No upcoming events."

Events are also searchable from the [Command Palette](#command-palette) — selecting one there does the same thing as clicking **Go to**.

---

## Tonight's Sky Drawer

Click the **♀ Tonight** icon in the panel header to open the **Tonight's sky** drawer. It lists all seven Solar System bodies with:

- **Name** — colored to match its dot on the chart. Names of bodies currently **above the horizon are clickable** — click to swing the view onto that body. Bodies below the horizon show "↓ below" in grey and are not clickable.
- **Alt / Az** — where it is in your sky right now.
- **Rise / Set times** — local times for the current day. `↑ HH:MM` is the rise time, `↓ HH:MM` is the set time. If a body does not rise or set on the chosen date (e.g. circumpolar, or the Sun at high latitudes in summer) the field shows `--`.
- **Show path / Hide path** — for above-horizon bodies only. Click **Show path** to draw a future trail across the sky showing where that body will be over the next four hours (sampled every five minutes). The button changes to **Hide path** while the trail is displayed; only one trail can be shown at a time. The trail is not saved in the URL.

---

## Night Vision

Click the **🔴** button in the panel header to toggle night vision mode. The whole page (including the star chart) is filtered to deep red, which preserves dark adaptation when you're using Planisphere out under the sky on a phone or laptop.

Click the button again to return to full color. The setting is preserved in the URL (`?nv=1`), so shared links can open already in night-vision mode.

---

## Copy Link

Click the **🔗** button in the panel header to copy the current URL to your clipboard. The button briefly changes to "Copied!" to confirm.

Because Planisphere keeps every setting in the URL (time, location, view direction, layers, opacities, magnitude limit, night vision, language, skyculture, telescope FOV), the copied link reproduces the exact view you see when opened in any browser.

The palette action **Copy link** does the same thing.

---

## Notebook Mode (Pro)

Click the **🌃 / 📓** icon in the panel header to switch between **Planetarium** (the default sky view) and **Notebook** — a rich-text notepad that anchors personal notes to specific objects and moments in time. Notebook mode is a **Pro** feature.

### Signing in

The first time a non-Pro user clicks the Notebook toggle, a **login modal** opens asking for an email address. Enter your email and submit — the site sends a **magic link** to that address. Click the link in the email to complete sign-in; you'll be redirected back into Notebook mode with Pro unlocked on this browser.

- Session cookies are HMAC-signed and expire after a set period. The Worker refreshes them as you use the app.
- Sign-in state is per-browser. Signing in on your phone is independent of signing in on your laptop.
- Free users can **preview** the Notebook editor (the UI loads and you can type) but **save / load / mentions** are gated — they prompt for login.

### Writing notes

The Notebook editor is a [tiptap](https://tiptap.dev/) rich-text surface with the usual keyboard-native editing: bold, italic, headings, lists, blockquotes. Each note is anchored to the current observer and time, so "10 pm from my backyard" stays meaningful even as the chart moves on.

### @mentions

Type `@` anywhere in a note to open the **mention popover**. Start typing an object or event name and the popover narrows the list. Three kinds of mentions are supported:

- **@body** — a Solar System body (e.g. `@Jupiter`, `@Moon`).
- **@constellation** — any of the 88 IAU constellations.
- **@event** — an upcoming event from the events drawer (e.g. an ISS pass or lunar eclipse).

Inserted mentions become clickable chips inside the note — clicking one in a saved note restores the corresponding observer time and camera direction.

### Where notes are stored

Notebook data lives on the server in **Cloudflare D1** (SQLite at the edge), accessed through a Cloudflare Worker behind the same magic-link auth. Notes are private to your account. See [ADR 009](../docs/adr/009-backend-selection.md) for the architecture and [ADR 013](../docs/adr/013-notebook-editor.md) for the editor choice.

Switching back to 🌃 Planetarium at any time returns you to the sky view; your notes stay where they are.

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

Size corresponds to brightness: magnitude −1 stars like Sirius show as large dots, while magnitude 6 stars (the faintest naked-eye limit) show as tiny specks. The chart renders only stars above the horizon. Use the **Mag ≤** slider in the Settings drawer (Filters tab) to filter out dim stars you don't want to see.

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

**Milky Way** appears as a soft glowing band arching across the sky. Drag its opacity slider (Settings → Opacity) to taste.

**Messier deep-sky objects** appear as small violet markers. Hover one for its name and catalog number (e.g. "M31 — Andromeda Galaxy").

**RA/Dec grid** (when enabled) is a web of right-ascension and declination lines — the celestial equivalent of latitude/longitude. Useful for verifying a coordinate by eye.

**Ecliptic** is the single highlighted curve where the Sun, Moon, and planets travel. Good shortcut for scanning a planet-friendly strip of sky.

**Compass** labels appear at the horizon edge of the view: N, S, E, W. The bottom HUD also shows your current heading numerically.

---

## Object Cards

Move your mouse over any object to see a small **hover card**. Move the mouse away and it disappears.

**Click** any object to **pin** an object card — a slightly larger card with a close button (×) that stays on screen while you pan around. Multiple pinned cards can stay open at once, and each card follows its object as time advances. Hover cards are suppressed while pinned cards exist near the pointer.

Click empty sky to drop a small reticle popover showing the direction readout and a **Look here** action — useful for bookmarking arbitrary points in the sky rather than specific objects.

Object-card content by kind:

**Star card:**

- Name (or HIP catalog number if the star has no common name)
- Magnitude
- Alt / Az (current sky position)
- RA / Dec (fixed celestial coordinates)

**Planet card:**

- Name
- Magnitude
- Alt / Az
- RA / Dec
- For the Moon: percentage of the disk that is illuminated

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

- Name (in the currently selected language / skyculture)
- A short description when available

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

**Best time to see satellites** — Satellites are only visible when sunlight catches them. This happens in the hour or so after sunset or before sunrise, when the sky is dark but the satellite is still in sunlight high above you. During the middle of the night or the middle of the day, satellites are either in Earth's shadow or lost in the daytime glare.

**Finding ISS passes** — Set your location (the 📍 chip is the fastest route) and open the **📅 Events** drawer. Any ISS passes in the next 48 hours show up there with an estimated brightness and peak altitude. Click **Go to** on a pass to jump the chart to peak and aim the camera at the right spot. Passes rendered at 50% opacity are in Earth's shadow — real but invisible — so skip those and pick a brighter one. You can also type "ISS" into the command palette (⌘K) to jump straight to the satellite.

**Planning through an eyepiece** — Pick your telescope's FOV from the panel body, search for your target (command palette or search box), click the result, and you'll see exactly what the eyepiece will frame.

**Reducing clutter** — Open Settings → Opacity and drag the Constellation Lines and Boundaries sliders to 0 if you just want stars. Or use Settings → Filters → Mag ≤ to drop faint stars so only the bright ones remain, which makes constellations easier to learn.

**Finding planets** — Turn the Ecliptic opacity up in Settings → Opacity. Every planet sits near that line. Combined with Tonight's Sky rise/set times, that's enough to plan when and where to look.

**Keyboard scrubbing** — The `←` / `→` arrows step time by one minute; add `Shift` for hours, `Alt` for days. Hold one down to race through — the sky animates as it goes. `Space` toggles real-time animation on/off.

**Sharing a sky event** — After you set things the way you want, click **🔗** in the panel header to copy the URL. Anyone you share that link with will see the exact same sky.

**Using outdoors** — Toggle **🔴 night vision** once you're dark-adapted. All of the UI and the sky chart go deep red so the screen doesn't wreck your night vision.

---

## Screenshots

_Screenshots are being re-captured to match the current sky-first layout. The placeholders above refer to the next round of captures; until they land, use the app itself (or the [architecture diagrams](./architecture.md)) as a visual reference._

### Pending captures

- **Interface overview** — the default zenith view with bottom HUD, top-right panel, and a drawer open.
- **Bottom HUD** — close-up of the location chip, time readout, and compass.
- **Command palette** — open with a few recents visible.
- **Onboarding tour** — a representative step (e.g. step 2: "Drag the time bar").
- **Settings drawer** — with the Opacity section expanded.
- **Events drawer** — with one of each event kind, including a shadowed ISS pass at 50% opacity.
- **Tonight's sky drawer** — with a trail drawn for one planet.
- **Notebook mode** — the editor with a couple of `@mentions` inserted.
- **Night vision** — the whole page filtered to red.
- **Skyculture comparison** — Western vs one non-Western skyculture side-by-side.
- **Daytime vs dark sky** — same location, noon vs midnight.
- **Different locations** — Austin, TX and Sydney, Australia at the same instant.
