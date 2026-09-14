import React, { useState } from 'react';
import { computeDistanceMatrix } from '../../utils/distanceMatrix';
import { DistanceMatrixHeatmap } from '../visualizers/DistanceMatrixHeatmap';
import { ExportButton } from '../common/ExportButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Grid3x3, AlertTriangle, Info } from 'lucide-react';

interface ToolProps {
  lang: Language;
}

const SAMPLE_FASTA = `>Human_beta_globin
ATGGTGCACCTGACTCCTGAGGAGAAGTCTGCCGTCACTGCCCTGTGGGGCAAGGTGAACGTGGATGAAGTTGGTGGTGAGGCCCTGGGCAGG
>Chimp_beta_globin
ATGGTGCACCTGACTCCTGAGGAGAAGTCTGCCGTCACTGCCCTGTGGGGCAAGGTGAACGTGGATGAAGTTGGTGGTGAGGCCCTGGGCAGA
>Mouse_beta_globin
ATGGTTGCTCCTGAGGAGAAGACTGCTGTCAGTGCCCTGTGGGGCAAGGTGAATGTGGAAGAAGTTGGTGGTGAGGCCCTGGGCAGG
>Unrelated_control
TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT`;

type MatrixMode = 'similarity' | 'distance';

export const DistanceMatrixTool: React.FC<ToolProps> = ({ lang }) => {
  const [fastaInput, setFastaInput] = useState(SAMPLE_FASTA);
  const [mode, setMode] = useState<MatrixMode>('similarity');
  const [matchScore, setMatchScore] = useState(2);
  const [mismatchPenalty, setMismatchPenalty] = useState(-1);
  const [gapPenalty, setGapPenalty] = useState(-2);

  const result = computeDistanceMatrix(fastaInput, matchScore, mismatchPenalty, gapPenalty);

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <label className="font-bold text-sm text-[#12312B] flex items-center gap-2">
            <Grid3x3 className="w-4 h-4 text-[#0F766E]" />
            {getTranslation(lang, 'tool_multi_fasta_input')}
          </label>
        </div>

        <textarea
          value={fastaInput}
          onChange={(e) => setFastaInput(e.target.value)}
          rows={7}
          placeholder=">header_id&#10;ATGC..."
          className="w-full p-3 font-mono text-xs bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 text-[#12312B] sequence-mono-ltr"
        />

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

      {!result.isValid && result.errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{result.errorMessage}</span>
        </div>
      )}

      {result.isValid && (
        <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-3 flex-wrap gap-2">
            <h4 className="font-bold text-sm text-[#12312B] flex items-center gap-2">
              <Grid3x3 className="w-4 h-4 text-[#0F766E]" />
              {getTranslation(lang, 'tool_distance_matrix_output')} ({result.labels.length}×{result.labels.length})
            </h4>
            <div className="flex items-center gap-2">
              <div role="group" className="flex items-center gap-1 p-1 bg-[#F3FAF7] rounded-xl border border-[#DDEDE8]">
                <button
                  type="button"
                  aria-pressed={mode === 'similarity'}
                  onClick={() => setMode('similarity')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    mode === 'similarity' ? 'bg-[#0F766E] text-white' : 'text-[#64748B] hover:text-[#12312B]'
                  }`}
                >
                  {getTranslation(lang, 'tool_similarity_pct')}
                </button>
                <button
                  type="button"
                  aria-pressed={mode === 'distance'}
                  onClick={() => setMode('distance')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    mode === 'distance' ? 'bg-[#0F766E] text-white' : 'text-[#64748B] hover:text-[#12312B]'
                  }`}
                >
                  {getTranslation(lang, 'tool_distance_pct')}
                </button>
              </div>
              <ExportButton filename="distance_matrix.json" data={result} format="json" lang={lang} />
            </div>
          </div>

          {result.skippedRecords.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-[11px] text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                {getTranslation(lang, 'tool_skipped_invalid_sequences')}:{' '}
                {result.skippedRecords.map((s) => s.id).join(', ')}
              </span>
            </div>
          )}

          {result.failedPairs.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-[11px] text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>{getTranslation(lang, 'tool_some_pairs_not_computed')}</span>
            </div>
          )}

          <DistanceMatrixHeatmap
            labels={result.labels}
            matrix={mode === 'similarity' ? result.similarityMatrix : result.distanceMatrix}
            higherIsBetter={mode === 'similarity'}
          />

          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-2 text-[11px] text-sky-800">
            <Info className="w-4 h-4 shrink-0 text-sky-600 mt-0.5" />
            <span>{getTranslation(lang, 'tool_distance_matrix_note')}</span>
          </div>
        </div>
      )}

      <ScientificExplanation
        formula="Distance(A,B) = 100 − IdentityPercent(GlobalAlign(A,B))"
        biologicalMeaning="A percent-identity or distance matrix summarizes how similar every sequence in a set is to every other sequence, all at once. This is the standard first step before building a phylogenetic tree, picking a representative sequence from a gene family, or spotting an outlier/contaminant in a batch of sequencing reads."
        assumptions="Every pairwise value comes from the same global (Needleman-Wunsch) alignment already used by the Global Alignment tool, with the scoring parameters you set above. Percent identity is computed over the full aligned length (including gaps in the denominator), which is the standard global-alignment definition."
        limitations="This is a full pairwise comparison (N×(N-1)/2 alignments), so it is capped at 12 sequences and 1000bp each to stay responsive in the browser. It does not build a phylogenetic tree itself — pair this with the Phylogenetic Tree tool if you already have a Newick tree to visualize, or treat the distance values here as the input a tree-building method (e.g. UPGMA/neighbor-joining) would need."
        lang={lang}
      />
    </div>
  );
};
