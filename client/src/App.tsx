import { useEffect, useMemo, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import './App.css';
import BirthForm from './BirthForm';
import AstroMap from './AstroMap';
import PolarView from './PolarView';
import Legend from './Legend';
import NatalSummary from './NatalSummary';
import TopPicks from './TopPicks';
import BestCities from './BestCities';
import CityCheck from './CityCheck';
import ParansList from './ParansList';
import { fetchChart, fetchRelocation, reverseGeocode, type ChartResponse, type RelocateResponse } from './api';
import { PLANET_META } from './planets';
import { scorePoint, type PointScore } from './cityScore';
import type { DistanceUnit } from './units';

type BirthInput = { date: string; time: string; lat: number; lon: number };

function readInitialBirthFromUrl(): (BirthInput & { label: string }) | null {
  const params = new URLSearchParams(window.location.search);
  const date = params.get('date');
  const time = params.get('time');
  const lat = params.get('lat');
  const lon = params.get('lon');
  const label = params.get('label');
  if (!date || !time || !lat || !lon) return null;
  return { date, time, lat: parseFloat(lat), lon: parseFloat(lon), label: label ?? `${lat}, ${lon}` };
}

export default function App() {
  const initialBirth = useMemo(readInitialBirthFromUrl, []);

  const [chart, setChart] = useState<ChartResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [birthInput, setBirthInput] = useState<BirthInput | null>(null);

  const [visiblePlanets, setVisiblePlanets] = useState(new Set(Object.keys(PLANET_META)));
  const [visibleLineTypes, setVisibleLineTypes] = useState(new Set(['mc', 'ic', 'ac', 'dc']));
  const [showLocalSpace, setShowLocalSpace] = useState(false);
  const [showCrossings, setShowCrossings] = useState(false);
  const [showParans, setShowParans] = useState(false);
  const [showBestWorstPins, setShowBestWorstPins] = useState(false);
  const [unit, setUnit] = useState<DistanceUnit>('km');
  const [mapMode, setMapMode] = useState<'mercator' | 'polar'>('mercator');

  const [relocation, setRelocation] = useState<RelocateResponse | null>(null);
  const [relocationPoint, setRelocationPoint] = useState<[number, number] | null>(null);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [pointScore, setPointScore] = useState<PointScore | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);

  async function handleSubmit(input: BirthInput, label?: string) {
    setLoading(true);
    setError(null);
    setRelocation(null);
    setRelocationPoint(null);
    try {
      const data = await fetchChart(input);
      setChart(data);
      setBirthInput(input);
      const params = new URLSearchParams({
        date: input.date,
        time: input.time,
        lat: String(input.lat),
        lon: String(input.lon),
        ...(label ? { label } : {}),
      });
      window.history.replaceState(null, '', `?${params.toString()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  // Auto-generate the chart if birth data was passed in via a shared link.
  useEffect(() => {
    if (initialBirth) {
      handleSubmit(
        { date: initialBirth.date, time: initialBirth.time, lat: initialBirth.lat, lon: initialBirth.lon },
        initialBirth.label
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function evaluatePoint(lat: number, lon: number, knownPlaceName?: string) {
    if (!birthInput || !chart) return;
    setRelocationPoint([lat, lon]);
    setRelocation(null);
    setPlaceName(knownPlaceName ?? null);
    // Local-space scoring is instant (no network round trip), so show it right away.
    setPointScore(scorePoint(chart, { lat, lon }, visibleLineTypes, showLocalSpace));

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

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // clipboard access denied - nothing more we can do here
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Astrocartography</h1>
        <BirthForm
          onSubmit={(input, label) => handleSubmit(input, label)}
          loading={loading}
          initial={
            initialBirth
              ? { date: initialBirth.date, time: initialBirth.time, lat: initialBirth.lat, lon: initialBirth.lon, label: initialBirth.label }
              : undefined
          }
        />
        {error && <div className="error">{error}</div>}
        {chart && (
          <>
            <div className="toolbar-row">
              <button type="button" className="show-more" onClick={copyLink}>
                {linkCopied ? 'Link copied!' : 'Copy shareable link'}
              </button>
              <div className="tab-row unit-toggle">
                <button type="button" className={unit === 'km' ? 'tab active' : 'tab'} onClick={() => setUnit('km')}>
                  km
                </button>
                <button type="button" className={unit === 'mi' ? 'tab active' : 'tab'} onClick={() => setUnit('mi')}>
                  mi
                </button>
              </div>
            </div>
            <div className="tab-row map-mode-toggle">
              <button
                type="button"
                className={mapMode === 'mercator' ? 'tab active' : 'tab'}
                onClick={() => setMapMode('mercator')}
              >
                Map
              </button>
              <button
                type="button"
                className={mapMode === 'polar' ? 'tab active' : 'tab'}
                onClick={() => setMapMode('polar')}
              >
                Polar view
              </button>
            </div>
            <Legend
              visiblePlanets={visiblePlanets}
              onTogglePlanet={togglePlanet}
              visibleLineTypes={visibleLineTypes}
              onToggleLineType={toggleLineType}
              showLocalSpace={showLocalSpace}
              onToggleLocalSpace={() => setShowLocalSpace((s) => !s)}
              showCrossings={showCrossings}
              onToggleCrossings={() => setShowCrossings((s) => !s)}
              showParans={showParans}
              onToggleParans={() => setShowParans((s) => !s)}
              showBestWorstPins={showBestWorstPins}
              onToggleBestWorstPins={() => setShowBestWorstPins((s) => !s)}
            />
            <NatalSummary chart={chart} />
            <TopPicks
              chart={chart}
              enabledLineTypes={visibleLineTypes}
              includeLocalSpace={showLocalSpace}
              unit={unit}
            />
            <BestCities
              chart={chart}
              enabledLineTypes={visibleLineTypes}
              includeLocalSpace={showLocalSpace}
              unit={unit}
            />
            <ParansList chart={chart} enabledLineTypes={visibleLineTypes} enabledPlanets={visiblePlanets} />
            <CityCheck
              onSelectPlace={handleSelectPlace}
              checkedPoint={relocationPoint}
              placeName={placeName}
              pointScore={pointScore}
              relocation={relocation}
              unit={unit}
            />
            <p className="hint">Click anywhere on the map to see the relocated ASC/MC for that spot.</p>
          </>
        )}
      </aside>
      <main className="map-area">
        {chart ? (
          mapMode === 'mercator' ? (
            <AstroMap
              chart={chart}
              visiblePlanets={visiblePlanets}
              visibleLineTypes={visibleLineTypes}
              showLocalSpace={showLocalSpace}
              showCrossings={showCrossings}
              showParans={showParans}
              showBestWorstPins={showBestWorstPins}
              onMapClick={handleMapClick}
              relocation={relocation}
              relocationPoint={relocationPoint}
              placeName={placeName}
              pointScore={pointScore}
              unit={unit}
              focusKey={focusKey}
            />
          ) : (
            <PolarView
              chart={chart}
              visiblePlanets={visiblePlanets}
              visibleLineTypes={visibleLineTypes}
              onMapClick={handleMapClick}
              relocationPoint={relocationPoint}
            />
          )
        ) : (
          <div className="placeholder">
            {loading ? 'Calculating…' : 'Enter your birth data to generate your astrocartography map.'}
          </div>
        )}
      </main>
    </div>
  );
}
