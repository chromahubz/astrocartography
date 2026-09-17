import { useMemo, useState } from 'react';
import type { ChartResponse } from './api';
import { scoreCities, scoreTo100, type CityScore } from './cityScore';
import { PLANET_META, LINE_TYPE_LABEL } from './planets';
import { narrativeSummary } from './narrative';
import { formatDistance, type DistanceUnit } from './units';
import ExpandableText from './ExpandableText';

function CityRow({ entry, unit }: { entry: CityScore; unit: DistanceUnit }) {
  const top = entry.topContribution;
  return (
    <li>
      <div className="city-name">
        {entry.city.name}, {entry.city.country} <span className="city-score">{scoreTo100(entry.score)}/100</span>
      </div>
      {top && (
        <div className="city-detail">
          closest:{' '}
          <span style={{ color: PLANET_META[top.planet]?.color }}>
            {PLANET_META[top.planet]?.symbol} {PLANET_META[top.planet]?.label} {LINE_TYPE_LABEL[top.lineType]}
          </span>{' '}
          line ({formatDistance(top.distanceKm, unit)})
        </div>
      )}
      <ExpandableText
        className="city-narrative"
        text={narrativeSummary(`${entry.city.name}`, entry.contributions, entry.score)}
      />
    </li>
  );
}

const PAGE_SIZE = 10;
const MID_SIZE = 100;

export default function BestCities({
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
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'best' | 'worst'>('best');
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  const ranked = useMemo(
    () => scoreCities(chart, enabledLineTypes, includeLocalSpace),
    [chart, enabledLineTypes, includeLocalSpace]
  );
  const total = ranked.length;
  const worstFirst = useMemo(() => [...ranked].reverse(), [ranked]);
  const list = tab === 'best' ? ranked : worstFirst;
  const shown = list.slice(0, shownCount);

  function switchTab(t: 'best' | 'worst') {
    setTab(t);
    setShownCount(PAGE_SIZE);
  }

  function showMore() {
    setShownCount((c) => (c < MID_SIZE ? Math.min(MID_SIZE, list.length) : list.length));
  }

  return (
    <div className="best-cities">
      <button type="button" className="section-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} Best & worst places to live (beta)
      </button>
      {open && (
        <>
          <p className="hint">
            Scored per line (AC/MC weighted strongest) using your chart's own planet placements
            &mdash; essential dignity, chart ruler, and retrograde status all shift the weighting.
            A heuristic starting point, not a verdict. Uses whichever line types are checked above.
            Ranked across {total} cities worldwide.
          </p>
          <div className="tab-row">
            <button type="button" className={tab === 'best' ? 'tab active' : 'tab'} onClick={() => switchTab('best')}>
              Best
            </button>
            <button type="button" className={tab === 'worst' ? 'tab active' : 'tab'} onClick={() => switchTab('worst')}>
              Worst
            </button>
          </div>
          <ol className="city-list scrollable" key={tab}>
            {shown.map((entry) => (
              <CityRow key={entry.city.name} entry={entry} unit={unit} />
            ))}
          </ol>
          {shownCount < list.length && (
            <button type="button" className="show-more" onClick={showMore}>
              Show {shownCount < MID_SIZE ? `up to ${Math.min(MID_SIZE, list.length)}` : `all ${list.length}`} (
              {list.length - shownCount} left)
            </button>
          )}
        </>
      )}
    </div>
  );
}
