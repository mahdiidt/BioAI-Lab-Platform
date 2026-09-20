import React from 'react';
import { PedigreeLayout } from '../../utils/pedigree';

interface PedigreeVisualizerProps {
  layout: PedigreeLayout;
  onSelectIndividual?: (id: string) => void;
}

const SYMBOL_SIZE = 30;
const HALF = SYMBOL_SIZE / 2;

export const PedigreeVisualizer: React.FC<PedigreeVisualizerProps> = ({ layout, onSelectIndividual }) => {
  if (layout.individuals.length === 0) {
    return null;
  }

  const width = layout.width + 40;
  const height = layout.height + 40;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Pedigree chart">
      {/* Couple connector lines */}
      {layout.coupleLinks.map((c, i) => (
        <line key={`couple-${i}`} x1={c.x1 + HALF} y1={c.y} x2={c.x2 - HALF} y2={c.y} stroke="#334155" strokeWidth={1.5} />
      ))}

      {/* Parent -> child connector lines (vertical drop + horizontal sibship tie handled per-child) */}
      {layout.childLinks.map((c, i) => (
        <g key={`child-${i}`}>
          <line x1={c.parentMidX} y1={c.parentY} x2={c.parentMidX} y2={(c.parentY + c.childY) / 2} stroke="#94A3B8" strokeWidth={1.5} />
          <line
            x1={c.parentMidX}
            y1={(c.parentY + c.childY) / 2}
            x2={c.childX}
            y2={(c.parentY + c.childY) / 2}
            stroke="#94A3B8"
            strokeWidth={1.5}
          />
          <line x1={c.childX} y1={(c.parentY + c.childY) / 2} x2={c.childX} y2={c.childY - HALF} stroke="#94A3B8" strokeWidth={1.5} />
        </g>
      ))}

      {/* Individuals */}
      {layout.individuals.map((ind) => (
        <g
          key={ind.id}
          className={onSelectIndividual ? 'cursor-pointer' : undefined}
          onClick={() => onSelectIndividual?.(ind.id)}
        >
          {ind.sex === 'M' ? (
            <rect
              x={ind.x - HALF}
              y={ind.y - HALF}
              width={SYMBOL_SIZE}
              height={SYMBOL_SIZE}
              fill={ind.affected ? '#0F766E' : 'white'}
              stroke="#12312B"
              strokeWidth={1.8}
            />
          ) : (
            <circle
              cx={ind.x}
              cy={ind.y}
              r={HALF}
              fill={ind.affected ? '#0F766E' : 'white'}
              stroke="#12312B"
              strokeWidth={1.8}
            />
          )}
          <title>{`${ind.id} — ${ind.sex === 'M' ? 'Male' : 'Female'}, ${ind.affected ? 'Affected' : 'Unaffected'}`}</title>
          <text x={ind.x} y={ind.y + HALF + 14} textAnchor="middle" fontSize={10} fontWeight={700} fill="#334155">
            {ind.id}
          </text>
        </g>
      ))}
    </svg>
  );
};
