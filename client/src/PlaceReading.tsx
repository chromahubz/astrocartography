import type { RelocateResponse } from './api';
import { scoreTo100, type PointScore } from './cityScore';
import { PLANET_META, LINE_TYPE_LABEL, degToSign } from './planets';
import { lineMeaning, strengthBand } from './lineMeanings';
import { narrativeSummary } from './narrative';
import { formatDistance, type DistanceUnit } from './units';
import ExpandableText from './ExpandableText';

function verdict(score: number): { label: string; className: string } {
  if (score > 0.5) return { label: 'Supportive', className: 'verdict-good' };
  if (score < -0.5) return { label: 'Challenging', className: 'verdict-bad' };
  return { label: 'Mixed / mild', className: 'verdict-neutral' };
}

export default function PlaceReading({
  placeName,
  lat,
  lon,
  pointScore,
  relocation,
  unit,
}: {
  placeName: string | null | undefined;
  lat: number;
  lon: number;
  pointScore: PointScore | null;
  relocation: RelocateResponse | null;
  unit: DistanceUnit;
}) {
  const v = pointScore ? verdict(pointScore.score) : null;
  const top3 = pointScore?.contributions.slice(0, 3) ?? [];

  return (
    <div className="place-reading">
      <div className="place-name">{placeName || `${lat.toFixed(2)}, ${lon.toFixed(2)}`}</div>
      {relocation ? (
        <div className="place-detail">
          ASC {degToSign(relocation.ascendant)} · MC {degToSign(relocation.mc)}
        </div>
      ) : (
        <div className="place-detail">Loading relocated angles…</div>
      )}
      {v && (
        <div className={`place-verdict ${v.className}`}>
          {v.label} &mdash; {scoreTo100(pointScore!.score)}/100
        </div>
      )}
      {pointScore && (
        <ExpandableText
          className="place-narrative"
          text={narrativeSummary(placeName || `This spot`, pointScore.contributions, pointScore.score)}
        />
      )}
      {top3.length > 0 && (
        <ul className="place-lines">
          {top3.map((c, i) => {
            const band = strengthBand(c.distanceKm);
            return (
              <li key={i}>
                <div>
                  <span style={{ color: PLANET_META[c.planet]?.color }}>
                    {PLANET_META[c.planet]?.symbol} {PLANET_META[c.planet]?.label} {LINE_TYPE_LABEL[c.lineType]}
                  </span>{' '}
                  <span className={`strength-badge ${band.className}`}>{band.label}</span>{' '}
                  ({formatDistance(c.distanceKm, unit)})
                </div>
                <div className="place-line-meaning">{lineMeaning(c.planet, c.lineType)}</div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
