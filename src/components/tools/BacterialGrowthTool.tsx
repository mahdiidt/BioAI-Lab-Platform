import React, { useState } from 'react';
import { calculateBacterialGrowth, BacterialGrowthResult } from '../../utils/microbiology';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Activity, Clock, AlertCircle } from 'lucide-react';
import { ExportButton } from '../common/ExportButton';

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
      <div className="p-5 bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-700 rounded-2xl shadow-xs space-y-4">
        <h4 className="font-bold text-sm text-[#12312B] dark:text-slate-100 border-b border-[#DDEDE8] dark:border-slate-700 pb-2">
          {getTranslation(lang, 'tool_bacterial_growth_params')}
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-[#64748B] dark:text-slate-400 block mb-1">{getTranslation(lang, 'tool_initial_pop_n0')}</label>
            <input
              type="number"
              min="1"
              value={n0}
              onChange={(e) => setN0(parseInt(e.target.value) || 1)}
              className="w-full p-2.5 rounded-xl border border-[#DDEDE8] dark:border-slate-600 font-mono text-sm font-bold text-[#0F766E] dark:text-teal-400 bg-[#F3FAF7] dark:bg-slate-800 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#64748B] dark:text-slate-400 block mb-1">{getTranslation(lang, 'tool_final_pop_nt')}</label>
            <input
              type="number"
              min="2"
              value={nt}
              onChange={(e) => setNt(parseInt(e.target.value) || 2)}
              className="w-full p-2.5 rounded-xl border border-[#DDEDE8] dark:border-slate-600 font-mono text-sm font-bold text-[#0F766E] dark:text-teal-400 bg-[#F3FAF7] dark:bg-slate-800 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#64748B] dark:text-slate-400 block mb-1">{getTranslation(lang, 'tool_elapsed_time')}</label>
            <input
              type="number"
              step="0.5"
              min="0.1"
              value={hours}
              onChange={(e) => setHours(parseFloat(e.target.value) || 0.1)}
              className="w-full p-2.5 rounded-xl border border-[#DDEDE8] dark:border-slate-600 font-mono text-sm font-bold text-[#0F766E] dark:text-teal-400 bg-[#F3FAF7] dark:bg-slate-800 dark:bg-slate-800"
            />
          </div>
        </div>
      </div>

      {/* Invalid-input warning: this growth model requires Nt > N0 */}
      {nt <= n0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-amber-800">
            {getTranslation(lang, 'tool_bacterial_growth_invalid_input')}
          </p>
        </div>
      )}

      {/* Results */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-700 rounded-2xl shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-[#DDEDE8] dark:border-slate-700 pb-3">
          <h4 className="font-bold text-sm text-[#12312B] dark:text-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
            {getTranslation(lang, 'tool_generation_metrics')}
          </h4>
          <ExportButton filename="bacterial_growth.json" data={res} format="json" lang={lang} className="me-2" />
          <span className="text-xs font-mono font-bold text-[#0F766E] dark:text-teal-400 bg-[#ECFDF5] dark:bg-teal-950/40 px-2.5 py-1 rounded-lg">
            g = {res.generationTimeMins} mins / generation
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 bg-[#ECFDF5] dark:bg-teal-950/40 border border-[#DDEDE8] dark:border-slate-700 rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">{getTranslation(lang, 'tool_num_generations')}</span>
            <span className="text-lg font-bold text-[#0F766E] dark:text-teal-400 font-mono">{res.generations}</span>
          </div>
          <div className="p-3.5 bg-[#ECFDF5] dark:bg-teal-950/40 border border-[#DDEDE8] dark:border-slate-700 rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">{getTranslation(lang, 'tool_generation_time')}</span>
            <span className="text-lg font-bold text-[#22C55E] dark:text-green-400 font-mono">{res.generationTimeHours} h</span>
          </div>
          <div className="p-3.5 bg-[#ECFDF5] dark:bg-teal-950/40 border border-[#DDEDE8] dark:border-slate-700 rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">{getTranslation(lang, 'tool_doubling_time_mins')}</span>
            <span className="text-lg font-bold text-[#0EA5E9] dark:text-sky-400 font-mono">{res.generationTimeMins} min</span>
          </div>
          <div className="p-3.5 bg-[#ECFDF5] dark:bg-teal-950/40 border border-[#DDEDE8] dark:border-slate-700 rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">{getTranslation(lang, 'tool_growth_rate_k')}</span>
            <span className="text-lg font-bold text-[#8B5CF6] dark:text-violet-400 font-mono">{res.growthRateK} h⁻¹</span>
          </div>
        </div>

        {/* Four Phase Growth Curve Points */}
        <div className="space-y-3 pt-2">
          <h5 className="font-bold text-xs text-[#12312B] dark:text-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
            {getTranslation(lang, 'tool_growth_phases')}
          </h5>

          <div className="max-h-60 overflow-y-auto border border-[#DDEDE8] rounded-xl bg-[#F3FAF7] dark:bg-slate-800">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#ECFDF5] text-[#12312B] dark:text-slate-100 border-b border-[#DDEDE8] dark:border-slate-700 sticky top-0">
                <tr>
                  <th className="p-2.5 font-bold">{getTranslation(lang, 'tool_time_hours')}</th>
                  <th className="p-2.5 font-bold">{getTranslation(lang, 'tool_est_population')}</th>
                  <th className="p-2.5 font-bold">{getTranslation(lang, 'tool_growth_phase')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDEDE8] dark:divide-slate-700">
                {res.curvePoints.map((pt, idx) => (
                  <tr key={idx} className="hover:bg-white/60 dark:hover:bg-slate-700/40 transition-colors">
                    <td className="p-2.5 font-mono font-bold text-[#64748B] dark:text-slate-400">{pt.timeHours} h</td>
                    <td className="p-2.5 font-mono font-bold text-[#0F766E] dark:text-teal-400">{pt.population.toLocaleString()} cells</td>
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

        <div className="p-3 bg-[#ECFDF5] dark:bg-teal-950/40 border border-[#DDEDE8] dark:border-slate-700 rounded-xl flex items-center gap-2 text-xs text-[#0F766E] dark:text-teal-400">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#0F766E] dark:text-teal-400" />
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
