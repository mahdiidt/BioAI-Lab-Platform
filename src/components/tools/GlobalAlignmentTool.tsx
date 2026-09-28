import React, { useState } from 'react';
import { SequenceInput } from '../common/SequenceInput';
import { needlemanWunschAlignment } from '../../utils/bioinformatics';
import { CopyButton } from '../common/CopyButton';
import { ExportButton } from '../common/ExportButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { GitCompare, AlertTriangle } from 'lucide-react';

interface ToolProps {
  lang: Language;
}

export const GlobalAlignmentTool: React.FC<ToolProps> = ({ lang }) => {
  const [seqA, setSeqA] = useState('ATGCGATACGCTTACGCATCG');
  const [seqB, setSeqB] = useState('ATGCGATACGCTTACGCATCG');

  const [matchScore, setMatchScore] = useState<number>(2);
  const [mismatchPenalty, setMismatchPenalty] = useState<number>(-1);
  const [gapPenalty, setGapPenalty] = useState<number>(-2);

  const alignment = needlemanWunschAlignment(seqA, seqB, matchScore, mismatchPenalty, gapPenalty);

  const isLongSeq = seqA.length > 1000 || seqB.length > 1000;

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SequenceInput
          value={seqA}
          onChange={setSeqA}
          sampleSequence="ATGCGATACGCTTACGCATCG"
          sampleLabel={getTranslation(lang, 'tool_load_seq_a')}
          allowedCharsRegex={/^[ATCGRYSWKMBDHVN\s]+$/i}
          lang={lang}
        />

        <SequenceInput
          value={seqB}
          onChange={setSeqB}
          sampleSequence="ATGCGATACGCTTACGCA"
          sampleLabel={getTranslation(lang, 'tool_load_seq_b')}
          allowedCharsRegex={/^[ATCGRYSWKMBDHVN\s]+$/i}
          lang={lang}
        />
      </div>

      {/* Alignment Scoring Matrix Parameters */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-700 rounded-2xl shadow-xs space-y-3">
        <label className="text-xs font-bold text-[#12312B] dark:text-slate-100 flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-[#0F766E] dark:text-teal-400" /> {getTranslation(lang, 'tool_alignment_params')}
        </label>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block mb-1">{getTranslation(lang, 'tool_match_score')}</label>
            <input
              type="number"
              value={matchScore}
              onChange={(e) => setMatchScore(parseInt(e.target.value) || 0)}
              className="w-full p-2 text-xs font-bold font-mono bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl text-center text-[#0F766E] dark:text-teal-400"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block mb-1">{getTranslation(lang, 'tool_mismatch_penalty')}</label>
            <input
              type="number"
              value={mismatchPenalty}
              onChange={(e) => setMismatchPenalty(parseInt(e.target.value) || 0)}
              className="w-full p-2 text-xs font-bold font-mono bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl text-center text-[#0F766E] dark:text-teal-400"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block mb-1">{getTranslation(lang, 'tool_gap_penalty')}</label>
            <input
              type="number"
              value={gapPenalty}
              onChange={(e) => setGapPenalty(parseInt(e.target.value) || 0)}
              className="w-full p-2 text-xs font-bold font-mono bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl text-center text-[#0F766E] dark:text-teal-400"
            />
          </div>
        </div>
      </div>

      {/* Long Sequence Warning */}
      {isLongSeq && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-3 text-xs text-amber-800">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
          <span>
            <strong>{getTranslation(lang, 'tool_seq_cap_title')}:</strong> {getTranslation(lang, 'tool_seq_cap_desc')}
          </span>
        </div>
      )}

      {/* Alignment Warning (e.g. invalid characters in input, or length limit exceeded) */}
      {alignment.warning && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-3 text-xs text-rose-700 dark:text-rose-300 font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{alignment.warning}</span>
        </div>
      )}

      {/* Results */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-700 rounded-2xl shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-[#DDEDE8] dark:border-slate-700 pb-3">
          <h4 className="font-bold text-sm text-[#12312B] dark:text-slate-100 flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
            {getTranslation(lang, 'tool_nw_alignment_output')}
          </h4>
          <ExportButton filename="needleman_wunsch_alignment.json" data={alignment} format="json" lang={lang} />
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-3 bg-[#ECFDF5] dark:bg-teal-950/40 border border-[#DDEDE8] dark:border-slate-700 rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">{getTranslation(lang, 'tool_alignment_score')}</span>
            <span className="text-lg font-bold text-[#0F766E] dark:text-teal-400 font-mono">{alignment.score}</span>
          </div>
          <div className="p-3 bg-[#ECFDF5] dark:bg-teal-950/40 border border-[#DDEDE8] dark:border-slate-700 rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">{getTranslation(lang, 'tool_identity_pct')}</span>
            <span className="text-lg font-bold text-[#22C55E] dark:text-green-400 font-mono">{alignment.identityPercent}%</span>
          </div>
          <div className="p-3 bg-[#ECFDF5] dark:bg-teal-950/40 border border-[#DDEDE8] dark:border-slate-700 rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">{getTranslation(lang, 'tool_matches')}</span>
            <span className="text-lg font-bold text-[#0EA5E9] dark:text-sky-400 font-mono">{alignment.matches}</span>
          </div>
          <div className="p-3 bg-[#ECFDF5] dark:bg-teal-950/40 border border-[#DDEDE8] dark:border-slate-700 rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">{getTranslation(lang, 'tool_mismatches')}</span>
            <span className="text-lg font-bold text-[#F59E0B] font-mono">{alignment.mismatches}</span>
          </div>
          <div className="p-3 bg-[#ECFDF5] dark:bg-teal-950/40 border border-[#DDEDE8] dark:border-slate-700 rounded-xl col-span-2 md:col-span-1">
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">{getTranslation(lang, 'tool_gaps')}</span>
            <span className="text-lg font-bold text-[#8B5CF6] dark:text-violet-400 font-mono">{alignment.gaps}</span>
          </div>
        </div>

        {/* Aligned Output Blocks */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#12312B] dark:text-slate-100">{getTranslation(lang, 'tool_aligned_seq_map')}</span>
            <CopyButton
              textToCopy={`SeqA: ${alignment.alignedA}\nMatch: ${alignment.matchLine}\nSeqB: ${alignment.alignedB}`}
              lang={lang}
            />
          </div>

          <div className="p-4 bg-[#1E293B] border border-slate-700 rounded-xl font-mono text-xs text-white overflow-x-auto space-y-1 sequence-mono-ltr">
            <div className="text-teal-400">Seq A: {alignment.alignedA}</div>
            <div className="text-slate-400">Match: {alignment.matchLine}</div>
            <div className="text-cyan-400">Seq B: {alignment.alignedB}</div>
          </div>
        </div>
      </div>

      <ScientificExplanation
        formula="S(i,j) = max [ S(i-1,j-1) + s(a_i, b_j), S(i-1,j) + d, S(i,j-1) + d ]"
        biologicalMeaning="The Needleman-Wunsch algorithm performs global pairwise sequence alignment via dynamic programming, maximizing the similarity score across the entire length of both sequences."
        assumptions="Assumes linear gap penalty scoring without affine gap open/extend differentiation."
        limitations="Optimized for global end-to-end alignment; local alignment (Smith-Waterman) is preferred for finding conserved domain sub-regions."
        lang={lang}
      />
    </div>
  );
};
