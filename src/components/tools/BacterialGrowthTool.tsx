import React, { useState } from 'react';
import { calculateBacterialGrowth, BacterialGrowthResult } from '../../utils/microbiology';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Activity, Clock, AlertCircle } from 'lucide-react';

interface ToolProps {
  lang: Language;
}

export const BacterialGrowthTool: React.FC<ToolProps> = ({ lang }) => {
  const [n0, setN0] = useState<number>(1000);
  const [nt, setNt] = useState<number>(1000000);
  const [hours, setHours] = useState<number>(6);

  const res: BacterialGrowthResult = calculateBacterialGrowth(n0, nt, hours);

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
        <h4 className="font-bold text-sm text-[#12312B] border-b border-[#DDEDE8] pb-2">
          {getTranslation(lang, 'tool_bacterial_growth_params')}
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_initial_pop_n0')}</label>
            <input
              type="number"
              min="1"
              value={n0}
              onChange={(e) => setN0(parseInt(e.target.value) || 1)}
              className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#0F766E] bg-[#F3FAF7]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_final_pop_nt')}</label>
            <input
              type="number"
              min="2"
              value={nt}
              onChange={(e) => setNt(parseInt(e.target.value) || 2)}
              className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#0F766E] bg-[#F3FAF7]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_elapsed_time')}</label>
            <input
              type="number"
              step="0.5"
              min="0.1"
              value={hours}
              onChange={(e) => setHours(parseFloat(e.target.value) || 0.1)}
              className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#0F766E] bg-[#F3FAF7]"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-3">
          <h4 className="font-bold text-sm text-[#12312B] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#0F766E]" />
            {getTranslation(lang, 'tool_generation_metrics')}
          </h4>
          <span className="text-xs font-mono font-bold text-[#0F766E] bg-[#ECFDF5] px-2.5 py-1 rounded-lg">
            g = {res.generationTimeMins} mins / generation
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_num_generations')}</span>
            <span className="text-lg font-bold text-[#0F766E] font-mono">{res.generations}</span>
          </div>
          <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_generation_time')}</span>
            <span className="text-lg font-bold text-[#22C55E] font-mono">{res.generationTimeHours} h</span>
          </div>
          <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_doubling_time_mins')}</span>
            <span className="text-lg font-bold text-[#0EA5E9] font-mono">{res.generationTimeMins} min</span>
          </div>
          <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_growth_rate_k')}</span>
            <span className="text-lg font-bold text-[#8B5CF6] font-mono">{res.growthRateK} h⁻¹</span>
          </div>
        </div>

        {/* Four Phase Growth Curve Points */}
        <div className="space-y-3 pt-2">
          <h5 className="font-bold text-xs text-[#12312B] flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#0F766E]" />
            {getTranslation(lang, 'tool_growth_phases')}
          </h5>

          <div className="max-h-60 overflow-y-auto border border-[#DDEDE8] rounded-xl bg-[#F3FAF7]">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#ECFDF5] text-[#12312B] border-b border-[#DDEDE8] sticky top-0">
                <tr>
                  <th className="p-2.5 font-bold">{getTranslation(lang, 'tool_time_hours')}</th>
                  <th className="p-2.5 font-bold">{getTranslation(lang, 'tool_est_population')}</th>
                  <th className="p-2.5 font-bold">{getTranslation(lang, 'tool_growth_phase')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDEDE8]">
                {res.curvePoints.map((pt, idx) => (
                  <tr key={idx} className="hover:bg-white/60 transition-colors">
                    <td className="p-2.5 font-mono font-bold text-[#64748B]">{pt.timeHours} h</td>
                    <td className="p-2.5 font-mono font-bold text-[#0F766E]">{pt.population.toLocaleString()} cells</td>
                    <td className="p-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          pt.phase === 'Lag'
                            ? 'bg-amber-100 text-amber-800'
                            : pt.phase === 'Log'
                            ? 'bg-emerald-100 text-emerald-800'
                            : pt.phase === 'Stationary'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {pt.phase} Phase
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-3 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl flex items-center gap-2 text-xs text-[#0F766E]">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#0F766E]" />
          <span>{res.modelDisclaimer}</span>
        </div>
      </div>

      <ScientificExplanation
        formula="Nₜ = N₀ × 2ⁿ  |  n = [ log₁₀(Nₜ) - log₁₀(N₀) ] / log₁₀(2)  |  g = t / n"
        biologicalMeaning="Bacterial binary fission proceeds exponentially during the Log phase. Generation time (g) represents the duration required for a population to double."
        assumptions="Assumes constant nutrient availability and non-limiting conditions during the exponential Log phase."
        limitations="Simulates idealized batch culture phases."
        lang={lang}
      />
    </div>
  );
};
