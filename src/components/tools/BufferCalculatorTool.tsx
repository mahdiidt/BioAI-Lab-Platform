import React, { useMemo, useState } from 'react';
import {
  calculatePhFromRatio,
  calculateMixingVolumes,
  BUFFER_SYSTEMS,
  MixingVolumesResult,
} from '../../utils/bufferChemistry';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Droplet, FlaskConical, AlertTriangle, Percent } from 'lucide-react';
import { ExportButton } from '../common/ExportButton';

interface ToolProps {
  lang: Language;
}

type Mode = 'ph' | 'mix';

const inputClass =
  'w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#0F766E] bg-[#F3FAF7]';
const labelClass = 'text-xs font-bold text-[#64748B] block mb-1';

export const BufferCalculatorTool: React.FC<ToolProps> = ({ lang }) => {
  const [mode, setMode] = useState<Mode>('ph');
  const [systemId, setSystemId] = useState<string>('acetate');
  const [customPka, setCustomPka] = useState<number>(7.0);

  // Mode A: Calculate pH
  const [concBase, setConcBase] = useState<number>(0.1);
  const [concAcid, setConcAcid] = useState<number>(0.1);

  // Mode B: Calculate mixing volumes
  const [targetPh, setTargetPh] = useState<number>(5.0);
  const [totalConc, setTotalConc] = useState<number>(0.1);
  const [totalVol, setTotalVol] = useState<number>(500);

  const selectedSystem = BUFFER_SYSTEMS.find((b) => b.id === systemId) ?? BUFFER_SYSTEMS[0];
  const pKa = systemId === 'custom' ? customPka : selectedSystem.pKa;

  const phResult = useMemo(() => {
    try {
      return { value: calculatePhFromRatio(pKa, concBase, concAcid), error: null as string | null };
    } catch (e) {
      return { value: null as number | null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [pKa, concBase, concAcid]);

  const mixResult = useMemo(() => {
    try {
      return { value: calculateMixingVolumes(pKa, targetPh, totalConc, totalVol) as MixingVolumesResult, error: null as string | null };
    } catch (e) {
      return { value: null as MixingVolumesResult | null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [pKa, targetPh, totalConc, totalVol]);

  const deltaFromPka = mode === 'ph' ? Math.abs((phResult.value ?? pKa) - pKa) : Math.abs(targetPh - pKa);
  const showEarlyWarning = mode === 'mix' && deltaFromPka > 1;

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      {/* Mode Tabs */}
      <div className="flex items-center gap-2 border-b border-[#DDEDE8] pb-3 overflow-x-auto">
        <button
          onClick={() => setMode('ph')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            mode === 'ph' ? 'bg-[#0F766E] text-white shadow-xs' : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
          }`}
        >
          <Percent className="w-4 h-4" /> {getTranslation(lang, 'tool_buffer_mode_ph')}
        </button>
        <button
          onClick={() => setMode('mix')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            mode === 'mix' ? 'bg-[#0F766E] text-white shadow-xs' : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
          }`}
        >
          <FlaskConical className="w-4 h-4" /> {getTranslation(lang, 'tool_buffer_mode_mix')}
        </button>
      </div>

      {/* Buffer System Selector */}
      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
        <h4 className="font-bold text-sm text-[#12312B] border-b border-[#DDEDE8] pb-2">{getTranslation(lang, 'tool_buffer_system')}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>{getTranslation(lang, 'tool_buffer_system')}</label>
            <select
              value={systemId}
              onChange={(e) => setSystemId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#0F766E] bg-[#F3FAF7] cursor-pointer"
            >
              {BUFFER_SYSTEMS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.id !== 'custom' ? `(pKa ${b.pKa})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{getTranslation(lang, 'tool_buffer_pka')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="14"
              disabled={systemId !== 'custom'}
              value={pKa}
              onChange={(e) => setCustomPka(parseFloat(e.target.value) || 0)}
              className={`${inputClass} disabled:opacity-70`}
            />
          </div>
        </div>
        {selectedSystem.note && (
          <p className="text-[11px] text-[#64748B] leading-relaxed bg-[#F3FAF7] border border-[#DDEDE8] rounded-lg p-2.5">
            {selectedSystem.note}
          </p>
        )}
      </div>

      {mode === 'ph' && (
        <>
          <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
            <h4 className="font-bold text-sm text-[#12312B] border-b border-[#DDEDE8] pb-2">{getTranslation(lang, 'tool_buffer_mode_ph')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{getTranslation(lang, 'tool_buffer_conc_base')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={concBase}
                  onChange={(e) => setConcBase(parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{getTranslation(lang, 'tool_buffer_conc_acid')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={concAcid}
                  onChange={(e) => setConcAcid(parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {phResult.error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">{phResult.error}</div>
          ) : (
            <div className="p-5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider block">
                  {getTranslation(lang, 'tool_buffer_calculated_ph')}
                </span>
                <ExportButton
                  filename="buffer_ph_calc.json"
                  data={{ pKa, concentrationBase: concBase, concentrationAcid: concAcid, pH: phResult.value }}
                  format="json"
                  lang={lang}
                />
              </div>
              <div className="text-3xl font-black text-[#0F766E] font-mono">{phResult.value}</div>
              <p className="text-xs text-[#64748B] font-mono pt-1">
                [A-]/[HA] = {(concAcid > 0 ? concBase / concAcid : 0).toFixed(3)}
              </p>
            </div>
          )}
        </>
      )}

      {mode === 'mix' && (
        <>
          <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
            <h4 className="font-bold text-sm text-[#12312B] border-b border-[#DDEDE8] pb-2">{getTranslation(lang, 'tool_buffer_mode_mix')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>{getTranslation(lang, 'tool_buffer_target_ph')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="14"
                  value={targetPh}
                  onChange={(e) => setTargetPh(parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{getTranslation(lang, 'tool_buffer_total_conc')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalConc}
                  onChange={(e) => setTotalConc(parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{getTranslation(lang, 'tool_buffer_total_vol')}</label>
                <input
                  type="number"
                  step="10"
                  min="0"
                  value={totalVol}
                  onChange={(e) => setTotalVol(parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {showEarlyWarning && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">{getTranslation(lang, 'tool_buffer_capacity_warning_title')}</strong>
                {getTranslation(lang, 'tool_buffer_capacity_warning_body')}
              </div>
            </div>
          )}

          {mixResult.error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">{mixResult.error}</div>
          ) : (
            mixResult.value && (
              <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-3">
                  <h4 className="font-bold text-sm text-[#12312B] flex items-center gap-2">
                    <Droplet className="w-4 h-4 text-[#0F766E]" />
                    {getTranslation(lang, 'tool_buffer_mode_mix')}
                  </h4>
                  <ExportButton filename="buffer_mixing_volumes.json" data={mixResult.value} format="json" lang={lang} />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
                    <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_buffer_acid_vol')}</span>
                    <span className="text-lg font-bold text-[#0F766E] font-mono">{mixResult.value.acidVolumeMl} mL</span>
                  </div>
                  <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
                    <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_buffer_base_vol')}</span>
                    <span className="text-lg font-bold text-[#22C55E] font-mono">{mixResult.value.baseVolumeMl} mL</span>
                  </div>
                  <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
                    <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_buffer_ratio')}</span>
                    <span className="text-lg font-bold text-[#0EA5E9] font-mono">{mixResult.value.ratio}</span>
                  </div>
                  <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
                    <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_buffer_pct_ionized')}</span>
                    <span className="text-lg font-bold text-[#8B5CF6] font-mono">{mixResult.value.percentIonized}%</span>
                  </div>
                </div>

                {mixResult.value.bufferingCapacityWarning && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>{mixResult.value.bufferingCapacityWarning}</div>
                  </div>
                )}
              </div>
            )
          )}
        </>
      )}

      <ScientificExplanation
        formula="pH = pKa + log10([A-] / [HA])"
        biologicalMeaning="The Henderson-Hasselbalch equation relates the pH of a solution to the pKa of a weak acid/conjugate base pair and the ratio of their concentrations. It is the basis for preparing laboratory buffers that resist pH change (e.g. Tris, phosphate, acetate) used in enzyme assays, cell culture, and molecular biology protocols."
        assumptions="Assumes the acid/base pair behaves as a simple monoprotic weak-acid equilibrium and that activity coefficients ≈ 1 (ideal dilute solution). Mixing-volume mode assumes both the acid-form and base-form stock solutions are prepared at the same total concentration, so volume ratio equals mole ratio."
        limitations="Polyprotic buffers (e.g. citrate, phosphate) have multiple pKa values; this tool uses a single representative pKa and does not model the full multi-equilibrium system. Buffering capacity is weak more than ~1 pH unit from the pKa — a warning is shown in that case. Ionic strength, temperature effects on pKa, and non-ideal solution behavior are not modeled."
        lang={lang}
      />
    </div>
  );
};
