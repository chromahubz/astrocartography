import type { ChartResponse } from './api';
import { CITIES, type City } from './cities';
import { PLANET_WEIGHT, LINE_TYPE_WEIGHT, SIGN_RULERS, signIndexOf, dignityModifier } from './planets';

const R_KM = 6371;
const LINE_TYPES = ['mc', 'ic', 'ac', 'dc'] as const;
type LineType = (typeof LINE_TYPES)[number];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(a));
}

// Nearest point on a meridian (constant longitude, MC/IC lines) to a city is at
// the city's own latitude — using the two stored endpoints directly would wildly
// overstate the distance for most cities.
function distanceToMeridian(city: City, meridianLon: number): number {
  return haversineKm(city.lat, city.lon, city.lat, meridianLon);
}

// AC/DC curves are sampled every 0.5 deg of latitude, so nearest-vertex distance
// is a reasonable (if not exact) approximation of nearest-point-on-curve.
function minDistanceToSampledCurve(city: City, segments: [number, number][][]): number {
  let min = Infinity;
  for (const seg of segments) {
    for (const [lat, lon] of seg) {
      const d = haversineKm(city.lat, city.lon, lat, lon);
      if (d < min) min = d;
    }
  }
  return min;
}

function distanceToLine(city: City, lineData: ChartResponse['lines'][string], lineType: LineType): number {
  if (lineType === 'mc') return distanceToMeridian(city, lineData.mc.lon);
  if (lineType === 'ic') return distanceToMeridian(city, lineData.ic.lon);
  return minDistanceToSampledCurve(city, lineData[lineType].segments);
}

/**
 * A planet's "valence" for this specific chart: the classical benefic/malefic
 * baseline (PLANET_WEIGHT), adjusted by essential dignity (sign it occupies),
 * a bonus if it rules the Ascendant (the chart's single most personally
 * significant planet, independent of benefic/malefic status), and a mild
 * damping if retrograde (its expression is traditionally read as more
 * internalized/complicated). All of these are standard, well-defined
 * classical techniques — not invented weights — but the *interpretation*
 * that "positive valence == good place to live" is still astrology, not
 * something empirically verifiable.
 */
function chartValence(chart: ChartResponse, planet: string): number {
  const base = PLANET_WEIGHT[planet] ?? 0;
  const eclipticLon = chart.ecliptic[planet]?.longitude ?? 0;
  const dignity = dignityModifier(planet, signIndexOf(eclipticLon));
  const ascSign = signIndexOf(chart.houses.ascendant);
  const isChartRuler = SIGN_RULERS[ascSign] === planet;

  let valence = base + dignity * 0.5 + (isChartRuler ? 0.5 : 0);
  if ((chart.ecliptic[planet]?.speed ?? 0) < 0) valence *= 0.85; // retrograde damping
  return valence;
}

export interface LineContribution {
  planet: string;
  lineType: LineType;
  distanceKm: number;
  contribution: number;
}

export interface CityScore {
  city: City;
  score: number;
  topContribution: LineContribution | null;
  contributions: LineContribution[];
}

const FALLOFF_KM = 300; // e-fold distance for "being near a line" influence

/**
 * "Best/worst places" heuristic score: for every (planet, line type) pair
 * enabled in `enabledLineTypes`, weight the chart-adjusted planet valence by
 * the line type's traditional strength (AC/MC felt strongest) and by
 * closeness to that specific line, then sum. Sort descending for "best",
 * ascending for "worst".
 */
export function scoreCities(
  chart: ChartResponse,
  enabledLineTypes: Set<string> = new Set(LINE_TYPES)
): CityScore[] {
  const valenceByPlanet: Record<string, number> = {};
  for (const planet of Object.keys(chart.lines)) {
    valenceByPlanet[planet] = chartValence(chart, planet);
  }

  return CITIES.map((city) => {
    const contributions: LineContribution[] = [];
    let score = 0;

    for (const [planet, lineData] of Object.entries(chart.lines)) {
      for (const lineType of LINE_TYPES) {
        if (!enabledLineTypes.has(lineType)) continue;
        const distanceKm = distanceToLine(city, lineData, lineType);
        const contribution =
          valenceByPlanet[planet] * LINE_TYPE_WEIGHT[lineType] * Math.exp(-distanceKm / FALLOFF_KM);
        contributions.push({ planet, lineType, distanceKm, contribution });
        score += contribution;
      }
    }

    contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    return { city, score, topContribution: contributions[0] ?? null, contributions };
  }).sort((a, b) => b.score - a.score);
}
