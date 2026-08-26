import React, { useState } from 'react';
import { digestDna, COMMON_ENZYMES } from '../../utils/restriction';
import { AgaroseGelVisualizer } from '../visualizers/AgaroseGelVisualizer';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Layers } from 'lucide-react';
import { ExportButton } from '../common/ExportButton';

interface ToolProps {
  lang: Language;
}

export const AgaroseGelSimTool: React.FC<ToolProps> = ({ lang }) => {
  const [sequence, setSequence] = useState('ATGCGAATTCATGCGGATCCATCGAAGCTTATGCGAATTCATCGAAGCTTATGCGAATTCATC');
  const [lane1Enzyme, setLane1Enzyme] = useState<string>('EcoRI');
  const [lane2Enzymes, setLane2Enzymes] = useState<string[]>(['EcoRI', 'BamHI']);
  const [gelConc, setGelConc] = useState<number>(1.0);

  const digest1 = digestDna(sequence, [lane1Enzyme], false);
  const digest2 = digestDna(sequence, lane2Enzymes, false);

  const laneLabel = getTranslation(lang, 'tool_lane_label');
  const digestLabel = getTranslation(lang, 'tool_digest_label');

  const lanes = [
    { name: `${laneLabel} 1: ${lane1Enzyme} ${digestLabel}`, bandsBp: digest1.fragmentSizes },
    { name: `${laneLabel} 2: ${lane2Enzymes.join('+')} ${digestLabel}`, bandsBp: digest2.fragmentSizes },
  ];

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#DDEDE8] pb-3">
          <h4 className="font-bold text-sm text-[#12312B] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#0F766E]" /> {getTranslation(lang, 'tool_configure_gel_sim')}
          </h4>
          <div className="flex items-center gap-2">
            <ExportButton filename="agarose_gel_digest.json" data={{ lanes, digest1, digest2 }} format="json" lang={lang} />
            <span className="text-xs text-[#64748B] font-bold">{getTranslation(lang, 'tool_gel_percent')}</span>
            {[0.8, 1.0, 1.5, 2.0].map((c) => (
              <button
                key={c}
                onClick={() => setGelConc(c)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer ${
                  gelConc === c
                    ? 'bg-[#0F766E] text-white'
                    : 'bg-[#F3FAF7] text-[#64748B] hover:text-[#12312B]'
                }`}
              >
                {c}%
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-bold text-[#64748B] block">{getTranslation(lang, 'tool_input_target_dna')}</label>
          <textarea
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
            rows={2}
            className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-xs text-[#0F766E] bg-[#F3FAF7] focus:ring-2 focus:ring-[#0F766E]/20 outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="text-xs font-bold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_lane1_enzyme')}</label>
            <select
              value={lane1Enzyme}
              onChange={(e) => setLane1Enzyme(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-[#DDEDE8] text-xs font-bold font-mono text-[#12312B] bg-[#F3FAF7]"
            >
              {COMMON_ENZYMES.map((e) => (
                <option key={e.name} value={e.name}>{e.name} ({e.site})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_lane2_enzymes')}</label>
            <div className="flex flex-wrap gap-2">
              {COMMON_ENZYMES.map((e) => {
                const isSelected = lane2Enzymes.includes(e.name);
                return (
                  <button
                    key={e.name}
                    type="button"
                    onClick={() => {
                      setLane2Enzymes((prev) =>
                        prev.includes(e.name)
                          ? prev.filter((x) => x !== e.name)
                          : [...prev, e.name]
                      );
                    }}
                    className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer ${
                      isSelected
                        ? 'bg-[#0F766E] text-white'
                        : 'bg-[#F3FAF7] border border-[#DDEDE8] text-[#64748B]'
                    }`}
                  >
                    {e.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Visualizer */}
      <AgaroseGelVisualizer lanes={lanes} gelConcentrationPercent={gelConc} lang={lang} />

      <ScientificExplanation
        formula="Migration Distance d ∝ -log₁₀(Fragment Size in bp)"
        biologicalMeaning="Educational agarose gel simulation maps computed restriction fragment lengths onto a virtual UV transilluminator. Smaller DNA fragments experience reduced steric hindrance through the agarose mesh, migrating farther toward the positive anode (+)."
        assumptions="Assumes complete digestion of linear DNA under standard electrophoretic running conditions."
        limitations="Educational model only. Does not predict non-specific star activity or voltage heating artifacts."
        lang={lang}
      />
    </div>
  );
};
