import React, { useState } from 'react';
import { validateSequence } from '../../utils/sequenceValidator';
import { complementSequence } from '../../utils/dna';
import { SequenceInput } from '../common/SequenceInput';

import { CopyButton } from '../common/CopyButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Repeat, AlertTriangle } from 'lucide-react';

interface ToolProps {
  lang: Language;
}

export const ReverseComplementTool: React.FC<ToolProps> = ({ lang }) => {
  const [sequence, setSequence] = useState('ATGCGATACGCTTACGCATCG');
  const [mode, setMode] = useState<'DNA' | 'RNA'>('DNA');

  const validation = validateSequence(sequence, mode);

  // Compute complements using the complementSequence helper
  let complement3to5 = '';
  let reverseComplement5to3 = '';

  if (validation.isValid && validation.cleanSequence) {
    const seq = validation.cleanSequence;
    complement3to5 = complementSequence(seq, mode); // 3' -> 5' complement
    reverseComplement5to3 = complement3to5.split('').reverse().join(''); // 5' -> 3' reverse complement
  }

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      {/* Mode Selector */}
      <div className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-bold text-[#12312B] flex items-center gap-2">
          <Repeat className="w-4 h-4 text-[#0F766E]" /> {getTranslation(lang, 'tool_select_molecule_mode')}
        </span>
        <div className="flex items-center gap-2 bg-[#F3FAF7] p-1 rounded-xl border border-[#DDEDE8]">
          <button
            onClick={() => setMode('DNA')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === 'DNA' ? 'bg-[#0F766E] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#12312B]'
            }`}
          >
            {getTranslation(lang, 'tool_dna_mode')}
          </button>
          <button
            onClick={() => setMode('RNA')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === 'RNA' ? 'bg-[#0F766E] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#12312B]'
            }`}
          >
            {getTranslation(lang, 'tool_rna_mode')}
          </button>
        </div>
      </div>

      <SequenceInput
        value={sequence}
        onChange={setSequence}
        sampleSequence={mode === 'DNA' ? 'ATGCGATACGCTTACGCATCG' : 'AUGCGAUACGCUUACGCAUCG'}
        sampleLabel={mode === 'DNA' ? getTranslation(lang, 'tool_load_sample_dna') : getTranslation(lang, 'tool_load_sample_rna')}
        allowedCharsRegex={mode === 'DNA' ? /^[ATCGRYSWKMBDHVN\s]+$/i : /^[AUCGRYSWKMBDHVN\s]+$/i}
        lang={lang}
      />

      {/* Validation Error Notice */}
      {!validation.isValid && validation.errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{validation.errorMessage}</span>
        </div>
      )}

      {/* Results Section */}
      {validation.isValid && (
        <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-4">
          <h4 className="font-bold text-sm text-[#12312B] border-b border-[#DDEDE8] pb-3 flex items-center gap-2">
            <Repeat className="w-4 h-4 text-[#0F766E]" />
            {getTranslation(lang, 'tool_complement_strands')} ({mode})
          </h4>

          <div className="space-y-4">
            {/* Input Sequence */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[#12312B] flex items-center gap-1">
                  {getTranslation(lang, 'tool_original_strand')}
                </span>
                <CopyButton textToCopy={validation.cleanSequence} lang={lang} />
              </div>
              <div className="p-3 bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl font-mono text-xs text-[#0F766E] break-all sequence-mono-ltr">
                5'- {validation.cleanSequence} -3'
              </div>
            </div>

            {/* Reverse Complement (5' -> 3') */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[#12312B] flex items-center gap-1 text-[#0EA5E9]">
                  {getTranslation(lang, 'tool_reverse_complement_strand')} <span className="text-[10px] text-[#64748B] font-normal">{getTranslation(lang, 'tool_antiparallel_strand')}</span>
                </span>
                <CopyButton textToCopy={reverseComplement5to3} lang={lang} />
              </div>
              <div className="p-3 bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl font-mono text-xs text-[#0EA5E9] font-bold break-all sequence-mono-ltr">
                5'- {reverseComplement5to3} -3'
              </div>
            </div>

            {/* Direct Complement (3' -> 5') */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[#12312B] flex items-center gap-1 text-[#8B5CF6]">
                  {getTranslation(lang, 'tool_direct_complement_strand')} <span className="text-[10px] text-[#64748B] font-normal">{getTranslation(lang, 'tool_aligned_antiparallel')}</span>
                </span>
                <CopyButton textToCopy={complement3to5} lang={lang} />
              </div>
              <div className="p-3 bg-[#F5F3FF] border border-[#DDD6FE] rounded-xl font-mono text-xs text-[#8B5CF6] break-all sequence-mono-ltr">
                3'- {complement3to5} -5'
              </div>
            </div>
          </div>
        </div>
      )}

      <ScientificExplanation
        formula={mode === 'DNA' ? 'A ↔ T, C ↔ G' : 'A ↔ U, C ↔ G'}
        biologicalMeaning="Nucleic acid double helices are antiparallel: one strand runs 5' → 3', while the complementary strand runs 3' → 5'. Polymerases and primers synthesize strictly in the 5' → 3' direction."
        assumptions="Assumes standard Watson-Crick base pairing rules without non-canonical wobble or modified base interactions."
        limitations="Processing is local."
        lang={lang}
      />
    </div>
  );
};
