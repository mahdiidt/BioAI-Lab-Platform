// ─────────────────────────────────────────────────────────────
// Dot Plot Sequence Comparison Tool
// Compare two sequences visually, detect repeats, inversions,
// and palindromes. Supports FASTA file upload.
// ─────────────────────────────────────────────────────────────
import React, { useState, useMemo, useRef } from 'react';
import { computeDotPlot, parseFasta, FastaEntry } from '../../utils/dotplot';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { ExportButton } from '../common/ExportButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { DotPlotVisualizer } from '../visualizers/DotPlotVisualizer';
import {
  Upload,
  FileText,
  Settings,
  BarChart2,
  Repeat,
  ArrowRightLeft,
  Eye,
  EyeOff,
  Dna,
  Layers,
  Info,
  AlertTriangle,
  Grid3x3,
} from 'lucide-react';

interface ToolProps {
  lang: Language;
}

const SAMPLE_SEQ1 = `>Human_BRCA1_fragment
ATGCGATCGATCGATCGAATGCGATCGATCGATCGATCG
ATGCGATCGATCGATCGAATGCGATCGATCGATCGATCG
CCCGGGTTTAAACCCGGGTTTAAACCCGGG`;

const SAMPLE_SEQ2 = `>Mouse_Brca1_fragment
ATGCGATCGATCGATCGAATGCAATCAATCGATCGATCG
ATGCGATCGATCGATCGAATGCGATCGATCAATCGATCG
CCCGGGTTTAAACCCGGGTTTAAAGGGCCC`;

export const DotPlotTool: React.FC<ToolProps> = ({ lang }) => {
  const [seq1Text, setSeq1Text] = useState(SAMPLE_SEQ1);
  const [seq2Text, setSeq2Text] = useState(SAMPLE_SEQ2);
  const [windowSize, setWindowSize] = useState(7);
  const [threshold, setThreshold] = useState(0.65);
  const [showReverse, setShowReverse] = useState(true);
  const [highlightRegions, setHighlightRegions] = useState(true);
  const [selfCompare, setSelfCompare] = useState(false);

  const fileInput1Ref = useRef<HTMLInputElement>(null);
  const fileInput2Ref = useRef<HTMLInputElement>(null);

  const isRTL = lang === 'fa';
  const dir = isRTL ? 'rtl' : 'ltr';

  // Parse sequences
  const seq1Entries = useMemo(() => parseFasta(seq1Text), [seq1Text]);
  const seq2Entries = useMemo(() => parseFasta(seq2Text), [seq2Text]);

  const seq1 = seq1Entries[0]?.sequence || '';
  const seq2 = selfCompare ? seq1 : (seq2Entries[0]?.sequence || '');
  const seq1Name = seq1Entries[0]?.name || 'Sequence 1';
  const seq2Name = selfCompare ? seq1Name + ' (self)' : (seq2Entries[0]?.name || 'Sequence 2');

  // Compute
  const result = useMemo(() => {
    if (seq1.length < 5 || seq2.length < 5) return null;
    return computeDotPlot(seq1, seq2, seq1Name, seq2Name, windowSize, threshold, showReverse);
  }, [seq1, seq2, seq1Name, seq2Name, windowSize, threshold, showReverse]);

  // Shared file reader with the same 5 MB cap other tools use, so a huge file
  // cannot freeze the tab while it is being read and parsed.
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const [fileError, setFileError] = useState<string | null>(null);
  const readSequenceFile = (file: File, target: 'seq1' | 'seq2') => {
    if (file.size > MAX_FILE_BYTES) {
      setFileError(getTranslation(lang, 'fileTooLargeError').replace('{size}', (file.size / 1024 / 1024).toFixed(1)));
      return;
    }
    setFileError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (target === 'seq1') setSeq1Text(text);
      else setSeq2Text(text);
    };
    reader.readAsText(file);
  };

  // File upload handler
  const handleFileUpload = (target: 'seq1' | 'seq2') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readSequenceFile(file, target);
    // Reset input so same file can be re-uploaded
    e.target.value = '';
  };

  // Drag & drop handler
  const handleDrop = (target: 'seq1' | 'seq2') => (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    readSequenceFile(file, target);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* Self-compare toggle */}
      <div className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs dark:bg-slate-900 dark:border-slate-700">
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setSelfCompare(false)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              !selfCompare
                ? 'bg-[#0F766E] text-white shadow-md'
                : 'bg-[#F3FAF7] text-[#64748B] border border-[#DDEDE8] hover:text-[#12312B]'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            {getTranslation(lang, 'tool_dotplot_two_seq')}
          </button>
          <button
            type="button"
            onClick={() => setSelfCompare(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selfCompare
                ? 'bg-[#0F766E] text-white shadow-md'
                : 'bg-[#F3FAF7] text-[#64748B] border border-[#DDEDE8] hover:text-[#12312B]'
            }`}
          >
            <Repeat className="w-4 h-4" />
            {getTranslation(lang, 'tool_dotplot_self_compare')}
          </button>
        </div>
      </div>

      {/* Sequence inputs */}
      <div className={`grid ${selfCompare ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'} gap-4`}>
        {/* Sequence 1 */}
        <div
          className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-3 dark:bg-slate-900 dark:border-slate-700"
          onDrop={handleDrop('seq1')}
          onDragOver={handleDragOver}
        >
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#12312B] flex items-center gap-1.5 dark:text-slate-100">
              <Dna className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
              {selfCompare
                ? getTranslation(lang, 'tool_dotplot_sequence')
                : getTranslation(lang, 'tool_dotplot_seq1')}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#64748B] font-mono dark:text-slate-400">{seq1.length} bp</span>
              <button
                type="button"
                onClick={() => fileInput1Ref.current?.click()}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-[#0F766E] text-white rounded-lg hover:bg-[#0D6B64] transition-colors cursor-pointer shadow-xs"
              >
                <Upload className="w-3 h-3" />
                {getTranslation(lang, 'tool_dotplot_upload_fasta')}
              </button>
              <input
                ref={fileInput1Ref}
                type="file"
                accept=".fasta,.fa,.fna,.ffn,.faa,.txt"
                onChange={handleFileUpload('seq1')}
                className="hidden"
              />
            </div>
          </div>
          <textarea
            value={seq1Text}
            onChange={(e) => setSeq1Text(e.target.value)}
            rows={5}
            className="w-full p-3 text-[11px] font-mono bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl text-[#12312B] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 resize-y dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
            placeholder={getTranslation(lang, 'tool_dotplot_paste_placeholder')}
            dir="ltr"
          />
          <p className="text-[10px] text-[#94A3B8] flex items-center gap-1">
            <Info className="w-3 h-3" />
            {getTranslation(lang, 'tool_dotplot_drag_hint')}
          </p>
        </div>

        {/* Sequence 2 */}
        {!selfCompare && (
          <div
            className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-3 dark:bg-slate-900 dark:border-slate-700"
            onDrop={handleDrop('seq2')}
            onDragOver={handleDragOver}
          >
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#12312B] flex items-center gap-1.5 dark:text-slate-100">
                <Dna className="w-4 h-4 text-[#8B5CF6]" />
                {getTranslation(lang, 'tool_dotplot_seq2')}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#64748B] font-mono dark:text-slate-400">{seq2.length} bp</span>
                <button
                  type="button"
                  onClick={() => fileInput2Ref.current?.click()}
                  className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-[#8B5CF6] text-white rounded-lg hover:bg-[#7C3AED] transition-colors cursor-pointer shadow-xs"
                >
                  <Upload className="w-3 h-3" />
                  {getTranslation(lang, 'tool_dotplot_upload_fasta')}
                </button>
                <input
                  ref={fileInput2Ref}
                  type="file"
                  accept=".fasta,.fa,.fna,.ffn,.faa,.txt"
                  onChange={handleFileUpload('seq2')}
                  className="hidden"
                />
              </div>
            </div>
            <textarea
              value={seq2Text}
              onChange={(e) => setSeq2Text(e.target.value)}
              rows={5}
              className="w-full p-3 text-[11px] font-mono bg-[#FAF5FF] border border-[#E9D5FF] rounded-xl text-[#12312B] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 resize-y dark:text-slate-100"
              placeholder={getTranslation(lang, 'tool_dotplot_paste_placeholder')}
              dir="ltr"
            />
            <p className="text-[10px] text-[#94A3B8] flex items-center gap-1">
              <Info className="w-3 h-3" />
              {getTranslation(lang, 'tool_dotplot_drag_hint')}
            </p>
          </div>
        )}
      </div>

      {/* Parameters */}
      <div className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs dark:bg-slate-900 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
          <span className="text-xs font-bold text-[#12312B] dark:text-slate-100">
            {getTranslation(lang, 'tool_dotplot_parameters')}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Window size */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-[#64748B] dark:text-slate-400">
              {getTranslation(lang, 'tool_dotplot_window')}
            </label>
            <input
              type="range"
              min={1}
              max={25}
              value={windowSize}
              onChange={(e) => setWindowSize(+e.target.value)}
              className="w-24 accent-[#0F766E]"
            />
            <span className="text-[10px] font-mono font-bold text-[#0F766E] bg-[#F3FAF7] px-2 py-0.5 rounded border border-[#DDEDE8] min-w-[2rem] text-center dark:text-teal-400 dark:bg-slate-800 dark:border-slate-700">
              {windowSize}
            </span>
          </div>

          {/* Threshold */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-[#64748B] dark:text-slate-400">
              {getTranslation(lang, 'tool_dotplot_threshold')}
            </label>
            <input
              type="range"
              min={0.3}
              max={1}
              step={0.05}
              value={threshold}
              onChange={(e) => setThreshold(+e.target.value)}
              className="w-24 accent-[#0F766E]"
            />
            <span className="text-[10px] font-mono font-bold text-[#0F766E] bg-[#F3FAF7] px-2 py-0.5 rounded border border-[#DDEDE8] min-w-[3rem] text-center dark:text-teal-400 dark:bg-slate-800 dark:border-slate-700">
              {(threshold * 100).toFixed(0)}%
            </span>
          </div>

          {/* Toggles */}
          <button
            type="button"
            onClick={() => setShowReverse(!showReverse)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
              showReverse
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-[#F3FAF7] border-[#DDEDE8] text-[#64748B]'
            }`}
          >
            {showReverse ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {getTranslation(lang, 'tool_dotplot_show_reverse')}
          </button>

          <button
            type="button"
            onClick={() => setHighlightRegions(!highlightRegions)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
              highlightRegions
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-[#F3FAF7] border-[#DDEDE8] text-[#64748B]'
            }`}
          >
            <Layers className="w-3 h-3" />
            {getTranslation(lang, 'tool_dotplot_show_regions')}
          </button>
        </div>
      </div>

      {/* Warning for large sequences */}
      {(seq1.length > 5000 || seq2.length > 5000) && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-700 font-medium flex items-center gap-2 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {getTranslation(lang, 'tool_dotplot_large_warning')}
        </div>
      )}

      {fileError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-medium dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">{fileError}</div>
      )}

      {/* Error */}
      {result && !result.isValid && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-medium dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
          {getTranslation(lang, result.errorCode === 'too_long' ? 'tool_dotplot_error_too_long' : result.errorCode === 'too_dense' ? 'tool_dotplot_error_too_dense' : 'tool_dotplot_error_too_short')}
        </div>
      )}

      {/* Dot Plot Visualization */}
      {result?.isValid && (
        <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-4 dark:bg-slate-900 dark:border-slate-700">
          <h4 className="text-sm font-bold text-[#12312B] flex items-center gap-2 dark:text-slate-100">
            <Grid3x3 className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
            {getTranslation(lang, 'tool_dotplot_visualization')}
          </h4>

          <DotPlotVisualizer
            result={result}
            lang={lang}
            showReverse={showReverse}
            highlightRegions={highlightRegions}
          />
        </div>
      )}

      {/* Statistics */}
      {result?.isValid && (
        <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-3 dark:bg-slate-900 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#12312B] flex items-center gap-2 dark:text-slate-100">
              <BarChart2 className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
              {getTranslation(lang, 'tool_dotplot_statistics')}
            </h4>
            <ExportButton
              data={[{
                seq1_name: result.seq1Name,
                seq1_length: result.seq1Length,
                seq2_name: result.seq2Name,
                seq2_length: result.seq2Length,
                window_size: result.windowSize,
                threshold: result.threshold,
                total_dots: result.stats.totalDots,
                density_percent: (result.stats.density * 100).toFixed(2),
                longest_diagonal: result.stats.longestDiagonal,
                longest_anti_diagonal: result.stats.longestAntiDiag,
                regions_found: result.regions.length,
              }]}
              filename="dotplot_stats"
              format="json"
              lang={lang}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: getTranslation(lang, 'tool_dotplot_total_dots'),
                value: result.stats.totalDots.toLocaleString(),
                color: '#0F766E',
              },
              {
                label: getTranslation(lang, 'tool_dotplot_density'),
                value: (result.stats.density * 100).toFixed(1) + '%',
                color: '#3B82F6',
              },
              {
                label: getTranslation(lang, 'tool_dotplot_longest_diag'),
                value: result.stats.longestDiagonal + ' bp',
                color: '#0F766E',
              },
              {
                label: getTranslation(lang, 'tool_dotplot_longest_anti'),
                value: result.stats.longestAntiDiag + ' bp',
                color: '#E11D48',
              },
            ].map((stat, i) => (
              <div key={i} className="p-3 bg-[#F3FAF7] rounded-xl border border-[#DDEDE8] text-center dark:bg-slate-800 dark:border-slate-700">
                <div className="text-[10px] font-bold text-[#64748B] mb-1 dark:text-slate-400">{stat.label}</div>
                <div className="text-lg font-bold font-mono" style={{ color: stat.color }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Detected regions */}
          {result.regions.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#DDEDE8] dark:border-slate-700">
              <h5 className="text-xs font-bold text-[#12312B] flex items-center gap-1.5 dark:text-slate-100">
                <Layers className="w-3.5 h-3.5 text-[#3B82F6]" />
                {getTranslation(lang, 'tool_dotplot_detected_regions')} ({result.regions.length})
              </h5>
              <div className="space-y-1.5">
                {result.regions.map((region, i) => {
                  const regionLabel = region.type === 'diagonal'
                    ? getTranslation(lang, 'tool_dotplot_region_self_diagonal')
                    : region.type === 'direct_repeat'
                    ? getTranslation(lang, 'tool_dotplot_region_direct').replace('{len}', String(region.length))
                    : region.type === 'inverted_repeat'
                    ? getTranslation(lang, 'tool_dotplot_region_inverted').replace('{len}', String(region.length))
                    : getTranslation(lang, 'tool_dotplot_region_palindrome').replace('{len}', String(region.length));
                  const regionBadge = region.type === 'direct_repeat'
                    ? getTranslation(lang, 'tool_dotplot_badge_direct')
                    : region.type === 'inverted_repeat'
                    ? getTranslation(lang, 'tool_dotplot_badge_inverted')
                    : region.type === 'palindrome'
                    ? getTranslation(lang, 'tool_dotplot_badge_palindrome')
                    : getTranslation(lang, 'tool_dotplot_badge_diagonal');
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2 bg-[#F3FAF7] rounded-lg border border-[#DDEDE8] text-[10px] dark:bg-slate-800 dark:border-slate-700"
                    >
                      <span className={`px-2 py-0.5 rounded font-bold text-white shrink-0 ${
                        region.type === 'direct_repeat' ? 'bg-[#0F766E]' :
                        region.type === 'inverted_repeat' ? 'bg-rose-500' :
                        region.type === 'palindrome' ? 'bg-purple-500' : 'bg-[#3B82F6]'
                      }`}>
                        {regionBadge}
                      </span>
                      <span className="text-[#334155] font-medium">{regionLabel}</span>
                      <span className="text-[#64748B] font-mono ml-auto dark:text-slate-400">
                        ({region.startX}, {region.startY}) → ({region.endX}, {region.endY})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Multi-FASTA selector (if uploaded file has multiple sequences) */}
      {seq1Entries.length > 1 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-700 font-medium flex items-center gap-2 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
          <FileText className="w-4 h-4 flex-shrink-0" />
          {getTranslation(lang, 'tool_dotplot_multi_fasta_note')
            .replace('{count}', String(seq1Entries.length))}
        </div>
      )}

      {/* Scientific Explanation */}
      <ScientificExplanation
        lang={lang}
        formula={getTranslation(lang, 'tool_dotplot_formula')}
        biologicalMeaning={getTranslation(lang, 'tool_dotplot_when')}
        assumptions={getTranslation(lang, 'tool_dotplot_input_desc')}
        limitations={getTranslation(lang, 'tool_dotplot_limitations')}
      />
    </div>
  );
};
