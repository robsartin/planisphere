# Planisphere User Guide

Planisphere is a live, interactive star chart that runs in your web browser. Point it at any place and time on Earth, and it shows you exactly what the sky looks like from there — stars, planets, the Moon, the Sun, orbiting satellites, constellation stick figures, and more. No installation required.

---

## Overview

When you open Planisphere you are looking up at the sky as if lying flat on your back. The view is a full-hemisphere projection: the center of the screen is directly overhead (the zenith), and the edges of the view are the horizon in every direction. Compass labels (N, S, E, W) mark the cardinal directions along the horizon.

What you can see:

- **Stars** — shown as white dots. Brighter stars have larger dots.
- **Planets** — colored dots: the Sun is golden yellow, the Moon is a pale white with a crescent shape showing its current phase, Venus is pale yellow, Mars is red-orange, Jupiter is a warm pinkish white, Saturn is golden tan, Mercury is a muted gray-pink.
- **Satellites** — bright green dots with a short trail showing direction of travel.
- **Constellation lines** — thin white lines connecting stars into the familiar stick-figure patterns.
- **Constellation boundaries** — faint white lines marking the official borders between constellation regions.
- **Compass** — cardinal direction labels at the horizon.

---

## Getting Started

Open the Planisphere URL in any modern web browser. By default you are standing at **latitude 0°, longitude 0°** (the Gulf of Guinea, off the west coast of Africa) looking straight up at the zenith. The time defaults to April 15, 2026 at midnight UTC.

The star chart renders immediately. After a moment, satellites appear as well — they are loaded from a live orbital data source, so they need a brief download.

To make the chart useful for your own location and the current moment, open the control panel (top-right corner) and set your location and time. See the sections below for details.

---

## URL Parameters

You can link directly to a specific sky view by adding parameters to the URL. This is handy for bookmarking your backyard, sharing a sky event with a friend, or embedding a particular moment in a blog post.

| Parameter | What it does                            | Example value              |
| --------- | --------------------------------------- | -------------------------- |
| `lat`     | Observer latitude, −90 to +90           | `30.27`                    |
| `lon`     | Observer longitude, −180 to +180        | `-97.74`                   |
| `t`       | UTC date/time in ISO 8601 format        | `2026-08-12T03:00:00.000Z` |
| `layers`  | Comma-separated list of layers to show  | `stars,planets,compass`    |
| `op_cl`   | Constellation Lines opacity, 0–100      | `50`                       |
| `op_cb`   | Constellation Boundaries opacity, 0–100 | `30`                       |
| `op_st`   | Satellite Trails opacity, 0–100         | `75`                       |

**Layer names for the `layers` parameter:**
`stars`, `planets`, `satellites`, `constellationLines`, `constellationBoundaries`, `compass`

If you omit the `layers` parameter entirely, all layers are shown. If you include it, only the layers you list are shown.

Opacity values are integers 0 (invisible) to 100 (full opacity). If you omit an opacity parameter, it defaults to 100.

**Examples:**

Austin, Texas right now with everything visible:

```
?lat=30.27&lon=-97.74&t=2026-04-15T04:00:00.000Z
```

Stars and planets only, no constellation clutter:

```
?lat=51.51&lon=-0.13&t=2026-04-15T22:00:00.000Z&layers=stars,planets,compass
```

Constellation lines at half opacity:

```
?lat=35.69&lon=139.69&t=2026-04-15T18:30:00.000Z&op_cl=50
```

---

## Control Panel

The control panel is in the **top-right corner** of the screen. It has a title bar reading "Planisphere" and a small gear icon (⚙). Click the gear icon to expand or collapse the controls. The panel has four sections.

### Time

At the top of the Time section is a date/time picker showing the current chart time in your local timezone.

Below the picker is a row of **step buttons**: `-1d`, `-1h`, `-1m`, `+1m`, `+1h`, `+1d`. Click any of these to jump the chart backward or forward by that amount. You can click repeatedly to keep stepping.

At the bottom of the section is a **Now** button. Click it to snap the chart back to the current real-world time.

### Location

Enter your **latitude** (−90 to +90, positive = north) and **longitude** (−180 to +180, positive = east) in the number fields. Press Tab or Enter after each field to apply.

Below the number fields is a **City preset** dropdown with nine cities: New York, London, Tokyo, Sydney, São Paulo, Cape Town, Los Angeles, Mumbai, and Austin. Selecting a city fills in the coordinates automatically.

### View Direction

By default the chart looks straight up (zenith). The View Direction section lets you turn toward any part of the sky.

The **preset buttons** snap to common directions:

- **Zenith** — straight up
- **N** — looking north at about 30° altitude
- **E** — looking east at about 30° altitude
- **S** — looking south at about 30° altitude
- **W** — looking west at about 30° altitude

Below the buttons are two number inputs, **Az** (azimuth, 0–360°) and **Alt** (altitude, 0–90°), for precise aiming. Azimuth 0° is north, 90° is east, 180° is south, 270° is west. Altitude 0° is the horizon, 90° is straight up.

### Layers

Six checkboxes let you show or hide each layer independently:

- **Stars** — the star field
- **Planets** — Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn
- **Satellites** — orbiting satellites with motion trails
- **Constellation Lines** — stick-figure outlines
- **Constellation Boundaries** — region borders between constellations
- **Compass** — cardinal direction labels at the horizon

### Opacity

Below the layer toggles are three sliders that control how strongly each semi-transparent overlay is drawn:

- **Constellation Lines opacity** — visible when Constellation Lines is on
- **Constellation Boundaries opacity** — visible when Constellation Boundaries is on
- **Satellite Trails opacity** — visible when Satellites is on

Drag a slider to the left to make the overlay more transparent, to the right for more solid. The sliders disappear automatically when their corresponding layer is turned off.

---

## Reading the Sky

**Stars** appear as white dots. Size corresponds to brightness: a magnitude −1 star like Sirius shows as a large dot, while magnitude 5 stars (barely naked-eye) show as tiny specks. The chart only renders stars above the horizon.

**Planets** each have a distinctive color so you can tell them apart at a glance:

- Sun — large golden-yellow glow
- Moon — pale white, shaped as a crescent that matches its current phase
- Venus — pale yellow-white
- Mars — red-orange
- Jupiter — warm pinkish-white
- Saturn — golden tan
- Mercury — muted gray-pink

**Satellites** appear as small bright green dots. Each one has a short trail behind it showing the direction it is traveling.

**Constellation lines** are thin white lines forming the familiar connect-the-dots star patterns. They are drawn at a lower opacity than stars so they don't overwhelm the view.

**Constellation boundaries** are even fainter white lines that mark the official rectangular borders between every constellation region, as defined by the International Astronomical Union.

**Compass labels** appear at the horizon edge of the view: N, S, E, W. They help you orient the chart to the real sky.

---

## Hover Tooltips

Move your mouse over any object to see a small info card. Move the mouse away and the card disappears.

**Star tooltip:**

- Name (if the star has one) or its HIP catalog number
- Magnitude (brightness)
- Altitude and Azimuth (where it is in your sky right now)
- Right Ascension and Declination (its fixed position on the celestial sphere)

**Planet tooltip:**

- Name
- Magnitude
- Altitude and Azimuth
- Right Ascension and Declination
- For the Moon: percentage of the disk that is illuminated (phase)

**Satellite tooltip:**

- Name
- NORAD catalog ID
- Altitude and Azimuth
- Orbital altitude in kilometers
- Orbital velocity in km/s

---

## Tips

**Best time to see satellites** — Satellites are only visible when sunlight catches them. This happens in the hour or so after sunset or before sunrise, when the sky is dark but the satellite is still in sunlight high above you. During the middle of the night or the middle of the day, satellites are either in Earth's shadow or lost in the daytime glare.

**Finding ISS passes** — Set your location, click Now to start at the current time, then click `+1m` repeatedly to step through the next hour. Watch for any satellite crossing your sky. The ISS is one of the brightest objects in the satellite layer.

**Reducing clutter** — If you want to focus on stars and planets, uncheck Constellation Lines, Constellation Boundaries, and Satellites in the Layers section. You can also drag the Constellation Lines opacity slider down to make the lines subtler rather than turning them off entirely.

**Exploring a different part of the sky** — Click N, E, S, or W in the View Direction section to swing the view toward that horizon. Use the Az and Alt inputs to aim at a specific point — for example, Az 45° Alt 60° looks northeast and up.

**Sharing a sky event** — After you set the time and location you want, copy the URL from your browser's address bar. Planisphere automatically keeps the URL in sync with the current state. Anyone you share that link with will see the same sky.

---

## Screenshots

Screenshots will be added after visual review.

### Default view

_Placeholder — screenshot of the default zenith view at lat 0, lon 0_

### Control panel

_Placeholder — screenshot showing the expanded control panel with all four sections_

### Tooltip examples

_Placeholder — screenshots of star, planet (Moon), and satellite tooltips_

### Daytime view

_Placeholder — screenshot showing the Sun above the horizon with the sky view_

### Different locations

_Placeholder — comparison screenshots from Austin, TX and Sydney, Australia showing how the sky orientation changes by hemisphere_
