import { useMemo, useState } from 'react';
import type { ChartResponse } from './api';
import { findParans, type Paran } from './parans';
import { PLANET_META } from './planets';

// Deliberately verb-phrase labels here (distinct from the MC/IC/AC/DC abbreviations
// used elsewhere) since a paran is literally "these two things happen at once".
const PARAN_ANGLE_LABEL: Record<string, string> = {
  mc: 'culminating',
  ic: 'anti-culminating',
  ac: 'rising',
  dc: 'setting',
};

function ParanRow({ p }: { p: Paran }) {
  return (
    <li>
      <span style={{ color: PLANET_META[p.a.planet]?.color }}>
        {PLANET_META[p.a.planet]?.symbol} {PLANET_META[p.a.planet]?.label} {PARAN_ANGLE_LABEL[p.a.lineType]}
      </span>{' '}
      /{' '}
      <span style={{ color: PLANET_META[p.b.planet]?.color }}>
        {PLANET_META[p.b.planet]?.symbol} {PLANET_META[p.b.planet]?.label} {PARAN_ANGLE_LABEL[p.b.lineType]}
      </span>
      <div className="place-detail">at latitude {p.lat >= 0 ? `${p.lat.toFixed(1)}°N` : `${(-p.lat).toFixed(1)}°S`}</div>
    </li>
  );
}

export default function ParansList({
  chart,
  enabledLineTypes,
  enabledPlanets,
}: {
  chart: ChartResponse;
  enabledLineTypes: Set<string>;
  enabledPlanets: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [shownCount, setShownCount] = useState(10);
  const parans = useMemo(
    () => findParans(chart, enabledLineTypes, enabledPlanets),
    [chart, enabledLineTypes, enabledPlanets]
  );

  return (
    <div className="parans-list">
      <button type="button" className="section-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} Parans ({parans.length})
      </button>
      {open && (
        <>
          <p className="hint">
            Latitudes where two planets are simultaneously angular (rising, setting, culminating, or
            anti-culminating) &mdash; a classical technique read as a combined influence along that whole
            latitude band, not tied to one longitude. Uses whichever line types/planets are checked above.
          </p>
          <ol className="city-list scrollable">
            {parans.slice(0, shownCount).map((p, i) => (
              <ParanRow key={i} p={p} />
            ))}
          </ol>
          {shownCount < parans.length && (
            <button
              type="button"
              className="show-more"
              onClick={() => setShownCount((c) => Math.min(c + 20, parans.length))}
            >
              Show 20 more ({parans.length - shownCount} left)
            </button>
          )}
        </>
      )}
    </div>
  );
}
