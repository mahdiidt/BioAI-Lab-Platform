import React, { useState } from 'react';
import { SequenceInput } from '../common/SequenceInput';
import { digestDna, COMMON_ENZYMES, DigestResult } from '../../utils/restriction';
import { CopyButton } from '../common/CopyButton';
import { ExportButton } from '../common/ExportButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Scissors, Box, Info } from 'lucide-react';

interface ToolProps {
  lang: Language;
}

export const RestrictionDigestTool: React.FC<ToolProps> = ({ lang }) => {
  const [sequence, setSequence] = useState(
    'ATGCGAATTCATGCGGATCCATCGAAGCTTATGCGAATTCATC'
  );
  const [selectedEnzymes, setSelectedEnzymes] = useState<string[]>(['EcoRI', 'BamHI']);
  const [isCircular, setIsCircular] = useState(false);

  const digestResult: DigestResult = digestDna(sequence, selectedEnzymes, isCircular);

  const toggleEnzyme = (name: string) => {
    setSelectedEnzymes((prev) =>
      prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name]
    );
  };

  return (
    <div className="space-y-6">
      <SequenceInput
        value={sequence}
        onChange={setSequence}
        sampleSequence="ATGCGAATTCATGCGGATCCATCGAAGCTTATGCGAATTCATC"
        sampleLabel={getTranslation(lang, 'tool_load_sample_plasmid')}
        allowedCharsRegex={/^[ATCGRYSWKMBDHVN\s]+$/i}
        lang={lang}
      />

      {/* Enzyme Selection & DNA Topology Controls */}
      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#DDEDE8] pb-3">
          <label className="font-bold text-sm text-[#12312B] flex items-center gap-2">
            <Scissors className="w-4 h-4 text-[#0F766E]" /> {getTranslation(lang, 'tool_select_restriction_enzymes')}
          </label>

          <div role="group" aria-label={getTranslation(lang, 'tool_linear_dna') + ' / ' + getTranslation(lang, 'tool_circular_plasmid')} className="flex items-center gap-2 bg-[#F3FAF7] p-1 rounded-xl border border-[#DDEDE8]">
            <button
              type="button"
              aria-pressed={!isCircular}
              onClick={() => setIsCircular(false)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !isCircular ? 'bg-[#0F766E] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#12312B]'
              }`}
            >
              {getTranslation(lang, 'tool_linear_dna')}
            </button>
            <button
              type="button"
              aria-pressed={isCircular}
              onClick={() => setIsCircular(true)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isCircular ? 'bg-[#0F766E] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#12312B]'
              }`}
            >
              {getTranslation(lang, 'tool_circular_plasmid')}
            </button>
          </div>
        </div>

        {/* Enzyme Checkbox Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {COMMON_ENZYMES.map((ez) => {
            const isChecked = selectedEnzymes.includes(ez.name);
            return (
              <button
                key={ez.name}
                type="button"
                onClick={() => toggleEnzyme(ez.name)}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  isChecked
                    ? 'bg-[#ECFDF5] border-[#0F766E] text-[#0F766E] font-bold shadow-2xs'
                    : 'bg-[#F3FAF7] border-[#DDEDE8] text-[#64748B] hover:bg-white'
                }`}
              >
                <span className="block text-xs font-mono">{ez.name}</span>
                <span className="block text-[10px] text-[#64748B] font-mono">{ez.site}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Digestion Results */}
      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-3">
          <h4 className="font-bold text-sm text-[#12312B] flex items-center gap-2">
            <Box className="w-4 h-4 text-[#0F766E]" />
            {getTranslation(lang, 'tool_digest_fragment_analysis')} ({isCircular ? getTranslation(lang, 'tool_circular_plasmid') : getTranslation(lang, 'tool_linear_dna')})
          </h4>
          <ExportButton filename="restriction_digest.json" data={digestResult} format="json" lang={lang} />
        </div>

        {/* Summary metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_total_seq_length')}</span>
            <span className="text-lg font-bold text-[#0F766E] font-mono">{digestResult.dnaLength} bp</span>
          </div>
          <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_total_cut_sites')}</span>
            <span className="text-lg font-bold text-[#22C55E] font-mono">{digestResult.numCuts}</span>
          </div>
          <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_fragments_generated')}</span>
            <span className="text-lg font-bold text-[#0EA5E9] font-mono">{digestResult.fragmentSizes.length}</span>
          </div>
          <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_selected_enzymes')}</span>
            <span className="text-xs font-bold text-[#8B5CF6] truncate block">{selectedEnzymes.join(', ') || getTranslation(lang, 'tool_none')}</span>
          </div>
        </div>

        {/* Ordered Cut Sites Table */}
        {digestResult.allCutSites.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold text-[#12312B]">{getTranslation(lang, 'tool_ordered_cut_positions')}</span>
            <div className="border border-[#DDEDE8] rounded-xl overflow-hidden bg-[#F3FAF7]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#ECFDF5] text-[#12312B] border-b border-[#DDEDE8]">
                  <tr>
                    <th className="p-2.5 font-bold">{getTranslation(lang, 'tool_cut_num')}</th>
                    <th className="p-2.5 font-bold">{getTranslation(lang, 'tool_cut_pos')}</th>
                    <th className="p-2.5 font-bold">{getTranslation(lang, 'tool_cutting_enzyme')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDEDE8]">
                  {digestResult.allCutSites.map((site, idx) => (
                    <tr key={idx} className="hover:bg-white/60 transition-colors">
                      <td className="p-2.5 font-mono font-bold text-[#64748B]">{getTranslation(lang, 'tool_site')} {idx + 1}</td>
                      <td className="p-2.5 font-mono font-bold text-[#0F766E]">{site.position} bp</td>
                      <td className="p-2.5 font-mono text-[#8B5CF6]">{site.enzymeName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Combined Fragment Sizes List */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-[#12312B]">{getTranslation(lang, 'tool_combined_fragment_sizes')}</span>
          <div className="p-3 bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl flex flex-wrap gap-2">
            {digestResult.fragmentSizes.map((size, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-white border border-[#DDEDE8] rounded-lg font-mono text-xs font-bold text-[#0F766E] shadow-2xs"
              >
                {getTranslation(lang, 'tool_fragment')} {idx + 1}: {size} bp
              </span>
            ))}
          </div>
        </div>
      </div>

      <ScientificExplanation
        formula="Combined Fragment set = Sorted distance intervals between ordered multi-enzyme cut positions"
        biologicalMeaning="Restriction endonucleases recognize specific palindromic DNA sequences and cleave the phosphodiester backbone. Multi-enzyme double-digests combine all cut sites simultaneously to generate fragment maps for cloning."
        assumptions="Assumes 100% complete restriction enzyme digestion without star activity or methylation blocking."
        limitations="Processing runs locally."
        lang={lang}
      />
    </div>
  );
};
