import React from 'react';

interface KineticsPoint {
  substrate: number;
  velocity: number;
}

interface EnzymeKineticsChartProps {
  vmax: number;
  km: number;
  curvePoints: KineticsPoint[];
}

export const EnzymeKineticsChart: React.FC<EnzymeKineticsChartProps> = ({
  vmax,
  km,
  curvePoints,
}) => {
  if (curvePoints.length === 0) return null;

  const maxSubstrate = Math.max(...curvePoints.map((p) => p.substrate), 10);
  const maxVelocity = Math.max(vmax * 1.1, 10);

  const width = 450;
  const height = 220;
  const padding = 35;

  const getX = (s: number) => padding + (s / maxSubstrate) * (width - 2 * padding);
  const getY = (v: number) => height - padding - (v / maxVelocity) * (height - 2 * padding);

  const pathD = curvePoints
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(p.substrate)} ${getY(p.velocity)}`)
    .join(' ');

  return (
    <div className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-3">
      <div className="flex items-center justify-between text-xs text-[#12312B] font-semibold border-b border-[#DDEDE8] pb-2">
        <span>Michaelis-Menten Curve ($v$ vs $[S]$)</span>
        <span className="text-[#0F766E] font-mono">
          Vmax: {vmax} | Km: {km}
        </span>
      </div>

      <div className="relative flex justify-center">
        <svg width={width} height={height} className="overflow-visible">
          {/* Axes */}
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            stroke="#64748B"
            strokeWidth="1.5"
          />
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={height - padding}
            stroke="#64748B"
            strokeWidth="1.5"
          />

          {/* Vmax Asymptote Line */}
          <line
            x1={padding}
            y1={getY(vmax)}
            x2={width - padding}
            y2={getY(vmax)}
            stroke="#EF4444"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
          <text x={width - padding - 40} y={getY(vmax) - 5} fill="#EF4444" fontSize="10" fontWeight="bold">
            Vmax ({vmax})
          </text>

          {/* Km Line */}
          <line
            x1={getX(km)}
            y1={getY(vmax / 2)}
            x2={getX(km)}
            y2={height - padding}
            stroke="#0EA5E9"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
          <text x={getX(km) + 5} y={height - padding - 10} fill="#0EA5E9" fontSize="10" fontWeight="bold">
            Km ({km})
          </text>

          {/* Curve */}
          <path d={pathD} fill="none" stroke="#0F766E" strokeWidth="2.5" />

          {/* Data Points */}
          {curvePoints.map((pt, i) => (
            <circle
              key={i}
              cx={getX(pt.substrate)}
              cy={getY(pt.velocity)}
              r="3"
              fill="#14B8A6"
              className="hover:r-5 transition-all"
            />
          ))}

          {/* Labels */}
          <text x={width / 2} y={height - 5} textAnchor="middle" fill="#64748B" fontSize="10" fontWeight="bold">
            Substrate Concentration [S]
          </text>
          <text
            x={-height / 2}
            y="12"
            transform="rotate(-90)"
            textAnchor="middle"
            fill="#64748B"
            fontSize="10"
            fontWeight="bold"
          >
            Reaction Velocity (v)
          </text>
        </svg>
      </div>
    </div>
  );
};
