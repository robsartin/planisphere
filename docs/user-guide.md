# Planisphere User Guide

Planisphere is a live, interactive star chart that runs in your web browser. Point it at any place and time on Earth, and it shows you exactly what the sky looks like from there — stars (with true colors), planets, the Moon, the Sun, orbiting satellites, constellation stick figures, Messier deep-sky objects, the Milky Way, and more. No installation required.

---

## Overview

When you open Planisphere you are looking up at the sky as if lying flat on your back. The view is a full-hemisphere projection: the center of the screen is directly overhead (the zenith), and the edges of the view are the horizon in every direction.

The screen is deliberately uncluttered — the sky fills the whole viewport. Chrome lives in three places:

- A slim **bottom HUD** carries the current time, your observer location, and a compass heading.
- A small **drawer rail** in the top-right opens one panel at a time: events, tonight's sky, help, or settings.
- A **command palette** (⌘K / Ctrl+K) searches everything from anywhere.

What you can see in the sky:

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

To make the chart useful for your own location, click the **📍 location chip** in the bottom-left of the HUD and pick a city or type coordinates — or use "Use my location" to have your browser fill both in.

On first visit, a short **guided tour** highlights the HUD, drawer rail, and command palette. You can Skip it with Esc; it doesn't come back automatically, but the Help modal has a "Replay tour" button if you want it again later.

---

## Bottom HUD

The HUD is a slim bar pinned to the bottom of the screen. It has three regions.

**Left — location chip** — shows `📍 lat, lon` for your current observer position. Click it to open the fullscreen **Location picker** (see [Location](#location)).

**Center — time readout and scrubber.** Two lines side-by-side: the current chart time in **UTC** and in your computer's **local timezone**, both live-updating as the chart advances. This whole region is also the time scrubber.

**Right — compass chip** — shows the current view azimuth as `<cardinal> <degrees>` (e.g. `SW 220°`). It's a live readout, not a control.

### Scrub time by dragging

Click and drag horizontally anywhere in the center region to scrub time. The ratio is **≈ 1 minute per pixel** — a full-width drag on a typical viewport covers roughly a 30-minute window. Left = earlier, right = later. Release to stop.

### Scrub time with the keyboard

The whole document listens for arrow keys and the space bar. As long as focus isn't in a text input, textarea, `<select>`, or contenteditable field, these shortcuts work anywhere on the page:

| Key               | Steps time by          |
| ----------------- | ---------------------- |
| **←** / **→**     | 1 minute               |
| **Shift + ← / →** | 1 hour                 |
| **Alt + ← / →**   | 1 day                  |
| **Space**         | Play / pause animation |

Holding a key auto-repeats via your OS's key-repeat.

### Auto-dim

If you don't interact for **~2 seconds**, the HUD fades to a low opacity so it doesn't distract from the sky. Any pointer movement or keypress wakes it back up. The auto-dim is purely cosmetic — the HUD stays active and responsive even when dim.

---

## Drawer rail

The top-right of the screen holds a small compact panel with a title ("Planisphere") and a row of icon buttons. The row is the "drawer rail": each icon toggles a surface.

Reading the row left-to-right:

- **🔴 Night vision** — deep-red filter for dark-adapted viewing (see [Night Vision](#night-vision)).
- **🔗 Copy link** — copies the current URL to your clipboard, preserving every setting.
- **📅 Upcoming events** — opens the **Events drawer** (conjunctions, eclipses, meteor showers, ISS passes).
- **♀ Tonight's sky** — opens the **Tonight drawer** (Sun/Moon/planets with alt/az, rise/set, and trail toggles).
- **? Help** — opens this manual in a scrollable modal, plus a "Replay tour" button.
- **⚙ Settings** — opens the **Settings drawer** (layers, opacities, star magnitude filter, language, skyculture).
- **🌃 / 📓 Mode toggle** — switches between the Planetarium (default) and Notebook (Pro) modes.
- **− / +** — collapses the panel body to just this button row.

Only one drawer is open at a time. Clicking a second icon closes the first.

---

## Search — the Command Palette

Press **⌘K** (macOS) or **Ctrl+K** (Windows/Linux) from anywhere in the app to open the palette. Press it again — or **Esc** — to close.

The palette is a single search box that fuzzy-matches across four kinds of source:

- **Objects** — stars, planets, satellites, Messier deep-sky objects, and constellations.
- **Upcoming events** — the same list surfaced by the Events drawer, so you can jump to a conjunction or eclipse without opening the drawer first.
- **Places** — the built-in city presets (New York, London, Tokyo, and so on). Selecting one sets your observer location.
- **Actions & settings** — commands like toggling layers, opening the location picker, or turning night vision on.

Keyboard navigation:

- **↑ / ↓** — move the highlighted row.
- **Enter** — run the highlighted result.
- **Esc** — close the palette without picking anything.

Your **last 10 selections** are remembered as a "Recents" section (stored locally per browser under the key `planisphere.palette.recents.v1`), so common places and objects are one keypress away next time.

---

## Time

Time controls are split across two places:

- Everyday **stepping and scrubbing** live on the [Bottom HUD](#bottom-hud): drag to scrub, arrow keys to step, Space to play/pause.
- Jumping to a **specific date and event** is done from the [Events drawer](#events--) (each event has a "Go to" button).

For a precise datetime (e.g. an eclipse prediction from another source), paste a URL with a `t=` parameter (see [URL Parameters](#url-parameters)).

To snap back to the current moment and your GPS in one shot, use the **📍 Now** action from the command palette (⌘K → "now").

---

## Events (📅)

Click the **📅** icon to open the Events drawer. It lists noteworthy things happening in the sky from your current observer location, sorted by date.

Four kinds of events show up here:

- **Planetary conjunctions** — pairs of Solar System bodies (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn) that come within about 5° of each other. Looks ahead 30 days.
- **Lunar eclipses** — penumbral, partial, or total. Looks ahead one year.
- **Meteor-shower peaks** — annual showers (Perseids, Geminids, etc.) at their yearly peak. Looks ahead one year.
- **ISS passes** — upcoming International Space Station passes over your location. Looks ahead 48 hours.

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

If no events match the lookahead windows for your location, the section shows "No upcoming events."

---

## Tonight's sky (♀)

Click the **♀** icon to open the Tonight drawer. It replaces the old always-on "Planet Info" side panel — same data, but out of the way until you want it.

Each row covers one Solar-System body (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn) and shows:

- **Name** — colored to match its dot on the chart. Names of bodies currently **above the horizon are clickable** — click to swing the view onto that body. Bodies below the horizon show "↓ below" in grey and are not clickable.
- **Alt / Az** — where it is in your sky right now.
- **Rise / Set times** — local times for the current day. `↑ HH:MM` is the rise time, `↓ HH:MM` is the set time. If a body does not rise or set on the chosen date (e.g. circumpolar, or the Sun at high latitudes in summer) the field shows `--`.
- **Show path / Hide path** — for above-horizon bodies only. Click **Show path** to draw a future trail across the sky showing where that body will be over the next four hours (sampled every five minutes). The button changes to **Hide path** while the trail is displayed; only one trail can be shown at a time. The trail is not saved in the URL.

The drawer re-reads the sky whenever you move time or observer, so its numbers stay current as you scrub.

---

## Settings (⚙)

Click the **⚙** icon to open the Settings drawer. It's organised into four collapsible sections; the drawer remembers which one was last open across reloads (stored under `planisphere.settings.lastSection.v1`).

### Visibility

Toggles for each whole layer:

- **Stars ☆**
- **Planets ☾** — Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn.
- **Satellites 🛰**
- **Compass ◎** — cardinal direction labels at the horizon.
- **Deep Sky ✦** — Messier catalog galaxies, nebulae, and clusters.

### Opacity

Six 0–100 sliders for line-like overlays. Drag to 0 to hide, or anywhere in between to ease it back.

- **Constellation Lines** — stick-figure outlines.
- **Constellation Boundaries** — IAU region borders.
- **Satellite Trails** — motion trails drawn behind each satellite.
- **RA/Dec Grid** — right-ascension / declination celestial grid.
- **Ecliptic** — the Sun's annual path (a good reference for finding planets).
- **Milky Way** — the bright galactic band.

### Filters

Contains the **Mag ≤** slider — how dim a star has to be before it drops out of the chart. Drag left toward `Mag ≤ 1.0` to keep only the brightest stars (a minimal view, good for learning constellations); drag right toward `Mag ≤ 6.0` to show everything down to the naked-eye limit.

### Display

Two dropdowns that change how names and asterisms are shown.

**Constellation Names (language)** — sets the language used for constellation labels on the Western (IAU) asterism set:

- **Latin** (default — e.g. _Ursa Major_)
- **English** (_Great Bear_)
- **中文** (Chinese)
- **العربية** (Arabic)
- **Ελληνικά** (Greek)

Star names and planet names stay in their conventional English/Latin form regardless of this setting. Language overrides are only defined for the Western asterism set — if you change the language while viewing a non-Western skyculture, the **Skyculture** dropdown snaps back to _Western (IAU)_ automatically.

**Skyculture** — chooses which set of stick-figure asterisms is drawn on top of the star field:

- **Western (IAU)** — the familiar 88 IAU constellations (default). Respects the Constellation Names language dropdown.
- **Chinese (Xingguan) 星官** — Chinese star mansions / officials. Labels in Chinese.
- **Indian (Vedic) वैदिक** — Vedic asterisms. Labels in Devanagari.
- **Norse (Edda)** — figures from the Poetic and Prose Edda.
- **Hawaiian Starlines** — the four Polynesian voyaging starlines.
- **Māori** — Māori constellations. Labels in te reo Māori.

Non-Western skycultures display names in the culture's own language — they don't use the Constellation Names language dropdown.

---

## Help (?) and the guided tour

Click the **?** icon to open the Help modal — the full user guide (this document) rendered inline, with a "Replay tour" button in the header.

### Guided tour

On first visit, an **onboarding overlay** highlights the HUD, drawer rail, and command palette in a few short steps. It's a one-time affair: dismissing it (Skip button, Esc, or Next on the final step) records the dismissal in `localStorage` under `planisphere.onboarding.v1` so it won't come back on future visits.

If you want it again, open the Help modal and click **Replay tour**.

---

## Notebook mode (Pro) — 🌃 / 📓

Planisphere ships a **Notebook mode** for keeping personal observing notes tied to specific objects and moments in the sky. It's a Pro feature — free accounts can browse the mode's UI and see the editor, but saving and loading notebooks requires a Pro sign-in.

### Entering Notebook mode

Click the **🌃 / 📓 mode toggle** at the right end of the drawer rail (the icon shows 🌃 in Planetarium mode and 📓 in Notebook mode). If you don't have Pro, a small "Pro" pill appears next to the icon and clicking it opens the sign-in modal instead of switching.

### Magic-link sign-in

Sign-in is passwordless. From the sign-in modal:

1. Enter your email address and press **Send link**.
2. Check your inbox for a short-lived magic link (delivered via Resend).
3. Click the link. You're returned to Planisphere signed in.

Sessions are stored in an HMAC-signed cookie set by the Cloudflare Worker that backs the mode; notebooks themselves live in Cloudflare D1. Sign out any time from the Notebook workspace.

### Writing a note

The editor is a rich-text surface (built on tiptap / ProseMirror). Type an **`@`** anywhere in a note to bring up the **mention popover** and drop a live reference to something on the chart. Three kinds of entity can be mentioned:

- **`@body`** — Sun, Moon, or one of the seven planets.
- **`@constellation`** — any of the 88 IAU constellations.
- **`@event`** — an entry from the Upcoming Events list.

Mentions render inline with the entity's name and stay linked, so re-opening the notebook later still resolves each `@…` to the right thing.

A note can also carry a **link to the current view** — a shareable URL that recreates the exact time, location, layers, and camera direction you were looking at when you wrote the note. That link button is Pro-gated on the free tier.

### Where notes live

Notes are stored server-side in the Planisphere Cloudflare Worker's D1 database, tied to your account. See the design decisions in [ADR 009 (backend selection)](https://github.com/robsartin/planisphere/blob/main/docs/adr/009-backend-selection.md), [ADR 013 (notebook editor)](https://github.com/robsartin/planisphere/blob/main/docs/adr/013-notebook-editor.md), and [ADR 014 (email delivery)](https://github.com/robsartin/planisphere/blob/main/docs/adr/014-email-delivery.md).

### Leaving the mode

Click the mode toggle again to switch back to Planetarium mode. Leaving the mode does not sign you out — your session persists until it expires or you click **Sign out** in the Notebook workspace.

---

## Location

Click the **📍 location chip** at the bottom-left of the HUD to open the fullscreen **Location picker**. It offers three ways to set your observer position:

- **Use my location** — asks your browser for GPS. The first time, you'll get a permission prompt; if you deny or your browser has no GPS, the picker leaves the coordinates untouched.
- **Latitude / Longitude number fields** — enter directly (−90 to +90 for lat, positive = north; −180 to +180 for lon, positive = east).
- **Quick-pick cities** — a 24-city grid (New York, London, Tokyo, Sydney, São Paulo, Cape Town, Los Angeles, Mumbai, Austin, and others). Click any to fill the coordinates.

The picker closes when you confirm; the chart re-computes stars, sun, moon, planets, satellites, and events for the new location on the fly.

You can also snap to the current real-world moment and your GPS at once via the command palette's **📍 Now** action (⌘K → "now").

---

## View direction

By default the chart looks straight up (zenith). Drag anywhere on the sky view with the mouse to swing the view around. Scroll (or pinch on touch devices) to zoom; double-tap to reset. The current view azimuth is always visible on the right-hand compass chip in the HUD.

For precise aiming — for example, "point north at 30° altitude" — use the command palette (⌘K) and search for the direction (N, S, E, W, Zenith) or type explicit values into the `vaz` / `valt` URL parameters (see [URL Parameters](#url-parameters)).

---

## Telescope FOV Reticle

The command palette also holds a **Telescope FOV** selector that overlays a circular reticle in the center of the screen at a real-world field-of-view size. Use it to see how much sky you would actually catch through common optics.

Options:

- **Off** — no reticle (default).
- **Naked eye (5°)**
- **Binoculars (7°)**
- **Small scope (1°)**
- **Large scope (0.5°)**

Combined with pointing the view, this is a quick way to plan what a given instrument will show when pointed at a specific target.

---

## Night Vision

Click the **🔴** button on the top-right panel to toggle night vision mode. The whole page (including the star chart) is filtered to deep red, which preserves dark adaptation when you're using Planisphere out under the sky on a phone or laptop.

Click the button again to return to full color. The setting is preserved in the URL (`?nv=1`), so shared links can open already in night-vision mode.

---

## Copy Link

Click the **🔗** button on the top-right panel to copy the current URL to your clipboard. The button briefly changes to "Copied!" to confirm.

Because Planisphere keeps every setting in the URL (time, location, view direction, layers, opacities, magnitude limit, night vision, language, skyculture, telescope FOV), the copied link reproduces the exact view you see when opened in any browser.

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

Size corresponds to brightness: magnitude −1 stars like Sirius show as large dots, while magnitude 6 stars (the faintest naked-eye limit) show as tiny specks. The chart renders only stars above the horizon. Use the **Mag ≤** slider in the Settings drawer's Filters section to filter out dim stars you don't want to see.

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

**Milky Way** appears as a soft glowing band arching across the sky. Drag the Milky Way opacity slider in the Settings drawer to taste.

**Messier deep-sky objects** appear as small violet markers. Hover one for its name and catalog number (e.g. "M31 — Andromeda Galaxy").

**RA/Dec grid** (when enabled) is a web of right-ascension and declination lines — the celestial equivalent of latitude/longitude. Useful for verifying a coordinate by eye.

**Ecliptic** is the single highlighted curve where the Sun, Moon, and planets travel. Good shortcut for scanning a planet-friendly strip of sky.

**Compass** labels appear at the horizon edge of the view: N, S, E, W. They help you orient the chart to the real sky. The HUD's right-hand chip always shows your current view azimuth as a live readout.

---

## Hover Tooltips and Object Cards

Move your mouse over any object to see a small info card. Move the mouse away and the card disappears.

**Click** any object to **pin** an object card — a slightly larger card with a close button (×) that stays on screen while you pan around. Multiple cards can stay open at once, and each card follows its object as time advances. Click the × or press **Esc** to dismiss.

**Clicking empty sky** drops a small reticle popover with the direction readout (Alt/Az) and a "Look here" action, so you can bookmark or aim at a specific patch of sky that isn't on a catalog.

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

**Finding ISS passes** — Set your location (📍 chip → "Use my location" is the fastest way) and open the 📅 Events drawer. Any ISS passes in the next 48 hours show up there with an estimated brightness and peak altitude. Click **Go to** on a pass to jump the chart to peak and aim the camera at the right spot. Passes rendered at 50% opacity are in Earth's shadow — real but invisible — so skip those and pick a brighter one. You can also type "ISS" into the command palette (⌘K) to jump straight to the satellite itself.

**Planning through an eyepiece** — Pick your telescope's FOV from the palette (⌘K → "binoculars" / "small scope" / …), search for your target, and you'll see exactly what the eyepiece will frame.

**Reducing clutter** — Open the ⚙ Settings drawer, expand the Opacity section, and drag the Constellation Lines and Boundaries sliders to 0 if you just want stars. Or use the **Mag ≤** slider in the Filters section to filter out faint stars so only the bright ones remain, which makes constellations easier to learn.

**Finding planets** — Turn the Ecliptic opacity slider up in the Settings drawer. Every planet sits near that line. Combined with the Tonight drawer's rise/set times, that's enough to plan when and where to look.

**Sharing a sky event** — After you set things the way you want, click **🔗** on the top-right panel to copy the URL. Anyone you share that link with will see the exact same sky.

**Using outdoors** — Toggle 🔴 night vision mode once you're dark-adapted. All of the UI and the sky chart go deep red so the screen doesn't wreck your night vision. The HUD also auto-dims after ~2 s of inactivity, so it fades further into the background while you're looking up.

**Notebook mode as an observing log** — Pro users can drop a note tied to `@Jupiter` and the current view URL every time they observe. Six months later, the note still resolves to the right object, and clicking the view link recreates the exact sky you were looking at.

---

## Screenshots

_Screenshots pending — the images referenced in earlier revisions of this guide have been removed pending a fresh capture pass against the current bottom HUD + drawer rail layout. If you follow a `./screenshots/…` link and land on a 404, that's why._
