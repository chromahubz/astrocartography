import { useMemo, useState } from 'react';
import type { ChartResponse } from './api';
import { scoreCities, type CityScore } from './cityScore';
import { PLANET_META } from './planets';

const LINE_TYPE_LABEL: Record<string, string> = { mc: 'MC', ic: 'IC', ac: 'AC', dc: 'DC' };

function CityRow({ entry }: { entry: CityScore }) {
  const top = entry.topContribution;
  return (
    <li>
      <div className="city-name">
        {entry.city.name}, {entry.city.country}
      </div>
      {top && (
        <div className="city-detail">
          closest:{' '}
          <span style={{ color: PLANET_META[top.planet]?.color }}>
            {PLANET_META[top.planet]?.symbol} {PLANET_META[top.planet]?.label} {LINE_TYPE_LABEL[top.lineType]}
          </span>{' '}
          line ({Math.round(top.distanceKm)} km)
        </div>
      )}
    </li>
  );
}

const PAGE_SIZE = 10;

export default function BestCities({
  chart,
  enabledLineTypes,
}: {
  chart: ChartResponse;
  enabledLineTypes: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'best' | 'worst'>('best');
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  const ranked = useMemo(() => scoreCities(chart, enabledLineTypes), [chart, enabledLineTypes]);
  const total = ranked.length;
  const worstFirst = useMemo(() => [...ranked].reverse(), [ranked]);
  const list = tab === 'best' ? ranked : worstFirst;
  const shown = list.slice(0, shownCount);

  function switchTab(t: 'best' | 'worst') {
    setTab(t);
    setShownCount(PAGE_SIZE);
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
              <CityRow key={entry.city.name} entry={entry} />
            ))}
          </ol>
          {shownCount < list.length && (
            <button type="button" className="show-more" onClick={() => setShownCount((c) => c + 20)}>
              Show 20 more ({list.length - shownCount} left)
            </button>
          )}
        </>
      )}
    </div>
  );
}
