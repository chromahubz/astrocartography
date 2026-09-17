import { useState } from 'react';
import type { ChartResponse } from './api';
import { PLANET_META, degToSign } from './planets';
import { computeAspects, ASPECT_SYMBOL } from './aspects';

export default function NatalSummary({ chart }: { chart: ChartResponse }) {
  const [showAspects, setShowAspects] = useState(false);
  const aspects = computeAspects(chart.ecliptic);

  return (
    <div className="natal-summary">
      <h3>Natal Positions</h3>
      <div className="meta-row">
        Timezone: {chart.resolvedTimeZone} (UTC{chart.utcOffsetMinutes >= 0 ? '+' : ''}
        {chart.utcOffsetMinutes / 60})
      </div>
      <div className="meta-row">ASC: {degToSign(chart.houses.ascendant)}</div>
      <div className="meta-row">MC: {degToSign(chart.houses.mc)}</div>
      <table>
        <tbody>
          {Object.entries(chart.ecliptic).map(([planet, pos]) => (
            <tr key={planet}>
              <td style={{ color: PLANET_META[planet]?.color }}>{PLANET_META[planet]?.symbol}</td>
              <td>{PLANET_META[planet]?.label}</td>
              <td>{degToSign(pos.longitude)}</td>
              <td>{pos.speed < 0 ? '℞' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button type="button" className="section-toggle" onClick={() => setShowAspects((s) => !s)}>
        {showAspects ? '▾' : '▸'} Aspects ({aspects.length})
      </button>
      {showAspects && (
        <ul className="aspect-list">
          {aspects.map((a, i) => (
            <li key={i}>
              <span style={{ color: PLANET_META[a.planetA]?.color }}>{PLANET_META[a.planetA]?.symbol}</span>
              {' '}
              <span className="aspect-symbol">{ASPECT_SYMBOL[a.type]}</span>{' '}
              <span style={{ color: PLANET_META[a.planetB]?.color }}>{PLANET_META[a.planetB]?.symbol}</span>{' '}
              <span className="aspect-type">{a.type}</span>{' '}
              <span className="aspect-orb">(orb {a.orb.toFixed(1)}&deg;)</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
