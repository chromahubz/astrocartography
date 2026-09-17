import { useMemo } from 'react';
import type { ChartResponse } from './api';
import { scoreCities, scoreTo100, type CityScore } from './cityScore';
import { PLANET_META, LINE_TYPE_LABEL } from './planets';
import { narrativeSummary } from './narrative';
import ExpandableText from './ExpandableText';
import { formatDistance, type DistanceUnit } from './units';

const MEDAL = ['🥇', '🥈', '🥉'];

function TopPickCard({ entry, rank, unit }: { entry: CityScore; rank: number; unit: DistanceUnit }) {
  const top = entry.topContribution;
  return (
    <div className="top-pick-card">
      <div className="top-pick-rank">{MEDAL[rank]}</div>
      <div className="top-pick-body">
        <div className="top-pick-name">
          {entry.city.name}, {entry.city.country}
          <span className="top-pick-score">{scoreTo100(entry.score)}/100</span>
        </div>
        {top && (
          <div className="city-detail">
            closest:{' '}
            <span style={{ color: PLANET_META[top.planet]?.color }}>
              {PLANET_META[top.planet]?.symbol} {PLANET_META[top.planet]?.label} {LINE_TYPE_LABEL[top.lineType]}
            </span>{' '}
            ({formatDistance(top.distanceKm, unit)})
          </div>
        )}
        <ExpandableText
          className="city-narrative"
          text={narrativeSummary(entry.city.name, entry.contributions, entry.score)}
        />
      </div>
    </div>
  );
}

export default function TopPicks({
  chart,
  enabledLineTypes,
  includeLocalSpace,
  unit,
}: {
  chart: ChartResponse;
  enabledLineTypes: Set<string>;
  includeLocalSpace: boolean;
  unit: DistanceUnit;
}) {
  const top3 = useMemo(
    () => scoreCities(chart, enabledLineTypes, includeLocalSpace).slice(0, 3),
    [chart, enabledLineTypes, includeLocalSpace]
  );

  return (
    <div className="top-picks">
      <h3>Your top 3 places to live</h3>
      <p className="hint">
        The single best-scoring pick, plus two runners-up, from the full ranking below &mdash; a
        heuristic starting point, not a verdict.
      </p>
      {top3.map((entry, i) => (
        <TopPickCard key={entry.city.name} entry={entry} rank={i} unit={unit} />
      ))}
    </div>
  );
}
