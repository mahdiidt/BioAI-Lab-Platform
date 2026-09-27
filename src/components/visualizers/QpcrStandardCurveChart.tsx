import React from 'react';

interface QpcrStandardCurveChartProps {
  points: { x: number; y: number }[]; // x = log10(dilution), y = Ct
  slope: number;
  intercept: number;
}

export const QpcrStandardCurveChart: React.FC<QpcrStandardCurveChartProps> = ({ points, slope, intercept }) => {
  if (points.length === 0) return null;

  const width = 460;
  const height = 240;
  const padding = 40;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys, intercept + slope * minX, intercept + slope * maxX);
  const maxY = Math.max(...ys, intercept + slope * minX, intercept + slope * maxX);

  const xSpan = maxX - minX || 1;
  const ySpan = maxY - minY || 1;
  const yPad = ySpan * 0.15;

  const getX = (x: number) => padding + ((x - minX) / xSpan) * (width - 2 * padding);
  const getY = (y: number) => height - padding - ((y - (minY - yPad)) / (ySpan + 2 * yPad)) * (height - 2 * padding);

  const lineX1 = minX;
  const lineX2 = maxX;
  const lineY1 = intercept + slope * lineX1;
  const lineY2 = intercept + slope * lineX2;

  return (
    <div className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm">
      <div className="flex items-center justify-between text-xs text-[#12312B] font-semibold border-b border-[#DDEDE8] pb-2 mb-2">
        <span>Ct vs log10(dilution)</span>
        <span className="text-[#0F766E] font-mono">
          slope: {slope.toFixed(3)}
        </span>
      </div>
      <div className="flex justify-center">
        <svg width={width} height={height} className="overflow-visible">
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#64748B" strokeWidth={1.5} />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#64748B" strokeWidth={1.5} />

          <text x={width / 2} y={height - 6} textAnchor="middle" fontSize={10} fill="#64748B" fontWeight={600}>
            log10(dilution / quantity)
          </text>
          <text x={12} y={height / 2} textAnchor="middle" fontSize={10} fill="#64748B" fontWeight={600} transform={`rotate(-90, 12, ${height / 2})`}>
            Ct
          </text>

          {/* Fitted regression line */}
          <line x1={getX(lineX1)} y1={getY(lineY1)} x2={getX(lineX2)} y2={getY(lineY2)} stroke="#0F766E" strokeWidth={2} strokeDasharray="5 3" />

          {/* Data points */}
          {points.map((p, i) => (
            <circle key={i} cx={getX(p.x)} cy={getY(p.y)} r={4.5} fill="#0F766E" stroke="white" strokeWidth={1.5}>
              <title>{`log10=${p.x.toFixed(2)}, Ct=${p.y.toFixed(2)}`}</title>
            </circle>
          ))}
        </svg>
      </div>
    </div>
  );
};
