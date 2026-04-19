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

To make the chart useful for your own location, open the control panel (top-right corner) and set your location. Or just click the **📍 Now** button to jump straight to "here and now" (see [Time](#time) below).

---

## Control Panel

The control panel is in the **top-right corner** of the screen. The title bar reads "Planisphere" and contains three small buttons on the right:

- **🔴 Night vision** — toggles a deep-red filter over the whole page (see [Night Vision](#night-vision)).
- **🔗 Copy link** — copies the current URL to your clipboard, preserving every setting.
- **⚙ / ×** — expand or collapse the controls panel.

Below the header the panel contains (in order):

1. Search box
2. Time controls
3. **Upcoming Events** (celestial event alerts — conjunctions, lunar eclipses, meteor showers, ISS passes)
4. Location controls
5. View Direction controls
6. Telescope FOV reticle
7. Layers + line opacity sliders + star magnitude filter + constellation-name language + skyculture
8. Planet Info

Upcoming Events sits right under Time on purpose: "Go to" buttons on each event jump the time cursor, so keeping the two next to each other keeps the feedback visible. At typical panel heights it fits above the fold so you can see what's coming without scrolling.

Each section is detailed below.

![Control panel](./screenshots/control-panel.png)

<!-- TODO: capture screenshot of the expanded control panel showing every section -->

---

## Search

At the top of the panel is a search box with the placeholder "Search stars, planets, satellites...".

Type at least two characters and a dropdown appears with matching objects. Each result shows:

- The object's **name**
- A small **type label** on the right (star / constellation / planet / satellite)
- **(below horizon)** in grey if the object is not currently above the horizon

Click any result to swing the view toward that object. If the object is above the horizon, the view rotates to face it. If the object is below the horizon the view still rotates toward its compass direction — useful for "where will Jupiter rise?"

The search covers the Hipparcos star catalog (named stars plus HIP numbers), all 88 IAU constellations, the seven Solar System bodies (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn), and every loaded satellite.

![Search dropdown](./screenshots/search.png)

<!-- TODO: capture screenshot of the search box with a query typed and dropdown results visible -->

---

## Time

The Time section has, in order:

- A **date/time picker** showing the current chart time in your computer's local timezone. Click it to pick any date and time.
- A row of **step buttons**: `-1d`, `-1h`, `-1m`, `+1m`, `+1h`, `+1d`. Click any of these to jump the chart backward or forward by that amount. Click repeatedly to keep stepping.
- **Now** — snap the chart back to the current real-world time.
- **📍 Now** — snap to current time _and_ ask your browser for your GPS location. The first time you click this, your browser will prompt for location permission. If you deny or your browser has no GPS, only the time is updated.

### Keyboard tip

The step buttons keep keyboard focus after a click, so you can tap Enter repeatedly to keep stepping.

![Time controls](./screenshots/time-controls.png)

<!-- TODO: capture screenshot of the Time section showing date picker, step buttons, and Now / 📍 Now -->

---

## Upcoming Events

Right below the Time section is **Upcoming Events** — a short list of noteworthy things happening in the sky from your current chart location, sorted by date. Collapse or expand the list with the ▾ / ▸ button on the section header.

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

If no events match the lookahead windows for your location, the section shows "No upcoming events."

![Upcoming events panel](./screenshots/events-panel.png)

<!-- TODO: capture screenshot of the Upcoming Events panel with at least one of each event kind, including a greyed-out eclipsed ISS pass -->

---

## Location

Enter your **latitude** (−90 to +90, positive = north) and **longitude** (−180 to +180, positive = east) in the number fields. Press Tab or Enter after each field to apply.

Below the number fields is a **City preset** dropdown with a list of built-in cities (New York, London, Tokyo, Sydney, São Paulo, Cape Town, Los Angeles, Mumbai, Austin, and several others). Selecting a city fills in the coordinates automatically.

If you'd rather use your actual location, click **📍 Now** in the Time section — it sets both time and GPS position in one click.

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

You can also drag on the sky view itself with the mouse to swing the view around.

![View direction](./screenshots/view-direction.png)

<!-- TODO: capture screenshot of the View Direction section and a non-zenith view -->

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

![Telescope FOV reticle](./screenshots/fov-reticle.png)

<!-- TODO: capture screenshot showing the reticle overlay centered on a bright object -->

---

## Layers

Each checkbox shows or hides a whole layer independently:

- **Stars ☆** — the star field
- **Planets ☾** — Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn
- **Satellites 🛰** — orbiting satellites with motion trails
- **Compass ◎** — cardinal direction labels at the horizon
- **Deep Sky ✦** — Messier catalog galaxies, nebulae, and clusters

### Line Layers (opacity sliders)

Six sliders below the toggles control the visibility of line-like overlays. Each slider runs 0–100; drag to 0 to hide the layer entirely, or anywhere in between to ease it back.

- **Constellation Lines** — stick-figure outlines
- **Constellation Boundaries** — IAU region borders
- **Satellite Trails** — motion trails drawn behind each satellite
- **RA/Dec Grid** — right-ascension / declination celestial grid
- **Ecliptic** — the Sun's annual path (a good reference for finding planets)
- **Milky Way** — the bright galactic band

### Star Filter (magnitude limit)

The **Mag ≤** slider controls how dim a star has to be before it drops out of the chart. Drag left toward `Mag ≤ 1.0` to keep only the brightest stars (a minimal view, good for learning constellations); drag right toward `Mag ≤ 6.0` to show everything down to the naked-eye limit.

### Constellation Names (language)

The dropdown under **Constellation Names** sets the language used for constellation labels on the Western (IAU) asterism set:

- **Latin** (default — e.g. _Ursa Major_)
- **English** (_Great Bear_)
- **中文** (Chinese)
- **العربية** (Arabic)
- **Ελληνικά** (Greek)

Star names and planet names stay in their conventional English/Latin form regardless of this setting.

Language overrides are only defined for the Western asterism set. If you change the language while viewing a non-Western skyculture, the **Skyculture** dropdown below snaps back to _Western (IAU)_ automatically — that's the only set whose constellation IDs the language files know how to rename. Switch back to a non-Western skyculture whenever you like; the labels there are always shown in the culture's own language.

### Skyculture

The **Skyculture** dropdown chooses which set of stick-figure asterisms is drawn on top of the star field. Every culture names and connects the stars differently, so this is a one-click way to see the same sky through a different tradition.

Options:

- **Western (IAU)** — the familiar 88 IAU constellations (default). Respects the Constellation Names language dropdown.
- **Chinese (Xingguan) 星官** — Chinese star mansions / officials. Labels in Chinese.
- **Indian (Vedic) वैदिक** — Vedic asterisms. Labels in Devanagari.
- **Norse (Edda)** — figures from the Poetic and Prose Edda.
- **Hawaiian Starlines** — the four Polynesian voyaging starlines.
- **Māori** — Māori constellations. Labels in te reo Māori.

Non-Western skycultures display names in the culture's own language — they don't use the Constellation Names language dropdown. When you pick one of these, the language dropdown stays where it is, but its effect is hidden until you go back to Western.

![Layers and opacity sliders](./screenshots/layers.png)

<!-- TODO: capture screenshot of the Layers section with all toggles, sliders, language, and skyculture dropdowns visible -->

![Skyculture comparison](./screenshots/skyculture.png)

<!-- TODO: capture screenshot comparing Western vs. one non-Western skyculture on the same sky -->

---

## Planet Info

Below the layer controls is a **Planet Info** panel (collapsible with the ▾ / ▸ button on its header). It lists all seven Solar System bodies with:

- **Name** — colored to match its dot on the chart. Names of bodies currently **above the horizon are clickable** — click to swing the view onto that body. Bodies below the horizon show "↓ below" in grey and are not clickable.
- **Alt / Az** — where it is in your sky right now.
- **Rise / Set times** — local times for the current day. `↑ HH:MM` is the rise time, `↓ HH:MM` is the set time. If a body does not rise or set on the chosen date (e.g. circumpolar, or the Sun at high latitudes in summer) the field shows `--`.
- **Show path / Hide path** — for above-horizon bodies only. Click **Show path** to draw a future trail across the sky showing where that body will be over the next four hours (sampled every five minutes). The button changes to **Hide path** while the trail is displayed; only one trail can be shown at a time. The trail is not saved in the URL.

![Planet info panel](./screenshots/planet-info.png)

<!-- TODO: capture screenshot of the Planet Info section with clickable names and rise/set times -->

---

## Night Vision

Click the **🔴** button in the panel header to toggle night vision mode. The whole page (including the star chart) is filtered to deep red, which preserves dark adaptation when you're using Planisphere out under the sky on a phone or laptop.

Click the button again to return to full color. The setting is preserved in the URL (`?nv=1`), so shared links can open already in night-vision mode.

![Night vision mode](./screenshots/night-vision.png)

<!-- TODO: capture screenshot of the app with night vision turned on -->

---

## Copy Link

Click the **🔗** button in the panel header to copy the current URL to your clipboard. The button briefly changes to "Copied!" to confirm.

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

Size corresponds to brightness: magnitude −1 stars like Sirius show as large dots, while magnitude 6 stars (the faintest naked-eye limit) show as tiny specks. The chart renders only stars above the horizon. Use the **Mag ≤** slider to filter out dim stars you don't want to see.

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

**Milky Way** appears as a soft glowing band arching across the sky. Drag the Milky Way opacity slider to taste.

**Messier deep-sky objects** appear as small violet markers. Hover one for its name and catalog number (e.g. "M31 — Andromeda Galaxy").

**RA/Dec grid** (when enabled) is a web of right-ascension and declination lines — the celestial equivalent of latitude/longitude. Useful for verifying a coordinate by eye.

**Ecliptic** is the single highlighted curve where the Sun, Moon, and planets travel. Good shortcut for scanning a planet-friendly strip of sky.

**Compass** labels appear at the horizon edge of the view: N, S, E, W. They help you orient the chart to the real sky.

---

## Hover Tooltips and Click-to-Pin

Move your mouse over any object to see a small info card. Move the mouse away and the card disappears.

**Click** any object to **pin** its tooltip — a slightly larger card with a close button (×) stays on screen while you pan around. Click the × or click empty space to dismiss. Hover tooltips are suppressed while a pinned tooltip is active.

**Star tooltip:**

- Name (or HIP catalog number if the star has no common name)
- Magnitude
- Alt / Az (current sky position)
- RA / Dec (fixed celestial coordinates)

**Planet tooltip:**

- Name
- Magnitude
- Alt / Az
- RA / Dec
- For the Moon: percentage of the disk that is illuminated

**Satellite tooltip:**

- Name
- NORAD catalog ID
- Alt / Az
- Orbital altitude in kilometers
- Orbital velocity in km/s

**Deep-sky tooltip:**

- Messier number and name (e.g. "M42 — Orion Nebula")
- Type (galaxy, nebula, open cluster, globular cluster, …)
- Magnitude
- Alt / Az
- RA / Dec

![Pinned tooltip](./screenshots/pinned-tooltip.png)

<!-- TODO: capture screenshot of a pinned tooltip with its close button -->

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

**Finding ISS passes** — Set your location (📍 Now is the fastest way) and look at the **Upcoming Events** panel. Any ISS passes in the next 48 hours show up there with an estimated brightness and peak altitude. Click **Go to** on a pass to jump the chart to peak and aim the camera at the right spot. Passes rendered at 50% opacity are in Earth's shadow — real but invisible — so skip those and pick a brighter one. You can also type "ISS" into the search box to jump straight to the satellite itself.

**Planning through an eyepiece** — Pick your telescope's FOV from the Telescope FOV dropdown, search for your target, click the search result (or click the object's name in Planet Info), and you'll see exactly what the eyepiece will frame.

**Reducing clutter** — Drag the Constellation Lines and Boundaries sliders to 0 if you just want stars. Or use the **Mag ≤** slider to filter out faint stars so only the bright ones remain, which makes constellations easier to learn.

**Finding planets** — Turn the Ecliptic layer up. Every planet sits near that line. Combined with the Planet Info rise/set times, that's enough to plan when and where to look.

**Sharing a sky event** — After you set things the way you want, click **🔗** in the panel header to copy the URL. Anyone you share that link with will see the exact same sky.

**Using outdoors** — Toggle 🔴 night vision mode once you're dark-adapted. All of the UI and the sky chart go deep red so the screen doesn't wreck your night vision.

---

## Screenshots

Screenshots will be added after visual review. Every `![...](./screenshots/...)` reference above is a placeholder for a single captured image.

### Default view

_Placeholder — screenshot of the default zenith view at lat 0, lon 0_

### Daytime view

_Placeholder — screenshot showing the Sun above the horizon with the daytime sky_

### Different locations

_Placeholder — comparison screenshots from Austin, TX and Sydney, Australia showing how the sky orientation changes by hemisphere_
