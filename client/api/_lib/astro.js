import * as Astronomy from 'astronomy-engine';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

// astronomy-engine has no Chiron or lunar-node body, so those are dropped
// relative to the earlier Swiss Ephemeris build.
const PLANETS = {
  sun: Astronomy.Body.Sun,
  moon: Astronomy.Body.Moon,
  mercury: Astronomy.Body.Mercury,
  venus: Astronomy.Body.Venus,
  mars: Astronomy.Body.Mars,
  jupiter: Astronomy.Body.Jupiter,
  saturn: Astronomy.Body.Saturn,
  uranus: Astronomy.Body.Uranus,
  neptune: Astronomy.Body.Neptune,
  pluto: Astronomy.Body.Pluto,
};

function normalizeDeg(d) {
  let x = d % 360;
  if (x < 0) x += 360;
  return x;
}

function wrapLon(d) {
  let x = normalizeDeg(d);
  if (x > 180) x -= 360;
  return x;
}

/** Geocentric apparent equatorial RA (deg)/Dec (deg) and ecliptic longitude (deg) for a body at a UTC instant. */
function bodyPositions(date, bodyId) {
  const observer = new Astronomy.Observer(0, 0, 0);
  const eq = Astronomy.Equator(bodyId, date, observer, true, true);
  const eclVec = Astronomy.GeoVector(bodyId, date, true);
  const ecl = Astronomy.Ecliptic(eclVec);
  return {
    raDeg: eq.ra * 15,
    decDeg: eq.dec,
    eclipticLon: normalizeDeg(ecl.elon),
    eclipticLat: ecl.elat,
  };
}

/** Greenwich Mean/Apparent Sidereal Time, in degrees. */
function gmstDegrees(date) {
  return Astronomy.SiderealTime(date) * 15;
}

function meridianLongitudes(raDeg, gmstDeg) {
  const mcLon = wrapLon(raDeg - gmstDeg);
  const icLon = wrapLon(mcLon + 180);
  return { mcLon, icLon };
}

function riseSetCurve(raDeg, decDeg, gmstDeg, branch, latStep = 0.5, latMax = 89.5) {
  const decRad = decDeg * DEG2RAD;
  const points = [];
  for (let lat = -latMax; lat <= latMax; lat += latStep) {
    const latRad = lat * DEG2RAD;
    const cosH0 = -Math.tan(latRad) * Math.tan(decRad);
    if (cosH0 < -1 || cosH0 > 1) continue; // circumpolar at this latitude
    const H0 = Math.acos(cosH0) * RAD2DEG;
    const H = branch === 'rise' ? -H0 : H0;
    const lst = raDeg + H;
    const lon = wrapLon(lst - gmstDeg);
    points.push([lat, lon]);
  }
  return points;
}

function splitAtAntimeridian(points) {
  const segments = [];
  let current = [];
  for (const [lat, lon] of points) {
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

function eclipticSpeed(date, bodyId, eclipticLon) {
  // Finite-difference daily motion (deg/day), used only to flag retrograde motion.
  const later = new Date(date.getTime() + 6 * 3600 * 1000);
  const laterLon = bodyPositions(later, bodyId).eclipticLon;
  let diff = laterLon - eclipticLon;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff * 4; // scale 6h delta up to deg/day
}

function computeAstrocartography(date) {
  const gmstDeg = gmstDegrees(date);
  const lines = {};
  const ecliptic = {};
  for (const [name, id] of Object.entries(PLANETS)) {
    const pos = bodyPositions(date, id);
    const { mcLon, icLon } = meridianLongitudes(pos.raDeg, gmstDeg);
    const acCurve = riseSetCurve(pos.raDeg, pos.decDeg, gmstDeg, 'rise');
    const dcCurve = riseSetCurve(pos.raDeg, pos.decDeg, gmstDeg, 'set');

    lines[name] = {
      ra: pos.raDeg,
      dec: pos.decDeg,
      mc: { lon: mcLon, segments: [[[-85, mcLon], [85, mcLon]]] },
      ic: { lon: icLon, segments: [[[-85, icLon], [85, icLon]]] },
      ac: { segments: splitAtAntimeridian(acCurve) },
      dc: { segments: splitAtAntimeridian(dcCurve) },
    };
    ecliptic[name] = {
      longitude: pos.eclipticLon,
      latitude: pos.eclipticLat,
      speed: eclipticSpeed(date, id, pos.eclipticLon),
    };
  }
  return { lines, ecliptic, gmstDeg };
}

/** Local space rays: great-circle bearing from the birthplace toward each planet's azimuth at the birth moment. */
function computeLocalSpaceAzimuths(gmstDeg, birthLat, birthLon, planetEq) {
  const lst = normalizeDeg(gmstDeg + birthLon);
  const latRad = birthLat * DEG2RAD;
  const azimuths = {};
  for (const [name, eq] of Object.entries(planetEq)) {
    const H = normalizeDeg(lst - eq.ra) * DEG2RAD;
    const decRad = eq.dec * DEG2RAD;
    const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(H);
    const alt = Math.asin(sinAlt);
    let cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * Math.cos(alt));
    cosAz = Math.max(-1, Math.min(1, cosAz));
    let az = Math.acos(cosAz) * RAD2DEG;
    if (Math.sin(H) > 0) az = 360 - az;
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
 * Ascendant and Midheaven ecliptic longitudes for an observer at (lat, lon) at the
 * given UTC instant. Standard spherical-astronomy formulas (see e.g. Meeus ch. 13
 * or any astrological-house reference); validated against Swiss Ephemeris output.
 */
function ascMc(date, lat, lon) {
  const gmstDeg = gmstDegrees(date);
  const ramc = normalizeDeg(gmstDeg + lon); // local sidereal time = RAMC
  const eps = Astronomy.e_tilt(Astronomy.MakeTime(date)).tobl * DEG2RAD; // true obliquity, deg -> rad
  const ramcRad = ramc * DEG2RAD;
  const latRad = lat * DEG2RAD;

  const mc = normalizeDeg(Math.atan2(Math.sin(ramcRad), Math.cos(ramcRad) * Math.cos(eps)) * RAD2DEG);

  const asc = normalizeDeg(
    Math.atan2(Math.cos(ramcRad), -(Math.sin(ramcRad) * Math.cos(eps) + Math.tan(latRad) * Math.sin(eps))) * RAD2DEG
  );

  return { ascendant: asc, mc, ramc };
}

export {
  PLANETS,
  normalizeDeg,
  wrapLon,
  bodyPositions,
  gmstDegrees,
  computeAstrocartography,
  computeLocalSpaceAzimuths,
  greatCircleLine,
  ascMc,
};
