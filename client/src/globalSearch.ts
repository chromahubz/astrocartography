import { geoContains } from 'd3-geo';
import { landFeature } from './landData';
import { scorePoint, haversineKm, type Point, type PointScore } from './cityScore';
import type { ChartResponse } from './api';

const GRID_STEP_DEG = 4;

// A worldwide grid of land-only points, built once and cached. Curated city
// lists are sparse and unevenly distributed (more entries in the US/Europe
// than, say, Central Asia), which is exactly why a small real city and a tiny
// islet can land at similar scores in that list - neither is "wrong," the
// list just has nothing better-placed nearby to compare against. Searching
// actual land everywhere sidesteps that.
// Excludes Antarctica and the Arctic. This isn't just "no one lives there":
// near the poles, meridians genuinely converge in real-world km, so an
// AC/DC curve's circumpolar cutoff can sit only a short haversine distance
// from a huge range of longitudes at once - the closeness there is real, but
// it reflects polar geometry, not anything meaningful for "where to live."
// The Arctic/Antarctic Circles (66.5 deg) are the standard, non-arbitrary
// boundary for this; -56 clears Ushuaia, the world's southernmost city.
const MIN_LAT = -56;
const MAX_LAT = 66.5;

let cachedGrid: Point[] | null = null;
function landGrid(): Point[] {
  if (cachedGrid) return cachedGrid;
  const points: Point[] = [];
  for (let lat = MIN_LAT; lat <= MAX_LAT; lat += GRID_STEP_DEG) {
    for (let lon = -180; lon < 180; lon += GRID_STEP_DEG) {
      if (geoContains(landFeature, [lon, lat])) points.push({ lat, lon });
    }
  }
  cachedGrid = points;
  return points;
}

export interface GlobalSpot extends PointScore {
  lat: number;
  lon: number;
}

/**
 * Top-scoring land points worldwide, not restricted to any curated city list.
 * Greedily enforces a minimum separation between results so the list can't
 * fill up with several near-identical points from the same lucky corridor -
 * the same clustering the curated list was prone to, just worse without a
 * minimum-distance safeguard, since raw grid points are far denser than any
 * hand-picked city list.
 */
export function findGlobalTopSpots(
  chart: ChartResponse,
  enabledLineTypes: Set<string>,
  includeLocalSpace: boolean,
  count = 8,
  minSeparationKm = 600,
  worst = false
): GlobalSpot[] {
  const scored: GlobalSpot[] = landGrid().map((p) => ({
    lat: p.lat,
    lon: p.lon,
    ...scorePoint(chart, p, enabledLineTypes, includeLocalSpace),
  }));
  scored.sort((a, b) => (worst ? a.score - b.score : b.score - a.score));

  const picked: GlobalSpot[] = [];
  for (const candidate of scored) {
    if (picked.length >= count) break;
    const tooClose = picked.some((p) => haversineKm(p.lat, p.lon, candidate.lat, candidate.lon) < minSeparationKm);
    if (!tooClose) picked.push(candidate);
  }
  return picked;
}
