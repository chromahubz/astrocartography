import { useRef, useState } from 'react';
import { geocode, type GeocodeResult } from './api';

/** Shared debounced-search-with-suggestions behavior for any place-search input. */
export function useGeocodeSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [selected, setSelected] = useState<GeocodeResult | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleQueryChange(q: string) {
    setQuery(q);
    setSelected(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await geocode(q));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }

  function handleSelect(r: GeocodeResult) {
    setSelected(r);
    setQuery(r.display_name);
    setResults([]);
    return r;
  }

  return { query, results, selected, searching, handleQueryChange, handleSelect };
}
