import React from 'react';
import { StructureCode } from '../../utils/secondaryStructure';

interface SecondaryStructureVisualizerProps {
  sequence: string;
  structure: StructureCode[];
  onHoverResidue?: (index: number | null) => void;
}

const RESIDUES_PER_ROW = 50;
const CELL_W = 16;
const ROW_H = 54;
const LEFT_PAD = 48;

const COLORS: Record<StructureCode, string> = {
  H: '#DC2626', // helix - red ribbon
  E: '#D97706', // sheet - amber arrow
  C: '#94A3B8', // coil - gray line
};

export const SecondaryStructureVisualizer: React.FC<SecondaryStructureVisualizerProps> = ({
  sequence,
  structure,
  onHoverResidue,
}) => {
  const rows: { start: number; residues: string[]; codes: StructureCode[] }[] = [];
  for (let i = 0; i < sequence.length; i += RESIDUES_PER_ROW) {
    rows.push({
      start: i,
      residues: sequence.slice(i, i + RESIDUES_PER_ROW).split(''),
      codes: structure.slice(i, i + RESIDUES_PER_ROW),
    });
  }

  const width = LEFT_PAD + RESIDUES_PER_ROW * CELL_W + 10;
  const height = rows.length * ROW_H + 10;

  // Groups consecutive same-code cells within one row into a single shape,
  // so a helix/sheet segment renders as one continuous ribbon/arrow instead
  // of one block per residue.
  const rowRuns = (codes: StructureCode[]) => {
    const runs: { code: StructureCode; from: number; to: number }[] = [];
    let i = 0;
    while (i < codes.length) {
      let j = i;
      while (j + 1 < codes.length && codes[j + 1] === codes[i]) j++;
      runs.push({ code: codes[i], from: i, to: j });
      i = j + 1;
    }
    return runs;
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Secondary structure track">
      {rows.map((row, rIdx) => {
        const y = rIdx * ROW_H + 8;
        const runs = rowRuns(row.codes);
        return (
          <g key={rIdx}>
            <text x={0} y={y + 24} fontSize={10} fontWeight={700} fill="#94A3B8" fontFamily="monospace">
              {row.start + 1}
            </text>

            {runs.map((run, runIdx) => {
              const x1 = LEFT_PAD + run.from * CELL_W;
              const runWidth = (run.to - run.from + 1) * CELL_W;
              const midY = y + 14;

              if (run.code === 'C') {
                return (
                  <line
                    key={runIdx}
                    x1={x1}
                    y1={midY}
                    x2={x1 + runWidth}
                    y2={midY}
                    stroke={COLORS.C}
                    strokeWidth={2.5}
                  />
                );
              }
              if (run.code === 'H') {
                return (
                  <rect
                    key={runIdx}
                    x={x1}
                    y={midY - 7}
                    width={runWidth}
                    height={14}
                    rx={6}
                    fill={COLORS.H}
                    opacity={0.85}
                  />
                );
              }
              // Sheet: a flat shaft with a triangular arrowhead at the C-terminal (right) end.
              const headLen = Math.min(10, runWidth * 0.5);
              const shaftEnd = x1 + runWidth - headLen;
              const points = [
                `${x1},${midY - 5}`,
                `${shaftEnd},${midY - 5}`,
                `${x1 + runWidth},${midY}`,
                `${shaftEnd},${midY + 5}`,
                `${x1},${midY + 5}`,
              ].join(' ');
              return <polygon key={runIdx} points={points} fill={COLORS.E} opacity={0.9} />;
            })}

            {row.residues.map((aa, cIdx) => (
              <text
                key={cIdx}
                x={LEFT_PAD + cIdx * CELL_W + CELL_W / 2}
                y={y + 40}
                textAnchor="middle"
                fontSize={9.5}
                fontFamily="monospace"
                fontWeight={600}
                fill="#334155"
                className="cursor-default"
                onMouseEnter={() => onHoverResidue?.(row.start + cIdx)}
                onMouseLeave={() => onHoverResidue?.(null)}
              >
                {aa}
                <title>{`Residue ${row.start + cIdx + 1}: ${aa} (${row.codes[cIdx] === 'H' ? 'Helix' : row.codes[cIdx] === 'E' ? 'Sheet' : 'Coil'})`}</title>
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
};
