import { useState } from 'react';
import 'leaflet/dist/leaflet.css';
import './App.css';
import BirthForm from './BirthForm';
import AstroMap from './AstroMap';
import Legend from './Legend';
import NatalSummary from './NatalSummary';
import BestCities from './BestCities';
import CityCheck from './CityCheck';
import { fetchChart, fetchRelocation, reverseGeocode, type ChartResponse, type RelocateResponse } from './api';
import { PLANET_META } from './planets';
import { scorePoint, type PointScore } from './cityScore';

export default function App() {
  const [chart, setChart] = useState<ChartResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [birthInput, setBirthInput] = useState<{ date: string; time: string; lat: number; lon: number } | null>(
    null
  );

  const [visiblePlanets, setVisiblePlanets] = useState(new Set(Object.keys(PLANET_META)));
  const [visibleLineTypes, setVisibleLineTypes] = useState(new Set(['mc', 'ic', 'ac', 'dc']));
  const [showLocalSpace, setShowLocalSpace] = useState(false);
  const [showCrossings, setShowCrossings] = useState(false);

  const [relocation, setRelocation] = useState<RelocateResponse | null>(null);
  const [relocationPoint, setRelocationPoint] = useState<[number, number] | null>(null);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [pointScore, setPointScore] = useState<PointScore | null>(null);
  const [focusKey, setFocusKey] = useState(0);

  async function handleSubmit(input: { date: string; time: string; lat: number; lon: number }) {
    setLoading(true);
    setError(null);
    setRelocation(null);
    setRelocationPoint(null);
    try {
      const data = await fetchChart(input);
      setChart(data);
      setBirthInput(input);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function evaluatePoint(lat: number, lon: number, knownPlaceName?: string) {
    if (!birthInput || !chart) return;
    setRelocationPoint([lat, lon]);
    setRelocation(null);
    setPlaceName(knownPlaceName ?? null);
    // Local-space scoring is instant (no network round trip), so show it right away.
    setPointScore(scorePoint(chart, { lat, lon }, visibleLineTypes));

    fetchRelocation({ ...birthInput, targetLat: lat, targetLon: lon })
      .then(setRelocation)
      .catch(() => {});
    if (!knownPlaceName) reverseGeocode(lat, lon).then(setPlaceName);
  }

  function handleMapClick(lat: number, lon: number) {
    evaluatePoint(lat, lon);
  }

  function handleSelectPlace(lat: number, lon: number, displayName: string) {
    evaluatePoint(lat, lon, displayName);
    setFocusKey((k) => k + 1);
  }

  function togglePlanet(p: string) {
    setVisiblePlanets((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  }

  function toggleLineType(t: string) {
    setVisibleLineTypes((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Astrocartography</h1>
        <BirthForm onSubmit={handleSubmit} loading={loading} />
        {error && <div className="error">{error}</div>}
        {chart && (
          <>
            <Legend
              visiblePlanets={visiblePlanets}
              onTogglePlanet={togglePlanet}
              visibleLineTypes={visibleLineTypes}
              onToggleLineType={toggleLineType}
              showLocalSpace={showLocalSpace}
              onToggleLocalSpace={() => setShowLocalSpace((s) => !s)}
              showCrossings={showCrossings}
              onToggleCrossings={() => setShowCrossings((s) => !s)}
            />
            <NatalSummary chart={chart} />
            <BestCities chart={chart} enabledLineTypes={visibleLineTypes} />
            <CityCheck
              onSelectPlace={handleSelectPlace}
              checkedPoint={relocationPoint}
              placeName={placeName}
              pointScore={pointScore}
              relocation={relocation}
            />
            <p className="hint">Click anywhere on the map to see the relocated ASC/MC for that spot.</p>
          </>
        )}
      </aside>
      <main className="map-area">
        {chart ? (
          <AstroMap
            chart={chart}
            visiblePlanets={visiblePlanets}
            visibleLineTypes={visibleLineTypes}
            showLocalSpace={showLocalSpace}
            showCrossings={showCrossings}
            onMapClick={handleMapClick}
            relocation={relocation}
            relocationPoint={relocationPoint}
            placeName={placeName}
            pointScore={pointScore}
            focusKey={focusKey}
          />
        ) : (
          <div className="placeholder">Enter your birth data to generate your astrocartography map.</div>
        )}
      </main>
    </div>
  );
}
