import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { ChartResponse, RelocateResponse } from './api';
import { PLANET_META, LINE_STYLES, LINE_TYPE_LABEL } from './planets';
import type { PointScore } from './cityScore';
import PlaceReading from './PlaceReading';
import { findCrossings } from './lineCrossings';
import { findParans } from './parans';
import { lineMeaning } from './lineMeanings';
import type { DistanceUnit } from './units';

interface Props {
  chart: ChartResponse;
  visiblePlanets: Set<string>;
  visibleLineTypes: Set<string>;
  showLocalSpace: boolean;
  showCrossings: boolean;
  showParans: boolean;
  onMapClick: (lat: number, lon: number) => void;
  relocation: RelocateResponse | null;
  relocationPoint: [number, number] | null;
  placeName: string | null;
  pointScore: PointScore | null;
  unit: DistanceUnit;
  /** Bumped whenever a new point should be flown to and its popup opened (e.g. a search selection). */
  focusKey?: number;
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

export default function AstroMap({
  chart,
  visiblePlanets,
  visibleLineTypes,
  showLocalSpace,
  showCrossings,
  showParans,
  onMapClick,
  relocation,
  relocationPoint,
  placeName,
  pointScore,
  unit,
  focusKey,
}: Props) {
  const targetMarkerRef = useRef<L.Marker>(null);

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
