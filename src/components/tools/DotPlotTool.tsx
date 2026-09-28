// ─────────────────────────────────────────────────────────────
// Dot Plot Visualizer (Canvas-based for performance)
// Renders forward matches in teal, reverse matches in rose,
// with zoom, pan, and region highlighting.
// ─────────────────────────────────────────────────────────────
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { DotPlotResult, DotPlotRegion } from '../../utils/dotplot';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Download, ZoomIn, ZoomOut, RotateCcw, Crosshair } from 'lucide-react';

interface Props {
  result: DotPlotResult;
  lang: Language;
  showReverse: boolean;
  highlightRegions: boolean;
}

const CANVAS_SIZE = 560;
const FORWARD_COLOR = '#0F766E';
const REVERSE_COLOR = '#E11D48';
const REGION_COLOR = 'rgba(59, 130, 246, 0.15)';
const GRID_COLOR = '#E2E8F0';
const BG_COLOR = '#FFFFFF';

export const DotPlotVisualizer: React.FC<Props> = ({ result, lang, showReverse, highlightRegions }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredPos, setHoveredPos] = useState<{ x: number; y: number } | null>(null);

  const margin = 60;
  const plotSize = CANVAS_SIZE - margin * 2;

  const scaleX = plotSize / result.seq1Length;
  const scaleY = plotSize / result.seq2Length;

  // Group dots by (direction, quantised alpha) once per result. The canvas is
  // repainted on every mouse move / drag frame, and building a new rgba()
  // string for each of up to ~400k dots per repaint made hovering laggy on
  // dense plots. Now fillStyle is set ~16 times per repaint instead of per dot.
  const dotGroups = useMemo(() => {
    const map = new Map<string, { reverse: boolean; style: string; xs: number[]; ys: number[] }>();
    for (const dot of result.dots) {
      const reverse = dot.score < 0;
      const bucket = Math.round(Math.abs(dot.score) * 8) / 8; // 0.125 steps
      const alpha = 0.3 + bucket * 0.7;
      const key = (reverse ? 'r' : 'f') + bucket;
      let g = map.get(key);
      if (!g) {
        g = {
          reverse,
          style: reverse ? `rgba(225, 29, 72, ${alpha})` : `rgba(15, 118, 110, ${alpha})`,
          xs: [],
          ys: [],
        };
        map.set(key, g);
      }
      g.xs.push(dot.x);
      g.ys.push(dot.y);
    }
    return [...map.values()];
  }, [result]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    canvas.style.width = CANVAS_SIZE + 'px';
    canvas.style.height = CANVAS_SIZE + 'px';
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.save();
    ctx.translate(margin + offset.x, margin + offset.y);
    ctx.scale(zoom, zoom);

    // Grid lines
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5 / zoom;
    const gridStep = Math.max(1, Math.round(result.seq1Length / 10));
    for (let i = 0; i <= result.seq1Length; i += gridStep) {
      ctx.beginPath();
      ctx.moveTo(i * scaleX, 0);
      ctx.lineTo(i * scaleX, result.seq2Length * scaleY);
      ctx.stroke();
    }
    const gridStepY = Math.max(1, Math.round(result.seq2Length / 10));
    for (let j = 0; j <= result.seq2Length; j += gridStepY) {
      ctx.beginPath();
      ctx.moveTo(0, j * scaleY);
      ctx.lineTo(result.seq1Length * scaleX, j * scaleY);
      ctx.stroke();
    }

    // Plot border
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1 / zoom;
    ctx.strokeRect(0, 0, result.seq1Length * scaleX, result.seq2Length * scaleY);

    // Highlight regions
    if (highlightRegions) {
      for (const region of result.regions) {
        ctx.fillStyle = REGION_COLOR;
        const rx = Math.min(region.startX, region.endX) * scaleX;
        const ry = Math.min(region.startY, region.endY) * scaleY;
        const rw = Math.abs(region.endX - region.startX) * scaleX;
        const rh = Math.abs(region.endY - region.startY) * scaleY;
        ctx.fillRect(rx, ry, rw || 3, rh || 3);
      }
    }

    // Draw dots
    const dotSize = Math.max(1, 2 / zoom);
    for (const g of dotGroups) {
      if (g.reverse && !showReverse) continue;
      ctx.fillStyle = g.style;
      for (let k = 0; k < g.xs.length; k++) {
        ctx.fillRect(g.xs[k] * scaleX - dotSize / 2, g.ys[k] * scaleY - dotSize / 2, dotSize, dotSize);
      }
    }

    // Crosshair on hover
    if (hoveredPos) {
      ctx.strokeStyle = 'rgba(15, 118, 110, 0.4)';
      ctx.lineWidth = 0.5 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.beginPath();
      ctx.moveTo(hoveredPos.x * scaleX, 0);
      ctx.lineTo(hoveredPos.x * scaleX, result.seq2Length * scaleY);
      ctx.moveTo(0, hoveredPos.y * scaleY);
      ctx.lineTo(result.seq1Length * scaleX, hoveredPos.y * scaleY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();

    // Axis labels
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.textAlign = 'center';

    // X-axis label
    ctx.fillText(
      result.seq1Name.length > 30 ? result.seq1Name.substring(0, 30) + '…' : result.seq1Name,
      CANVAS_SIZE / 2,
      CANVAS_SIZE - 8,
    );

    // Y-axis label
    ctx.save();
    ctx.translate(14, CANVAS_SIZE / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(
      result.seq2Name.length > 30 ? result.seq2Name.substring(0, 30) + '…' : result.seq2Name,
      0, 0,
    );
    ctx.restore();

    // Tick marks
    ctx.fillStyle = '#64748B';
    ctx.font = '9px Arial, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i <= result.seq1Length; i += gridStep) {
      const px = margin + (i * scaleX * zoom) + offset.x;
      if (px > margin - 5 && px < CANVAS_SIZE - margin + 5) {
        ctx.fillText(String(i), px, margin - 6);
      }
    }
    ctx.textAlign = 'right';
    for (let j = 0; j <= result.seq2Length; j += gridStepY) {
      const py = margin + (j * scaleY * zoom) + offset.y;
      if (py > margin - 5 && py < CANVAS_SIZE - margin + 5) {
        ctx.fillText(String(j), margin - 8, py + 3);
      }
    }
  }, [result, dotGroups, zoom, offset, showReverse, highlightRegions, hoveredPos, scaleX, scaleY]);

  useEffect(() => { draw(); }, [draw]);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left - margin - offset.x;
    const my = e.clientY - rect.top - margin - offset.y;

    if (isDragging) {
      setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }

    // Update hover position
    const seqX = Math.round(mx / (scaleX * zoom));
    const seqY = Math.round(my / (scaleY * zoom));
    if (seqX >= 0 && seqX < result.seq1Length && seqY >= 0 && seqY < result.seq2Length) {
      setHoveredPos({ x: seqX, y: seqY });
    } else {
      setHoveredPos(null);
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = 'dotplot.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  const resetView = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom(z => Math.min(z * 1.3, 10))}
            className="p-1.5 bg-[#F3FAF7] border border-[#DDEDE8] rounded-lg hover:bg-[#E6F5EF] transition-colors cursor-pointer dark:bg-slate-800 dark:border-slate-700"
            title={getTranslation(lang, 'tool_dotplot_zoom_in')}
          >
            <ZoomIn className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(z / 1.3, 0.2))}
            className="p-1.5 bg-[#F3FAF7] border border-[#DDEDE8] rounded-lg hover:bg-[#E6F5EF] transition-colors cursor-pointer dark:bg-slate-800 dark:border-slate-700"
            title={getTranslation(lang, 'tool_dotplot_zoom_out')}
          >
            <ZoomOut className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
          </button>
          <button
            onClick={resetView}
            className="p-1.5 bg-[#F3FAF7] border border-[#DDEDE8] rounded-lg hover:bg-[#E6F5EF] transition-colors cursor-pointer dark:bg-slate-800 dark:border-slate-700"
            title={getTranslation(lang, 'tool_dotplot_reset_view')}
          >
            <RotateCcw className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
          </button>
          <span className="text-[10px] text-[#64748B] font-mono ml-1 dark:text-slate-400">{Math.round(zoom * 100)}%</span>
        </div>

        {hoveredPos && (
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#64748B] dark:text-slate-400">
            <Crosshair className="w-3 h-3" />
            {getTranslation(lang, 'tool_dotplot_seq1_short')}: {hoveredPos.x} | {getTranslation(lang, 'tool_dotplot_seq2_short')}: {hoveredPos.y}
          </div>
        )}

        <button
          onClick={handleExportPNG}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-[#F3FAF7] border border-[#DDEDE8] rounded-lg text-[#0F766E] hover:bg-[#E6F5EF] transition-colors cursor-pointer dark:bg-slate-800 dark:border-slate-700 dark:text-teal-400"
        >
          <Download className="w-3 h-3" /> PNG
        </button>
      </div>

      {/* Canvas */}
      <div className="bg-white border border-[#DDEDE8] rounded-2xl p-2 overflow-hidden dark:bg-slate-900 dark:border-slate-700">
        <canvas
          ref={canvasRef}
          style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, cursor: isDragging ? 'grabbing' : 'crosshair' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { setIsDragging(false); setHoveredPos(null); }}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] font-bold px-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: FORWARD_COLOR }} />
          <span className="text-[#334155]">{getTranslation(lang, 'tool_dotplot_forward')}</span>
        </div>
        {showReverse && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: REVERSE_COLOR }} />
            <span className="text-[#334155]">{getTranslation(lang, 'tool_dotplot_reverse')}</span>
          </div>
        )}
        {highlightRegions && result.regions.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border border-blue-300" style={{ backgroundColor: 'rgba(59,130,246,0.2)' }} />
            <span className="text-[#334155]">{getTranslation(lang, 'tool_dotplot_regions')}</span>
          </div>
        )}
      </div>
    </div>
  );
};
