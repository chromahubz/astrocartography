import { useMemo, useRef, useState } from 'react';
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
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const CLICK_DRAG_THRESHOLD_PX = 4;

// d3 projections take [longitude, latitude]; this helper just keeps that ordering
// straight in one place against our app's usual (lat, lon) convention.
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

interface Props {
  chart: ChartResponse;
  visiblePlanets: Set<string>;
  visibleLineTypes: Set<string>;
  onMapClick: (lat: number, lon: number) => void;
  relocationPoint: [number, number] | null;
}

export default function PolarView({ chart, visiblePlanets, visibleLineTypes, onMapClick, relocationPoint }: Props) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number; moved: boolean } | null>(
    null
  );
  const svgRef = useRef<SVGSVGElement>(null);

  const projection = useMemo(() => {
    return geoAzimuthalEquidistant()
      .rotate([0, -90]) // North-pole-centered
      .clipAngle(CLIP_ANGLE_DEG) // the far pole stretches to infinity in this projection - clip before it gets absurd
      .translate([CENTER, CENTER])
      .scale(SCALE);
  }, []);

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
        // would draw an artificial gap in any curve that happened to cross +-180.
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
  const targetPoint = relocationPoint ? project(projection, relocationPoint[0], relocationPoint[1]) : null;

  function clampPan(next: { x: number; y: number }, z: number) {
    // Keep at least a small sliver of the disc on-screen rather than letting it
    // fly off completely - bound pan proportional to how far zoomed in we are.
    const maxOffset = RADIUS * (z - 1) + RADIUS * 0.6;
    return {
      x: Math.max(-maxOffset, Math.min(maxOffset, next.x)),
      y: Math.max(-maxOffset, Math.min(maxOffset, next.y)),
    };
  }

  function zoomBy(factor: number) {
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * factor)));
  }

  function handleWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15);
  }

  function svgUnitsPerPixel() {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect ? SIZE / rect.width : 1;
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, moved: false };
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragRef.current) return;
    const scale = svgUnitsPerPixel();
    const dx = (e.clientX - dragRef.current.startX) * scale;
    const dy = (e.clientY - dragRef.current.startY) * scale;
    if (Math.abs(e.clientX - dragRef.current.startX) > CLICK_DRAG_THRESHOLD_PX ||
        Math.abs(e.clientY - dragRef.current.startY) > CLICK_DRAG_THRESHOLD_PX) {
      dragRef.current.moved = true;
    }
    setPan(clampPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy }, zoom));
  }

  function handlePointerUp(e: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.moved || !svgRef.current) return; // a real drag, not a click

    // Screen px -> SVG viewBox coordinates.
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * SIZE;
    const svgY = ((e.clientY - rect.top) / rect.height) * SIZE;

    // Undo the pan/zoom transform on the inner <g> to get back to the
    // projection's own (untransformed) pixel space, which .invert() expects.
    const preZoomX = (svgX - pan.x - CENTER) / zoom + CENTER;
    const preZoomY = (svgY - pan.y - CENTER) / zoom + CENTER;

    const lonLat = projection.invert?.([preZoomX, preZoomY]);
    if (lonLat) onMapClick(lonLat[1], lonLat[0]);
  }

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  return (
    <div className="polar-view">
      <p className="hint polar-caption">
        Azimuthal equidistant projection &mdash; the real map projection popularly (and incorrectly)
        called the "flat earth map." Meridians (MC/IC) become straight lines from the center; the far
        pole is clipped before it stretches into the disc's outer edge. An alternate view, not a claim
        about the Earth's actual shape. Click anywhere for a reading, same as the map view.
      </p>
      <div className="polar-svg-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="polar-svg"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <defs>
            <clipPath id="polar-disc-clip">
              <circle cx={CENTER} cy={CENTER} r={RADIUS} />
            </clipPath>
          </defs>
          <circle cx={CENTER} cy={CENTER} r={RADIUS} className="polar-ocean" />
          <g clipPath="url(#polar-disc-clip)">
            <g transform={`translate(${pan.x} ${pan.y}) translate(${CENTER} ${CENTER}) scale(${zoom}) translate(${-CENTER} ${-CENTER})`}>
              <path d={graticule} className="polar-graticule" />
              <path d={land} className="polar-land" />
              {lines.map((l) => (
                <path
                  key={l.key}
                  d={l.d}
                  stroke={l.color}
                  strokeWidth={l.weight / zoom}
                  strokeDasharray={l.dashArray}
                  fill="none"
                  opacity={0.9}
                />
              ))}
              {birthPoint && (
                <text
                  x={birthPoint[0]}
                  y={birthPoint[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="polar-birth-marker"
                  fontSize={20 / zoom}
                >
                  ★
                </text>
              )}
              {targetPoint && (
                <text
                  x={targetPoint[0]}
                  y={targetPoint[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="polar-target-marker"
                  fontSize={20 / zoom}
                >
                  📍
                </text>
              )}
            </g>
          </g>
        </svg>
        <div className="polar-zoom-controls">
          <button type="button" onClick={() => zoomBy(1.4)} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out">
            &minus;
          </button>
          <button type="button" onClick={resetView} aria-label="Reset view" className="polar-zoom-reset">
            reset
          </button>
        </div>
      </div>
    </div>
  );
}
