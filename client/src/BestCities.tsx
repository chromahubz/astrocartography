import { useMemo, useState } from 'react';
import type { ChartResponse } from './api';
import { scoreCities } from './cityScore';
import { PLANET_META } from './planets';

export default function BestCities({ chart }: { chart: ChartResponse }) {
  const [open, setOpen] = useState(false);
  const ranked = useMemo(() => scoreCities(chart), [chart]);
  const top = ranked.slice(0, 10);

  return (
    <div className="best-cities">
      <button type="button" className="section-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} Best places to live (beta)
      </button>
      {open && (
        <>
          <p className="hint">
            Ranked by proximity to your supportive lines (Venus, Jupiter, Sun) and distance from
            challenging ones (Mars, Saturn, Pluto). A heuristic starting point, not a verdict.
          </p>
          <ol className="city-list">
            {top.map((c) => (
              <li key={c.city.name}>
                <div className="city-name">
                  {c.city.name}, {c.city.country}
                </div>
                <div className="city-detail">
                  closest: <span style={{ color: PLANET_META[c.nearestPlanet]?.color }}>
                    {PLANET_META[c.nearestPlanet]?.symbol} {PLANET_META[c.nearestPlanet]?.label}
                  </span>{' '}
                  line ({Math.round(c.nearestKm)} km)
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
