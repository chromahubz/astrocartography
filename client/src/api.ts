const API_BASE = 'http://localhost:3001';

export interface GeocodeResult {
  display_name: string;
  lat: string;
  lon: string;
}

export interface LineData {
  ra: number;
  dec: number;
  mc: { lon: number; segments: [number, number][][] };
  ic: { lon: number; segments: [number, number][][] };
  ac: { segments: [number, number][][] };
  dc: { segments: [number, number][][] };
}

export interface LocalSpaceData {
  azimuth: number;
  altitude: number;
  segments: [number, number][][];
}

export interface ChartResponse {
  input: { date: string; time: string; lat: number; lon: number };
  resolvedTimeZone: string;
  utcOffsetMinutes: number;
  utcIso: string;
  julianDayUT: number;
  ecliptic: Record<string, { longitude: number; latitude: number; speed: number }>;
  houses: { ascendant: number; mc: number; armc: number; cusps: number[] };
  lines: Record<string, LineData>;
  localSpace: Record<string, LocalSpaceData>;
}

export interface RelocateResponse {
  target: { lat: number; lon: number };
  ascendant: number;
  mc: number;
  cusps: number[];
}

export async function geocode(q: string): Promise<GeocodeResult[]> {
  const res = await fetch(`${API_BASE}/api/geocode?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('Geocoding failed');
  return res.json();
}

export async function fetchChart(input: {
  date: string;
  time: string;
  lat: number;
  lon: number;
}): Promise<ChartResponse> {
  const res = await fetch(`${API_BASE}/api/chart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Chart calculation failed');
  }
  return res.json();
}

export async function fetchRelocation(input: {
  date: string;
  time: string;
  lat: number;
  lon: number;
  targetLat: number;
  targetLon: number;
}): Promise<RelocateResponse> {
  const res = await fetch(`${API_BASE}/api/relocate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Relocation failed');
  }
  return res.json();
}
