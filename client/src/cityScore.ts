import type { ChartResponse } from './api';
import { CITIES, type City } from './cities';
import { PLANET_WEIGHT, LINE_TYPE_WEIGHT, SIGN_RULERS, signIndexOf, dignityModifier } from './planets';

const R_KM = 6371;
const LINE_TYPES = ['mc', 'ic', 'ac', 'dc'] as const;
type LineType = (typeof LINE_TYPES)[number];
type ScoreLineType = LineType | 'ls';

export interface Point {
  lat: number;
  lon: number;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(a));
}

// Nearest point on a meridian (constant longitude, MC/IC lines) to any point is at
// that point's own latitude — using the two stored endpoints directly would wildly
// overstate the distance for most locations.
function distanceToMeridian(point: Point, meridianLon: number): number {
  return haversineKm(point.lat, point.lon, point.lat, meridianLon);
}

// AC/DC curves are sampled every 0.5 deg of latitude, so nearest-vertex distance
// is a reasonable (if not exact) approximation of nearest-point-on-curve.
function minDistanceToSampledCurve(point: Point, segments: [number, number][][]): number {
  let min = Infinity;
  for (const seg of segments) {
    for (const [lat, lon] of seg) {
      const d = haversineKm(point.lat, point.lon, lat, lon);
      if (d < min) min = d;
    }
  }
  return min;
}

function distanceToLine(point: Point, lineData: ChartResponse['lines'][string], lineType: LineType): number {
  if (lineType === 'mc') return distanceToMeridian(point, lineData.mc.lon);
  if (lineType === 'ic') return distanceToMeridian(point, lineData.ic.lon);
  return minDistanceToSampledCurve(point, lineData[lineType].segments);
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
  lineType: ScoreLineType;
  distanceKm: number;
  contribution: number;
}

export interface PointScore {
  score: number;
  topContribution: LineContribution | null;
  contributions: LineContribution[];
}

export interface CityScore extends PointScore {
  city: City;
}

// A sigmoid squashes the raw (unbounded, roughly -2..+2 in practice) score into a
// friendlier 0-100 scale, 50 = neutral. k=1.2 was picked so the existing +-0.5
// "supportive"/"challenging" verdict thresholds land around 65/35 - a visible but
// not extreme shift from neutral.
export function scoreTo100(score: number): number {
  return Math.round(100 / (1 + Math.exp(-1.2 * score)));
}

const FALLOFF_KM = 300; // e-fold distance for "being near a line" influence
// How many of a point's closest lines actually count toward its score. Summing
// every one of a chart's ~40 planet/line-type combinations (even distant ones,
// since the falloff never hits exactly zero) systematically favors "supportive"
// everywhere: there are more traditionally positive planets (Sun, Moon, Mercury,
// Venus, Jupiter, Uranus, Neptune) than negative ones (Mars, Saturn, Pluto), so
// the sheer count advantage drowns out actually being close to a malefic line.
// A real reading looks at what's nearby, not a diffuse average of everything.
const SCORED_LINE_COUNT = 5;

function valenceByPlanet(chart: ChartResponse): Record<string, number> {
  const result: Record<string, number> = {};
  for (const planet of Object.keys(chart.lines)) {
    result[planet] = chartValence(chart, planet);
  }
  return result;
}

/**
 * "Best/worst places" heuristic score for a single point: for every
 * (planet, line type) pair enabled in `enabledLineTypes`, weight the
 * chart-adjusted planet valence by the line type's traditional strength
 * (AC/MC felt strongest) and by closeness to that specific line, then sum.
 */
export function scorePoint(
  chart: ChartResponse,
  point: Point,
  enabledLineTypes: Set<string> = new Set(LINE_TYPES),
  includeLocalSpace = false
): PointScore {
  const valence = valenceByPlanet(chart);
  const contributions: LineContribution[] = [];

  for (const [planet, lineData] of Object.entries(chart.lines)) {
    for (const lineType of LINE_TYPES) {
      if (!enabledLineTypes.has(lineType)) continue;
      const distanceKm = distanceToLine(point, lineData, lineType);
      const contribution = valence[planet] * LINE_TYPE_WEIGHT[lineType] * Math.exp(-distanceKm / FALLOFF_KM);
      contributions.push({ planet, lineType, distanceKm, contribution });
    }
  }

  if (includeLocalSpace) {
    for (const [planet, ls] of Object.entries(chart.localSpace)) {
      const distanceKm = minDistanceToSampledCurve(point, ls.segments);
      const contribution = (valence[planet] ?? 0) * LINE_TYPE_WEIGHT.ls * Math.exp(-distanceKm / FALLOFF_KM);
      contributions.push({ planet, lineType: 'ls', distanceKm, contribution });
    }
  }

  // Score sums the top N most astrologically significant contributions (weighted
  // by valence, not just distance) - sorted separately so it's unaffected by how
  // `contributions` gets ordered below for display.
  const byContribution = [...contributions].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const score = byContribution.slice(0, SCORED_LINE_COUNT).reduce((sum, c) => sum + c.contribution, 0);

  // Display order is genuine proximity: "closest lines" should mean closest in
  // km, matching how orb-based astrocartography readings actually work, not
  // which lines happen to carry the most weighted influence.
  contributions.sort((a, b) => a.distanceKm - b.distanceKm);
  return { score, topContribution: contributions[0] ?? null, contributions };
}

/** Same scoring applied across the curated city list, sorted best-first. */
export function scoreCities(
  chart: ChartResponse,
  enabledLineTypes: Set<string> = new Set(LINE_TYPES),
  includeLocalSpace = false
): CityScore[] {
  return CITIES.map((city) => ({
    city,
    ...scorePoint(chart, city, enabledLineTypes, includeLocalSpace),
  })).sort((a, b) => b.score - a.score);
}
