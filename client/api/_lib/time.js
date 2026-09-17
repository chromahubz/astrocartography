const { DateTime } = require('luxon');
const tzlookup = require('tz-lookup');

function resolveBirthUTC({ date, time, lat, lon, tzName }) {
  const zone = tzName || tzlookup(lat, lon);
  const dt = DateTime.fromISO(`${date}T${time}`, { zone });
  if (!dt.isValid) {
    throw new Error(`Invalid date/time: ${dt.invalidReason} ${dt.invalidExplanation}`);
  }
  return { utc: dt.toUTC(), zone, offsetMinutes: dt.offset };
}

module.exports = { resolveBirthUTC };
