import { useMemo, useState } from 'react';
import { geoAzimuthalEquidistant, geoPath, geoGraticule10, type GeoProjection } from 'd3-geo';
import * as topojson from 'topojson-client';
import landTopo from 'world-atlas/land-110m.json';
import type { ChartResponse } from './api';
import { PLANET_META, LINE_STYLES } from './planets';

const SIZE = 560;
const CENTER = SIZE / 2;
const RADIUS = CENTER - 2;
const CLIP_ANGLE_DEG = 150; // roughly the Antarctic-circle-style cutoff classic azimuthal maps use
// scale must be set so the clip boundary lands exactly on the disc's edge - otherwise most of the
// globe projects outside the visible circle instead of warping visibly within it.
const SCALE = RADIUS / (CLIP_ANGLE_DEG * (Math.PI / 180));

// d3 projections take [longitude, latitude] and use south-pole-centered clipping
// oddly, so this helper just keeps the (lon, lat) ordering straight in one place
// against our app's usual (lat, lon) convention.
function project(projection: GeoProjection, lat: number, lon: number): [number, number] | null {
  const p = projection([lon, lat]);
  return p ? [p[0], p[1]] : null;
}

/** Break a lat/lon polyline into SVG-point strings, splitting wherever the
 * projection clips a point out (near the antipodal edge) rather than drawing a
 * spurious line across the whole disc. */
function projectPolyline(projection: GeoProjection, points: [number, number][]): string[] {
  const strings: string[] = [];
  let current: string[] = [];
  for (const [lat, lon] of points) {
    const p = project(projection, lat, lon);
    if (!p) {
      if (current.length > 1) strings.push(current.join(' '));
      current = [];
      continue;
    }
    current.push(`${p[0]},${p[1]}`);
  }
  if (current.length > 1) strings.push(current.join(' '));
  return strings;
}

export default function PolarView({
  chart,
  visiblePlanets,
  visibleLineTypes,
}: {
  chart: ChartResponse;
  visiblePlanets: Set<string>;
  visibleLineTypes: Set<string>;
}) {
  const [hemisphere, setHemisphere] = useState<'N' | 'S'>('N');

  const projection = useMemo(() => {
    const p = geoAzimuthalEquidistant()
      .rotate([0, hemisphere === 'N' ? -90 : 90])
      .clipAngle(CLIP_ANGLE_DEG) // the far pole stretches to infinity in this projection - clip before it gets absurd
      .translate([CENTER, CENTER])
      .scale(SCALE);
    return p;
  }, [hemisphere]);

  const land = useMemo(() => {
    const geo = topojson.feature(landTopo as never, (landTopo as never as { objects: { land: never } }).objects.land);
    return geoPath(projection)(geo as never) ?? '';
  }, [projection]);

  const graticule = useMemo(() => geoPath(projection)(geoGraticule10()) ?? '', [projection]);

  const lines = useMemo(() => {
    const items: { key: string; d: string; color: string; dashArray?: string; weight: number }[] = [];
    for (const [planet, data] of Object.entries(chart.lines)) {
      if (!visiblePlanets.has(planet)) continue;
      const color = PLANET_META[planet]?.color ?? '#888';
      for (const lineType of ['mc', 'ic', 'ac', 'dc'] as const) {
        if (!visibleLineTypes.has(lineType)) continue;
        const style = LINE_STYLES[lineType];
        // The backend pre-splits AC/DC curves wherever they cross +-180 longitude,
        // purely so the Mercator map doesn't draw a spurious line across the whole
        // world there. That split is meaningless in this projection (there's no
        // seam - only the antipodal point is a singularity) and reusing it as-is
        // would draw an artificial gap in any curve that happens to cross +-180.
        // Concatenating the segments back exactly reconstructs the original
        // continuous curve, since splitting only cuts the point list, never
        // reorders or drops points.
        const continuousPoints = data[lineType].segments.flat();
        projectPolyline(projection, continuousPoints).forEach((pointsStr, j) => {
          items.push({
            key: `${planet}-${lineType}-${j}`,
            d: `M${pointsStr.replace(/ /g, 'L')}`,
            color,
            dashArray: style.dashArray,
            weight: style.weight,
          });
        });
      }
    }
    return items;
  }, [chart, visiblePlanets, visibleLineTypes, projection]);

  const birthPoint = project(projection, chart.input.lat, chart.input.lon);

  return (
    <div className="polar-view">
      <div className="polar-controls">
        <button type="button" className={hemisphere === 'N' ? 'tab active' : 'tab'} onClick={() => setHemisphere('N')}>
          North-centered
        </button>
        <button type="button" className={hemisphere === 'S' ? 'tab active' : 'tab'} onClick={() => setHemisphere('S')}>
          South-centered
        </button>
      </div>
      <p className="hint polar-caption">
        Azimuthal equidistant projection &mdash; the real map projection popularly (and incorrectly)
        called the "flat earth map." Meridians (MC/IC) become straight lines from the center; the far
        pole is clipped before it stretches into the disc's outer edge. A fun alternate view, not a
        claim about the Earth's actual shape.
      </p>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="polar-svg">
        <defs>
          <clipPath id="polar-disc-clip">
            <circle cx={CENTER} cy={CENTER} r={RADIUS} />
          </clipPath>
        </defs>
        <circle cx={CENTER} cy={CENTER} r={RADIUS} className="polar-ocean" />
        <g clipPath="url(#polar-disc-clip)">
          <path d={graticule} className="polar-graticule" />
          <path d={land} className="polar-land" />
          {lines.map((l) => (
            <path
              key={l.key}
              d={l.d}
              stroke={l.color}
              strokeWidth={l.weight}
              strokeDasharray={l.dashArray}
              fill="none"
              opacity={0.9}
            />
          ))}
        </g>
        {birthPoint && (
          <text x={birthPoint[0]} y={birthPoint[1]} textAnchor="middle" dominantBaseline="middle" className="polar-birth-marker">
            ★
          </text>
        )}
      </svg>
    </div>
  );
}
