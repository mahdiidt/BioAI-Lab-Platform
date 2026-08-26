import React, { useState } from 'react';
import { calculateMolarity, calculateC1V1, calculateCellDensityOd600 } from '../../utils/lab';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Calculator, FlaskConical, Droplet, Info } from 'lucide-react';
import { ExportButton } from '../common/ExportButton';

interface ToolProps {
  lang: Language;
  initialTab?: 'molarity' | 'c1v1' | 'od600';
}

export const MolarityCalcTool: React.FC<ToolProps> = ({ lang, initialTab = 'molarity' }) => {
  const [activeTab, setActiveTab] = useState<'molarity' | 'c1v1' | 'od600'>(initialTab);

  // Molarity state
  const [targetConcM, setTargetConcM] = useState<number>(0.1);
  const [volMl, setVolMl] = useState<number>(500);
  const [mw, setMw] = useState<number>(58.44); // NaCl default

  // C1V1 state
  const [c1, setC1] = useState<number>(10);
  const [v1, setV1] = useState<number>(5);
  const [c2, setC2] = useState<number>(1);
  const [v2, setV2] = useState<number>(50);
  const [targetToSolve, setTargetToSolve] = useState<'V1' | 'C2'>('V1');

  // OD600 state
  const [od600, setOd600] = useState<number>(0.6);
  const [organism, setOrganism] = useState<string>('E. coli');

  const molarityRes = calculateMolarity(undefined, mw, volMl, targetConcM);
  const c1v1Res = calculateC1V1(c1, targetToSolve === 'V1' ? undefined : v1, targetToSolve === 'C2' ? undefined : c2, v2);
  const odRes = calculateCellDensityOd600(od600, organism);

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#DDEDE8] pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('molarity')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'molarity'
              ? 'bg-[#0F766E] text-white shadow-xs'
              : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
          }`}
        >
          <Calculator className="w-4 h-4" /> {getTranslation(lang, 'tool_molarity_calc')}
        </button>
        <button
          onClick={() => setActiveTab('c1v1')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'c1v1'
              ? 'bg-[#0F766E] text-white shadow-xs'
              : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
          }`}
        >
          <FlaskConical className="w-4 h-4" /> {getTranslation(lang, 'tool_solution_dilution')}
        </button>
        <button
          onClick={() => setActiveTab('od600')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'od600'
              ? 'bg-[#0F766E] text-white shadow-xs'
              : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
          }`}
        >
          <Droplet className="w-4 h-4" /> {getTranslation(lang, 'tool_od600_density')}
        </button>
      </div>

      {activeTab === 'molarity' && (
        <div className="space-y-6">
          <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
            <h4 className="font-bold text-sm text-[#12312B] border-b border-[#DDEDE8] pb-2">
              {getTranslation(lang, 'tool_sol_prep_params')}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_target_conc')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={targetConcM}
                  onChange={(e) => setTargetConcM(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#0F766E] bg-[#F3FAF7]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_desired_vol')}</label>
                <input
                  type="number"
                  step="10"
                  min="0"
                  value={volMl}
                  onChange={(e) => setVolMl(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#0F766E] bg-[#F3FAF7]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_solute_mw')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={mw}
                  onChange={(e) => setMw(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#0F766E] bg-[#F3FAF7]"
                />
              </div>
            </div>
          </div>

          {molarityRes && (
            <div className="p-5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider block">{getTranslation(lang, 'tool_req_solute_mass')}</span>
                <ExportButton filename="molarity_calc.json" data={molarityRes} format="json" lang={lang} />
              </div>
              <div className="text-3xl font-black text-[#0F766E] font-mono">
                {molarityRes.value} {molarityRes.unit}
              </div>
              <div className="text-xs text-[#0F766E] font-medium pt-1 space-y-1">
                {molarityRes.calculationSteps.map((s, i) => (
                  <p key={i}>{s}</p>
                ))}
              </div>
            </div>
          )}

          <ScientificExplanation
            formula="Mass (g) = Concentration (mol/L) × Volume (L) × Molecular Weight (g/mol)"
            biologicalMeaning="Molarity defines solute chemical concentration per unit volume of solution, fundamental for buffer preparation, cell culture media, and enzymatic assay kinetics."
            assumptions="Assumes complete chemical dissociation and ideal solution behavior without volumetric contraction."
            limitations="Assumes measurements at standard laboratory temperature."
            lang={lang}
          />
        </div>
      )}

      {activeTab === 'c1v1' && (
        <div className="space-y-6">
          <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-2">
              <h4 className="font-bold text-sm text-[#12312B]">{getTranslation(lang, 'tool_dilution_calc')}</h4>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#64748B] font-bold">{getTranslation(lang, 'tool_solve_for')}:</span>
                <button
                  onClick={() => setTargetToSolve('V1')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer ${
                    targetToSolve === 'V1' ? 'bg-[#0F766E] text-white' : 'bg-[#F3FAF7] text-[#64748B]'
                  }`}
                >
                  {getTranslation(lang, 'tool_stock_vol_v1')}
                </button>
                <button
                  onClick={() => setTargetToSolve('C2')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer ${
                    targetToSolve === 'C2' ? 'bg-[#0F766E] text-white' : 'bg-[#F3FAF7] text-[#64748B]'
                  }`}
                >
                  {getTranslation(lang, 'tool_final_conc_c2')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_stock_conc_c1')}</label>
                <input
                  type="number"
                  value={c1}
                  onChange={(e) => setC1(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#0F766E] bg-[#F3FAF7]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#64748B] block mb-1">
                  {getTranslation(lang, 'tool_stock_vol_v1')} {targetToSolve === 'V1' && <span className="text-[#0F766E] font-bold">({getTranslation(lang, 'tool_target_label')})</span>}
                </label>
                <input
                  type="number"
                  disabled={targetToSolve === 'V1'}
                  value={targetToSolve === 'V1' ? c1v1Res?.value || '' : v1}
                  onChange={(e) => setV1(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#0F766E] bg-[#F3FAF7] disabled:opacity-80"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#64748B] block mb-1">
                  {getTranslation(lang, 'tool_final_conc_c2')} {targetToSolve === 'C2' && <span className="text-[#0F766E] font-bold">({getTranslation(lang, 'tool_target_label')})</span>}
                </label>
                <input
                  type="number"
                  disabled={targetToSolve === 'C2'}
                  value={targetToSolve === 'C2' ? c1v1Res?.value || '' : c2}
                  onChange={(e) => setC2(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#0F766E] bg-[#F3FAF7] disabled:opacity-80"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_final_vol_v2')}</label>
                <input
                  type="number"
                  value={v2}
                  onChange={(e) => setV2(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#0F766E] bg-[#F3FAF7]"
                />
              </div>
            </div>
          </div>

          {c1v1Res && (
            <div className="p-5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider block">
                  {getTranslation(lang, 'tool_calculated')} {c1v1Res.solvedVariable}
                </span>
                <ExportButton filename="c1v1_dilution.json" data={c1v1Res} format="json" lang={lang} />
              </div>
              <div className="text-3xl font-black text-[#0F766E] font-mono">
                {c1v1Res.value} {c1v1Res.unit}
              </div>
              <p className="text-xs text-[#0F766E] font-medium pt-1">
                {getTranslation(lang, 'tool_add_stock_1')} <strong>{c1v1Res.value} {c1v1Res.unit}</strong> {getTranslation(lang, 'tool_add_stock_2')} <strong>{c1v1Res.diluentVolume} {c1v1Res.unit}</strong> {getTranslation(lang, 'tool_add_stock_3')}
              </p>
            </div>
          )}

          <ScientificExplanation
            formula="C₁ × V₁ = C₂ × V₂"
            biologicalMeaning="Conservation of mass principle during solution dilution: the total amount of solute remains identical before and after solvent addition."
            assumptions="Requires identical concentration units for C1/C2 and identical volume units for V1/V2."
            limitations="Assumes non-reactive mixing without significant volume non-idealities."
            lang={lang}
          />
        </div>
      )}

      {activeTab === 'od600' && (
        <div className="space-y-6">
          <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
            <h4 className="font-bold text-sm text-[#12312B] border-b border-[#DDEDE8] pb-2">
              {getTranslation(lang, 'tool_od_spec')}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_measured_od600')}</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  value={od600}
                  onChange={(e) => setOd600(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#0F766E] bg-[#F3FAF7]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_microorganism_type')}</label>
                <select
                  value={organism}
                  onChange={(e) => setOrganism(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#0F766E] bg-[#F3FAF7]"
                >
                  <option value="E. coli">E. coli (~8×10⁸ cells/mL per OD600)</option>
                  <option value="Yeast">S. cerevisiae Yeast (~3×10⁷ cells/mL per OD600)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider block">{getTranslation(lang, 'tool_est_cell_density')}</span>
              <ExportButton filename="od600_cell_density.json" data={odRes} format="json" lang={lang} />
            </div>
            <div className="text-2xl font-black text-[#0F766E] font-mono">
              {odRes.formattedCells} cells/mL
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">{getTranslation(lang, 'tool_calib_disc_title')}:</strong>
                {odRes.disclaimer}
              </div>
            </div>
          </div>

          <ScientificExplanation
            formula="Cell Density (cells/mL) = OD₆₀₀ × Calibration Factor"
            biologicalMeaning="OD600 measures light scattering caused by bacterial suspensions in a cuvette. It serves as an indirect proxy for biomass concentration during bacterial growth monitoring."
            assumptions="Assumes linear Beer-Lambert range (typically 0.1 < OD600 < 0.8). Samples above 0.8 must be diluted prior to measurement."
            limitations="Optical light scattering is sensitive to cell size, morphology, spectrophotometer geometry, and cell aggregation."
            lang={lang}
          />
        </div>
      )}
    </div>
  );
};
