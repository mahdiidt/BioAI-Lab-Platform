import React, { useState } from 'react';
import { SequenceInput } from '../common/SequenceInput';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { CopyButton } from '../common/CopyButton';
import { ExportButton } from '../common/ExportButton';
import { calculateSequenceStats, transcribeDnaToRna, translateRnaToProtein, reverseComplement, findOpenReadingFrames } from '../../utils/dna';
import { validateSequence } from '../../utils/sequenceValidator';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Dna, PieChart, ArrowRightLeft, Binary, Search, AlertTriangle } from 'lucide-react';

interface ToolProps {
  lang: Language;
  initialTab?: 'dna' | 'gc' | 'transcription' | 'translation' | 'orf';
}

export const DnaAnalyzerTool: React.FC<ToolProps> = ({ lang, initialTab = 'dna' }) => {
  const [sequence, setSequence] = useState('ATGCGATACGCTTACGCATCGATCGATCGATCGATCG');
  const [activeTab, setActiveTab] = useState<'dna' | 'gc' | 'transcription' | 'translation' | 'orf'>(initialTab);

  const validation = validateSequence(sequence, 'DNA');
  const cleanSeq = validation.cleanSequence;

  const stats = calculateSequenceStats(cleanSeq);
  const rna = transcribeDnaToRna(cleanSeq);
  const protein = translateRnaToProtein(cleanSeq);
  // reverseComplement/findOpenReadingFrames throw on invalid nucleotide
  // characters (they no longer silently substitute 'N'), so only run
  // them once the sequence has actually passed validation.
  const revComp = validation.isValid ? reverseComplement(cleanSeq) : '';
  // Use the utility's own scientifically meaningful default (10 aa) instead of
  // a hardcoded low threshold — a 3 aa minimum matches almost any random
  // sequence and produces biologically meaningless "ORFs".
  const orfs = validation.isValid ? findOpenReadingFrames(cleanSeq) : [];

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-2 border-b border-[#DDEDE8] pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('dna')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'dna'
              ? 'bg-[#0F766E] text-white shadow-xs'
              : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
          }`}
        >
          <Dna className="w-4 h-4" /> {getTranslation(lang, 'tool_dna_analyzer_title')}
        </button>
        <button
          onClick={() => setActiveTab('gc')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'gc'
              ? 'bg-[#0F766E] text-white shadow-xs'
              : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
          }`}
        >
          <PieChart className="w-4 h-4" /> {getTranslation(lang, 'tool_gc_content')}
        </button>
        <button
          onClick={() => setActiveTab('transcription')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'transcription'
              ? 'bg-[#0F766E] text-white shadow-xs'
              : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" /> {getTranslation(lang, 'tool_transcription_title')}
        </button>
        <button
          onClick={() => setActiveTab('translation')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'translation'
              ? 'bg-[#0F766E] text-white shadow-xs'
              : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
          }`}
        >
          <Binary className="w-4 h-4" /> {getTranslation(lang, 'tool_translation_title')}
        </button>
        <button
          onClick={() => setActiveTab('orf')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'orf'
              ? 'bg-[#0F766E] text-white shadow-xs'
              : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
          }`}
        >
          <Search className="w-4 h-4" /> {getTranslation(lang, 'tool_orf_title')}
        </button>
      </div>

      <SequenceInput
        value={sequence}
        onChange={setSequence}
        sampleSequence="ATGCGATACGCTTACGCATCGATCGATCGATCGATCG"
        sampleLabel={getTranslation(lang, 'tool_load_sample_gene')}
        allowedCharsRegex={/^[ATCGRYSWKMBDHVN\s]+$/i}
        lang={lang}
      />

      {!validation.isValid && validation.errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{validation.errorMessage}</span>
        </div>
      )}

      {/* Results Section */}
      {validation.isValid && (
        <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-3">
            <h4 className="font-bold text-sm text-[#12312B]">
              {getTranslation(lang, 'resultsHeader')}
            </h4>
            <div className="flex items-center gap-2">
              <ExportButton filename="dna_analysis.json" data={{ stats, rna, protein, revComp, orfs }} format="json" lang={lang} />
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_length')}</span>
              <span className="text-lg font-bold text-[#0F766E] font-mono">{stats.length.toLocaleString()} bp</span>
            </div>
            <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_gc_content')}</span>
              <span className="text-lg font-bold text-[#22C55E] font-mono">{stats.gcContent}%</span>
            </div>
            <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_at_content')}</span>
              <span className="text-lg font-bold text-[#0EA5E9] font-mono">{stats.atContent}%</span>
            </div>
            <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_mol_weight')}</span>
              <span className="text-lg font-bold text-[#8B5CF6] font-mono">{stats.molecularWeightDa.toLocaleString()} Da</span>
            </div>
          </div>

          {/* Nucleotide Breakdown Bar */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-[#12312B]">{getTranslation(lang, 'tool_nucleotide_comp')}</span>
            <div className="h-3 rounded-full bg-slate-100 flex overflow-hidden border border-[#DDEDE8]">
              <div style={{ width: `${(stats.baseCounts.A / (stats.length || 1)) * 100}%` }} className="bg-emerald-500" title="A" />
              <div style={{ width: `${(stats.baseCounts.T / (stats.length || 1)) * 100}%` }} className="bg-sky-500" title="T" />
              <div style={{ width: `${(stats.baseCounts.G / (stats.length || 1)) * 100}%` }} className="bg-amber-500" title="G" />
              <div style={{ width: `${(stats.baseCounts.C / (stats.length || 1)) * 100}%` }} className="bg-purple-500" title="C" />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-[#64748B] pt-1">
              <span className="text-emerald-700 font-medium">A: {stats.baseCounts.A}</span>
              <span className="text-sky-700 font-medium">T: {stats.baseCounts.T}</span>
              <span className="text-amber-700 font-medium">G: {stats.baseCounts.G}</span>
              <span className="text-purple-700 font-medium">C: {stats.baseCounts.C}</span>
            </div>
          </div>

          {/* Tab Specific Views */}
          {activeTab === 'orf' ? (
            <div className="space-y-3 pt-2">
              <h5 className="text-xs font-bold text-[#12312B]">{getTranslation(lang, 'tool_orfs_found')} ({orfs.length})</h5>
              {orfs.length === 0 ? (
                <p className="text-xs text-[#64748B] italic">{getTranslation(lang, 'tool_no_orfs_found')}</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {orfs.map((orf, i) => (
                    <div key={i} className="p-3 bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-[#0F766E]">
                        <span>{getTranslation(lang, 'tool_frame')} {orf.frame} (bp {orf.start}..{orf.end})</span>
                        <span className="font-mono">{orf.lengthAa} aa ({orf.lengthBp} bp)</span>
                      </div>
                      <div className="p-2 bg-white border border-[#DDEDE8] rounded-lg font-mono text-xs text-[#8B5CF6] break-all sequence-mono-ltr">
                        {orf.proteinSequence}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[#12312B]">{getTranslation(lang, 'tool_transcribed_mrna')}</span>
                  <CopyButton textToCopy={rna} lang={lang} />
                </div>
                <div className="p-2.5 bg-[#F3FAF7] border border-[#DDEDE8] rounded-lg font-mono text-xs text-[#0F766E] break-all sequence-mono-ltr">
                  {rna}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[#12312B]">{getTranslation(lang, 'tool_translated_protein')}</span>
                  <CopyButton textToCopy={protein} lang={lang} />
                </div>
                <div className="p-2.5 bg-[#F3FAF7] border border-[#DDEDE8] rounded-lg font-mono text-xs text-[#8B5CF6] break-all sequence-mono-ltr">
                  {protein}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[#12312B]">{getTranslation(lang, 'tool_reverse_complement_strand')}</span>
                  <CopyButton textToCopy={revComp} lang={lang} />
                </div>
                <div className="p-2.5 bg-[#F3FAF7] border border-[#DDEDE8] rounded-lg font-mono text-xs text-[#0EA5E9] break-all sequence-mono-ltr">
                  {revComp}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <ScientificExplanation
        formula="GC% = [(G + C) / (A + T + G + C)] × 100"
        biologicalMeaning="GC bonds contain 3 hydrogen bonds (G≡C) compared to 2 in AT pairs (A=T). Higher GC content increases thermal denaturation melting temperature (Tm) and structural stability."
        assumptions="Calculations assume a linear single-stranded DNA molecule without unnatural modified nucleosides."
        limitations="Molecular weight is an approximation for single-stranded DNA (ssDNA). Double-stranded DNA (dsDNA) molecular weight is approximately 2× the value."
        lang={lang}
      />
    </div>
  );
};
