import { useState } from 'react';
import 'leaflet/dist/leaflet.css';
import './App.css';
import BirthForm from './BirthForm';
import AstroMap from './AstroMap';
import Legend from './Legend';
import NatalSummary from './NatalSummary';
import BestCities from './BestCities';
import { fetchChart, fetchRelocation, type ChartResponse, type RelocateResponse } from './api';
import { PLANET_META } from './planets';

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

  const [relocation, setRelocation] = useState<RelocateResponse | null>(null);
  const [relocationPoint, setRelocationPoint] = useState<[number, number] | null>(null);

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

  async function handleMapClick(lat: number, lon: number) {
    if (!birthInput) return;
    setRelocationPoint([lat, lon]);
    setRelocation(null);
    try {
      const r = await fetchRelocation({ ...birthInput, targetLat: lat, targetLon: lon });
      setRelocation(r);
    } catch {
      // ignore
    }
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
            />
            <NatalSummary chart={chart} />
            <BestCities chart={chart} enabledLineTypes={visibleLineTypes} />
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
            onMapClick={handleMapClick}
            relocation={relocation}
            relocationPoint={relocationPoint}
          />
        ) : (
          <div className="placeholder">Enter your birth data to generate your astrocartography map.</div>
        )}
      </main>
    </div>
  );
}
