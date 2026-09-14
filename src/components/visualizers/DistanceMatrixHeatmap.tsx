import React from 'react';

interface DistanceMatrixHeatmapProps {
  labels: string[];
  matrix: (number | null)[][];
  /** When true, higher values are "good" (similarity, green). When false, higher values are "far apart" (distance, colored the opposite way). */
  higherIsBetter: boolean;
}

function colorForValue(value: number | null, higherIsBetter: boolean): string {
  if (value === null) return '#E2E8F0'; // slate-200, "no data"
  const pct = higherIsBetter ? value : 100 - value;
  // Interpolate from rose (low) to emerald (high) through amber.
  if (pct >= 75) return '#0F766E';
  if (pct >= 50) return '#22C55E';
  if (pct >= 25) return '#F59E0B';
  return '#EF4444';
}

const CELL = 44;
const LABEL_COL_WIDTH = 90;
const LABEL_ROW_HEIGHT = 60;

export const DistanceMatrixHeatmap: React.FC<DistanceMatrixHeatmapProps> = ({ labels, matrix, higherIsBetter }) => {
  const n = labels.length;
  const width = LABEL_COL_WIDTH + n * CELL + 10;
  const height = LABEL_ROW_HEIGHT + n * CELL + 10;

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
        {/* Column labels (rotated) */}
        {labels.map((label, j) => (
          <text
            key={`col-${j}`}
            x={LABEL_COL_WIDTH + j * CELL + CELL / 2}
            y={LABEL_ROW_HEIGHT - 8}
            textAnchor="start"
            fontSize={10}
            fontFamily="monospace"
            fontWeight={700}
            fill="#12312B"
            transform={`rotate(-45 ${LABEL_COL_WIDTH + j * CELL + CELL / 2} ${LABEL_ROW_HEIGHT - 8})`}
          >
            {label}
          </text>
        ))}

        {/* Row labels + cells */}
        {labels.map((rowLabel, i) => (
          <g key={`row-${i}`}>
            <text
              x={LABEL_COL_WIDTH - 8}
              y={LABEL_ROW_HEIGHT + i * CELL + CELL / 2 + 4}
              textAnchor="end"
              fontSize={10}
              fontFamily="monospace"
              fontWeight={700}
              fill="#12312B"
            >
              {rowLabel}
            </text>
            {labels.map((_, j) => {
              const value = matrix[i]?.[j] ?? null;
              return (
                <g key={`cell-${i}-${j}`}>
                  <rect
                    x={LABEL_COL_WIDTH + j * CELL}
                    y={LABEL_ROW_HEIGHT + i * CELL}
                    width={CELL - 2}
                    height={CELL - 2}
                    rx={4}
                    fill={colorForValue(value, higherIsBetter)}
                    opacity={i === j ? 1 : 0.85}
                  />
                  <text
                    x={LABEL_COL_WIDTH + j * CELL + (CELL - 2) / 2}
                    y={LABEL_ROW_HEIGHT + i * CELL + (CELL - 2) / 2 + 4}
                    textAnchor="middle"
                    fontSize={10}
                    fontFamily="monospace"
                    fontWeight={700}
                    fill="white"
                  >
                    {value === null ? '—' : value.toFixed(0)}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
};
