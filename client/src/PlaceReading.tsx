import type { RelocateResponse } from './api';
import type { PointScore } from './cityScore';
import { PLANET_META, degToSign } from './planets';
import { lineMeaning, strengthBand } from './lineMeanings';

const LINE_TYPE_LABEL: Record<string, string> = { mc: 'MC', ic: 'IC', ac: 'AC', dc: 'DC' };

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
}: {
  placeName: string | null | undefined;
  lat: number;
  lon: number;
  pointScore: PointScore | null;
  relocation: RelocateResponse | null;
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
          {v.label} ({pointScore!.score >= 0 ? '+' : ''}
          {pointScore!.score.toFixed(2)})
        </div>
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
                  ({Math.round(c.distanceKm)} km)
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
