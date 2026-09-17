// Colors chosen for >=4.5:1 contrast against the dark sidebar (#14161c) as well as
// mutual distinguishability on the map.
export const PLANET_META: Record<string, { symbol: string; color: string; label: string }> = {
  sun: { symbol: '☉', color: '#f0a83c', label: 'Sun' },
  moon: { symbol: '☽', color: '#b9c4d1', label: 'Moon' },
  mercury: { symbol: '☿', color: '#7cc576', label: 'Mercury' },
  venus: { symbol: '♀', color: '#ec86c0', label: 'Venus' },
  mars: { symbol: '♂', color: '#e35a4a', label: 'Mars' },
  jupiter: { symbol: '♃', color: '#6f9fe8', label: 'Jupiter' },
  saturn: { symbol: '♄', color: '#c9a227', label: 'Saturn' },
  uranus: { symbol: '♅', color: '#46d1d1', label: 'Uranus' },
  neptune: { symbol: '♆', color: '#8f6fe8', label: 'Neptune' },
  pluto: { symbol: '♇', color: '#c56fe0', label: 'Pluto' },
};

// Classical benefic/malefic classification used only for the "best places" scoring
// heuristic below — a simplification, not an astronomical fact.
export const PLANET_WEIGHT: Record<string, number> = {
  sun: 0.6,
  moon: 0.4,
  mercury: 0.3,
  venus: 1,
  mars: -0.8,
  jupiter: 1,
  saturn: -0.6,
  uranus: 0.1,
  neptune: 0.1,
  pluto: -0.3,
};

export const LINE_STYLES: Record<string, { dashArray?: string; weight: number }> = {
  mc: { weight: 2.5 },
  ic: { weight: 2.5, dashArray: '1 6' },
  ac: { weight: 2.5, dashArray: '6 4' },
  dc: { weight: 2.5, dashArray: '2 8 2 2' },
};

export const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

export function degToSign(deg: number): string {
  const norm = ((deg % 360) + 360) % 360;
  const signIndex = Math.floor(norm / 30);
  const inSign = norm - signIndex * 30;
  const d = Math.floor(inSign);
  const m = Math.round((inSign - d) * 60);
  return `${d}°${m.toString().padStart(2, '0')}' ${ZODIAC_SIGNS[signIndex]}`;
}
