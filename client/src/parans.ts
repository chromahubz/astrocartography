import type { ChartResponse } from './api';
import { findCrossings } from './lineCrossings';

export interface Paran {
  lat: number;
  a: { planet: string; lineType: 'mc' | 'ic' | 'ac' | 'dc' };
  b: { planet: string; lineType: 'mc' | 'ic' | 'ac' | 'dc' };
}

/**
 * Parans: latitudes where two different planets are simultaneously angular
 * (rising/setting/culminating), classically read as a combined influence
 * along that entire latitude band, not just at one map point. Geometrically
 * this is the same condition as a line crossing (findCrossings) - a paran is
 * that crossing's latitude generalized across all longitudes, since the
 * underlying "same local sidereal time" condition depends only on latitude.
 */
export function findParans(
  chart: ChartResponse,
  enabledLineTypes: Set<string>,
  enabledPlanets: Set<string>
): Paran[] {
  const crossings = findCrossings(chart, enabledLineTypes, enabledPlanets);
  const seen = new Set<string>();
  const parans: Paran[] = [];
  for (const c of crossings) {
    const key = `${c.a.planet}:${c.a.lineType}:${c.b.planet}:${c.b.lineType}:${c.lat.toFixed(1)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parans.push({ lat: c.lat, a: c.a, b: c.b });
  }
  return parans.sort((x, y) => x.lat - y.lat);
}
