# Astrocartography

Interactive astrocartography (astro*carto*graphy) web app: enter a birth date, time,
and place, and see where each planet's angular lines (MC/IC/AC/DC) and local-space
rays cross the globe, plus relocated chart angles for any point you click, and a
heuristic ranking of "best places to live" by proximity to your supportive lines.

## Accuracy

Planetary positions are computed with **[astronomy-engine](https://github.com/cosinekitty/astronomy)**,
a pure-JS/TS ephemeris giving sub-arcsecond accuracy for the Sun, Moon, and planets
across 1700–2200 — no native bindings, so it runs anywhere (including Vercel
serverless functions or the browser). Birth time is converted to UTC using the IANA
time zone database (via `luxon` + `tz-lookup`), which correctly accounts for
historical DST/offset rules at the birthplace.

Line math (standard astrocartography formulas):
- **MC/IC**: meridian longitude where local sidereal time equals the planet's right
  ascension (MC), and the antipodal meridian (IC).
- **AC/DC**: for each latitude, the hour angle where the planet's altitude is 0
  (`cos H0 = -tan(lat)·tan(dec)`), taken on the rising (AC) or setting (DC) branch.
- **Local space lines**: great-circle rays from the birthplace along the planet's
  true azimuth at the birth moment.
- **Relocation**: recomputes the Ascendant/Midheaven at any clicked point for the
  same birth instant.

All of the above were spot-checked against a known chart (Barack Obama, Honolulu)
and by re-deriving each line point's local sidereal time / altitude numerically.
Note: `astronomy-engine` does not model Chiron or the lunar nodes, so those are not
included (an earlier Swiss Ephemeris build did; dropped when switching to a pure-JS
engine so the whole app can deploy as a single Vercel project).

## Structure

Single Vercel project, deployed from `client/`:
- `client/api/` — Vercel serverless functions (`/api/chart`, `/api/relocate`) running
  the astronomy-engine calculations.
- `client/src/` — React + Leaflet frontend. Birthplace search calls Nominatim
  (OpenStreetMap) directly from the browser.

## Running locally

```bash
cd client && npm install && npm run dev   # frontend only, http://localhost:5173
vercel dev                                 # frontend + /api functions together
```
