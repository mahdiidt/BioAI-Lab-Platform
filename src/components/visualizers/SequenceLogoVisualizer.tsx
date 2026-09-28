// ─────────────────────────────────────────────────────────────
// Sequence Logo Visualizer (SVG-based, publication-quality)
// Renders a stacked-letter logo from a PWM, scaled by
// information content (bits).  Supports DNA, RNA, and Protein.
// ─────────────────────────────────────────────────────────────
import React, { useRef } from 'react';
import { PWMPosition, SeqAlphabet } from '../../utils/motifDiscovery';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Download, Maximize2 } from 'lucide-react';

interface Props {
  pwm: PWMPosition[];
  alphabet: SeqAlphabet;
  lang: Language;
  title?: string;
}

// Color schemes
const DNA_COLORS: Record<string, string> = { A: '#2ECC40', C: '#0074D9', G: '#FFDC00', T: '#FF4136' };
const RNA_COLORS: Record<string, string> = { A: '#2ECC40', C: '#0074D9', G: '#FFDC00', U: '#FF4136' };
const PROTEIN_COLORS: Record<string, string> = {
  // Hydrophobic
  A: '#2b83ba', V: '#2b83ba', I: '#2b83ba', L: '#2b83ba', M: '#2b83ba', F: '#2b83ba', W: '#2b83ba', P: '#2b83ba',
  // Polar
  S: '#abdda4', T: '#abdda4', N: '#abdda4', Q: '#abdda4', Y: '#abdda4', C: '#abdda4',
  // Positive
  K: '#d7191c', R: '#d7191c', H: '#d7191c',
  // Negative
  D: '#fdae61', E: '#fdae61',
  // Special
  G: '#999999',
};

function getColorMap(alphabet: SeqAlphabet): Record<string, string> {
  switch (alphabet) {
    case 'DNA': return DNA_COLORS;
    case 'RNA': return RNA_COLORS;
    case 'PROTEIN': return PROTEIN_COLORS;
  }
}

const COLUMN_WIDTH = 40;
const MAX_HEIGHT = 120; // pixels for max IC
const MARGIN = { top: 30, bottom: 40, left: 50, right: 20 };

export const SequenceLogoVisualizer: React.FC<Props> = ({ pwm, alphabet, lang, title }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const colors = getColorMap(alphabet);

  const maxIC = alphabet === 'PROTEIN' ? Math.log2(20) : 2; // 4.32 or 2
  const width = MARGIN.left + pwm.length * COLUMN_WIDTH + MARGIN.right;
  const height = MARGIN.top + MAX_HEIGHT + MARGIN.bottom;

  // Sort letters per position: smallest IC contribution on top, biggest at bottom
  function getLetterStack(pos: PWMPosition) {
    const chars = Object.keys(pos.frequency);
    const stack = chars
      .map((c) => ({
        char: c,
        height: pos.frequency[c] * pos.informationContent,
        color: colors[c] || '#888',
      }))
      .filter((l) => l.height > 0.001)
      .sort((a, b) => a.height - b.height);
    return stack;
  }

  // Export SVG
  const handleExportSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sequence_logo.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export PNG
  const handleExportPNG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement('canvas');
    const scale = 3;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      const a = document.createElement('a');
      a.download = 'sequence_logo.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-[#12312B] flex items-center gap-2 dark:text-slate-100">
          <Maximize2 className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
          {title || getTranslation(lang, 'tool_motif_logo_title')}
        </h4>
        <div className="flex gap-2">
          <button
            onClick={handleExportSVG}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-[#F3FAF7] border border-[#DDEDE8] rounded-lg text-[#0F766E] hover:bg-[#E6F5EF] transition-colors cursor-pointer dark:bg-slate-800 dark:border-slate-700 dark:text-teal-400"
          >
            <Download className="w-3 h-3" /> SVG
          </button>
          <button
            onClick={handleExportPNG}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-[#F3FAF7] border border-[#DDEDE8] rounded-lg text-[#0F766E] hover:bg-[#E6F5EF] transition-colors cursor-pointer dark:bg-slate-800 dark:border-slate-700 dark:text-teal-400"
          >
            <Download className="w-3 h-3" /> PNG
          </button>
        </div>
      </div>

      {/* SVG Logo */}
      <div className="overflow-x-auto p-4 bg-white border border-[#DDEDE8] rounded-2xl dark:bg-slate-900 dark:border-slate-700">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          xmlns="http://www.w3.org/2000/svg"
          className="block mx-auto"
          style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
        >
          {/* Background */}
          <rect width={width} height={height} fill="white" />

          {/* Y-axis */}
          <line
            x1={MARGIN.left}
            y1={MARGIN.top}
            x2={MARGIN.left}
            y2={MARGIN.top + MAX_HEIGHT}
            stroke="#94A3B8"
            strokeWidth={1}
          />
          {/* Y-axis ticks */}
          {Array.from({ length: Math.ceil(maxIC) + 1 }, (_, i) => i).map((tick) => {
            const y = MARGIN.top + MAX_HEIGHT - (tick / maxIC) * MAX_HEIGHT;
            return (
              <g key={tick}>
                <line x1={MARGIN.left - 5} y1={y} x2={MARGIN.left} y2={y} stroke="#94A3B8" strokeWidth={1} />
                <text x={MARGIN.left - 10} y={y + 4} textAnchor="end" fontSize={10} fill="#64748B">
                  {tick}
                </text>
              </g>
            );
          })}
          {/* Y-axis label */}
          <text
            transform={`rotate(-90, 14, ${MARGIN.top + MAX_HEIGHT / 2})`}
            x={14}
            y={MARGIN.top + MAX_HEIGHT / 2}
            textAnchor="middle"
            fontSize={11}
            fontWeight="bold"
            fill="#334155"
          >
            {getTranslation(lang, 'tool_motif_bits')}
          </text>

          {/* X-axis */}
          <line
            x1={MARGIN.left}
            y1={MARGIN.top + MAX_HEIGHT}
            x2={MARGIN.left + pwm.length * COLUMN_WIDTH}
            y2={MARGIN.top + MAX_HEIGHT}
            stroke="#94A3B8"
            strokeWidth={1}
          />

          {/* Columns */}
          {pwm.map((pos, colIdx) => {
            const stack = getLetterStack(pos);
            const x = MARGIN.left + colIdx * COLUMN_WIDTH;
            let yOffset = MARGIN.top + MAX_HEIGHT; // start from bottom

            return (
              <g key={colIdx}>
                {/* Position number */}
                <text
                  x={x + COLUMN_WIDTH / 2}
                  y={MARGIN.top + MAX_HEIGHT + 18}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#64748B"
                >
                  {colIdx + 1}
                </text>

                {/* Stacked letters */}
                {stack.map((letter, li) => {
                  const letterHeight = (letter.height / maxIC) * MAX_HEIGHT;
                  if (letterHeight < 0.5) return null;
                  yOffset -= letterHeight;

                  // Scale the letter to fill its bounding box
                  const scaleY = letterHeight / 16; // base font size 16
                  const scaleX = (COLUMN_WIDTH - 4) / 16;

                  return (
                    <text
                      key={li}
                      x={x + COLUMN_WIDTH / 2}
                      y={yOffset + letterHeight}
                      textAnchor="middle"
                      dominantBaseline="alphabetic"
                      fontSize={16}
                      fontWeight="bold"
                      fill={letter.color}
                      transform={`translate(${x + COLUMN_WIDTH / 2}, ${yOffset}) scale(${scaleX}, ${scaleY}) translate(${-(x + COLUMN_WIDTH / 2)}, ${-yOffset})`}
                    >
                      {letter.char}
                    </text>
                  );
                })}
              </g>
            );
          })}

          {/* X-axis label */}
          <text
            x={MARGIN.left + (pwm.length * COLUMN_WIDTH) / 2}
            y={height - 5}
            textAnchor="middle"
            fontSize={11}
            fontWeight="bold"
            fill="#334155"
          >
            {getTranslation(lang, 'tool_motif_position')}
          </text>
        </svg>
      </div>

      {/* IC per position bar */}
      <div className="p-4 bg-[#F3FAF7] border border-[#DDEDE8] rounded-2xl dark:bg-slate-800 dark:border-slate-700">
        <h5 className="text-xs font-bold text-[#12312B] mb-2 dark:text-slate-100">
          {getTranslation(lang, 'tool_motif_ic_per_pos')}
        </h5>
        <div className="flex gap-1 items-end" style={{ height: 60 }}>
          {pwm.map((pos, i) => {
            const pct = (pos.informationContent / maxIC) * 100;
            return (
              <div key={i} className="flex flex-col items-center flex-1 min-w-0">
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${pct}%`,
                    backgroundColor: pct > 75 ? '#0F766E' : pct > 40 ? '#14B8A6' : '#94A3B8',
                    minHeight: 2,
                  }}
                />
                <span className="text-[8px] text-[#64748B] mt-0.5 dark:text-slate-400">{i + 1}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
