import React, { useState } from 'react';
import { parseMultiFasta, FastaParseResult } from '../../utils/fastaParser';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { CopyButton } from '../common/CopyButton';
import { ExportButton } from '../common/ExportButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { FileText, CheckCircle2, AlertTriangle, Layers, XCircle } from 'lucide-react';

interface ToolProps {
  lang: Language;
}

const SAMPLE_FASTA = `>seq1 Human beta-globin fragment
ATGGTGCACCTGACTCCTGAGGAGAAGTCTGCCGTCACTGCCCTGTGGGGCAAGGTGAACGTGGATGAAGTTGGTGGTGAGGCCCTGGGCAGG

>seq2 E. coli lacZ snippet
ATGACCATGATTACGGATTCACTGGCCGTCGTTTTACAACGTCGTGACTGGGAAAACCCTGGCGTTACCCAACTTAATCGCCTTGCAGCACAT

>seq3 Short test primer
ATGCGATACGCTTACGCATCG`;

export const FastaParserTool: React.FC<ToolProps> = ({ lang }) => {
  const [fastaInput, setFastaInput] = useState(SAMPLE_FASTA);
  const [seqType, setSeqType] = useState<'DNA' | 'RNA' | 'PROTEIN'>('DNA');

  const parseResult: FastaParseResult = parseMultiFasta(fastaInput, seqType);

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      {/* Input Area */}
      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <label className="font-bold text-sm text-[#12312B] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#0F766E]" />
            {getTranslation(lang, 'tool_multi_fasta_input')}
          </label>

          <div className="flex items-center gap-2 bg-[#F3FAF7] p-1 rounded-xl border border-[#DDEDE8]">
            {(['DNA', 'RNA', 'PROTEIN'] as const).map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={seqType === type}
                onClick={() => setSeqType(type)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  seqType === type
                    ? 'bg-[#0F766E] text-white shadow-2xs'
                    : 'text-[#64748B] hover:text-[#12312B]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={fastaInput}
          onChange={(e) => setFastaInput(e.target.value)}
          rows={6}
          placeholder=">header_id Description&#10;ATGC..."
          className="w-full p-3 font-mono text-xs bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 text-[#12312B]"
        />

        <div className="flex items-center justify-between text-xs text-[#64748B]">
          <span>{getTranslation(lang, 'tool_parsed_records')}: <strong className="text-[#0F766E] font-bold">{parseResult.totalRecords}</strong></span>
          <button
            onClick={() => setFastaInput(SAMPLE_FASTA)}
            className="text-[#0F766E] hover:underline font-semibold cursor-pointer"
          >
            {getTranslation(lang, 'tool_load_sample_fasta')}
          </button>
        </div>
      </div>

      {/* Global Parse Error (e.g. sequence data found before the first '>' header) */}
      {parseResult.hasErrors && parseResult.globalErrorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-medium">
          <XCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{parseResult.globalErrorMessage}</span>
        </div>
      )}

      {/* Results */}
      {parseResult.records.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-[#12312B] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#0EA5E9]" />
              {getTranslation(lang, 'tool_parsed_fasta_records')} ({parseResult.totalRecords})
            </h4>
            <ExportButton
              filename="parsed_fasta_records.json"
              data={parseResult.records.map((r) => ({
                id: r.id,
                description: r.description,
                lengthBp: r.length,
                sequence: r.sequence,
                isValid: r.validation.isValid,
              }))}
              format="json"
              lang={lang}
            />
          </div>

          <div className="space-y-3">
            {parseResult.records.map((rec, idx) => (
              <div
                key={idx}
                className={`p-4 bg-white border rounded-2xl shadow-2xs space-y-3 ${
                  rec.validation.isValid ? 'border-[#DDEDE8]' : 'border-rose-300 bg-rose-50/20'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#DDEDE8] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-[#ECFDF5] border border-[#DDEDE8] text-[11px] font-mono font-bold text-[#0F766E]">
                      &gt;{rec.id}
                    </span>
                    {rec.description && (
                      <span className="text-xs text-[#64748B] italic line-clamp-1">{rec.description}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-semibold text-[#12312B]">
                      {rec.length.toLocaleString()} {seqType === 'PROTEIN' ? 'aa' : 'bp'}
                    </span>
                    {rec.validation.isValid ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#22C55E]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {getTranslation(lang, 'tool_valid')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                        <AlertTriangle className="w-3.5 h-3.5" /> {getTranslation(lang, 'tool_invalid_bases')}
                      </span>
                    )}
                    <CopyButton textToCopy={rec.sequence} lang={lang} />
                  </div>
                </div>

                {!rec.validation.isValid && rec.validation.errorMessage && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                    {rec.validation.errorMessage}
                  </div>
                )}

                <div className="p-3 bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl font-mono text-xs text-[#0F766E] break-all max-h-28 overflow-y-auto sequence-mono-ltr">
                  {rec.sequence}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ScientificExplanation
        formula="FASTA Record = >Header [Description] \n Sequence"
        biologicalMeaning="FASTA is the universal standard text format for representing nucleotide or amino acid sequences. Multi-FASTA files group multiple sequence entries into a single file for batch processing."
        assumptions="Headers must begin with '>'. Multi-line sequence fragments under a single header are automatically concatenated and stripped of whitespace."
        limitations="Processing is performed locally in client memory."
        lang={lang}
      />
    </div>
  );
};
