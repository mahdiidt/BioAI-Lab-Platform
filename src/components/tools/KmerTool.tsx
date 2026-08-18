import React, { useState } from 'react';
import { SequenceInput } from '../common/SequenceInput';
import { analyzeKmers, KmerAnalysisResult } from '../../utils/kmer';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { ExportButton } from '../common/ExportButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { BarChart2, Hash, Layers } from 'lucide-react';

interface ToolProps {
  lang: Language;
}

export const KmerTool: React.FC<ToolProps> = ({ lang }) => {
  const [sequence, setSequence] = useState('ATGCGATACGCTTACGCATCGATCGATCGATCGATCG');
  const [kValue, setKValue] = useState(3);
  const [seqType, setSeqType] = useState<'DNA' | 'RNA'>('DNA');

  const result: KmerAnalysisResult = analyzeKmers(sequence, kValue, seqType);

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

      {/* Controls */}
      <div className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-[#12312B] flex items-center gap-1.5">
            <Hash className="w-4 h-4 text-[#0F766E]" /> {getTranslation(lang, 'tool_kmer_size')}
          </label>
          <input
            type="number"
            min={1}
            max={30}
            value={kValue}
            onChange={(e) => setKValue(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
            className="w-20 p-2 text-xs font-bold font-mono bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl text-center text-[#0F766E] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20"
          />
        </div>

        <div className="flex items-center gap-2 bg-[#F3FAF7] p-1 rounded-xl border border-[#DDEDE8]">
          {(['DNA', 'RNA'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setSeqType(type)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                seqType === type
                  ? 'bg-[#0F766E] text-white shadow-2xs'
                  : 'text-[#64748B] hover:text-[#12312B]'
              }`}
            >
              {type === 'DNA' ? getTranslation(lang, 'tool_dna_mode') : getTranslation(lang, 'tool_rna_mode')}
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {!result.isValid && result.errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-medium">
          {result.errorMessage}
        </div>
      )}

      {/* Results */}
      {result.isValid && (
        <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-3">
            <h4 className="font-bold text-sm text-[#12312B] flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[#0F766E]" />
              {getTranslation(lang, 'tool_kmer_distribution')} (k={kValue})
            </h4>
            <ExportButton filename={`kmer_k${kValue}_analysis.json`} data={result} format="json" lang={lang} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_total_kmers')}</span>
              <span className="text-lg font-bold text-[#0F766E] font-mono">{result.totalKmers.toLocaleString()}</span>
            </div>
            <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_unique_kmers')}</span>
              <span className="text-lg font-bold text-[#22C55E] font-mono">{result.uniqueKmers.toLocaleString()}</span>
            </div>
            <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl col-span-2 md:col-span-1">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_length')}</span>
              <span className="text-lg font-bold text-[#0EA5E9] font-mono">{sequence.length} bp</span>
            </div>
          </div>

          {/* Table of Frequencies */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-[#12312B] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#0EA5E9]" />
              {getTranslation(lang, 'tool_kmer_table')}
            </span>

            <div className="max-h-72 overflow-y-auto border border-[#DDEDE8] rounded-xl bg-[#F3FAF7]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#ECFDF5] text-[#12312B] border-b border-[#DDEDE8] sticky top-0">
                  <tr>
                    <th className="p-2.5 font-bold">k-mer ({kValue}-bp)</th>
                    <th className="p-2.5 font-bold text-center">{getTranslation(lang, 'tool_count')}</th>
                    <th className="p-2.5 font-bold text-right">{getTranslation(lang, 'tool_frequency')}</th>
                    <th className="p-2.5 font-bold w-1/3">{getTranslation(lang, 'tool_visual_bar')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDEDE8]">
                  {result.frequencies.map((item, idx) => (
                    <tr key={idx} className="hover:bg-white/60 transition-colors">
                      <td className="p-2.5 font-mono font-bold text-[#0F766E]">{item.kmer}</td>
                      <td className="p-2.5 font-mono text-center font-bold text-[#12312B]">{item.count}</td>
                      <td className="p-2.5 font-mono text-right text-[#64748B]">{item.frequency}%</td>
                      <td className="p-2.5">
                        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            style={{ width: `${item.frequency}%` }}
                            className="h-full bg-[#0F766E]"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <ScientificExplanation
        formula="Total k-mers = Length - k + 1"
        biologicalMeaning="k-mers are sub-sequences of length k. Frequency counting is a foundational tool in genome assembly, metagenomics, motif discovery, and species identification."
        assumptions="Counts canonical forward strand oligomers of length k."
        limitations="Processing runs locally in client browser."
        lang={lang}
      />
    </div>
  );
};

