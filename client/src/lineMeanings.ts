// Short, standard astrocartography interpretations per (planet, line type).
// Traditional/widely-cited meanings (e.g. Jim Lewis's original A*C*G system) -
// still astrology, not empirical fact, but this is the established reading
// rather than something invented for this app.
const THEMES: Record<string, string> = {
  ac: 'colors your self-image, identity, and how you come across to others',
  dc: 'colors relationships, partnerships, and who you attract or encounter',
  mc: 'colors career, public reputation, and life direction',
  ic: 'colors home, family, roots, and inner emotional life',
};

const PLANET_FLAVOR: Record<string, string> = {
  sun: 'vitality, confidence, and visibility',
  moon: 'emotional life, instinct, and a sense of belonging',
  mercury: 'communication, learning, and mental activity',
  venus: 'romance, beauty, ease, and enjoyment',
  mars: 'drive, assertiveness, and friction or conflict',
  jupiter: 'growth, opportunity, and good fortune',
  saturn: 'discipline, restriction, hard work, and maturity',
  uranus: 'sudden change, independence, and disruption',
  neptune: 'imagination, spirituality, and confusion or idealization',
  pluto: 'intensity, transformation, and power dynamics',
};

export function lineMeaning(planet: string, lineType: string): string {
  const theme = THEMES[lineType] ?? '';
  const flavor = PLANET_FLAVOR[planet] ?? '';
  if (!theme || !flavor) return '';
  return `${theme}, with ${flavor}`;
}

export interface StrengthBand {
  label: string;
  className: string;
}

/** Qualitative read of "how close" a line is, since raw km isn't intuitive at a glance. */
export function strengthBand(distanceKm: number): StrengthBand {
  if (distanceKm < 50) return { label: 'exact', className: 'strength-exact' };
  if (distanceKm < 200) return { label: 'close', className: 'strength-close' };
  if (distanceKm < 500) return { label: 'moderate', className: 'strength-moderate' };
  return { label: 'background', className: 'strength-background' };
}
