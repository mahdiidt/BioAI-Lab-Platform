// ─────────────────────────────────────────────────────────────
// Motif Discovery & Sequence Logo Tool
// Professional bioinformatics tool for discovering conserved
// sequence motifs and generating publication-quality logos
// ─────────────────────────────────────────────────────────────
import React, { useState, useMemo } from 'react';
import {
  analyzeAlignedMotif,
  discoverMotifs,
  SeqAlphabet,
  MotifResult,
  MotifDiscoveryResult,
} from '../../utils/motifDiscovery';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { ExportButton } from '../common/ExportButton';
import { CopyButton } from '../common/CopyButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { SequenceLogoVisualizer } from '../visualizers/SequenceLogoVisualizer';
import {
  Search,
  Layers,
  AlignLeft,
  Dna,
  Activity,
  FileText,
  Zap,
  BarChart2,
  Copy,
  Hash,
  Database,
} from 'lucide-react';

interface ToolProps {
  lang: Language;
}

type Mode = 'aligned' | 'discover';

const SAMPLE_ALIGNED = `ATGCGATCGA
ATGCAATCGA
ATGCGTTCGA
ATGCGATCGA
ATGCGATCAA
ATGCGAGCGA
ATGCGATCGA
ATGCGACCGA`;

const SAMPLE_DISCOVER = `CGATCGATGCGATCGATCG
TATATGCGATCGCCCGAT
ATGCGATCGATCGATCGA
CCCATGCGATCGAATTTT
GGATGCGATCGATGATCG
AACATGCGATCGTTTAAA
TTTATGCGATCGAAAGGG`;

export const MotifDiscoveryTool: React.FC<ToolProps> = ({ lang }) => {
  const [mode, setMode] = useState<Mode>('aligned');
  const [inputText, setInputText] = useState(SAMPLE_ALIGNED);
  const [alphabet, setAlphabet] = useState<SeqAlphabet>('DNA');
  const [motifWidth, setMotifWidth] = useState(6);
  const [maxMismatches, setMaxMismatches] = useState(1);
  const [topN, setTopN] = useState(5);
  const [selectedMotifIdx, setSelectedMotifIdx] = useState(0);

  const isRTL = lang === 'fa';
  const dir = isRTL ? 'rtl' : 'ltr';

  // Parse input
  const sequences = useMemo(() => {
    const lines = inputText.trim().split('\n');
    const seqs: string[] = [];
    let currentSeq = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('>')) {
        if (currentSeq) seqs.push(currentSeq);
        currentSeq = '';
      } else {
        currentSeq += trimmed.replace(/\s/g, '');
      }
    }
    if (currentSeq) seqs.push(currentSeq);
    return seqs;
  }, [inputText]);

  // Results
  const alignedResult: MotifResult | null = useMemo(() => {
    if (mode !== 'aligned' || sequences.length < 2) return null;
    return analyzeAlignedMotif(sequences, alphabet);
  }, [mode, sequences, alphabet]);

  const discoveryResult: MotifDiscoveryResult | null = useMemo(() => {
    if (mode !== 'discover' || sequences.length < 2) return null;
    return discoverMotifs(sequences, motifWidth, maxMismatches, topN, alphabet);
  }, [mode, sequences, motifWidth, maxMismatches, topN, alphabet]);

  const currentPWM = mode === 'aligned'
    ? alignedResult?.pwm || []
    : discoveryResult?.motifs[selectedMotifIdx]?.pwm || [];

  const currentAlpha = mode === 'aligned'
    ? alignedResult?.alphabet || alphabet
    : discoveryResult?.alphabet || alphabet;

  return (
    <div className="space-y-6" dir={dir}>
      {/* Mode Selector */}
      <div className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs">
        <div className="flex items-center gap-2 bg-[#F3FAF7] p-1 rounded-xl border border-[#DDEDE8] w-fit mx-auto">
          <button
            type="button"
            aria-pressed={mode === 'aligned'}
            onClick={() => { setMode('aligned'); setInputText(SAMPLE_ALIGNED); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === 'aligned'
                ? 'bg-[#0F766E] text-white shadow-2xs'
                : 'text-[#64748B] hover:text-[#12312B]'
            }`}
          >
            <AlignLeft className="w-4 h-4" />
            {getTranslation(lang, 'tool_motif_mode_aligned')}
          </button>
          <button
            type="button"
            aria-pressed={mode === 'discover'}
            onClick={() => { setMode('discover'); setInputText(SAMPLE_DISCOVER); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === 'discover'
                ? 'bg-[#0F766E] text-white shadow-2xs'
                : 'text-[#64748B] hover:text-[#12312B]'
            }`}
          >
            <Search className="w-4 h-4" />
            {getTranslation(lang, 'tool_motif_mode_discover')}
          </button>
        </div>
        <p className="text-center text-[10px] text-[#64748B] mt-2">
          {mode === 'aligned'
            ? getTranslation(lang, 'tool_motif_mode_aligned_desc')
            : getTranslation(lang, 'tool_motif_mode_discover_desc')}
        </p>
      </div>

      {/* Input */}
      <div className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-[#12312B] flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-[#0F766E]" />
            {getTranslation(lang, 'tool_motif_input_label')}
          </label>
          <span className="text-[10px] text-[#64748B]">
            {sequences.length} {getTranslation(lang, 'tool_motif_sequences_found')}
          </span>
        </div>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          rows={8}
          className="w-full p-3 text-xs font-mono bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl text-[#12312B] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 resize-y"
          placeholder={getTranslation(lang, 'tool_motif_input_placeholder')}
          dir="ltr"
        />
        <p className="text-[10px] text-[#94A3B8]">
          {getTranslation(lang, 'tool_motif_input_hint')}
        </p>
      </div>

      {/* Controls */}
      <div className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs flex flex-wrap items-center gap-4">
        {/* Alphabet */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-[#12312B] flex items-center gap-1.5">
            <Dna className="w-4 h-4 text-[#0F766E]" />
            {getTranslation(lang, 'tool_motif_alphabet')}
          </label>
          <div className="flex gap-1 bg-[#F3FAF7] p-1 rounded-lg border border-[#DDEDE8]">
            {(['DNA', 'RNA', 'PROTEIN'] as SeqAlphabet[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAlphabet(a)}
                className={`px-3 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  alphabet === a
                    ? 'bg-[#0F766E] text-white shadow-2xs'
                    : 'text-[#64748B] hover:text-[#12312B]'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Discovery-specific controls */}
        {mode === 'discover' && (
          <>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-[#12312B] flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-[#0F766E]" />
                {getTranslation(lang, 'tool_motif_width')}
              </label>
              <input
                type="number"
                min={4}
                max={20}
                value={motifWidth}
                onChange={(e) => setMotifWidth(Math.max(4, Math.min(20, +e.target.value || 6)))}
                className="w-16 p-1.5 text-[10px] font-mono bg-[#F3FAF7] border border-[#DDEDE8] rounded-lg text-center text-[#0F766E] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-[#12312B]">
                {getTranslation(lang, 'tool_motif_mismatches')}
              </label>
              <input
                type="number"
                min={0}
                max={4}
                value={maxMismatches}
                onChange={(e) => setMaxMismatches(Math.max(0, Math.min(4, +e.target.value || 1)))}
                className="w-16 p-1.5 text-[10px] font-mono bg-[#F3FAF7] border border-[#DDEDE8] rounded-lg text-center text-[#0F766E] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20"
              />
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {((mode === 'aligned' && alignedResult && !alignedResult.isValid) ||
        (mode === 'discover' && discoveryResult && !discoveryResult.isValid)) && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-medium">
          {mode === 'aligned' ? alignedResult?.errorMessage : discoveryResult?.errorMessage}
        </div>
      )}

      {/* Discovery results: motif selector */}
      {mode === 'discover' && discoveryResult?.isValid && discoveryResult.motifs.length > 0 && (
        <div className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-3">
          <h4 className="text-sm font-bold text-[#12312B] flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#0F766E]" />
            {getTranslation(lang, 'tool_motif_discovered')} ({discoveryResult.motifs.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {discoveryResult.motifs.map((m, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedMotifIdx(i)}
                className={`px-3 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer border ${
                  selectedMotifIdx === i
                    ? 'bg-[#0F766E] text-white border-[#0F766E] shadow-md'
                    : 'bg-[#F3FAF7] text-[#12312B] border-[#DDEDE8] hover:border-[#0F766E]'
                }`}
              >
                <div className="font-bold tracking-wider">{m.consensus}</div>
                <div className="text-[9px] mt-0.5 opacity-70">
                  IC: {m.totalIC.toFixed(2)} | {m.positions.length}/{discoveryResult.sequenceCount} seqs
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sequence Logo */}
      {currentPWM.length > 0 && (
        <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-5">
          <SequenceLogoVisualizer
            pwm={currentPWM}
            alphabet={currentAlpha}
            lang={lang}
          />
        </div>
      )}

      {/* PWM Table */}
      {currentPWM.length > 0 && (
        <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#12312B] flex items-center gap-2">
              <Database className="w-4 h-4 text-[#0F766E]" />
              {getTranslation(lang, 'tool_motif_pwm_table')}
            </h4>
            <ExportButton
              data={(() => {
                const chars = Object.keys(currentPWM[0]?.frequency || {});
                const header = ['Position', ...chars, 'IC_bits', 'Consensus'].join('\t');
                const rows = currentPWM.map((p, i) => [
                  i + 1,
                  ...chars.map((c) => p.frequency[c].toFixed(4)),
                  p.informationContent.toFixed(3),
                  p.maxChar,
                ].join('\t'));
                return [header, ...rows].join('\n');
              })()}
              filename="pwm_matrix.tsv"
              lang={lang}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="border-b border-[#DDEDE8]">
                  <th className="py-2 px-2 text-left text-[#64748B] font-bold">Pos</th>
                  {Object.keys(currentPWM[0].frequency).map((c) => (
                    <th key={c} className="py-2 px-2 text-center text-[#0F766E] font-bold">{c}</th>
                  ))}
                  <th className="py-2 px-2 text-center text-[#64748B] font-bold">IC (bits)</th>
                  <th className="py-2 px-2 text-center text-[#64748B] font-bold">Consensus</th>
                </tr>
              </thead>
              <tbody>
                {currentPWM.map((pos, i) => (
                  <tr key={i} className="border-b border-[#F3FAF7] hover:bg-[#F3FAF7]/50">
                    <td className="py-1.5 px-2 font-bold text-[#12312B]">{i + 1}</td>
                    {Object.entries(pos.frequency).map(([c, f]) => (
                      <td
                        key={c}
                        className="py-1.5 px-2 text-center"
                        style={{
                          backgroundColor: `rgba(15, 118, 110, ${Math.min(f, 1) * 0.3})`,
                          color: f > 0.6 ? '#0F766E' : '#64748B',
                          fontWeight: f > 0.5 ? 'bold' : 'normal',
                        }}
                      >
                        {f.toFixed(3)}
                      </td>
                    ))}
                    <td className="py-1.5 px-2 text-center font-bold text-[#0F766E]">
                      {pos.informationContent.toFixed(3)}
                    </td>
                    <td className="py-1.5 px-2 text-center font-bold text-[#12312B] text-sm">
                      {pos.maxChar}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total IC */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#DDEDE8]">
            <BarChart2 className="w-4 h-4 text-[#0F766E]" />
            <span className="text-xs font-bold text-[#12312B]">
              {getTranslation(lang, 'tool_motif_total_ic')}:
            </span>
            <span className="text-xs font-mono font-bold text-[#0F766E]">
              {currentPWM.reduce((s, p) => s + p.informationContent, 0).toFixed(3)} bits
            </span>
          </div>
        </div>
      )}

      {/* Consensus & Exports */}
      {mode === 'aligned' && alignedResult?.isValid && (
        <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-4">
          {/* Consensus */}
          <div>
            <h4 className="text-xs font-bold text-[#12312B] mb-1 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#0F766E]" />
              {getTranslation(lang, 'tool_motif_consensus')}
            </h4>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono font-bold text-[#0F766E] bg-[#F3FAF7] px-3 py-1.5 rounded-lg border border-[#DDEDE8] tracking-widest">
                {alignedResult.consensus}
              </code>
              <CopyButton textToCopy={alignedResult.consensus} lang={lang} />
            </div>
          </div>

          {/* Export formats */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#12312B] flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#0F766E]" />
              {getTranslation(lang, 'tool_motif_export_formats')}
            </h4>

            {[
              { label: 'JASPAR', content: alignedResult.jasparMatrix },
              { label: 'MEME', content: alignedResult.memeMotif },
              { label: 'TRANSFAC', content: alignedResult.transfacMatrix },
            ].map(({ label, content }) => (
              <div key={label} className="bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-[#0F766E] uppercase tracking-wider">
                    {label} Format
                  </span>
                  <CopyButton textToCopy={content} lang={lang} />
                </div>
                <pre className="text-[10px] font-mono text-[#334155] whitespace-pre overflow-x-auto" dir="ltr">
                  {content}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scientific Explanation */}
      <ScientificExplanation
        lang={lang}
        biologicalMeaning={`${getTranslation(lang, 'tool_motif_when')} ${getTranslation(lang, 'tool_motif_example')}`}
        assumptions={`${getTranslation(lang, 'tool_motif_input')} ${getTranslation(lang, 'tool_motif_output')}`}
        limitations="This is an educational motif finder using simple k-mer enumeration with Hamming-distance clustering, not a replacement for MEME, STREME, or HOMER's statistical motif-discovery algorithms."
      />
    </div>
  );
};
