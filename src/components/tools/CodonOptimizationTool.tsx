import React, { useState } from 'react';
import { SequenceInput } from '../common/SequenceInput';
import { optimizeCodons, HostOrganism, CODON_USAGE_TABLES } from '../../utils/codonOptimization';
import { CopyButton } from '../common/CopyButton';
import { ExportButton } from '../common/ExportButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Sliders, Cpu, AlertTriangle } from 'lucide-react';

interface ToolProps {
  lang: Language;
}

export const CodonOptimizationTool: React.FC<ToolProps> = ({ lang }) => {
  const [sequence, setSequence] = useState('ATGCGATACGCTTACGCATCGATCGATCGATCGATCG');
  const [host, setHost] = useState<HostOrganism>('ecoli');

  const result = optimizeCodons(sequence, host);

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <SequenceInput
        value={sequence}
        onChange={setSequence}
        sampleSequence="ATGCGATACGCTTACGCATCGATCGATCGATCGATCG"
        sampleLabel={getTranslation(lang, 'tool_load_sample_gene')}
        allowedCharsRegex={/^[ATCGRYSWKMBDHVN\s]+$/i}
        lang={lang}
      />

      {/* Host Organism Selector */}
      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-3">
        <label className="text-xs font-bold text-[#12312B] flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[#0F766E]" /> {getTranslation(lang, 'tool_select_host_system')}
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.keys(CODON_USAGE_TABLES) as HostOrganism[]).map((h) => {
            const table = CODON_USAGE_TABLES[h];
            const isSelected = host === h;
            return (
              <button
                key={h}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setHost(h)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#ECFDF5] border-[#0F766E] shadow-2xs'
                    : 'bg-[#F3FAF7] border-[#DDEDE8] hover:bg-white'
                }`}
              >
                <span className="font-bold text-xs text-[#12312B] block">{table.name}</span>
                <span className="text-[11px] text-[#64748B] line-clamp-2 mt-1">{table.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ambiguity / Invalid Input Warning */}
      {result.warning && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{result.warning}</span>
        </div>
      )}

      {/* Results */}
      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-3">
          <h4 className="font-bold text-sm text-[#12312B] flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#0F766E]" />
            {getTranslation(lang, 'tool_codon_opt_metrics')} ({CODON_USAGE_TABLES[host].name})
          </h4>
          <ExportButton filename={`codon_optimization_${host}.json`} data={result} format="json" lang={lang} />
        </div>

        {/* CAI and GC Comparison Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_orig_cai')}</span>
            <span className="text-lg font-bold text-[#64748B] font-mono">{result.originalCai}</span>
          </div>

          <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_opt_cai')}</span>
            <span className="text-lg font-bold text-[#22C55E] font-mono">{result.optimizedCai}</span>
          </div>

          <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_gc_content')}</span>
            <span className="text-sm font-bold text-[#0EA5E9] font-mono">
              {result.originalGcContent}% → {result.optimizedGcContent}%
            </span>
          </div>

          <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_codons_replaced')}</span>
            <span className="text-lg font-bold text-[#8B5CF6] font-mono">
              {result.codonsChanged} / {result.totalCodons}
            </span>
          </div>
        </div>

        {/* Sequence Displays */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[#12312B]">{getTranslation(lang, 'tool_opt_dna_seq')}</span>
              <CopyButton textToCopy={result.optimizedDna} lang={lang} />
            </div>
            <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl font-mono text-xs text-[#15803D] font-bold break-all sequence-mono-ltr">
              {result.optimizedDna}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[#12312B]">{getTranslation(lang, 'tool_translated_protein_preserved')}</span>
              <CopyButton textToCopy={result.proteinSequence} lang={lang} />
            </div>
            <div className="p-3 bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl font-mono text-xs text-[#0F766E] break-all sequence-mono-ltr">
              {result.proteinSequence}
            </div>
          </div>
        </div>
      </div>

      <ScientificExplanation
        formula="CAI = [ Π (f_i / f_max) ] ^ (1 / L)"
        biologicalMeaning="Codon Adaptation Index (CAI) measures the bias toward synonymous codons preferred by high-abundance tRNAs in the target host organism, increasing translational speed and recombinant protein yield."
        assumptions="Replaces codons with host top-frequency synonymous codons while preserving the identical amino acid sequence."
        limitations="Does not model mRNA secondary structure stability (hairpins/rRNA binding) or rare codon clusters for protein folding pauses."
        lang={lang}
      />
    </div>
  );
};
