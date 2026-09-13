import React, { useMemo, useState } from 'react';
import { parseMultiFasta } from '../../utils/fastaParser';
import { computeSequenceDistanceMatrix } from '../../utils/distanceMatrix';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { ExportButton } from '../common/ExportButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { Grid, AlertTriangle, XCircle } from 'lucide-react';

interface ToolProps {
  lang: Language;
}

const SAMPLE_FASTA = `>seq1
ATGCGATACGCTTACGCATCGATCGATCGGCTAGCTAGCTAGGATCG
>seq2
ATGCGATACGCTTACGCATCGATCGATCGGCTAGCTAGCTAGGATCC
>seq3
ATGCGATACCCTTACGCATCGATCCATCGGCTAGCTAGCTAGGATCG
>seq4
TTTTGGGGCCCCAAAATTTTGGGGCCCCAAAATTTTGGGGCCCCAAA`;

function cellColor(identity: number | null): string {
  if (identity === null) return '#F3F4F6';
  // Interpolate from white (0%) to brand teal (100%) - matches app theme.
  const t = Math.max(0, Math.min(100, identity)) / 100;
  const r = Math.round(255 + (15 - 255) * t);
  const g = Math.round(255 + (118 - 255) * t);
  const b = Math.round(255 + (110 - 255) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export const SequenceDistanceMatrixTool: React.FC<ToolProps> = ({ lang }) => {
  const [fastaInput, setFastaInput] = useState(SAMPLE_FASTA);

  const parseResult = useMemo(() => parseMultiFasta(fastaInput, 'DNA'), [fastaInput]);

  const matrixResult = useMemo(
    () =>
      computeSequenceDistanceMatrix(
        parseResult.records.map((r) => ({ id: r.id, sequence: r.sequence }))
      ),
    [parseResult]
  );

  const { ids, identityMatrix } = matrixResult;

  const bestWorst = useMemo(() => {
    let best: { i: number; j: number; value: number } | null = null;
    let worst: { i: number; j: number; value: number } | null = null;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const v = identityMatrix[i][j];
        if (v === null) continue;
        if (!best || v > best.value) best = { i, j, value: v };
        if (!worst || v < worst.value) worst = { i, j, value: v };
      }
    }
    return { best, worst };
  }, [ids, identityMatrix]);

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      {/* Input Area */}
      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <label className="font-bold text-sm text-[#12312B] flex items-center gap-2">
            <Grid className="w-4 h-4 text-[#0F766E]" />
            {getTranslation(lang, 'tool_multi_fasta_input')}
          </label>
        </div>

        <textarea
          value={fastaInput}
          onChange={(e) => setFastaInput(e.target.value)}
          rows={8}
          placeholder=">seq1&#10;ATGC...&#10;&#10;>seq2&#10;ATGC..."
          className="w-full p-3 font-mono text-xs bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 text-[#12312B]"
        />

        <div className="flex items-center justify-between text-xs text-[#64748B]">
          <span>
            {getTranslation(lang, 'tool_parsed_records')}: <strong className="text-[#0F766E] font-bold">{parseResult.totalRecords}</strong>
          </span>
          <button
            onClick={() => setFastaInput(SAMPLE_FASTA)}
            className="text-[#0F766E] hover:underline font-semibold cursor-pointer"
          >
            {getTranslation(lang, 'tool_load_sample_fasta')}
          </button>
        </div>
      </div>

      {/* Parse-level errors (leading sequence before header, etc.) */}
      {parseResult.hasErrors && parseResult.globalErrorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-medium">
          <XCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{parseResult.globalErrorMessage}</span>
        </div>
      )}

      {/* Sequences excluded from the matrix (invalid chars, or over the 1000bp cap) */}
      {matrixResult.excluded.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-1 text-xs text-amber-800">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            {getTranslation(lang, 'tool_distance_matrix_excluded')}
          </div>
          {matrixResult.excluded.map((ex) => (
            <div key={ex.id} className="ps-6">
              <span className="font-mono font-bold">{ex.id}</span>: {ex.reason}
            </div>
          ))}
        </div>
      )}

      {/* Too-many-sequences warning */}
      {matrixResult.warning && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-xs text-amber-800">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
          <span>{matrixResult.warning}</span>
        </div>
      )}

      {/* Matrix + stats */}
      {ids.length >= 2 && (
        <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-3">
            <h4 className="font-bold text-sm text-[#12312B] flex items-center gap-2">
              <Grid className="w-4 h-4 text-[#0F766E]" />
              {getTranslation(lang, 'tool_distance_matrix_output')}
            </h4>
            <ExportButton filename="sequence_distance_matrix.json" data={matrixResult} format="json" lang={lang} />
          </div>

          {bestWorst.best && bestWorst.worst && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
                <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_distance_matrix_most_similar')}</span>
                <span className="text-sm font-bold text-[#0F766E] font-mono">
                  {ids[bestWorst.best.i]} ↔ {ids[bestWorst.best.j]} ({bestWorst.best.value}%)
                </span>
              </div>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_distance_matrix_least_similar')}</span>
                <span className="text-sm font-bold text-rose-600 font-mono">
                  {ids[bestWorst.worst.i]} ↔ {ids[bestWorst.worst.j]} ({bestWorst.worst.value}%)
                </span>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="border-collapse text-xs font-mono">
              <thead>
                <tr>
                  <th className="p-2"></th>
                  {ids.map((id) => (
                    <th key={id} className="p-2 text-[#12312B] font-bold whitespace-nowrap">
                      {id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ids.map((rowId, i) => (
                  <tr key={rowId}>
                    <th className="p-2 text-[#12312B] font-bold whitespace-nowrap text-start">{rowId}</th>
                    {ids.map((_, j) => {
                      const v = identityMatrix[i][j];
                      return (
                        <td
                          key={j}
                          className="p-2 text-center border border-[#DDEDE8] font-semibold"
                          style={{ backgroundColor: cellColor(v), color: v !== null && v > 60 ? '#FFFFFF' : '#12312B' }}
                        >
                          {v === null ? '—' : `${v}%`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ScientificExplanation
        formula="Distance(A,B) = 100 - IdentityPercent(GlobalAlignment(A,B))"
        biologicalMeaning="Each cell reuses this platform's own Needleman-Wunsch global alignment (see the Global Alignment tool) to compute pairwise percent identity between every pair of sequences, assembled into an N x N similarity/distance matrix."
        assumptions="Every pair is aligned independently with the same default scoring (match +2, mismatch -1, gap -2). Sequences must be DNA (IUPAC ambiguity codes allowed); invalid or over-length sequences are excluded and listed."
        limitations="Distance is a simple derived figure (100 - percent identity) from one global alignment, not a corrected evolutionary distance model (e.g. Jukes-Cantor, Kimura 2-parameter). Comparisons scale O(n^2); a hard cap of 12 sequences keeps the matrix responsive in-browser."
        lang={lang}
      />
    </div>
  );
};
