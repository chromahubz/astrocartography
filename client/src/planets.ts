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

// Classical benefic/malefic classification used as a *starting point* for the
// "best places" scoring heuristic — see cityScore.ts, which further modulates
// this per the individual chart (dignity, chart ruler, retrograde).
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

// Angular lines (AC/MC) are traditionally felt as the strongest, most personally
// direct expressions of a planet; DC/IC are real but somewhat less dominant.
// Used only by the "best places" heuristic.
export const LINE_TYPE_WEIGHT: Record<string, number> = {
  ac: 1,
  mc: 0.9,
  dc: 0.75,
  ic: 0.75,
};

export const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

// Modern single rulership per sign (index 0 = Aries ... 11 = Pisces). Used both to
// find a chart's Ascendant ruler and, with EXALTATION below, to score essential
// dignity — a planet is stronger in a sign it rules or is exalted in, weaker in
// the opposite (detriment / fall).
export const SIGN_RULERS: string[] = [
  'mars', 'venus', 'mercury', 'moon', 'sun', 'mercury',
  'venus', 'pluto', 'jupiter', 'saturn', 'uranus', 'neptune',
];

// Classical exaltations (only defined for the 7 traditional planets).
export const EXALTATION_SIGN: Record<string, number> = {
  sun: 0, // Aries
  moon: 1, // Taurus
  mercury: 5, // Virgo
  venus: 11, // Pisces
  mars: 9, // Capricorn
  jupiter: 3, // Cancer
  saturn: 6, // Libra
};

export function signIndexOf(deg: number): number {
  return Math.floor((((deg % 360) + 360) % 360) / 30);
}

/**
 * Essential dignity modifier: +1 in the sign a planet rules, +0.5 in its
 * exaltation sign, -1 in detriment (opposite its rulership), -0.5 in fall
 * (opposite its exaltation), 0 otherwise ("peregrine").
 */
export function dignityModifier(planet: string, signIndex: number): number {
  if (SIGN_RULERS[signIndex] === planet) return 1;
  if (EXALTATION_SIGN[planet] === signIndex) return 0.5;
  // Mercury and Venus rule two signs each, so check every sign they rule, not just the first.
  const rulesSign = SIGN_RULERS.some((ruler, j) => ruler === planet && (j + 6) % 12 === signIndex);
  if (rulesSign) return -1;
  if (planet in EXALTATION_SIGN && (EXALTATION_SIGN[planet] + 6) % 12 === signIndex) return -0.5;
  return 0;
}

export function degToSign(deg: number): string {
  const norm = ((deg % 360) + 360) % 360;
  const signIndex = Math.floor(norm / 30);
  const inSign = norm - signIndex * 30;
  const d = Math.floor(inSign);
  const m = Math.round((inSign - d) * 60);
  return `${d}°${m.toString().padStart(2, '0')}' ${ZODIAC_SIGNS[signIndex]}`;
}
