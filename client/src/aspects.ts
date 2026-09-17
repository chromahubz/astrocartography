export interface Aspect {
  planetA: string;
  planetB: string;
  type: string;
  angle: number;
  orb: number;
}

// Standard Ptolemaic aspects with conventional orbs (degrees of allowed deviation).
const ASPECT_DEFS = [
  { type: 'conjunction', angle: 0, orb: 8 },
  { type: 'sextile', angle: 60, orb: 6 },
  { type: 'square', angle: 90, orb: 8 },
  { type: 'trine', angle: 120, orb: 8 },
  { type: 'opposition', angle: 180, orb: 8 },
];

export const ASPECT_SYMBOL: Record<string, string> = {
  conjunction: '☌',
  sextile: '⚹',
  square: '□',
  trine: '△',
  opposition: '☍',
};

function angularSeparation(lon1: number, lon2: number): number {
  let d = Math.abs(lon1 - lon2) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/** All Ptolemaic aspects between natal planet pairs, within standard orbs. */
export function computeAspects(ecliptic: Record<string, { longitude: number }>): Aspect[] {
  const planets = Object.keys(ecliptic);
  const aspects: Aspect[] = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const sep = angularSeparation(ecliptic[planets[i]].longitude, ecliptic[planets[j]].longitude);
      for (const def of ASPECT_DEFS) {
        const orb = Math.abs(sep - def.angle);
        if (orb <= def.orb) {
          aspects.push({ planetA: planets[i], planetB: planets[j], type: def.type, angle: sep, orb });
          break; // a pair forms at most one aspect (the closest-matching angle)
        }
      }
    }
  }
  return aspects.sort((a, b) => a.orb - b.orb);
}
