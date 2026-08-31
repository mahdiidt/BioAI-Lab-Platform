import React, { useState } from 'react';
import { SequenceInput } from '../common/SequenceInput';
import { CopyButton } from '../common/CopyButton';
import { ExportButton } from '../common/ExportButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { RnaStructureVisualizer } from '../visualizers/RnaStructureVisualizer';
import { predictRnaSecondaryStructure } from '../../utils/rnaStructure';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Waves, AlertTriangle } from 'lucide-react';

interface ToolProps {
  lang: Language;
}

const SAMPLE_RNA = 'GGGAAAUCCCUUUGGGAAAUCCC';
const MAX_VISUALIZED_LEN = 150;

export const RnaSecondaryStructureTool: React.FC<ToolProps> = ({ lang }) => {
  const [sequence, setSequence] = useState(SAMPLE_RNA);
  const [minLoopLength, setMinLoopLength] = useState<number>(3);

  const result = predictRnaSecondaryStructure(sequence, minLoopLength);

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <SequenceInput
        value={sequence}
        onChange={setSequence}
        sampleSequence={SAMPLE_RNA}
        sampleLabel={getTranslation(lang, 'tool_load_sample_rna_hairpin')}
        allowedCharsRegex={/^[AUCGRYSWKMBDHVN\s]+$/i}
        lang={lang}
      />

      {/* Min Loop Length Parameter */}
      <div className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-2">
        <label className="text-xs font-bold text-[#12312B] flex items-center gap-2">
          <Waves className="w-4 h-4 text-[#0F766E]" /> {getTranslation(lang, 'tool_min_loop_length')}
        </label>
        <input
          type="number"
          min="1"
          max="10"
          value={minLoopLength}
          onChange={(e) => setMinLoopLength(Math.max(1, parseInt(e.target.value) || 3))}
          className="w-24 p-2 text-xs font-bold font-mono bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl text-center text-[#0F766E]"
        />
        <p className="text-[10px] text-[#64748B]">{getTranslation(lang, 'tool_min_loop_length_desc')}</p>
      </div>

      {!result.isValid && result.errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{result.errorMessage}</span>
        </div>
      )}

      {result.warning === 'AMBIGUITY_BLOCKS_STRUCTURE' && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{getTranslation(lang, 'tool_ambiguity_blocks_structure')}</span>
        </div>
      )}

      {result.isValid && !result.warning && result.sequence.length > 0 && (
        <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-3">
            <h4 className="font-bold text-sm text-[#12312B] flex items-center gap-2">
              <Waves className="w-4 h-4 text-[#0F766E]" />
              {getTranslation(lang, 'tool_predicted_structure')}
            </h4>
            <ExportButton filename="rna_secondary_structure.json" data={result} format="json" lang={lang} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="p-3 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_length')}</span>
              <span className="text-lg font-bold text-[#0F766E] font-mono">{result.sequence.length} nt</span>
            </div>
            <div className="p-3 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_base_pairs_found')}</span>
              <span className="text-lg font-bold text-[#8B5CF6] font-mono">{result.numPairs}</span>
            </div>
            <div className="p-3 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl col-span-2 md:col-span-1">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_min_loop_length')}</span>
              <span className="text-lg font-bold text-[#0EA5E9] font-mono">{result.minLoopLength}</span>
            </div>
          </div>

          {result.sequence.length <= MAX_VISUALIZED_LEN ? (
            <RnaStructureVisualizer sequence={result.sequence} pairs={result.pairs} lang={lang} />
          ) : (
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-2 text-[11px] text-sky-800">
              <AlertTriangle className="w-4 h-4 shrink-0 text-sky-600 mt-0.5" />
              <span>{getTranslation(lang, 'tool_too_long_for_diagram')}</span>
            </div>
          )}

          {/* Dot-Bracket Output */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#12312B]">{getTranslation(lang, 'tool_dot_bracket_notation')}</span>
              <CopyButton textToCopy={result.dotBracket} lang={lang} />
            </div>
            <div className="p-3 bg-[#1E293B] border border-slate-700 rounded-xl font-mono text-xs text-white overflow-x-auto space-y-1 sequence-mono-ltr">
              <div className="text-cyan-400">{result.sequence}</div>
              <div className="text-teal-400">{result.dotBracket}</div>
            </div>
          </div>
        </div>
      )}

      <ScientificExplanation
        formula="M(i,j) = max[ M(i+1,j), M(i,j-1), M(i+1,j-1)+1 (if i,j pair), max over k: M(i,k)+M(k+1,j) ]"
        biologicalMeaning="The Nussinov algorithm predicts an RNA secondary structure by dynamic programming, maximizing the total number of base pairs (Watson-Crick A-U/G-C, plus the common G-U wobble pair) subject to a minimum hairpin loop size — RNA cannot fold back on itself sharply enough to pair immediately adjacent bases."
        assumptions="Every valid base pair is counted equally; the algorithm has no concept of stacking energy, so it does not distinguish a thermodynamically favorable stack of pairs from an equally-numerous but unstable arrangement. Pseudoknots (crossing base pairs) are not modeled — the predicted structure is always a valid nested (non-crossing) secondary structure."
        limitations="This is a maximum base-pairing predictor, not a minimum-free-energy (MFE) predictor. Real RNA folding tools (e.g. Zuker's algorithm, used by mfold/RNAfold) use experimentally-derived thermodynamic parameters and will often predict a different, more biologically realistic structure than simple pair-count maximization. Use this tool for educational understanding of RNA folding DP, not as a substitute for RNAfold/mfold in real experimental design."
        lang={lang}
      />
    </div>
  );
};
