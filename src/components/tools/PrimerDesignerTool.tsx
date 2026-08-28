import React, { useState } from 'react';
import { SequenceInput } from '../common/SequenceInput';
import { calculatePrimerTm, calculatePcrReactionSetup, calculateAnnealingTemperature } from '../../utils/pcr';
import { designPrimers } from '../../utils/bioinformatics';
import { validateSequence } from '../../utils/sequenceValidator';
import { CopyButton } from '../common/CopyButton';
import { ExportButton } from '../common/ExportButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Crosshair, Thermometer, TestTube, AlertTriangle } from 'lucide-react';

interface ToolProps {
  lang: Language;
  initialTab?: 'design' | 'tm' | 'setup';
}

export const PrimerDesignerTool: React.FC<ToolProps> = ({ lang, initialTab = 'design' }) => {
  const [activeTab, setActiveTab] = useState<'design' | 'tm' | 'setup'>(initialTab);

  // Design state
  const [templateDna, setTemplateDna] = useState('ATGCGATACGCTTACGCATCGATCGATCGATCGATCGATCGATCGATCGATCG');
  const [targetLen, setTargetLen] = useState(20);

  // Custom Tm state
  const [customPrimer, setCustomPrimer] = useState('ATGCGATACGCTTACGCATC');

  // PCR Setup state
  const [numRxns, setNumRxns] = useState(10);
  const [rxnVol, setRxnVol] = useState(50);

  const validation = validateSequence(templateDna, 'DNA', false);
  const designed = designPrimers(templateDna, targetLen);
  const fwdTmInfo = calculatePrimerTm(designed.forward.sequence);
  const revTmInfo = calculatePrimerTm(designed.reverse.sequence);
  const taInfo = calculateAnnealingTemperature(fwdTmInfo.tm, revTmInfo.tm);

  const customTmInfo = calculatePrimerTm(customPrimer);
  const rxnSetup = calculatePcrReactionSetup(numRxns, rxnVol, true);

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#DDEDE8] pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('design')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'design'
              ? 'bg-[#0F766E] text-white shadow-xs'
              : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
          }`}
        >
          <Crosshair className="w-4 h-4" /> {getTranslation(lang, 'tool_pair_primer_design')}
        </button>
        <button
          onClick={() => setActiveTab('tm')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'tm'
              ? 'bg-[#0F766E] text-white shadow-xs'
              : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
          }`}
        >
          <Thermometer className="w-4 h-4" /> {getTranslation(lang, 'tool_primer_tm_calc')}
        </button>
        <button
          onClick={() => setActiveTab('setup')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'setup'
              ? 'bg-[#0F766E] text-white shadow-xs'
              : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
          }`}
        >
          <TestTube className="w-4 h-4" /> {getTranslation(lang, 'tool_master_mix_setup')}
        </button>
      </div>

      {activeTab === 'design' && (
        <div className="space-y-6">
          <SequenceInput
            value={templateDna}
            onChange={setTemplateDna}
            sampleSequence="ATGCGATACGCTTACGCATCGATCGATCGATCGATCGATCGATCGATCGATCG"
            sampleLabel={getTranslation(lang, 'tool_load_template_dna')}
            allowedCharsRegex={/^[ATCG\s]+$/i}
            lang={lang}
          />

          <div className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs flex items-center justify-between">
            <label className="text-xs font-bold text-[#12312B]">{getTranslation(lang, 'tool_desired_primer_len')}</label>
            <input
              type="number"
              min={15}
              max={35}
              value={targetLen}
              onChange={(e) => setTargetLen(Math.max(15, Math.min(35, parseInt(e.target.value) || 20)))}
              className="w-20 p-2 text-xs font-bold font-mono bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl text-center text-[#0F766E] focus:outline-none"
            />
          </div>

          {(!validation.isValid || designed.forward.warnings.some((w) => w.includes('too short') || w.includes('Invalid') || w.includes('invalid') || w.includes('empty'))) && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-medium">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>
                {!validation.isValid ? validation.errorMessage : designed.forward.warnings[0]}
              </span>
            </div>
          )}

          {validation.isValid && designed.forward.sequence !== '' && (
            <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-3">
                <h4 className="font-bold text-sm text-[#12312B] flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-[#0F766E]" /> {getTranslation(lang, 'tool_designed_pcr_pair')}
                </h4>
                <ExportButton filename="pcr_primers.json" data={{ forward: fwdTmInfo, reverse: revTmInfo, annealing: taInfo }} format="json" lang={lang} />
              </div>

              {/* Recommended Annealing Temp */}
              <div className="p-4 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#12312B] block">{getTranslation(lang, 'tool_rec_anneal_temp')}</span>
                  <span className="text-[11px] text-[#64748B]">{getTranslation(lang, 'tool_approx_starting_temp')}</span>
                </div>
                <span className="text-2xl font-black text-[#0F766E] font-mono">{taInfo.recommendedTa} °C</span>
              </div>

              {/* Primers Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Forward Primer */}
                <div className="p-4 bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0F766E]">{getTranslation(lang, 'tool_fwd_primer')} (5' → 3')</span>
                    <CopyButton textToCopy={designed.forward.sequence} lang={lang} />
                  </div>
                  <div className="p-2.5 bg-white border border-[#DDEDE8] rounded-lg font-mono text-xs text-[#0F766E] font-bold break-all sequence-mono-ltr">
                    5'- {designed.forward.sequence} -3'
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                    <div>{getTranslation(lang, 'tool_length')}: <strong>{fwdTmInfo.length} bp</strong></div>
                    <div>GC%: <strong>{fwdTmInfo.gcContent}%</strong></div>
                    <div>Tm: <strong>{fwdTmInfo.tm} °C</strong></div>
                  </div>
                </div>

                {/* Reverse Primer */}
                <div className="p-4 bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0EA5E9]">{getTranslation(lang, 'tool_rev_primer')} (5' → 3')</span>
                    <CopyButton textToCopy={designed.reverse.sequence} lang={lang} />
                  </div>
                  <div className="p-2.5 bg-white border border-[#DDEDE8] rounded-lg font-mono text-xs text-[#0EA5E9] font-bold break-all sequence-mono-ltr">
                    5'- {designed.reverse.sequence} -3'
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                    <div>{getTranslation(lang, 'tool_length')}: <strong>{revTmInfo.length} bp</strong></div>
                    <div>GC%: <strong>{revTmInfo.gcContent}%</strong></div>
                    <div>Tm: <strong>{revTmInfo.tm} °C</strong></div>
                  </div>
                </div>
              </div>

              {/* Warnings list */}
              {(fwdTmInfo.warnings.length > 0 || revTmInfo.warnings.length > 0 || taInfo.warnings.length > 0) && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs text-amber-800">
                  <span className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" /> {getTranslation(lang, 'tool_primer_warnings')}:
                  </span>
                  <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                    {fwdTmInfo.warnings.map((w, i) => <li key={`fwd-${i}`}>{getTranslation(lang, 'tool_fwd_prefix')}: {w}</li>)}
                    {revTmInfo.warnings.map((w, i) => <li key={`rev-${i}`}>{getTranslation(lang, 'tool_rev_prefix')}: {w}</li>)}
                    {taInfo.warnings.map((w, i) => <li key={`ta-${i}`}>{w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <ScientificExplanation
            formula="Wallace rule (<14 bp) / Empirical GC-based formula (≥14 bp)"
            biologicalMeaning="Melting temperature (Tm) is the temperature at which 50% of the DNA duplex is dissociated into single strands. This simple end-primer generator extracts 5' and 3' end sequences from the template."
            assumptions="Basic end-primer extraction without advanced locus searching, secondary structure (hairpin/dimer) folding, or thermodynamic nearest-neighbor matrix alignment."
            limitations="In-silico estimate for simple end primers. Experimental PCR optimization (e.g. gradient PCR) is recommended."
            lang={lang}
          />
        </div>
      )}

      {activeTab === 'tm' && (
        <div className="space-y-6">
          <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
            <label className="text-xs font-bold text-[#12312B] block">{getTranslation(lang, 'tool_single_primer_seq')}</label>
            <input
              type="text"
              value={customPrimer}
              onChange={(e) => setCustomPrimer(e.target.value.toUpperCase())}
              placeholder="ATGC..."
              className="w-full p-3 font-mono text-xs font-bold bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl text-[#0F766E] focus:outline-none"
            />

            {customTmInfo.warnings.some((w) => w.includes('Invalid character')) && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{customTmInfo.warnings.find((w) => w.includes('Invalid character'))}</span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
                <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_length')}</span>
                <span className="text-lg font-bold text-[#0F766E] font-mono">{customTmInfo.length} bp</span>
              </div>
              <div className="p-3 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
                <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_gc_content')}</span>
                <span className="text-lg font-bold text-[#22C55E] font-mono">{customTmInfo.gcContent}%</span>
              </div>
              <div className="p-3 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
                <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_approx_tm')}</span>
                <span className="text-lg font-bold text-[#0EA5E9] font-mono">{customTmInfo.tm} °C</span>
              </div>
              <div className="p-3 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
                <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_formula_used')}</span>
                <span className="text-xs font-bold text-[#8B5CF6]">{customTmInfo.length < 14 ? 'Wallace Rule' : 'GC-based Estimate'}</span>
              </div>
            </div>

            {customTmInfo.warnings.length > 0 && !customTmInfo.warnings.some((w) => w.includes('Invalid character')) && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs text-amber-800">
                <span className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" /> {getTranslation(lang, 'tool_primer_warnings')}:
                </span>
                <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                  {customTmInfo.warnings.map((w, i) => <li key={`custom-${i}`}>{w}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'setup' && (
        <div className="space-y-6">
          <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
            <h4 className="font-bold text-sm text-[#12312B] border-b border-[#DDEDE8] pb-2">
              {getTranslation(lang, 'tool_pcr_master_mix_params')}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_num_rxns')}</label>
                <input
                  type="number"
                  min="1"
                  value={numRxns}
                  onChange={(e) => setNumRxns(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#0F766E] bg-[#F3FAF7]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_single_rxn_vol')}</label>
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={rxnVol}
                  onChange={(e) => setRxnVol(Math.max(10, Math.min(100, parseInt(e.target.value) || 50)))}
                  className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#0F766E] bg-[#F3FAF7]"
                />
              </div>
            </div>
          </div>

          <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-2">
              <h4 className="font-bold text-sm text-[#12312B]">
                {getTranslation(lang, 'tool_mm_recipe')} ({numRxns} rxns + 10% {getTranslation(lang, 'tool_pipetting_excess')} = {rxnSetup.multiplierUsed}x)
              </h4>
              <ExportButton filename="pcr_mastermix_setup.json" data={rxnSetup} format="json" lang={lang} />
            </div>

            <div className="border border-[#DDEDE8] rounded-xl overflow-hidden bg-[#F3FAF7]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#ECFDF5] text-[#12312B] border-b border-[#DDEDE8]">
                  <tr>
                    <th className="p-2.5 font-bold">{getTranslation(lang, 'tool_component')}</th>
                    <th className="p-2.5 font-bold text-center">{getTranslation(lang, 'tool_per_1_rxn')} ({rxnVol} µL)</th>
                    <th className="p-2.5 font-bold text-right">{getTranslation(lang, 'tool_mm_total')} ({numRxns} rxns)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDEDE8]">
                  <tr><td className="p-2.5 font-medium">{getTranslation(lang, 'tool_nuclease_free_water')}</td><td className="p-2.5 text-center font-mono">{rxnSetup.perRxn.water.toFixed(1)} µL</td><td className="p-2.5 text-right font-mono font-bold text-[#0F766E]">{rxnSetup.masterMixTotal.water} µL</td></tr>
                  <tr><td className="p-2.5 font-medium">{getTranslation(lang, 'tool_pcr_buffer_10x')}</td><td className="p-2.5 text-center font-mono">{rxnSetup.perRxn.buffer10x.toFixed(1)} µL</td><td className="p-2.5 text-right font-mono font-bold text-[#0F766E]">{rxnSetup.masterMixTotal.buffer10x} µL</td></tr>
                  <tr><td className="p-2.5 font-medium">{getTranslation(lang, 'tool_dntp_mix')}</td><td className="p-2.5 text-center font-mono">{rxnSetup.perRxn.dntp10mM.toFixed(1)} µL</td><td className="p-2.5 text-right font-mono font-bold text-[#0F766E]">{rxnSetup.masterMixTotal.dntp10mM} µL</td></tr>
                  <tr><td className="p-2.5 font-medium">{getTranslation(lang, 'tool_fwd_primer_10um')}</td><td className="p-2.5 text-center font-mono">{rxnSetup.perRxn.fwdPrimer10uM.toFixed(1)} µL</td><td className="p-2.5 text-right font-mono font-bold text-[#0F766E]">{rxnSetup.masterMixTotal.fwdPrimer10uM} µL</td></tr>
                  <tr><td className="p-2.5 font-medium">{getTranslation(lang, 'tool_rev_primer_10um')}</td><td className="p-2.5 text-center font-mono">{rxnSetup.perRxn.revPrimer10uM.toFixed(1)} µL</td><td className="p-2.5 text-right font-mono font-bold text-[#0F766E]">{rxnSetup.masterMixTotal.revPrimer10uM} µL</td></tr>
                  <tr><td className="p-2.5 font-medium">{getTranslation(lang, 'tool_taq_poly')}</td><td className="p-2.5 text-center font-mono">{rxnSetup.perRxn.taqPolymerase.toFixed(1)} µL</td><td className="p-2.5 text-right font-mono font-bold text-[#0F766E]">{rxnSetup.masterMixTotal.taqPolymerase} µL</td></tr>
                  <tr className="bg-[#ECFDF5] font-bold"><td className="p-2.5 text-[#12312B]">{getTranslation(lang, 'tool_total_mm_vol')}</td><td className="p-2.5 text-center font-mono">{(rxnVol - rxnSetup.perRxn.templateDna).toFixed(1)} µL</td><td className="p-2.5 text-right font-mono text-[#0F766E]">{rxnSetup.masterMixTotal.totalVolumeUl} µL</td></tr>
                  <tr className="bg-amber-50/60 text-amber-900 border-t-2 border-amber-200">
                    <td className="p-2.5 font-semibold">{getTranslation(lang, 'tool_template_dna_add_separately')}</td>
                    <td className="p-2.5 text-center font-mono">{rxnSetup.perRxn.templateDna.toFixed(1)} µL</td>
                    <td className="p-2.5 text-right font-mono italic text-amber-700">{getTranslation(lang, 'tool_add_separately_per_rxn')}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-xs text-[#64748B] italic bg-[#F3FAF7] p-3 rounded-xl border border-[#DDEDE8]">
              💡 <strong>{getTranslation(lang, 'tool_pcr_note_label')}</strong> {rxnSetup.note}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
