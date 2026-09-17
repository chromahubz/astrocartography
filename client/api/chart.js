const { resolveBirthUTC } = require('./_lib/time');
const { computeAstrocartography, computeLocalSpaceAzimuths, greatCircleLine, ascMc } = require('./_lib/astro');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const { date, time, lat, lon, tzName } = req.body;
    if (date == null || time == null || lat == null || lon == null) {
      return res.status(400).json({ error: 'date, time, lat, lon are required' });
    }

    const { utc, zone, offsetMinutes } = resolveBirthUTC({ date, time, lat, lon, tzName });
    const jsDate = utc.toJSDate();

    const { lines, ecliptic, gmstDeg } = computeAstrocartography(jsDate);

    const planetEq = {};
    for (const [name, data] of Object.entries(lines)) {
      planetEq[name] = { ra: data.ra, dec: data.dec };
    }
    const azimuths = computeLocalSpaceAzimuths(gmstDeg, lat, lon, planetEq);
    const localSpace = {};
    for (const [name, az] of Object.entries(azimuths)) {
      localSpace[name] = {
        azimuth: az.azimuth,
        altitude: az.altitude,
        segments: greatCircleLine(lat, lon, az.azimuth),
      };
    }

    const { ascendant, mc } = ascMc(jsDate, lat, lon);

    res.status(200).json({
      input: { date, time, lat, lon },
      resolvedTimeZone: zone,
      utcOffsetMinutes: offsetMinutes,
      utcIso: utc.toISO(),
      ecliptic,
      houses: { ascendant, mc },
      lines,
      localSpace,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
