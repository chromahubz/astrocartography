const swe = require('swisseph');
const path = require('path');

swe.swe_set_ephe_path(path.join(__dirname, 'ephe'));

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

const PLANETS = {
  sun: swe.SE_SUN,
  moon: swe.SE_MOON,
  mercury: swe.SE_MERCURY,
  venus: swe.SE_VENUS,
  mars: swe.SE_MARS,
  jupiter: swe.SE_JUPITER,
  saturn: swe.SE_SATURN,
  uranus: swe.SE_URANUS,
  neptune: swe.SE_NEPTUNE,
  pluto: swe.SE_PLUTO,
  chiron: swe.SE_CHIRON,
  meanNode: swe.SE_MEAN_NODE,
};

function normalizeDeg(d) {
  let x = d % 360;
  if (x < 0) x += 360;
  return x;
}

// wrap to -180..180
function wrapLon(d) {
  let x = normalizeDeg(d);
  if (x > 180) x -= 360;
  return x;
}

function julianDayUT(dt) {
  // dt: Luxon DateTime in UTC
  const hour = dt.hour + dt.minute / 60 + dt.second / 3600;
  return swe.swe_julday(dt.year, dt.month, dt.day, hour, swe.SE_GREG_CAL);
}

function calcPlanet(jdUT, planetId) {
  return new Promise((resolve, reject) => {
    swe.swe_calc_ut(jdUT, planetId, swe.SEFLG_SWIEPH | swe.SEFLG_SPEED, (res) => {
      if (res.error) return reject(new Error(res.error));
      resolve(res); // ecliptic lon/lat
    });
  });
}

function calcPlanetEquatorial(jdUT, planetId) {
  return new Promise((resolve, reject) => {
    swe.swe_calc_ut(
      jdUT,
      planetId,
      swe.SEFLG_SWIEPH | swe.SEFLG_SPEED | swe.SEFLG_EQUATORIAL,
      (res) => {
        if (res.error) return reject(new Error(res.error));
        // swisseph returns {rectAscension, declination, ...} in equatorial mode
        resolve({ longitude: res.rectAscension, latitude: res.declination, distance: res.distance });
      }
    );
  });
}

function gmstDegrees(jdUT) {
  // Greenwich Mean Sidereal Time in degrees, via swisseph's sidtime (returns hours)
  const sid = swe.swe_sidtime(jdUT); // apparent sidereal time at Greenwich, hours
  const sidHours = typeof sid === 'number' ? sid : sid.siderialTime;
  return sidHours * 15; // to degrees
}

/**
 * Compute MC/IC meridian longitudes for a planet at a given instant.
 * Returns { mcLon, icLon } in -180..180
 */
function meridianLongitudes(raDeg, gmstDeg) {
  const mcLon = wrapLon(raDeg - gmstDeg);
  const icLon = wrapLon(mcLon + 180);
  return { mcLon, icLon };
}

/**
 * Compute AC/DC curve as array of [lat, lon] points for a planet given RA/Dec at instant.
 * For each latitude, solve hour angle where altitude = 0:
 *   cos(H0) = -tan(lat) * tan(dec)
 * AC (rising): H = -H0  -> LST = RA - H0 (planet east, about to culminate)
 * DC (setting): H = +H0 -> LST = RA + H0
 * longitude = LST - GMST
 */
function riseSetCurve(raDeg, decDeg, gmstDeg, branch, latStep = 0.5, latMax = 89.5) {
  const decRad = decDeg * DEG2RAD;
  const points = [];
  for (let lat = -latMax; lat <= latMax; lat += latStep) {
    const latRad = lat * DEG2RAD;
    const cosH0 = -Math.tan(latRad) * Math.tan(decRad);
    if (cosH0 < -1 || cosH0 > 1) continue; // circumpolar / never rises at this latitude
    const H0 = Math.acos(cosH0) * RAD2DEG;
    const H = branch === 'rise' ? -H0 : H0;
    const lst = raDeg + H;
    const lon = wrapLon(lst - gmstDeg);
    points.push([lat, lon]);
  }
  return points;
}

/**
 * Split a lat/lon polyline into segments when longitude wraps around +/-180,
 * so Leaflet doesn't draw a spurious line across the whole map.
 */
function splitAtAntimeridian(points) {
  const segments = [];
  let current = [];
  for (let i = 0; i < points.length; i++) {
    const [lat, lon] = points[i];
    if (current.length > 0) {
      const prevLon = current[current.length - 1][1];
      if (Math.abs(lon - prevLon) > 180) {
        segments.push(current);
        current = [];
      }
    }
    current.push([lat, lon]);
  }
  if (current.length) segments.push(current);
  return segments;
}

async function computeAstrocartography(jdUT) {
  const gmstDeg = gmstDegrees(jdUT);
  const results = {};
  for (const [name, id] of Object.entries(PLANETS)) {
    const eq = await calcPlanetEquatorial(jdUT, id);
    const raDeg = eq.longitude; // equatorial "longitude" = RA in degrees
    const decDeg = eq.latitude; // equatorial "latitude" = Dec in degrees

    const { mcLon, icLon } = meridianLongitudes(raDeg, gmstDeg);
    const acCurve = riseSetCurve(raDeg, decDeg, gmstDeg, 'rise');
    const dcCurve = riseSetCurve(raDeg, decDeg, gmstDeg, 'set');

    results[name] = {
      ra: raDeg,
      dec: decDeg,
      mc: { lon: mcLon, segments: [[[-85, mcLon], [85, mcLon]]] },
      ic: { lon: icLon, segments: [[[-85, icLon], [85, icLon]]] },
      ac: { segments: splitAtAntimeridian(acCurve) },
      dc: { segments: splitAtAntimeridian(dcCurve) },
    };
  }
  return results;
}

/**
 * Local space lines: great-circle bearing rays from the birth location to each planet's
 * geographic sub-point direction (azimuth from observer at birth moment).
 * Returns for each planet an array of [lat, lon] points tracing the great circle path
 * along that initial azimuth, for a fixed angular distance.
 */
function computeLocalSpaceAzimuths(jdUT, birthLat, birthLon, planetEq) {
  const gmstDeg = gmstDegrees(jdUT);
  const lst = normalizeDeg(gmstDeg + birthLon);
  const latRad = birthLat * DEG2RAD;
  const azimuths = {};
  for (const [name, eq] of Object.entries(planetEq)) {
    const H = normalizeDeg(lst - eq.ra) * DEG2RAD; // hour angle
    const decRad = eq.dec * DEG2RAD;
    const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(H);
    const alt = Math.asin(sinAlt);
    let cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * Math.cos(alt));
    cosAz = Math.max(-1, Math.min(1, cosAz));
    let az = Math.acos(cosAz) * RAD2DEG;
    if (Math.sin(H) > 0) az = 360 - az; // hour angle positive (west) => azimuth in western half
    azimuths[name] = { azimuth: az, altitude: alt * RAD2DEG };
  }
  return azimuths;
}

function destinationPoint(lat, lon, bearingDeg, distanceDeg) {
  const latRad = lat * DEG2RAD;
  const lonRad = lon * DEG2RAD;
  const bearingRad = bearingDeg * DEG2RAD;
  const angDist = distanceDeg * DEG2RAD;

  const lat2 = Math.asin(
    Math.sin(latRad) * Math.cos(angDist) + Math.cos(latRad) * Math.sin(angDist) * Math.cos(bearingRad)
  );
  const lon2 =
    lonRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angDist) * Math.cos(latRad),
      Math.cos(angDist) - Math.sin(latRad) * Math.sin(lat2)
    );
  return [lat2 * RAD2DEG, wrapLon(lon2 * RAD2DEG)];
}

function greatCircleLine(startLat, startLon, bearingDeg, maxDistanceDeg = 179, stepDeg = 1) {
  const points = [];
  for (let d = 0; d <= maxDistanceDeg; d += stepDeg) {
    points.push(destinationPoint(startLat, startLon, bearingDeg, d));
  }
  return splitAtAntimeridian(points);
}

/**
 * Recompute chart angles (ASC, MC, houses) for an arbitrary location at the same
 * birth instant (classic "relocation" astrocartography feature).
 */
function calcHouses(jdUT, lat, lon, hsys = 'P') {
  return new Promise((resolve, reject) => {
    swe.swe_houses(jdUT, lat, lon, hsys, (res) => {
      if (res.error) return reject(new Error(res.error));
      resolve(res);
    });
  });
}

module.exports = {
  PLANETS,
  julianDayUT,
  gmstDegrees,
  calcPlanet,
  calcPlanetEquatorial,
  computeAstrocartography,
  computeLocalSpaceAzimuths,
  greatCircleLine,
  calcHouses,
  normalizeDeg,
  wrapLon,
};
