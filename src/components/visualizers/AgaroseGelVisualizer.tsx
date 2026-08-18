import React from 'react';
import { calculateGelMigrationPercent } from '../../utils/restriction';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';

interface GelLane {
  name: string;
  bandsBp: number[];
}

interface AgaroseGelVisualizerProps {
  ladderBp?: number[];
  lanes: GelLane[];
  gelConcentrationPercent?: number;
  lang?: Language;
}

export const AgaroseGelVisualizer: React.FC<AgaroseGelVisualizerProps> = ({
  ladderBp = [10000, 8000, 6000, 5000, 4000, 3000, 2000, 1500, 1000, 500, 200],
  lanes,
  gelConcentrationPercent = 1.0,
  lang = 'en',
}) => {
  const currentLang: Language = (lang as Language) || 'en';
  const maxBp = Math.max(...ladderBp, 10000);
  const minBp = 100;

  const getMigrationPercentage = (sizeBp: number) =>
    calculateGelMigrationPercent(sizeBp, gelConcentrationPercent, maxBp, minBp);

  const allLanes = [{ name: getTranslation(currentLang, 'tool_dna_ladder'), bandsBp: ladderBp }, ...lanes];

  return (
    <div className="p-4 bg-[#121826] rounded-2xl border border-slate-700 text-white shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2 gap-2">
        <span className="font-bold text-teal-400">{getTranslation(currentLang, 'tool_gel_sim_title')} ({gelConcentrationPercent}% {getTranslation(currentLang, 'tool_agarose')})</span>
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> {getTranslation(currentLang, 'tool_cathode_anode_label')}
        </span>
      </div>

      {/* Gel Tank Surface */}
      <div className="relative bg-[#0b0f19] border-2 border-teal-500/30 rounded-xl p-4 min-h-[340px] flex gap-4 overflow-x-auto">
        {allLanes.map((lane, laneIdx) => (
          <div key={laneIdx} className="flex-1 min-w-[75px] relative flex flex-col items-center">
            {/* Sample Well Pocket */}
            <div className="w-12 h-3.5 bg-slate-800 border border-slate-600 rounded-xs mb-3 flex items-center justify-center">
              <span className="text-[9px] font-mono text-slate-400">W{laneIdx + 1}</span>
            </div>

            <span className="text-[10px] font-semibold text-slate-300 text-center line-clamp-1 mb-2">
              {lane.name}
            </span>

            {/* Lane Migration Column */}
            <div className="w-full flex-1 relative bg-slate-900/50 rounded border border-slate-800/50 min-h-[260px]">
              {lane.bandsBp.map((bandBp, bandIdx) => {
                const topPct = getMigrationPercentage(bandBp);
                const isLadder = laneIdx === 0;

                return (
                  <div
                    key={bandIdx}
                    style={{ top: `${topPct}%` }}
                    className={`absolute left-1 right-1 h-1.5 rounded-full shadow-lg transition-all hover:scale-110 cursor-pointer group ${
                      isLadder
                        ? 'bg-cyan-300 shadow-cyan-500/80'
                        : 'bg-[#22C55E] shadow-green-500/80'
                    }`}
                  >
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/90 text-white font-mono text-[10px] rounded border border-slate-700 whitespace-nowrap z-20 pointer-events-none transition-opacity">
                      {bandBp.toLocaleString()} bp
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Required Explanatory Note */}
      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-[11px] text-slate-300 space-y-1">
        <strong className="text-teal-400 font-bold block">{getTranslation(currentLang, 'tool_gel_model_note_title')}</strong>
        <p className="leading-relaxed">
          {getTranslation(currentLang, 'tool_gel_model_note_body')}
        </p>
      </div>
    </div>
  );
};