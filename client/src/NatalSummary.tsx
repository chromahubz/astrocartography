import type { ChartResponse } from './api';
import { PLANET_META, degToSign } from './planets';

export default function NatalSummary({ chart }: { chart: ChartResponse }) {
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
    </div>
  );
}
