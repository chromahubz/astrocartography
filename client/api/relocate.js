const { resolveBirthUTC } = require('./_lib/time');
const { ascMc } = require('./_lib/astro');

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
    const { date, time, lat, lon, tzName, targetLat, targetLon } = req.body;
    if (targetLat == null || targetLon == null) {
      return res.status(400).json({ error: 'targetLat, targetLon are required' });
    }
    const { utc } = resolveBirthUTC({ date, time, lat, lon, tzName });
    const { ascendant, mc } = ascMc(utc.toJSDate(), targetLat, targetLon);
    res.status(200).json({ target: { lat: targetLat, lon: targetLon }, ascendant, mc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
