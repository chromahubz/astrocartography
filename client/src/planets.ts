export const PLANET_META: Record<string, { symbol: string; color: string; label: string }> = {
  sun: { symbol: '☉', color: '#e8a33d', label: 'Sun' },
  moon: { symbol: '☽', color: '#9aa5b1', label: 'Moon' },
  mercury: { symbol: '☿', color: '#8fbf6b', label: 'Mercury' },
  venus: { symbol: '♀', color: '#e07bb0', label: 'Venus' },
  mars: { symbol: '♂', color: '#d1483c', label: 'Mars' },
  jupiter: { symbol: '♃', color: '#5b8fd6', label: 'Jupiter' },
  saturn: { symbol: '♄', color: '#7a6a53', label: 'Saturn' },
  uranus: { symbol: '♅', color: '#4fbfbf', label: 'Uranus' },
  neptune: { symbol: '♆', color: '#4a6fd6', label: 'Neptune' },
  pluto: { symbol: '♇', color: '#7a4a8f', label: 'Pluto' },
  chiron: { symbol: '⚷', color: '#b08a4a', label: 'Chiron' },
  meanNode: { symbol: '☊', color: '#5a5a5a', label: 'North Node' },
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
