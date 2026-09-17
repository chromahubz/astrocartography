import { useGeocodeSearch } from './useGeocodeSearch';
import type { RelocateResponse } from './api';
import type { PointScore } from './cityScore';
import PlaceReading from './PlaceReading';

interface Props {
  onSelectPlace: (lat: number, lon: number, displayName: string) => void;
  checkedPoint: [number, number] | null;
  placeName: string | null;
  pointScore: PointScore | null;
  relocation: RelocateResponse | null;
}

export default function CityCheck({ onSelectPlace, checkedPoint, placeName, pointScore, relocation }: Props) {
  const { query, results, searching, handleQueryChange, handleSelect } = useGeocodeSearch();

  function pick(r: (typeof results)[number]) {
    const picked = handleSelect(r);
    onSelectPlace(parseFloat(picked.lat), parseFloat(picked.lon), picked.display_name);
  }

  return (
    <div className="city-check">
      <h3>Check a place</h3>
      <div className="location-field">
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search any city…"
          autoComplete="off"
        />
        {searching && <div className="hint">Searching...</div>}
        {results.length > 0 && (
          <ul className="suggestions">
            {results.map((r, i) => (
              <li key={i} onClick={() => pick(r)}>
                {r.display_name}
              </li>
            ))}
          </ul>
        )}
      </div>
      {checkedPoint && (
        <PlaceReading
          placeName={placeName}
          lat={checkedPoint[0]}
          lon={checkedPoint[1]}
          pointScore={pointScore}
          relocation={relocation}
        />
      )}
    </div>
  );
}
