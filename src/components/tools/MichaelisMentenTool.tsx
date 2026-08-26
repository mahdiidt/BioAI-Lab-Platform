import React, { useState } from 'react';
import { calculateMichaelisMenten, MichaelisMentenResult } from '../../utils/biochemistry';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Activity, AlertTriangle, TrendingUp } from 'lucide-react';
import { ExportButton } from '../common/ExportButton';

interface ToolProps {
  lang: Language;
}

export const MichaelisMentenTool: React.FC<ToolProps> = ({ lang }) => {
  const [vmax, setVmax] = useState<number>(100);
  const [km, setKm] = useState<number>(5);
  const [substrate, setSubstrate] = useState<number>(10);

  const res: MichaelisMentenResult = calculateMichaelisMenten(vmax, km, substrate);

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
        <h4 className="font-bold text-sm text-[#12312B] border-b border-[#DDEDE8] pb-2">
          {getTranslation(lang, 'tool_enzyme_params')}
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_vmax_label')}</label>
            <input
              type="number"
              step="1"
              min="1"
              value={vmax}
              onChange={(e) => setVmax(parseFloat(e.target.value) || 1)}
              className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#0F766E] bg-[#F3FAF7]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_km_label')}</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={km}
              onChange={(e) => setKm(parseFloat(e.target.value) || 0.1)}
              className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#0F766E] bg-[#F3FAF7]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_substrate_conc')}</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={substrate}
              onChange={(e) => setSubstrate(parseFloat(e.target.value) || 0)}
              className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#0F766E] bg-[#F3FAF7]"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-3">
          <h4 className="font-bold text-sm text-[#12312B] flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#0F766E]" />
            {getTranslation(lang, 'tool_reaction_vel_output')}
          </h4>
          <div className="flex items-center gap-2">
            <ExportButton filename="michaelis_menten.json" data={res} format="json" lang={lang} />
            <span className="text-xs font-mono font-bold text-[#0F766E] bg-[#ECFDF5] px-2.5 py-1 rounded-lg">
              V = {res.velocity} µmol/min
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_substrate_s')}</span>
            <span className="text-lg font-bold text-[#0F766E] font-mono">{substrate} mM</span>
          </div>
          <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_init_velocity')}</span>
            <span className="text-lg font-bold text-[#22C55E] font-mono">{res.velocity}</span>
          </div>
          <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_pct_vmax')}</span>
            <span className="text-lg font-bold text-[#0EA5E9] font-mono">{res.percentVmax}%</span>
          </div>
          <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_cat_efficiency')}</span>
            <span className="text-lg font-bold text-[#8B5CF6] font-mono">{res.catalyticEfficiency}</span>
          </div>
        </div>

        {/* Lineweaver-Burk Double Reciprocal Points & Warning */}
        <div className="p-4 bg-[#F3FAF7] border border-[#DDEDE8] rounded-2xl space-y-3">
          <h5 className="font-bold text-xs text-[#12312B] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#8B5CF6]" />
            {getTranslation(lang, 'tool_lineweaver_burk')}
          </h5>

          <div className="grid grid-cols-2 gap-3 font-mono text-xs text-[#12312B]">
            <div className="p-2.5 bg-white border border-[#DDEDE8] rounded-xl">
              1/[S] = <strong>{res.lineweaverBurk.invSubstrate} mM⁻¹</strong>
            </div>
            <div className="p-2.5 bg-white border border-[#DDEDE8] rounded-xl">
              1/v = <strong>{res.lineweaverBurk.invVelocity} (µmol/min)⁻¹</strong>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">{getTranslation(lang, 'tool_transform_error_warn')}:</strong>
              {res.lineweaverBurk.warningNote}
            </div>
          </div>
        </div>
      </div>

      <ScientificExplanation
        formula="v = (Vmax × [S]) / (Km + [S])  |  1/v = (Km/Vmax)(1/[S]) + 1/Vmax"
        biologicalMeaning="Michaelis-Menten kinetics models single-substrate non-allosteric enzyme catalysis. Km equals the substrate concentration at which reaction rate is half of Vmax, reflecting enzyme-substrate affinity."
        assumptions="Assumes quasi-steady state ([ES] concentration is constant) and negligible reverse reaction (P → S)."
        limitations="Does not apply to cooperative allosteric enzymes (Hill equation), multi-substrate ping-pong mechanisms, or substrate inhibition."
        lang={lang}
      />
    </div>
  );
};
