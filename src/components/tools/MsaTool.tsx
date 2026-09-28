import React, { useState, useMemo, useRef } from 'react';
import { ExportButton } from '../common/ExportButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { AlignLeft, Play, AlertTriangle, Info, FileUp } from 'lucide-react';
import {
  parseFasta,
  progressiveMSA,
  MsaResult,
} from '../../utils/msa';

interface ToolProps {
  lang: Language;
}

const SAMPLE_DNA = `>Human_BRCA1
ATGCGATACGCTTACGCATCGATCGATCG
>Mouse_BRCA1
ATGCGATACCCTTACGCATCGATCGATCG
>Rat_BRCA1
ATGCAATACGCTTACGCATCAATCGATCG
>Dog_BRCA1
ATGCGATACGCTTACGCATCGATCAATCG
>Cat_BRCA1
ATGCGATACGCTTACCCATCGATCGATCG`;

const SAMPLE_PROTEIN = `>Human_P53
MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGP
>Mouse_P53
MTAMEESQSDISLELPLSQETFSGLWKLLPPEDILPSPHCMDDLLLPQDVEEFFEGPSEA
>Chicken_P53
MEPTQAEPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGP
>Frog_P53
MEESQAELPPNSPEGASLSDLWKLLPENNVLSPAPSQPMDDLLLSTDDIEQWFTEDPGP`;

const SAMPLE_HEMOGLOBIN = `>Human_HBA
MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSH
>Gorilla_HBA
MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSH
>Horse_HBA
MVLSAADKTNVKAAWSKVGGHAGEYGAEALERMFLGFPTTKTYFPHFDLSH
>Chicken_HBA
MVLSAADKNNVKGIFTKIAGHAEEYGAETLERMFTTYPPTKTYFPHFDLSH`;

// Nucleotide color classes (match your existing theme)
const NT_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-800',
  T: 'bg-red-100 text-red-800',
  U: 'bg-red-100 text-red-800',
  G: 'bg-yellow-100 text-yellow-800',
  C: 'bg-blue-100 text-blue-800',
  '-': 'bg-gray-100 text-gray-400',
};

// Amino acid property groups (Clustal-like coloring)
const AA_HYDROPHOBIC = new Set('AILMFWV'.split(''));
const AA_POSITIVE = new Set('RKH'.split(''));
const AA_NEGATIVE = new Set('DE'.split(''));
const AA_POLAR = new Set('STNQY'.split(''));

function getAaColorClass(char: string): string {
  if (char === '-') return 'bg-gray-100 text-gray-400';
  if (AA_HYDROPHOBIC.has(char)) return 'bg-blue-100 text-blue-800';
  if (AA_POSITIVE.has(char)) return 'bg-red-100 text-red-800';
  if (AA_NEGATIVE.has(char)) return 'bg-purple-100 text-purple-800';
  if (AA_POLAR.has(char)) return 'bg-green-100 text-green-800';
  return 'bg-amber-100 text-amber-800'; // special (G,P,C)
}

function getCellClass(char: string, type: 'dna' | 'protein'): string {
  if (type === 'dna') return NT_COLORS[char] || NT_COLORS['-'];
  return getAaColorClass(char);
}

function getConsBarColor(val: number): string {
  if (val >= 1) return 'bg-[#0F766E]';
  if (val >= 0.75) return 'bg-[#14B8A6]';
  if (val >= 0.5) return 'bg-[#5EEAD4]';
  if (val >= 0.25) return 'bg-[#99F6E4]';
  return 'bg-[#CCFBF1]';
}

export const MsaTool: React.FC<ToolProps> = ({ lang }) => {
  const [input, setInput] = useState(SAMPLE_DNA);
  const [seqType, setSeqType] = useState<'auto' | 'dna' | 'protein'>('auto');
  const [matchScore, setMatchScore] = useState(2);
  const [mismatchScore, setMismatchScore] = useState(-1);
  const [gapPenalty, setGapPenalty] = useState(-2);
  const [result, setResult] = useState<MsaResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
    const oversized = files.find((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversized) {
      const sizeMb = (oversized.size / 1024 / 1024).toFixed(1);
      setFileError(getTranslation(lang, 'fileTooLargeError').replace('{size}', sizeMb));
      e.target.value = '';
      return;
    }
    setFileError(null);
    // Read every selected file, then merge them together in one update so
    // uploading several files at once (or one after another) combines their
    // sequences into a single FASTA block instead of the last one replacing
    // the rest.
    Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve((event.target?.result as string) || '');
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
          })
      )
    )
      .then((contents) => {
        const merged = contents.map((c) => c.trim()).filter(Boolean).join('\n');
        if (!merged) return;
        setInput((prev) => {
          const prevTrimmed = prev.trim();
          return prevTrimmed ? `${prevTrimmed}\n${merged}` : merged;
        });
      })
      .catch(() => {
        setFileError('One of the selected files could not be read.');
      });
    e.target.value = '';
  };

  const runAlignment = () => {
    const seqs = parseFasta(input);
    setIsRunning(true);
    // Use setTimeout to allow UI to update with loading state
    setTimeout(() => {
      const res = progressiveMSA(seqs, matchScore, mismatchScore, gapPenalty, seqType);
      setResult(res);
      setIsRunning(false);
    }, 50);
  };

  const exportData = () => {
    if (!result || !result.isValid) return;
    // Strict FASTA only (no "#" comment lines - not universally recognized by
    // FASTA parsers) so the file can be re-imported directly into other tools
    // (Jalview, MEGA, ClustalX, BLAST, etc.) without manual cleanup. The
    // alignment stats already shown above are omitted here since they'd
    // otherwise appear as a stray non-sequence line.
    let text = '';
    for (let i = 0; i < result.names.length; i++) {
      text += `>${result.names[i]}\n${result.aligned[i]}\n`;
    }
    text += `>Consensus\n${result.consensus}\n`;
    return text;
  };

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      {/* Sample buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setInput(SAMPLE_DNA)}
          className="px-3 py-1.5 text-xs font-semibold rounded-full border border-[#DDEDE8] bg-white hover:bg-[#ECFDF5] text-[#64748B] hover:text-[#0F766E] transition-colors"
        >
          🧬 Sample DNA (5 seqs)
        </button>
        <button
          onClick={() => setInput(SAMPLE_PROTEIN)}
          className="px-3 py-1.5 text-xs font-semibold rounded-full border border-[#DDEDE8] bg-white hover:bg-[#ECFDF5] text-[#64748B] hover:text-[#0F766E] transition-colors"
        >
          🔬 Sample Protein (4 seqs)
        </button>
        <button
          onClick={() => setInput(SAMPLE_HEMOGLOBIN)}
          className="px-3 py-1.5 text-xs font-semibold rounded-full border border-[#DDEDE8] bg-white hover:bg-[#ECFDF5] text-[#64748B] hover:text-[#0F766E] transition-colors"
        >
          🫁 Hemoglobin Family
        </button>
      </div>

      {/* Input */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-700 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-bold text-[#12312B] dark:text-slate-100 flex items-center gap-2">
            <AlignLeft className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
            {getTranslation(lang, 'tool_msa_input_label') || 'Input Sequences (FASTA Format)'}
          </label>
          <button
            onClick={() => fileInputRef.current?.click()}
            type="button"
            className="inline-flex items-center gap-1 text-xs text-[#0F766E] hover:underline font-semibold cursor-pointer"
          >
            <FileUp className="w-3.5 h-3.5" />
            {getTranslation(lang, 'tool_upload_fasta')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".fasta,.fa,.txt,.seq"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
        {fileError && (
          <div className="mb-3 p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-xs text-[#EF4444] dark:text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {fileError}
          </div>
        )}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full min-h-[180px] resize-y font-mono text-xs leading-relaxed bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl p-4 text-[#12312B] focus:outline-none focus:border-[#14B8A6]"
          placeholder={">Sequence_1\nATGCGATACGCTTGA\n>Sequence_2\nATGCAATACGCTTGA"}
        />
      </div>

      {/* Controls */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-700 rounded-2xl shadow-xs">
        <label className="text-xs font-bold text-[#12312B] dark:text-slate-100 flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
          {getTranslation(lang, 'tool_alignment_params') || 'Alignment Parameters'}
        </label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block mb-1">Sequence Type</label>
            <select
              value={seqType}
              onChange={(e) => setSeqType(e.target.value as 'auto' | 'dna' | 'protein')}
              className="w-full p-2 text-xs font-bold bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl text-[#0F766E] dark:text-teal-400"
            >
              <option value="auto">Auto-detect</option>
              <option value="dna">DNA/RNA</option>
              <option value="protein">Protein</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block mb-1">
              {getTranslation(lang, 'tool_match_score') || 'Match Score'}
            </label>
            <input
              type="number"
              value={matchScore}
              onChange={(e) => setMatchScore(parseInt(e.target.value) || 0)}
              className="w-full p-2 text-xs font-bold font-mono bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl text-center text-[#0F766E] dark:text-teal-400"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block mb-1">
              {getTranslation(lang, 'tool_mismatch_penalty') || 'Mismatch'}
            </label>
            <input
              type="number"
              value={mismatchScore}
              onChange={(e) => setMismatchScore(parseInt(e.target.value) || 0)}
              className="w-full p-2 text-xs font-bold font-mono bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl text-center text-[#0F766E] dark:text-teal-400"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block mb-1">
              {getTranslation(lang, 'tool_gap_penalty') || 'Gap Penalty'}
            </label>
            <input
              type="number"
              value={gapPenalty}
              onChange={(e) => setGapPenalty(parseInt(e.target.value) || 0)}
              className="w-full p-2 text-xs font-bold font-mono bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl text-center text-[#0F766E] dark:text-teal-400"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={runAlignment}
              disabled={isRunning}
              className="w-full px-4 py-2 rounded-xl bg-[#0F766E] hover:bg-[#0d625b] text-white font-bold text-xs shadow-md shadow-[#0F766E]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {isRunning ? 'Aligning...' : 'Align'}
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isRunning && (
        <div className="p-8 bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-700 rounded-2xl text-center">
          <div className="w-7 h-7 border-3 border-[#DDEDE8] border-t-[#0F766E] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#64748B] font-medium">Aligning sequences...</p>
        </div>
      )}

      {/* Error */}
      {result && !result.isValid && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-3 text-xs text-rose-700 dark:text-rose-300 font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{result.errorMessage}</span>
        </div>
      )}

      {/* Results */}
      {result && result.isValid && !isRunning && (
        <div className="bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#DDEDE8] dark:border-slate-700">
            <h4 className="font-bold text-sm text-[#12312B] dark:text-slate-100 flex items-center gap-2">
              <AlignLeft className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
              Alignment Result ({result.type === 'dna' ? 'Nucleotide' : 'Protein'})
            </h4>
            <ExportButton
              filename="msa_alignment.fasta"
              data={exportData() || ''}
              format="fasta"
              lang={lang}
            />
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 border-b border-[#DDEDE8] dark:border-slate-700">
            <div className="p-3 bg-[#ECFDF5] dark:bg-teal-950/40 border border-[#DDEDE8] dark:border-slate-700 rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">Sequences</span>
              <span className="text-lg font-bold text-[#0F766E] dark:text-teal-400 font-mono">{result.stats.numSeqs}</span>
            </div>
            <div className="p-3 bg-[#ECFDF5] dark:bg-teal-950/40 border border-[#DDEDE8] dark:border-slate-700 rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">Alignment Length</span>
              <span className="text-lg font-bold text-[#0F766E] dark:text-teal-400 font-mono">{result.stats.alignLen}</span>
            </div>
            <div className="p-3 bg-[#ECFDF5] dark:bg-teal-950/40 border border-[#DDEDE8] dark:border-slate-700 rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">Identical Columns</span>
              <span className="text-lg font-bold text-[#0F766E] dark:text-teal-400 font-mono">{result.stats.identCols}</span>
            </div>
            <div className="p-3 bg-[#ECFDF5] dark:bg-teal-950/40 border border-[#DDEDE8] dark:border-slate-700 rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">Identity</span>
              <span className="text-lg font-bold text-[#0F766E] dark:text-teal-400 font-mono">{result.stats.identPct}%</span>
            </div>
            <div className="p-3 bg-[#ECFDF5] dark:bg-teal-950/40 border border-[#DDEDE8] dark:border-slate-700 rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">Gaps</span>
              <span className="text-lg font-bold text-[#0F766E] dark:text-teal-400 font-mono">{result.stats.gapPct}%</span>
            </div>
          </div>

          {/* MSA Viewer */}
          <div className="overflow-x-auto p-4">
            <div className="font-mono text-xs leading-none space-y-0">
              {result.names.map((name, i) => (
                <div key={i} className="flex items-stretch">
                  <span
                    className="min-w-[120px] max-w-[160px] pr-3 text-right text-[11px] font-semibold text-[#64748B] flex items-center justify-end shrink-0 border-r-2 border-[#DDEDE8] mr-2 truncate"
                    title={name}
                  >
                    {name}
                  </span>
                  <div className="flex">
                    {result.aligned[i].split('').map((char, j) => (
                      <span
                        key={j}
                        className={`w-[18px] h-[22px] inline-flex items-center justify-center text-[11px] font-medium rounded-sm mx-[0.5px] my-[0.5px] ${getCellClass(char, result.type)}`}
                      >
                        {char}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {/* Conservation bar */}
              <div className="flex items-stretch mt-1">
                <span className="min-w-[120px] max-w-[160px] pr-3 text-right text-[10px] font-bold text-[#0F766E] flex items-center justify-end shrink-0 border-r-2 border-[#DDEDE8] mr-2">
                  Conservation
                </span>
                <div className="flex">
                  {result.conservation.map((val, j) => (
                    <span
                      key={j}
                      className={`w-[18px] h-[8px] rounded-sm mx-[0.5px] ${getConsBarColor(val)}`}
                      title={`${(val * 100).toFixed(0)}%`}
                    />
                  ))}
                </div>
              </div>

              {/* Consensus row */}
              <div className="flex items-stretch mt-1 pt-1 border-t-2 border-[#DDEDE8]">
                <span className="min-w-[120px] max-w-[160px] pr-3 text-right text-[10px] font-bold text-[#0F766E] flex items-center justify-end shrink-0 border-r-2 border-[#DDEDE8] mr-2">
                  Consensus
                </span>
                <div className="flex">
                  {result.consensus.split('').map((char, j) => {
                    const isUpper = char === char.toUpperCase() && char !== '.';
                    const cls = char === '.' || char === '-'
                      ? 'bg-gray-100 text-gray-400'
                      : getCellClass(char.toUpperCase(), result.type);
                    return (
                      <span
                        key={j}
                        className={`w-[18px] h-[22px] inline-flex items-center justify-center text-[11px] rounded-sm mx-[0.5px] my-[0.5px] ${cls}`}
                        style={{ fontWeight: isUpper ? 700 : 400, opacity: isUpper ? 1 : 0.6 }}
                      >
                        {char}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 p-4 border-t border-[#DDEDE8] text-[11px] text-[#64748B] font-medium">
            {result.type === 'dna' ? (
              <>
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-green-100" /> A</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-red-100" /> T/U</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-yellow-100" /> G</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-blue-100" /> C</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-gray-100" /> Gap</span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-blue-100" /> Hydrophobic</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-red-100" /> Positive</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-purple-100" /> Negative</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-green-100" /> Polar</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-amber-100" /> Special</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-gray-100" /> Gap</span>
              </>
            )}
          </div>
        </div>
      )}

      <ScientificExplanation
        lang={lang}
        biologicalMeaning="Progressive MSA compares sequences pairwise, builds a guide tree, then aligns profiles along that tree. Conservation bars show the fraction of sequences sharing the most common residue in each column."
        assumptions="The current browser implementation uses a simple identity-based scoring model with linear gap penalties."
        limitations="This is an educational progressive aligner, not a replacement for MAFFT, MUSCLE, Clustal Omega, or a production affine-gap/profile-HMM pipeline."
      />
    </div>
  );
};
