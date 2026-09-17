import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { ChartResponse, RelocateResponse } from './api';
import { PLANET_META, LINE_STYLES } from './planets';
import type { PointScore } from './cityScore';
import PlaceReading from './PlaceReading';

interface Props {
  chart: ChartResponse;
  visiblePlanets: Set<string>;
  visibleLineTypes: Set<string>;
  showLocalSpace: boolean;
  onMapClick: (lat: number, lon: number) => void;
  relocation: RelocateResponse | null;
  relocationPoint: [number, number] | null;
  placeName: string | null;
  pointScore: PointScore | null;
  /** Bumped whenever a new point should be flown to and its popup opened (e.g. a search selection). */
  focusKey?: number;
}

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
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
  onMapClick,
  relocation,
  relocationPoint,
  placeName,
  pointScore,
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

  return (
    <MapContainer
      center={[chart.input.lat, chart.input.lon]}
      zoom={3}
      worldCopyJump
      style={{ width: '100%', height: '100%' }}
    >
      {/* Wikimedia's "osm-intl" tiles render place labels with the international
          (largely English/Latin) name alongside the local one, rather than only
          the local script baked into standard OSM raster tiles. Free, no API key. */}
      <TileLayer
        url="https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, style by Wikimedia'
        maxZoom={18}
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
            />
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
