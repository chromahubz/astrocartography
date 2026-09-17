import { useState } from 'react';
import { useGeocodeSearch } from './useGeocodeSearch';

interface Props {
  onSubmit: (input: { date: string; time: string; lat: number; lon: number }) => void;
  loading: boolean;
}

export default function BirthForm({ onSubmit, loading }: Props) {
  const [date, setDate] = useState('1990-06-15');
  const [time, setTime] = useState('12:00');
  const { query, results, selected, searching, handleQueryChange, handleSelect } = useGeocodeSearch();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    onSubmit({ date, time, lat: parseFloat(selected.lat), lon: parseFloat(selected.lon) });
  }

  return (
    <form onSubmit={handleSubmit} className="birth-form">
      <h2>Birth Data</h2>
      <label>
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label>
        Time (local, 24h)
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
      </label>
      <label className="location-field">
        Birthplace
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="City, Country"
          autoComplete="off"
          required
        />
        {searching && <div className="hint">Searching...</div>}
        {results.length > 0 && (
          <ul className="suggestions">
            {results.map((r, i) => (
              <li key={i} onClick={() => handleSelect(r)}>
                {r.display_name}
              </li>
            ))}
          </ul>
        )}
      </label>
      <button type="submit" disabled={!selected || loading}>
        {loading ? 'Calculating…' : 'Generate Astrocartography'}
      </button>
    </form>
  );
}
