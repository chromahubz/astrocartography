import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, CircleMarker, ImageOverlay, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { ChartResponse, RelocateResponse } from './api';
import { PLANET_META, LINE_STYLES, LINE_TYPE_LABEL } from './planets';
import { scoreCities, scoreTo100, type CityScore, type PointScore } from './cityScore';
import PlaceReading from './PlaceReading';
import { findCrossings } from './lineCrossings';
import { findParans } from './parans';
import { lineMeaning } from './lineMeanings';
import { narrativeSummary } from './narrative';
import ExpandableText from './ExpandableText';
import { buildHeatmapDataUrl, HEATMAP_BOUNDS } from './heatmap';
import { formatDistance, type DistanceUnit } from './units';

interface Props {
  chart: ChartResponse;
  visiblePlanets: Set<string>;
  visibleLineTypes: Set<string>;
  showLocalSpace: boolean;
  showCrossings: boolean;
  showParans: boolean;
  showBestWorstPins: boolean;
  showHeatmap: boolean;
  onMapClick: (lat: number, lon: number) => void;
  relocation: RelocateResponse | null;
  relocationPoint: [number, number] | null;
  placeName: string | null;
  pointScore: PointScore | null;
  unit: DistanceUnit;
  /** Bumped whenever a new point should be flown to and its popup opened (e.g. a search selection). */
  focusKey?: number;
}

function PinPopupContent({ entry, unit }: { entry: CityScore; unit: DistanceUnit }) {
  const top = entry.topContribution;
  return (
    <div className="place-reading">
      <div className="place-name">
        {entry.city.name}, {entry.city.country} <span className="city-score">{scoreTo100(entry.score)}/100</span>
      </div>
      {top && (
        <div className="place-detail">
          closest:{' '}
          <span style={{ color: PLANET_META[top.planet]?.color }}>
            {PLANET_META[top.planet]?.symbol} {PLANET_META[top.planet]?.label} {LINE_TYPE_LABEL[top.lineType]}
          </span>{' '}
          ({formatDistance(top.distanceKm, unit)})
        </div>
      )}
      <ExpandableText className="place-narrative" text={narrativeSummary(entry.city.name, entry.contributions, entry.score)} />
    </div>
  );
}

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      // worldCopyJump lets you click a wrapped copy of the map, where raw lng can
      // fall outside -180..180 - normalize before it reaches any distance math.
      const wrapped = e.latlng.wrap();
      onMapClick(wrapped.lat, wrapped.lng);
    },
  });
  return null;
}

function FlyToOnFocus({ point, focusKey }: { point: [number, number] | null; focusKey: number | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (point && focusKey) map.flyTo(point, Math.max(map.getZoom(), 5));
  }, [focusKey, map]);
  return null;
}

const birthIcon = L.divIcon({
  className: 'birth-marker',
  html: '<div style="font-size:22px;line-height:1;">★</div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const targetIcon = L.divIcon({
  className: 'target-marker',
  html: '<div style="font-size:20px;line-height:1;">📍</div>',
  iconSize: [20, 20],
  iconAnchor: [10, 20],
});

const bestIcon = L.divIcon({
  className: 'best-place-marker',
  html: '<div style="font-size:18px;line-height:1;">🟢</div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const worstIcon = L.divIcon({
  className: 'worst-place-marker',
  html: '<div style="font-size:18px;line-height:1;">🔴</div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function AstroMap({
  chart,
  visiblePlanets,
  visibleLineTypes,
  showLocalSpace,
  showCrossings,
  showParans,
  showBestWorstPins,
  showHeatmap,
  onMapClick,
  relocation,
  relocationPoint,
  placeName,
  pointScore,
  unit,
  focusKey,
}: Props) {
  const targetMarkerRef = useRef<L.Marker>(null);
  const [heatmapUrl, setHeatmapUrl] = useState('');

  useEffect(() => {
    if (!showHeatmap) {
      setHeatmapUrl('');
      return;
    }
    // Defer so the "computing" state (an empty overlay while this runs) actually
    // paints before the heavy synchronous grid scoring blocks the main thread.
    const id = setTimeout(() => {
      setHeatmapUrl(buildHeatmapDataUrl(chart, visibleLineTypes, showLocalSpace));
    }, 0);
    return () => clearTimeout(id);
  }, [chart, visibleLineTypes, showLocalSpace, showHeatmap]);

  useEffect(() => {
    if (relocationPoint) targetMarkerRef.current?.openPopup();
  }, [relocationPoint]);

  const polylines = useMemo(() => {
    const items: { key: string; positions: [number, number][]; color: string; dashArray?: string; weight: number }[] = [];
    for (const [planet, data] of Object.entries(chart.lines)) {
      if (!visiblePlanets.has(planet)) continue;
      const color = PLANET_META[planet]?.color ?? '#888';
      for (const lineType of ['mc', 'ic', 'ac', 'dc'] as const) {
        if (!visibleLineTypes.has(lineType)) continue;
        const style = LINE_STYLES[lineType];
        data[lineType].segments.forEach((seg, i) => {
          items.push({
            key: `${planet}-${lineType}-${i}`,
            positions: seg,
            color,
            dashArray: style.dashArray,
            weight: style.weight,
          });
        });
      }
    }
    if (showLocalSpace) {
      for (const [planet, data] of Object.entries(chart.localSpace)) {
        if (!visiblePlanets.has(planet)) continue;
        const color = PLANET_META[planet]?.color ?? '#888';
        data.segments.forEach((seg, i) => {
          items.push({
            key: `${planet}-ls-${i}`,
            positions: seg,
            color,
            dashArray: '1 4',
            weight: 1.5,
          });
        });
      }
    }
    return items;
  }, [chart, visiblePlanets, visibleLineTypes, showLocalSpace]);

  const crossings = useMemo(() => {
    if (!showCrossings) return [];
    return findCrossings(chart, visibleLineTypes, visiblePlanets);
  }, [chart, visibleLineTypes, visiblePlanets, showCrossings]);

  const parans = useMemo(() => {
    if (!showParans) return [];
    return findParans(chart, visibleLineTypes, visiblePlanets);
  }, [chart, visibleLineTypes, visiblePlanets, showParans]);

  const { bestPins, worstPins } = useMemo(() => {
    if (!showBestWorstPins) return { bestPins: [], worstPins: [] };
    const ranked = scoreCities(chart, visibleLineTypes, showLocalSpace);
    return { bestPins: ranked.slice(0, 5), worstPins: ranked.slice(-5).reverse() };
  }, [chart, visibleLineTypes, showLocalSpace, showBestWorstPins]);

  return (
    <MapContainer
      center={[chart.input.lat, chart.input.lon]}
      zoom={3}
      worldCopyJump
      style={{ width: '100%', height: '100%' }}
    >
      {/* Esri's World Street Map: labels in English/Latin script worldwide, free to
          embed with no API key (unlike Wikimedia's osm-intl tiles, which are
          restricted to Wikimedia's own sites and blocked third-party production use). */}
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom"
        maxZoom={19}
      />
      <ClickHandler onMapClick={onMapClick} />
      <FlyToOnFocus point={relocationPoint} focusKey={focusKey} />
      {heatmapUrl && <ImageOverlay url={heatmapUrl} bounds={HEATMAP_BOUNDS} />}
      {polylines.map((p) => (
        <Polyline
          key={p.key}
          positions={p.positions}
          pathOptions={{ color: p.color, weight: p.weight, dashArray: p.dashArray, opacity: 0.85 }}
        />
      ))}
      {crossings.map((c, i) => (
        <CircleMarker
          key={i}
          center={[c.lat, c.lon]}
          radius={5}
          pathOptions={{ color: '#fff', weight: 1, fillColor: '#f2f2f2', fillOpacity: 0.9 }}
        >
          <Popup>
            <div className="crossing-popup">
              <strong>Planetary crossing</strong>
              {[c.a, c.b].map((side, idx) => (
                <div key={idx} className="crossing-line">
                  <span style={{ color: PLANET_META[side.planet]?.color }}>
                    {PLANET_META[side.planet]?.symbol} {PLANET_META[side.planet]?.label} {LINE_TYPE_LABEL[side.lineType]}
                  </span>
                  <div className="place-line-meaning">{lineMeaning(side.planet, side.lineType)}</div>
                </div>
              ))}
            </div>
          </Popup>
        </CircleMarker>
      ))}
      {parans.map((p, i) => (
        <Polyline
          key={`paran-${i}`}
          positions={[[p.lat, -179], [p.lat, 179]]}
          pathOptions={{ color: '#f2f2f2', weight: 1, dashArray: '2 6', opacity: 0.6 }}
        >
          <Popup>
            <div className="crossing-popup">
              <strong>Paran at {p.lat >= 0 ? `${p.lat.toFixed(1)}°N` : `${(-p.lat).toFixed(1)}°S`}</strong>
              {[p.a, p.b].map((side, idx) => (
                <div key={idx} className="crossing-line">
                  <span style={{ color: PLANET_META[side.planet]?.color }}>
                    {PLANET_META[side.planet]?.symbol} {PLANET_META[side.planet]?.label} {LINE_TYPE_LABEL[side.lineType]}
                  </span>
                </div>
              ))}
            </div>
          </Popup>
        </Polyline>
      ))}
      {bestPins.map((entry) => (
        <Marker key={`best-${entry.city.name}`} position={[entry.city.lat, entry.city.lon]} icon={bestIcon}>
          <Popup>
            <PinPopupContent entry={entry} unit={unit} />
          </Popup>
        </Marker>
      ))}
      {worstPins.map((entry) => (
        <Marker key={`worst-${entry.city.name}`} position={[entry.city.lat, entry.city.lon]} icon={worstIcon}>
          <Popup>
            <PinPopupContent entry={entry} unit={unit} />
          </Popup>
        </Marker>
      ))}
      <Marker position={[chart.input.lat, chart.input.lon]} icon={birthIcon}>
        <Popup>Birthplace</Popup>
      </Marker>
      {relocationPoint && (
        <Marker position={relocationPoint} icon={targetIcon} ref={targetMarkerRef}>
          <Popup minWidth={220}>
            <PlaceReading
              placeName={placeName}
              lat={relocationPoint[0]}
              lon={relocationPoint[1]}
              pointScore={pointScore}
              relocation={relocation}
              unit={unit}
            />
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
