# Astrocartography

Interactive astrocartography (astro*carto*graphy) web app: enter a birth date, time,
and place, and see where each planet's angular lines (MC/IC/AC/DC) and local-space
rays cross the globe, plus relocated chart angles for any point you click.

## Accuracy

Planetary positions are computed with the **Swiss Ephemeris** (via the `swisseph`
Node binding), using the actual JPL-derived `.se1` data files (not the lower-precision
Moshier fallback), giving sub-arcsecond accuracy for the Sun, Moon, and planets.
Birth time is converted to UTC using the IANA time zone database (via `luxon` +
`tz-lookup`), which correctly accounts for historical DST/offset rules at the
birthplace.

Line math (standard astrocartography formulas):
- **MC/IC**: meridian longitude where local sidereal time equals the planet's right
  ascension (MC), and the antipodal meridian (IC).
- **AC/DC**: for each latitude, the hour angle where the planet's altitude is 0
  (`cos H0 = -tan(lat)·tan(dec)`), taken on the rising (AC) or setting (DC) branch.
- **Local space lines**: great-circle rays from the birthplace along the planet's
  true azimuth at the birth moment.
- **Relocation**: recomputes house cusps/angles (Placidus) at any clicked point for
  the same birth instant.

All of the above were spot-checked against a known chart (Barack Obama, Honolulu)
and by re-deriving each line point's local sidereal time / altitude numerically.

## Structure

- `server/` — Express API (`/api/chart`, `/api/relocate`, `/api/geocode`) that runs
  the Swiss Ephemeris calculations.
- `client/` — React + Leaflet frontend.

## Running locally

```bash
cd server && npm install && node index.js       # http://localhost:3001
cd client && npm install && npm run dev          # http://localhost:5173
```
