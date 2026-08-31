import React, { useState } from 'react';
import { SequenceInput } from '../common/SequenceInput';
import { smithWatermanAlignment } from '../../utils/localAlignment';
import { CopyButton } from '../common/CopyButton';
import { ExportButton } from '../common/ExportButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { GitCompare, AlertTriangle } from 'lucide-react';

interface ToolProps {
  lang: Language;
}

export const LocalAlignmentTool: React.FC<ToolProps> = ({ lang }) => {
  const [seqA, setSeqA] = useState('TTTTTTTGATTACAGGGGGGG');
  const [seqB, setSeqB] = useState('CCCCCCCGATTACATTTTTTT');

  const [matchScore, setMatchScore] = useState<number>(2);
  const [mismatchPenalty, setMismatchPenalty] = useState<number>(-1);
  const [gapPenalty, setGapPenalty] = useState<number>(-2);

  const alignment = smithWatermanAlignment(seqA, seqB, matchScore, mismatchPenalty, gapPenalty);

  const isLongSeq = seqA.length > 1000 || seqB.length > 1000;
  const hasNoSimilarity = alignment.score === 0 && !alignment.warning;

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SequenceInput
          value={seqA}
          onChange={setSeqA}
          sampleSequence="TTTTTTTGATTACAGGGGGGG"
          sampleLabel={getTranslation(lang, 'tool_load_seq_a')}
          allowedCharsRegex={/^[ATCGRYSWKMBDHVN\s]+$/i}
          lang={lang}
        />

        <SequenceInput
          value={seqB}
          onChange={setSeqB}
          sampleSequence="CCCCCCCGATTACATTTTTTT"
          sampleLabel={getTranslation(lang, 'tool_load_seq_b')}
          allowedCharsRegex={/^[ATCGRYSWKMBDHVN\s]+$/i}
          lang={lang}
        />
      </div>

      {/* Alignment Scoring Matrix Parameters */}
      <div className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-3">
        <label className="text-xs font-bold text-[#12312B] flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-[#0F766E]" /> {getTranslation(lang, 'tool_alignment_params')}
        </label>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_match_score')}</label>
            <input
              type="number"
              value={matchScore}
              onChange={(e) => setMatchScore(parseInt(e.target.value) || 0)}
              className="w-full p-2 text-xs font-bold font-mono bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl text-center text-[#0F766E]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_mismatch_penalty')}</label>
            <input
              type="number"
              value={mismatchPenalty}
              onChange={(e) => setMismatchPenalty(parseInt(e.target.value) || 0)}
              className="w-full p-2 text-xs font-bold font-mono bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl text-center text-[#0F766E]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_gap_penalty')}</label>
            <input
              type="number"
              value={gapPenalty}
              onChange={(e) => setGapPenalty(parseInt(e.target.value) || 0)}
              className="w-full p-2 text-xs font-bold font-mono bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl text-center text-[#0F766E]"
            />
          </div>
        </div>
      </div>

      {/* Long Sequence Warning */}
      {isLongSeq && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-xs text-amber-800">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
          <span>
            <strong>{getTranslation(lang, 'tool_seq_cap_title')}:</strong> {getTranslation(lang, 'tool_seq_cap_desc')}
          </span>
        </div>
      )}

      {/* Alignment Warning (invalid characters, invalid params, or length limit exceeded) */}
      {alignment.warning && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{alignment.warning}</span>
        </div>
      )}

      {/* No Positive-Scoring Local Similarity */}
      {hasNoSimilarity && (
        <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl flex items-center gap-3 text-xs text-sky-800">
          <AlertTriangle className="w-5 h-5 shrink-0 text-sky-600" />
          <span>{getTranslation(lang, 'tool_no_local_similarity')}</span>
        </div>
      )}

      {/* Results */}
      {!alignment.warning && !hasNoSimilarity && (
        <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-3">
            <h4 className="font-bold text-sm text-[#12312B] flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-[#0F766E]" />
              {getTranslation(lang, 'tool_sw_alignment_output')}
            </h4>
            <ExportButton filename="smith_waterman_alignment.json" data={alignment} format="json" lang={lang} />
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_alignment_score')}</span>
              <span className="text-lg font-bold text-[#0F766E] font-mono">{alignment.score}</span>
            </div>
            <div className="p-3 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_identity_pct')}</span>
              <span className="text-lg font-bold text-[#22C55E] font-mono">{alignment.identityPercent}%</span>
            </div>
            <div className="p-3 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_matches')}</span>
              <span className="text-lg font-bold text-[#0EA5E9] font-mono">{alignment.matches}</span>
            </div>
            <div className="p-3 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_mismatches')}</span>
              <span className="text-lg font-bold text-[#F59E0B] font-mono">{alignment.mismatches}</span>
            </div>
            <div className="p-3 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl col-span-2 md:col-span-1">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_gaps')}</span>
              <span className="text-lg font-bold text-[#8B5CF6] font-mono">{alignment.gaps}</span>
            </div>
          </div>

          {/* Aligned Region Coordinates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_aligned_region_a')}</span>
              <span className="text-sm font-bold text-[#12312B] font-mono">{alignment.startA}–{alignment.endA}</span>
            </div>
            <div className="p-3 bg-slate-50 border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_aligned_region_b')}</span>
              <span className="text-sm font-bold text-[#12312B] font-mono">{alignment.startB}–{alignment.endB}</span>
            </div>
          </div>

          {/* Aligned Output Blocks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#12312B]">{getTranslation(lang, 'tool_aligned_seq_map')}</span>
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
      )}

      <ScientificExplanation
        formula="H(i,j) = max [ 0, H(i-1,j-1) + s(a_i, b_j), H(i-1,j) + d, H(i,j-1) + d ]"
        biologicalMeaning="The Smith-Waterman algorithm performs local pairwise sequence alignment via dynamic programming, finding the single highest-scoring similar subregion shared between two sequences rather than forcing an end-to-end alignment. This is the standard approach for locating a conserved domain, motif, or shared subsequence between two otherwise dissimilar sequences."
        assumptions="Assumes linear gap penalty scoring without affine gap open/extend differentiation, and reports only the single best-scoring local alignment (not all locally-optimal regions)."
        limitations="Requires gap and mismatch penalties to be zero or negative — the algorithm's 'reset to zero' local property depends on this. For end-to-end comparison of two sequences of similar length, use Global Alignment (Needleman-Wunsch) instead."
        lang={lang}
      />
    </div>
  );
};
