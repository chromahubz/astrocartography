import { useEffect, useMemo, useState } from 'react';
import type { ChartResponse } from './api';
import { reverseGeocode } from './api';
import { scoreCities, scoreTo100, type CityScore } from './cityScore';
import { findGlobalTopSpots, type GlobalSpot } from './globalSearch';
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

function GlobalRow({ entry, name, unit }: { entry: GlobalSpot; name: string | undefined; unit: DistanceUnit }) {
  const top = entry.topContribution;
  const label = name ?? `${entry.lat.toFixed(2)}, ${entry.lon.toFixed(2)}`;
  return (
    <li>
      <div className="city-name">
        {name ? label : <span className="hint">resolving location&hellip;</span>}{' '}
        <span className="city-score">{scoreTo100(entry.score)}/100</span>
      </div>
      {!name && <div className="city-detail">{entry.lat.toFixed(2)}, {entry.lon.toFixed(2)}</div>}
      {top && (
        <div className="city-detail">
          closest:{' '}
          <span style={{ color: PLANET_META[top.planet]?.color }}>
            {PLANET_META[top.planet]?.symbol} {PLANET_META[top.planet]?.label} {LINE_TYPE_LABEL[top.lineType]}
          </span>{' '}
          line ({formatDistance(top.distanceKm, unit)})
        </div>
      )}
      <ExpandableText className="city-narrative" text={narrativeSummary(label, entry.contributions, entry.score)} />
    </li>
  );
}

/** Worldwide land search: computed on demand (heavier than the curated list),
 * with place names for each result resolved one at a time to stay within
 * Nominatim's fair-use rate limit. */
function WorldwideList({
  chart,
  enabledLineTypes,
  includeLocalSpace,
  worst,
  unit,
}: {
  chart: ChartResponse;
  enabledLineTypes: Set<string>;
  includeLocalSpace: boolean;
  worst: boolean;
  unit: DistanceUnit;
}) {
  const spots = useMemo(
    () => findGlobalTopSpots(chart, enabledLineTypes, includeLocalSpace, 8, 600, worst),
    [chart, enabledLineTypes, includeLocalSpace, worst]
  );
  const [names, setNames] = useState<Record<number, string>>({});

  useEffect(() => {
    setNames({});
    let cancelled = false;
    (async () => {
      for (let i = 0; i < spots.length; i++) {
        if (cancelled) return;
        const name = await reverseGeocode(spots[i].lat, spots[i].lon);
        if (cancelled) return;
        setNames((prev) => ({ ...prev, [i]: name ?? `${spots[i].lat.toFixed(2)}, ${spots[i].lon.toFixed(2)}` }));
        await new Promise((r) => setTimeout(r, 1100)); // respect Nominatim's ~1 req/sec fair-use limit
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spots]);

  return (
    <ol className="city-list scrollable">
      {spots.map((entry, i) => (
        <GlobalRow key={`${entry.lat}-${entry.lon}`} entry={entry} name={names[i]} unit={unit} />
      ))}
    </ol>
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
  const [source, setSource] = useState<'curated' | 'worldwide'>('curated');
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
          </p>
          <div className="tab-row">
            <button
              type="button"
              className={source === 'curated' ? 'tab active' : 'tab'}
              onClick={() => setSource('curated')}
            >
              {total} curated cities
            </button>
            <button
              type="button"
              className={source === 'worldwide' ? 'tab active' : 'tab'}
              onClick={() => setSource('worldwide')}
            >
              Any land, worldwide
            </button>
          </div>
          {source === 'worldwide' && (
            <p className="hint">
              Grid-sampled across real land everywhere (oceans excluded), with results kept at least
              ~600km apart so the list can't fill up with several near-identical neighbors from the same
              lucky spot &mdash; unlike the curated list, which is sparse and unevenly spread, so a small
              town and a major city can otherwise land at similar scores just because nothing better-placed
              was nearby to compare against. Place names resolve one at a time (rate-limited).
            </p>
          )}
          <div className="tab-row">
            <button type="button" className={tab === 'best' ? 'tab active' : 'tab'} onClick={() => switchTab('best')}>
              Best
            </button>
            <button type="button" className={tab === 'worst' ? 'tab active' : 'tab'} onClick={() => switchTab('worst')}>
              Worst
            </button>
          </div>
          {source === 'curated' ? (
            <>
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
          ) : (
            <WorldwideList
              key={tab}
              chart={chart}
              enabledLineTypes={enabledLineTypes}
              includeLocalSpace={includeLocalSpace}
              worst={tab === 'worst'}
              unit={unit}
            />
          )}
        </>
      )}
    </div>
  );
}
