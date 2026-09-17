const express = require('express');
const cors = require('cors');
const { DateTime } = require('luxon');
const tzlookup = require('tz-lookup');
const https = require('https');

const {
  julianDayUT,
  computeAstrocartography,
  computeLocalSpaceAzimuths,
  greatCircleLine,
  calcHouses,
  calcPlanet,
  calcPlanetEquatorial,
  PLANETS,
} = require('./astro');

const app = express();
app.use(cors());
app.use(express.json());

function resolveBirthUTC({ date, time, lat, lon, tzName }) {
  // date: 'YYYY-MM-DD', time: 'HH:mm' (24h, local civil time at birthplace)
  const zone = tzName || tzlookup(lat, lon);
  const dt = DateTime.fromISO(`${date}T${time}`, { zone });
  if (!dt.isValid) {
    throw new Error(`Invalid date/time: ${dt.invalidReason} ${dt.invalidExplanation}`);
  }
  return { utc: dt.toUTC(), zone, offsetMinutes: dt.offset };
}

app.post('/api/chart', async (req, res) => {
  try {
    const { date, time, lat, lon, tzName } = req.body;
    if (date == null || time == null || lat == null || lon == null) {
      return res.status(400).json({ error: 'date, time, lat, lon are required' });
    }
    const { utc, zone, offsetMinutes } = resolveBirthUTC({ date, time, lat, lon, tzName });
    const jdUT = julianDayUT(utc);

    const lines = await computeAstrocartography(jdUT);

    // equatorial positions (for local-space azimuths) reused from lines output
    const planetEq = {};
    for (const [name, data] of Object.entries(lines)) {
      planetEq[name] = { ra: data.ra, dec: data.dec };
    }
    const azimuths = computeLocalSpaceAzimuths(jdUT, lat, lon, planetEq);
    const localSpace = {};
    for (const [name, az] of Object.entries(azimuths)) {
      localSpace[name] = {
        azimuth: az.azimuth,
        altitude: az.altitude,
        segments: greatCircleLine(lat, lon, az.azimuth),
      };
    }

    // Natal ecliptic positions + houses at birthplace
    const ecliptic = {};
    for (const [name, id] of Object.entries(PLANETS)) {
      const p = await calcPlanet(jdUT, id);
      ecliptic[name] = { longitude: p.longitude, latitude: p.latitude, speed: p.longitudeSpeed };
    }
    const houses = await calcHouses(jdUT, lat, lon, 'P');

    res.json({
      input: { date, time, lat, lon },
      resolvedTimeZone: zone,
      utcOffsetMinutes: offsetMinutes,
      utcIso: utc.toISO(),
      julianDayUT: jdUT,
      ecliptic,
      houses: {
        ascendant: houses.ascendant,
        mc: houses.mc,
        armc: houses.armc,
        cusps: houses.house,
      },
      lines,
      localSpace,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/relocate', async (req, res) => {
  try {
    const { date, time, lat, lon, tzName, targetLat, targetLon } = req.body;
    if (targetLat == null || targetLon == null) {
      return res.status(400).json({ error: 'targetLat, targetLon are required' });
    }
    const { utc } = resolveBirthUTC({ date, time, lat, lon, tzName });
    const jdUT = julianDayUT(utc);
    const houses = await calcHouses(jdUT, targetLat, targetLon, 'P');
    res.json({
      target: { lat: targetLat, lon: targetLon },
      ascendant: houses.ascendant,
      mc: houses.mc,
      cusps: houses.house,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Simple geocoding proxy to Nominatim (OpenStreetMap) — required to set a User-Agent.
app.get('/api/geocode', (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'q is required' });
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`;
  https
    .get(url, { headers: { 'User-Agent': 'astrocartography-app/1.0' } }, (upstream) => {
      let data = '';
      upstream.on('data', (chunk) => (data += chunk));
      upstream.on('end', () => {
        try {
          res.json(JSON.parse(data));
        } catch (e) {
          res.status(502).json({ error: 'bad response from geocoder' });
        }
      });
    })
    .on('error', (err) => res.status(502).json({ error: err.message }));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Astrocartography server listening on :${PORT}`));
