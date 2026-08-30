import React, { useState } from 'react';
import { SequenceInput } from '../common/SequenceInput';
import { CopyButton } from '../common/CopyButton';
import { ExportButton } from '../common/ExportButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { findCrisprGuides, PAM_OPTIONS, PamType, CrisprGuide } from '../../utils/crispr';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Crosshair, AlertTriangle, Info, ArrowRight, ArrowLeft as ArrowLeftIcon } from 'lucide-react';

interface ToolProps {
  lang: Language;
}

const SAMPLE_SEQUENCE =
  'ATGGATCCGAATTCGTACGTACGTACGTACGTACGTCGGATGCGAATTCATGCGGATCCATCGAAGCTTATGCGAATTCATCGATCGATCGATCGATCGATCGGCATCGATGCTAGCTAGCTAGCTGACTGACTG';

function scoreLabel(score: number): { text: string; className: string } {
  if (score >= 80) return { text: 'high', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  if (score >= 50) return { text: 'medium', className: 'bg-amber-100 text-amber-700 border-amber-200' };
  return { text: 'low', className: 'bg-rose-100 text-rose-700 border-rose-200' };
}

export const CrisprGuideDesignerTool: React.FC<ToolProps> = ({ lang }) => {
  const [sequence, setSequence] = useState(SAMPLE_SEQUENCE);
  const [pam, setPam] = useState<PamType>('NGG');

  const result = findCrisprGuides(sequence, pam, 20);

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <SequenceInput
        value={sequence}
        onChange={setSequence}
        sampleSequence={SAMPLE_SEQUENCE}
        sampleLabel={getTranslation(lang, 'tool_load_sample_target')}
        allowedCharsRegex={/^[ATCGRYSWKMBDHVN\s]+$/i}
        lang={lang}
      />

      {/* PAM Selector */}
      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-3">
        <label className="font-bold text-sm text-[#12312B] flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-[#0F766E]" /> {getTranslation(lang, 'tool_select_pam')}
        </label>
        <div role="group" aria-label={getTranslation(lang, 'tool_select_pam')} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PAM_OPTIONS.map((opt) => {
            const isSelected = pam === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setPam(opt.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#ECFDF5] border-[#0F766E] shadow-2xs'
                    : 'bg-[#F3FAF7] border-[#DDEDE8] hover:bg-white'
                }`}
              >
                <span className={`block text-sm font-mono font-bold ${isSelected ? 'text-[#0F766E]' : 'text-[#12312B]'}`}>
                  {opt.label}
                </span>
                <span className="block text-[11px] text-[#64748B]">{opt.enzyme}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!result.isValid && result.errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{result.errorMessage}</span>
        </div>
      )}

      {result.warning === 'AMBIGUITY_BLOCKS_DESIGN' && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{getTranslation(lang, 'tool_ambiguity_blocks_guide_design')}</span>
        </div>
      )}

      {/* Results */}
      {result.isValid && !result.warning && (
        <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-3">
            <h4 className="font-bold text-sm text-[#12312B]">
              {getTranslation(lang, 'tool_candidate_guides_found')} ({result.guides.length})
            </h4>
            <ExportButton filename="crispr_guides.json" data={result} format="json" lang={lang} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_length')}</span>
              <span className="text-lg font-bold text-[#0F766E] font-mono">{result.sequenceLength.toLocaleString()} bp</span>
            </div>
            <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_pam_pattern')}</span>
              <span className="text-lg font-bold text-[#8B5CF6] font-mono">{result.pamPattern}</span>
            </div>
            <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_guide_length')}</span>
              <span className="text-lg font-bold text-[#0EA5E9] font-mono">{result.guideLength} nt</span>
            </div>
          </div>

          {result.guides.length === 0 ? (
            <p className="text-xs text-[#64748B] italic">{getTranslation(lang, 'tool_no_guides_found')}</p>
          ) : (
            <div className="space-y-2 max-h-[28rem] overflow-y-auto">
              {result.guides.map((g: CrisprGuide, i: number) => {
                const badge = scoreLabel(g.qualityScore);
                return (
                  <div key={i} className="p-3.5 bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#0F766E]">
                        {g.strand === '+' ? (
                          <ArrowRight className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowLeftIcon className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {getTranslation(lang, 'tool_strand')} {g.strand} · bp {g.guideStart}-{g.guideEnd}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badge.className}`}>
                        {getTranslation(lang, 'tool_quality_score')}: {g.qualityScore} ({getTranslation(lang, `tool_score_${badge.text}` as const)})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-white border border-[#DDEDE8] rounded-lg font-mono text-xs text-[#12312B] break-all sequence-mono-ltr flex-1">
                        {g.guideSeq}
                        <span className="text-[#F59E0B] font-bold">{g.pamSeq}</span>
                      </div>
                      <CopyButton textToCopy={g.guideSeq} lang={lang} />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-[10px]">
                      <span className="px-2 py-0.5 rounded-full bg-white border border-[#DDEDE8] font-mono font-bold text-[#64748B]">
                        {getTranslation(lang, 'tool_gc_content')}: {g.gcContent}%
                      </span>
                      {g.hasPolyT && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 border border-rose-200 font-bold text-rose-700 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> {getTranslation(lang, 'tool_polyt_warning')}
                        </span>
                      )}
                      {!g.hasPolyT && g.hasHomopolymer && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 font-bold text-amber-700 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> {getTranslation(lang, 'tool_homopolymer_warning')}
                        </span>
                      )}
                      {g.seedOffTargetCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 font-bold text-amber-700 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> {getTranslation(lang, 'tool_offtarget_warning')} ({g.seedOffTargetCount})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-2 text-[11px] text-sky-800">
            <Info className="w-4 h-4 shrink-0 text-sky-600 mt-0.5" />
            <span>{getTranslation(lang, 'tool_offtarget_scope_note')}</span>
          </div>
        </div>
      )}

      <ScientificExplanation
        formula="PAM scan: guide = seq[i-20:i], PAM = seq[i:i+len(PAM)] wherever PAM matches NGG/NG/NNGRR (IUPAC wildcards)"
        biologicalMeaning="Cas9-family nucleases require a short Protospacer Adjacent Motif (PAM) immediately 3' of the 20nt target site (protospacer) to bind and cut DNA. Both strands are scanned because Cas9 can target either strand of double-stranded DNA. GC content in the ~40-60% range and the absence of a TTTT+ run (which prematurely terminates Pol III transcription from U6/H1 promoters) are commonly used heuristics for a workable synthetic guide."
        assumptions="This is an educational, computational PAM-scanning and guide-scoring tool, not a validated on-target efficiency predictor (e.g. it does not implement a machine-learning cutting-efficiency model). The quality score is a simple, transparent heuristic (GC content, homopolymer/poly-T runs, and same-input seed repetition), not a wet-lab-validated ranking."
        limitations="Off-target checking only scans the pasted input sequence itself (a same-input 12nt seed match), not the full genome or transcriptome — a guide flagged as 'clean' here is NOT confirmed genome-wide specific. For real experimental design, cross-check candidate guides against a full-genome off-target tool (e.g. CRISPOR, Cas-OFFinder) before ordering oligos."
        lang={lang}
      />
    </div>
  );
};
