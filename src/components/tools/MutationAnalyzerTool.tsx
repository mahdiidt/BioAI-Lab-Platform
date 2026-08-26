import React, { useState } from 'react';
import { SequenceInput } from '../common/SequenceInput';
import { analyzeMutation } from '../../utils/genetics';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { ExportButton } from '../common/ExportButton';
import { Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ToolProps {
  lang: Language;
}

export const MutationAnalyzerTool: React.FC<ToolProps> = ({ lang }) => {
  const [origDna, setOrigDna] = useState('ATGGTGCACCTGACTCCTGAGGAGAAGTCTGCCGTCACTGCC');
  const [mutDna, setMutDna] = useState('ATGGTGCACCTGACTCCTGTGGAGAAGTCTGCCGTCACTGCC');

  const result = analyzeMutation(origDna, mutDna);

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SequenceInput
          value={origDna}
          onChange={setOrigDna}
          sampleSequence="ATGGTGCACCTGACTCCTGAGGAGAAGTCTGCCGTCACTGCC"
          sampleLabel={getTranslation(lang, 'tool_orig_seq')}
          allowedCharsRegex={/^[ATCG\s]+$/i}
          lang={lang}
        />

        <SequenceInput
          value={mutDna}
          onChange={setMutDna}
          sampleSequence="ATGGTGCACCTGACTCCTGTGGAGAAGTCTGCCGTCACTGCC"
          sampleLabel={getTranslation(lang, 'tool_mut_seq')}
          allowedCharsRegex={/^[ATCG\s]+$/i}
          lang={lang}
        />
      </div>

      {/* Results */}
      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-3">
          <h4 className="font-bold text-sm text-[#12312B] flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#F59E0B]" />
            {getTranslation(lang, 'tool_mutation_analysis')}
          </h4>
          <div className="flex items-center gap-2">
            <ExportButton filename="mutation_analysis.json" data={result} format="json" lang={lang} />
            <span className="text-xs font-mono font-bold text-[#64748B]">
              {origDna.length} bp vs {mutDna.length} bp
            </span>
          </div>
        </div>

        {/* Mutation Badge */}
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3 ${
            result.isFrameshift
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : result.mismatchCount === 0
              ? 'bg-[#ECFDF5] border-[#DDEDE8] text-[#0F766E]'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          {result.isFrameshift ? (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          ) : result.mismatchCount === 0 ? (
            <CheckCircle2 className="w-5 h-5 text-[#22C55E] shrink-0 mt-0.5" />
          ) : (
            <Zap className="w-5 h-5 text-[#F59E0B] shrink-0 mt-0.5" />
          )}

          <div className="space-y-1">
            <h5 className="font-bold text-sm">{result.mutationType}</h5>
            <p className="text-xs leading-relaxed">{result.description}</p>
            {result.label && (
              <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/80 border border-current">
                {result.label}
              </span>
            )}
          </div>
        </div>

        {/* Changed Codons Table */}
        {result.changedCodons && result.changedCodons.length > 0 && (
          <div className="space-y-2 pt-2">
            <span className="text-xs font-bold text-[#12312B]">{getTranslation(lang, 'tool_altered_codons')}</span>
            <div className="border border-[#DDEDE8] rounded-xl overflow-hidden bg-[#F3FAF7]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#ECFDF5] text-[#12312B] border-b border-[#DDEDE8]">
                  <tr>
                    <th className="p-2.5 font-bold">{getTranslation(lang, 'tool_position')}</th>
                    <th className="p-2.5 font-bold">{getTranslation(lang, 'tool_orig_codon_aa')}</th>
                    <th className="p-2.5 font-bold">{getTranslation(lang, 'tool_mut_codon_aa')}</th>
                    <th className="p-2.5 font-bold">{getTranslation(lang, 'tool_effect')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDEDE8]">
                  {result.changedCodons.map((item, idx) => {
                    const isDiffAa = item.origAa !== item.mutAa;
                    return (
                      <tr key={idx} className="hover:bg-white/60 transition-colors">
                        <td className="p-2.5 font-mono font-bold text-[#64748B]">nt {item.position}</td>
                        <td className="p-2.5 font-mono text-[#0F766E]">
                          {item.origCodon} ({item.origAa})
                        </td>
                        <td className="p-2.5 font-mono text-[#8B5CF6]">
                          {item.mutCodon} ({item.mutAa})
                        </td>
                        <td className="p-2.5 font-bold">
                          {isDiffAa ? (
                            item.mutAa === '*' ? (
                              <span className="text-rose-600">{getTranslation(lang, 'tool_nonsense')}</span>
                            ) : (
                              <span className="text-amber-600">{getTranslation(lang, 'tool_missense')}</span>
                            )
                          ) : (
                            <span className="text-[#22C55E]">{getTranslation(lang, 'tool_silent')}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ScientificExplanation
        formula="Indel Frameshift Condition: |Length(Mutated) - Length(Original)| mod 3 ≠ 0"
        biologicalMeaning="Point mutations alter single nucleotides (silent, missense, or nonsense). Indel mutations insert or delete nucleotides; if the change is not a multiple of 3, it disrupts the downstream triplet reading frame."
        assumptions="Assumes sequence represents a contiguous protein-coding region starting in frame 1."
        limitations="Educational analysis only. Does not provide clinical diagnosis or pathogenic classification."
        lang={lang}
      />
    </div>
  );
};
