import React from 'react';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';

interface RnaStructureVisualizerProps {
  sequence: string;
  pairs: Array<[number, number]>;
  lang?: Language;
}

const CANONICAL_WC = new Set(['AU', 'UA', 'GC', 'CG']);

export const RnaStructureVisualizer: React.FC<RnaStructureVisualizerProps> = ({ sequence, pairs, lang = 'en' }) => {
  const currentLang: Language = (lang as Language) || 'en';
  const n = sequence.length;

  if (n === 0) return null;

  const spacing = 16;
  const marginX = 20;
  const baselineY = 90;
  const width = marginX * 2 + n * spacing;
  const maxArcHeight = 70;

  // Scale arc height by pair distance so nested/short pairs sit closer to
  // the baseline and long-range pairs arc higher — purely a rendering
  // convenience, not a physical model of RNA folding geometry.
  const maxDist = pairs.reduce((m, [i, j]) => Math.max(m, j - i), 1);

  return (
    <div className="space-y-2">
      <div className="p-3 bg-white border border-[#DDEDE8] rounded-xl overflow-x-auto">
        <svg width={width} height={baselineY + 30} viewBox={`0 0 ${width} ${baselineY + 30}`} className="block">
          {/* Baseline */}
          <line x1={marginX} y1={baselineY} x2={width - marginX} y2={baselineY} stroke="#DDEDE8" strokeWidth={1} />

          {/* Arcs for each base pair */}
          {pairs.map(([i, j], idx) => {
            const x1 = marginX + i * spacing + spacing / 2;
            const x2 = marginX + j * spacing + spacing / 2;
            const dist = j - i;
            const arcHeight = 10 + (dist / maxDist) * maxArcHeight;
            const midX = (x1 + x2) / 2;
            const pairKey = sequence[i] + sequence[j];
            const isWobble = !CANONICAL_WC.has(pairKey);
            return (
              <path
                key={idx}
                d={`M ${x1} ${baselineY} Q ${midX} ${baselineY - arcHeight} ${x2} ${baselineY}`}
                fill="none"
                stroke={isWobble ? '#F59E0B' : '#0F766E'}
                strokeWidth={1.5}
                opacity={0.75}
              />
            );
          })}

          {/* Base letters */}
          {sequence.split('').map((base, i) => (
            <text
              key={i}
              x={marginX + i * spacing + spacing / 2}
              y={baselineY + 16}
              textAnchor="middle"
              fontSize={10}
              fontFamily="monospace"
              fontWeight={700}
              fill="#12312B"
            >
              {base}
            </text>
          ))}
        </svg>
      </div>
      <div className="flex items-center gap-4 text-[10px] text-[#64748B]">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-[#0F766E] inline-block rounded-full" /> {getTranslation(currentLang, 'tool_wc_pair')}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-[#F59E0B] inline-block rounded-full" /> {getTranslation(currentLang, 'tool_wobble_pair')}
        </span>
      </div>
    </div>
  );
};
