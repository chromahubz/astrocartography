import type { ChartResponse } from './api';

type LineType = 'mc' | 'ic' | 'ac' | 'dc';
type Segments = [number, number][][];

export interface Crossing {
  lat: number;
  lon: number;
  a: { planet: string; lineType: LineType };
  b: { planet: string; lineType: LineType };
}

function normalizeDelta(d: number): number {
  if (d > 180) return d - 360;
  if (d < -180) return d + 360;
  return d;
}

/** Where a meridian (constant longitude, MC/IC) crosses a sampled AC/DC curve. */
function meridianCurveCrossings(meridianLon: number, segments: Segments): number[] {
  const lats: number[] = [];
  for (const seg of segments) {
    for (let i = 0; i < seg.length - 1; i++) {
      const [lat1, lon1] = seg[i];
      const [lat2, lon2] = seg[i + 1];
      const d1 = normalizeDelta(lon1 - meridianLon);
      const d2 = normalizeDelta(lon2 - meridianLon);
      if (d1 === 0) lats.push(lat1);
      else if (d1 < 0 !== d2 < 0) {
        const t = d1 / (d1 - d2);
        lats.push(lat1 + (lat2 - lat1) * t);
      }
    }
  }
  // A curve point landing exactly on the meridian gets caught by both the exact-match
  // branch and the interpolation of the adjacent segment - collapse near-duplicates.
  lats.sort((a, b) => a - b);
  return lats.filter((lat, i) => i === 0 || Math.abs(lat - lats[i - 1]) > 0.01);
}

/** Where two sampled AC/DC curves (same latitude grid) cross each other. */
function curveCurveCrossings(segmentsA: Segments, segmentsB: Segments): [number, number][] {
  const mapB = new Map<string, number>();
  for (const seg of segmentsB) for (const [lat, lon] of seg) mapB.set(lat.toFixed(1), lon);

  const points: [number, number][] = [];
  for (const seg of segmentsA) {
    let prevDiff: number | null = null;
    let prevLat: number | null = null;
    let prevLonA: number | null = null;
    for (const [lat, lonA] of seg) {
      const lonB = mapB.get(lat.toFixed(1));
      if (lonB === undefined) {
        prevDiff = null; // gap (e.g. one curve is circumpolar-cut here) - don't bridge across it
        continue;
      }
      const diff = normalizeDelta(lonA - lonB);
      if (prevDiff !== null && prevLat !== null && prevLonA !== null && prevDiff < 0 !== diff < 0) {
        const t = prevDiff / (prevDiff - diff);
        points.push([prevLat + (lat - prevLat) * t, prevLonA + (lonA - prevLonA) * t]);
      }
      prevDiff = diff;
      prevLat = lat;
      prevLonA = lonA;
    }
  }
  return points;
}

/**
 * Points where two *different* planets' lines intersect - traditionally read as
 * a combined/amplified influence in astrocartography. Only cross-planet pairs
 * are considered (a planet's own lines meeting isn't a "crossing" in this sense).
 * MC/IC-vs-MC/IC pairs are skipped: both are constant-longitude meridians, so
 * two different ones never cross.
 */
export function findCrossings(
  chart: ChartResponse,
  enabledLineTypes: Set<string>,
  enabledPlanets: Set<string>
): Crossing[] {
  const planets = Object.keys(chart.lines).filter((p) => enabledPlanets.has(p));
  const crossings: Crossing[] = [];

  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const p1 = planets[i];
      const p2 = planets[j];
      const l1 = chart.lines[p1];
      const l2 = chart.lines[p2];

      for (const [meridianPlanet, meridianLines, curvePlanet, curveLines] of [
        [p1, l1, p2, l2],
        [p2, l2, p1, l1],
      ] as const) {
        for (const mtype of ['mc', 'ic'] as const) {
          if (!enabledLineTypes.has(mtype)) continue;
          for (const ctype of ['ac', 'dc'] as const) {
            if (!enabledLineTypes.has(ctype)) continue;
            const meridianLon = meridianLines[mtype].lon;
            for (const lat of meridianCurveCrossings(meridianLon, curveLines[ctype].segments)) {
              crossings.push({
                lat,
                lon: meridianLon,
                a: { planet: meridianPlanet, lineType: mtype },
                b: { planet: curvePlanet, lineType: ctype },
              });
            }
          }
        }
      }

      for (const t1 of ['ac', 'dc'] as const) {
        if (!enabledLineTypes.has(t1)) continue;
        for (const t2 of ['ac', 'dc'] as const) {
          if (!enabledLineTypes.has(t2)) continue;
          for (const [lat, lon] of curveCurveCrossings(l1[t1].segments, l2[t2].segments)) {
            crossings.push({ lat, lon, a: { planet: p1, lineType: t1 }, b: { planet: p2, lineType: t2 } });
          }
        }
      }
    }
  }

  return crossings;
}
