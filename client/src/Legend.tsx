import { PLANET_META } from './planets';

interface Props {
  visiblePlanets: Set<string>;
  onTogglePlanet: (p: string) => void;
  visibleLineTypes: Set<string>;
  onToggleLineType: (t: string) => void;
  showLocalSpace: boolean;
  onToggleLocalSpace: () => void;
  showCrossings: boolean;
  onToggleCrossings: () => void;
  showParans: boolean;
  onToggleParans: () => void;
  showBestWorstPins: boolean;
  onToggleBestWorstPins: () => void;
}

const LINE_TYPE_LABELS: Record<string, string> = {
  mc: 'MC (career / public role)',
  ic: 'IC (home / roots)',
  ac: 'AC (identity / new starts)',
  dc: 'DC (relationships)',
};

export default function Legend({
  visiblePlanets,
  onTogglePlanet,
  visibleLineTypes,
  onToggleLineType,
  showLocalSpace,
  onToggleLocalSpace,
  showCrossings,
  onToggleCrossings,
  showParans,
  onToggleParans,
  showBestWorstPins,
  onToggleBestWorstPins,
}: Props) {
  return (
    <div className="legend">
      <h3>Line Types</h3>
      {Object.entries(LINE_TYPE_LABELS).map(([key, label]) => (
        <label key={key} className="legend-row">
          <input
            type="checkbox"
            checked={visibleLineTypes.has(key)}
            onChange={() => onToggleLineType(key)}
          />
          {label}
        </label>
      ))}
      <label className="legend-row">
        <input type="checkbox" checked={showLocalSpace} onChange={onToggleLocalSpace} />
        Local Space lines (from birthplace)
      </label>
      <label className="legend-row">
        <input type="checkbox" checked={showCrossings} onChange={onToggleCrossings} />
        Planetary crossings (combined-influence points)
      </label>
      <label className="legend-row">
        <input type="checkbox" checked={showParans} onChange={onToggleParans} />
        Paran lines (latitude bands)
      </label>
      <label className="legend-row">
        <input type="checkbox" checked={showBestWorstPins} onChange={onToggleBestWorstPins} />
        Best/worst places pins (top 5 each)
      </label>

      <h3>Planets</h3>
      <div className="planet-grid">
        {Object.entries(PLANET_META).map(([key, meta]) => (
          <label key={key} className="legend-row">
            <input
              type="checkbox"
              checked={visiblePlanets.has(key)}
              onChange={() => onTogglePlanet(key)}
            />
            <span style={{ color: meta.color, fontWeight: 'bold', marginRight: 4 }}>{meta.symbol}</span>
            {meta.label}
          </label>
        ))}
      </div>
    </div>
  );
}
