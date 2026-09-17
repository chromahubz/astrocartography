import { PLANET_META, LINE_TYPE_LABEL } from './planets';
import { lineMeaning, strengthBand } from './lineMeanings';
import type { LineContribution } from './cityScore';

const CLOSENESS_PHRASE: Record<string, string> = {
  exact: 'sits almost exactly on',
  close: 'is close to',
  moderate: 'has a moderate distance to',
  background: 'has only a background influence from',
};

/** A short, readable paragraph summarizing why a place scored the way it did. */
export function narrativeSummary(name: string, contributions: LineContribution[], score: number): string {
  const top = contributions.filter((c) => Math.abs(c.contribution) > 0.01).slice(0, 3);
  if (top.length === 0) {
    return `${name} isn't notably close to any of your chosen lines.`;
  }

  const clauses = top.map((c) => {
    const band = strengthBand(c.distanceKm);
    const label = `${PLANET_META[c.planet]?.label} ${LINE_TYPE_LABEL[c.lineType]}`;
    return `${CLOSENESS_PHRASE[band.label] ?? 'is affected by'} your ${label} line, which ${lineMeaning(c.planet, c.lineType)}`;
  });

  let sentence = `${name} ${clauses[0]}`;
  if (clauses.length > 1) sentence += `, and ${clauses.slice(1).join(', and ')}`;
  sentence += '.';

  const overall =
    score > 0.5
      ? ' On balance this leans supportive for you.'
      : score < -0.5
        ? ' On balance this leans challenging for you.'
        : ' On balance the influence here is mixed or mild.';

  return sentence + overall;
}
