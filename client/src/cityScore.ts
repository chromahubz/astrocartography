import type { ChartResponse } from './api';
import { CITIES, type City } from './cities';
import { PLANET_WEIGHT } from './planets';

const R_KM = 6371;

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

export interface CityScore {
  city: City;
  score: number;
  nearestPlanet: string;
  nearestKm: number;
  contributions: { planet: string; distanceKm: number; contribution: number }[];
}

const FALLOFF_KM = 300; // e-fold distance for "being near a line" influence

/**
 * Heuristic "best places" score: proximity to each planet's astrocartography
 * lines (MC/IC/AC/DC combined), weighted by a classical benefic/malefic
 * classification (see PLANET_WEIGHT). This is a simplification offered as a
 * starting point for exploration, not a definitive verdict.
 */
export function scoreCities(chart: ChartResponse): CityScore[] {
  return CITIES.map((city) => {
    const contributions: CityScore['contributions'] = [];
    let score = 0;
    let nearestPlanet = '';
    let nearestKm = Infinity;

    for (const [planet, lineData] of Object.entries(chart.lines)) {
      const distKm = Math.min(
        distanceToMeridian(city, lineData.mc.lon),
        distanceToMeridian(city, lineData.ic.lon),
        minDistanceToSampledCurve(city, lineData.ac.segments),
        minDistanceToSampledCurve(city, lineData.dc.segments)
      );
      const weight = PLANET_WEIGHT[planet] ?? 0;
      const contribution = weight * Math.exp(-distKm / FALLOFF_KM);
      contributions.push({ planet, distanceKm: distKm, contribution });
      score += contribution;
      if (distKm < nearestKm) {
        nearestKm = distKm;
        nearestPlanet = planet;
      }
    }

    contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    return { city, score, nearestPlanet, nearestKm, contributions };
  }).sort((a, b) => b.score - a.score);
}
