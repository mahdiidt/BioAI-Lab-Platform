// ─────────────────────────────────────────────────────────────
// GC Skew Multi-Track Chart (SVG-based)
// Renders GC%, GC Skew, Cumulative GC Skew in stacked tracks
// with landmark annotations and interactive tooltip.
// ─────────────────────────────────────────────────────────────
import React, { useState, useRef, useMemo } from 'react';
import { GcSkewResult, SkewLandmark } from '../../utils/gcSkew';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Download, MapPin } from 'lucide-react';

interface Props {
  result: GcSkewResult;
  lang: Language;
  showTracks: { gcContent: boolean; gcSkew: boolean; cumulative: boolean; atSkew: boolean };
}

const COLORS = {
  gcContent: '#0F766E',
  gcSkewPos: '#3B82F6',
  gcSkewNeg: '#EF4444',
  cumulative: '#8B5CF6',
  atSkew: '#F59E0B',
  grid: '#E2E8F0',
  landmark_ori: '#EF4444',
  landmark_ter: '#3B82F6',
  landmark_gc_island: '#10B981',
  landmark_at_rich: '#F59E0B',
};

const MARGIN = { top: 20, right: 30, bottom: 50, left: 60 };
const TRACK_HEIGHT = 120;
const TRACK_GAP = 15;

export const GcSkewChart: React.FC<Props> = ({ result, lang, showTracks }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: any } | null>(null);

  const activeTracks = [
    showTracks.gcContent && 'gcContent',
    showTracks.gcSkew && 'gcSkew',
    showTracks.cumulative && 'cumulative',
    showTracks.atSkew && 'atSkew',
  ].filter(Boolean) as string[];

  const totalHeight = MARGIN.top + activeTracks.length * (TRACK_HEIGHT + TRACK_GAP) + MARGIN.bottom;
  const chartWidth = 800;
  const plotWidth = chartWidth - MARGIN.left - MARGIN.right;

  const points = result.dataPoints;
  const n = points.length;

  // Scales
  const xScale = (pos: number) => MARGIN.left + (pos / result.stats.seqLength) * plotWidth;
  const dataToX = (idx: number) => xScale(points[idx]?.position || 0);

  // Build SVG path for a data series
  function buildPath(accessor: (p: typeof points[0]) => number, yMin: number, yMax: number, baseY: number): string {
    if (n === 0) return '';
    const range = yMax - yMin || 1;
    const parts: string[] = [];
    for (let i = 0; i < n; i++) {
      const x = dataToX(i);
      const val = accessor(points[i]);
      const y = baseY + TRACK_HEIGHT - ((val - yMin) / range) * TRACK_HEIGHT;
      parts.push(i === 0 ? `M${x},${y}` : `L${x},${y}`);
    }
    return parts.join(' ');
  }

  // Build filled area path (for GC skew with positive/negative coloring)
  function buildAreaPath(accessor: (p: typeof points[0]) => number, yMin: number, yMax: number, baseY: number, zeroLine: number): { above: string; below: string } {
    if (n === 0) return { above: '', below: '' };
    const range = yMax - yMin || 1;
    const yOfVal = (val: number) => baseY + TRACK_HEIGHT - ((val - yMin) / range) * TRACK_HEIGHT;
    const zeroY = yOfVal(zeroLine);

    let above = `M${dataToX(0)},${zeroY}`;
    let below = `M${dataToX(0)},${zeroY}`;

    for (let i = 0; i < n; i++) {
      const x = dataToX(i);
      const val = accessor(points[i]);
      const y = yOfVal(val);
      above += ` L${x},${Math.min(y, zeroY)}`;
      below += ` L${x},${Math.max(y, zeroY)}`;
    }

    above += ` L${dataToX(n - 1)},${zeroY} Z`;
    below += ` L${dataToX(n - 1)},${zeroY} Z`;

    return { above, below };
  }

  // Track renderers
  const tracks = useMemo(() => {
    const rendered: React.ReactNode[] = [];
    let currentY = MARGIN.top;

    if (showTracks.gcContent) {
      const min = Math.min(...points.map(p => p.gcContent));
      const max = Math.max(...points.map(p => p.gcContent));
      const path = buildPath(p => p.gcContent, min - 0.02, max + 0.02, currentY);

      rendered.push(
        <g key="gcContent">
          <rect x={MARGIN.left} y={currentY} width={plotWidth} height={TRACK_HEIGHT} fill="#F8FFFE" rx={4} />
          <text x={MARGIN.left - 8} y={currentY + 12} textAnchor="end" fontSize={10} fontWeight="bold" fill="#0F766E">
            GC%
          </text>
          {/* Mean line */}
          <line
            x1={MARGIN.left} x2={MARGIN.left + plotWidth}
            y1={currentY + TRACK_HEIGHT - ((result.stats.overallGC - min + 0.02) / (max - min + 0.04)) * TRACK_HEIGHT}
            y2={currentY + TRACK_HEIGHT - ((result.stats.overallGC - min + 0.02) / (max - min + 0.04)) * TRACK_HEIGHT}
            stroke="#0F766E" strokeWidth={1} strokeDasharray="4,3" opacity={0.5}
          />
          <path d={path} fill="none" stroke={COLORS.gcContent} strokeWidth={1.5} />
          {/* Y-axis ticks */}
          <text x={MARGIN.left - 8} y={currentY + TRACK_HEIGHT} textAnchor="end" fontSize={8} fill="#94A3B8">
            {(min * 100).toFixed(0)}%
          </text>
          <text x={MARGIN.left - 8} y={currentY + 10} textAnchor="end" fontSize={8} fill="#94A3B8">
            {(max * 100).toFixed(0)}%
          </text>
        </g>
      );
      currentY += TRACK_HEIGHT + TRACK_GAP;
    }

    if (showTracks.gcSkew) {
      const vals = points.map(p => p.gcSkew);
      const absMax = Math.max(Math.abs(Math.min(...vals)), Math.abs(Math.max(...vals)), 0.01);
      const { above, below } = buildAreaPath(p => p.gcSkew, -absMax, absMax, currentY, 0);
      const linePath = buildPath(p => p.gcSkew, -absMax, absMax, currentY);

      rendered.push(
        <g key="gcSkew">
          <rect x={MARGIN.left} y={currentY} width={plotWidth} height={TRACK_HEIGHT} fill="#FAFBFF" rx={4} />
          <text x={MARGIN.left - 8} y={currentY + 12} textAnchor="end" fontSize={10} fontWeight="bold" fill="#3B82F6">
            GC Skew
          </text>
          {/* Zero line */}
          <line
            x1={MARGIN.left} x2={MARGIN.left + plotWidth}
            y1={currentY + TRACK_HEIGHT / 2} y2={currentY + TRACK_HEIGHT / 2}
            stroke="#94A3B8" strokeWidth={0.5}
          />
          <path d={above} fill="rgba(59,130,246,0.15)" />
          <path d={below} fill="rgba(239,68,68,0.15)" />
          <path d={linePath} fill="none" stroke="#3B82F6" strokeWidth={1.2} />
          <text x={MARGIN.left - 8} y={currentY + TRACK_HEIGHT} textAnchor="end" fontSize={8} fill="#94A3B8">
            {(-absMax).toFixed(2)}
          </text>
          <text x={MARGIN.left - 8} y={currentY + 10} textAnchor="end" fontSize={8} fill="#94A3B8">
            {absMax.toFixed(2)}
          </text>
        </g>
      );
      currentY += TRACK_HEIGHT + TRACK_GAP;
    }

    if (showTracks.cumulative) {
      const vals = points.map(p => p.cumulativeGcSkew);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const path = buildPath(p => p.cumulativeGcSkew, min, max, currentY);

      rendered.push(
        <g key="cumulative">
          <rect x={MARGIN.left} y={currentY} width={plotWidth} height={TRACK_HEIGHT} fill="#FDFAFF" rx={4} />
          <text x={MARGIN.left - 8} y={currentY + 12} textAnchor="end" fontSize={10} fontWeight="bold" fill="#8B5CF6">
            Cum.
          </text>
          <path d={path} fill="none" stroke={COLORS.cumulative} strokeWidth={1.8} />
          {/* Landmark annotations on cumulative track */}
          {result.landmarks.filter(l => l.type === 'ori' || l.type === 'ter').map((lm, i) => {
            const x = xScale(lm.position);
            return (
              <g key={`lm-${i}`}>
                <line
                  x1={x} x2={x} y1={currentY} y2={currentY + TRACK_HEIGHT}
                  stroke={lm.type === 'ori' ? COLORS.landmark_ori : COLORS.landmark_ter}
                  strokeWidth={1.5} strokeDasharray="4,2"
                />
                <circle cx={x} cy={currentY + 8} r={5}
                  fill={lm.type === 'ori' ? COLORS.landmark_ori : COLORS.landmark_ter} />
                <text x={x} y={currentY + 11} textAnchor="middle" fontSize={7} fill="white" fontWeight="bold">
                  {lm.type === 'ori' ? 'O' : 'T'}
                </text>
              </g>
            );
          })}
        </g>
      );
      currentY += TRACK_HEIGHT + TRACK_GAP;
    }

    if (showTracks.atSkew) {
      const vals = points.map(p => p.atSkew);
      const absMax = Math.max(Math.abs(Math.min(...vals)), Math.abs(Math.max(...vals)), 0.01);
      const linePath = buildPath(p => p.atSkew, -absMax, absMax, currentY);

      rendered.push(
        <g key="atSkew">
          <rect x={MARGIN.left} y={currentY} width={plotWidth} height={TRACK_HEIGHT} fill="#FFFDF5" rx={4} />
          <text x={MARGIN.left - 8} y={currentY + 12} textAnchor="end" fontSize={10} fontWeight="bold" fill="#F59E0B">
            AT Skew
          </text>
          <line
            x1={MARGIN.left} x2={MARGIN.left + plotWidth}
            y1={currentY + TRACK_HEIGHT / 2} y2={currentY + TRACK_HEIGHT / 2}
            stroke="#94A3B8" strokeWidth={0.5}
          />
          <path d={linePath} fill="none" stroke={COLORS.atSkew} strokeWidth={1.2} />
        </g>
      );
    }

    return rendered;
  }, [points, showTracks, result]);

  // X-axis ticks
  const xTicks = useMemo(() => {
    const ticks: React.ReactNode[] = [];
    const step = Math.pow(10, Math.floor(Math.log10(result.stats.seqLength / 5)));
    for (let pos = 0; pos <= result.stats.seqLength; pos += step) {
      const x = xScale(pos);
      ticks.push(
        <g key={pos}>
          <line x1={x} x2={x} y1={totalHeight - MARGIN.bottom} y2={totalHeight - MARGIN.bottom + 5} stroke="#94A3B8" />
          <text x={x} y={totalHeight - MARGIN.bottom + 16} textAnchor="middle" fontSize={9} fill="#64748B">
            {pos >= 1000000 ? `${(pos / 1000000).toFixed(1)}M` : pos >= 1000 ? `${(pos / 1000).toFixed(0)}k` : pos}
          </text>
        </g>
      );
    }
    return ticks;
  }, [result, totalHeight]);

  // Mouse tracking
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const seqPos = ((mx - MARGIN.left) / plotWidth) * result.stats.seqLength;

    // Find nearest data point
    const idx = points.findIndex(p => p.position >= seqPos);
    if (idx >= 0 && idx < points.length) {
      setTooltip({
        x: mx,
        y: e.clientY - rect.top,
        data: points[idx],
      });
    }
  };

  const handleExportSVG = () => {
    if (!svgRef.current) return;
    const data = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([data], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'gc_skew_plot.svg'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-[#12312B] flex items-center gap-2 dark:text-slate-100">
          <MapPin className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
          {getTranslation(lang, 'tool_gcskew_chart_title')}
        </h4>
        <button
          onClick={handleExportSVG}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-[#F3FAF7] border border-[#DDEDE8] rounded-lg text-[#0F766E] hover:bg-[#E6F5EF] transition-colors cursor-pointer dark:bg-slate-800 dark:border-slate-700 dark:text-teal-400"
        >
          <Download className="w-3 h-3" /> SVG
        </button>
      </div>

      <div className="relative overflow-x-auto bg-white border border-[#DDEDE8] rounded-2xl p-3 dark:bg-slate-900 dark:border-slate-700">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${chartWidth} ${totalHeight}`}
          width={chartWidth}
          height={totalHeight}
          className="block mx-auto"
          style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        >
          <rect width={chartWidth} height={totalHeight} fill="white" />

          {tracks}

          {/* X-axis */}
          <line
            x1={MARGIN.left} x2={MARGIN.left + plotWidth}
            y1={totalHeight - MARGIN.bottom} y2={totalHeight - MARGIN.bottom}
            stroke="#94A3B8" strokeWidth={1}
          />
          {xTicks}
          <text
            x={chartWidth / 2} y={totalHeight - 5}
            textAnchor="middle" fontSize={11} fontWeight="bold" fill="#334155"
          >
            {getTranslation(lang, 'tool_gcskew_position')} ({result.seqName})
          </text>

          {/* Tooltip crosshair */}
          {tooltip && (
            <g>
              <line x1={tooltip.x} x2={tooltip.x} y1={MARGIN.top} y2={totalHeight - MARGIN.bottom}
                stroke="#0F766E" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.6} />
            </g>
          )}
        </svg>

        {/* Floating tooltip */}
        {tooltip && tooltip.data && (
          <div
            className="absolute pointer-events-none bg-white/95 backdrop-blur-sm border border-[#DDEDE8] rounded-xl shadow-lg p-2.5 text-[10px] font-mono z-50 dark:border-slate-700"
            style={{
              left: Math.min(tooltip.x + 15, chartWidth - 180),
              top: tooltip.y - 80,
            }}
          >
            <div className="font-bold text-[#12312B] mb-1 dark:text-slate-100">{getTranslation(lang, 'tool_gcskew_tooltip_position')}: {tooltip.data.position.toLocaleString()}</div>
            <div className="text-[#0F766E] dark:text-teal-400">GC: {(tooltip.data.gcContent * 100).toFixed(1)}%</div>
            <div className="text-[#3B82F6]">GC Skew: {tooltip.data.gcSkew.toFixed(4)}</div>
            <div className="text-[#8B5CF6]">{getTranslation(lang, 'tool_gcskew_cumulative')}: {tooltip.data.cumulativeGcSkew.toFixed(2)}</div>
            <div className="text-[#F59E0B]">AT Skew: {tooltip.data.atSkew.toFixed(4)}</div>
          </div>
        )}
      </div>
    </div>
  );
};
