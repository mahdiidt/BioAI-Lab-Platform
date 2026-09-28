import React, { useState, useMemo, useRef } from 'react';
import { analyzeGcSkew, parseFastaGC } from '../../utils/gcSkew';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { ExportButton } from '../common/ExportButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { GcSkewChart } from '../visualizers/GcSkewChart';
import {
  Upload, FileText, Settings, BarChart2, MapPin, Dna,
  Eye, EyeOff, Info, AlertTriangle, TrendingUp, Target,
  Layers, Activity,
} from 'lucide-react';

interface ToolProps { lang: Language; }

const SAMPLE = `>E_coli_K12_fragment_10kb
ATGAAACGCATTAGCACCACCATTACCACCACCATCACCATTACCACAGGTAACGGTGCGGGCTGACGCGTACAGGAAACACAGAAAAAAGCCCGCACCTGAC
AGTGCGGGCTTTTTTTTTCGACCAAAGGTAACGAGGTAACAACCATGCGAGTGTTGAAGTTCGGCGGTACATCAGTGGCAAATGCAGAACGTTTTCTGCGTG
TTGCCGATATTCTGGAAAGCAATGCCAGGCAGGGGCAGGTGGCCACCGTCCTCTCTGCCCCCGCCAAAATCACCAACCACCTGGTGGCGATGATTGAAAAAAC
CATTAGCGGCCAGGATGCTTTACCCAATATCAGCGATGCCGAACGTATTTTTGCCGAACTTTTGACGGGACTCGCCGCCGCCCAGCCGGGGTTCCCGCTGGCG
CAATTGAAAACTTTCGTCGATCAGGAATTTGCCCAAATAAAACATGTCCTGCATGGCATTAGTTTGTTGGGGCAGTGCCCGGATAGCATCAACGCTGCGCTGA
TTTGCCGTGGCGAGAAAATGTCGATCGCCATTATGGCCGGCGTATTAGAAGCGCGCGGTCACAACGTTACTGTTATCGATCCGGTCGAAAAACTGCTGGCAGT
GGGGCATTACCTCGAATCTACCGTCGATATTGCTGAGTCCACCCGCCGTATTGCGGCAAGCCGCATTCCGGCTGATCACATGGTGCTGATGGCAGGTTTCACC
GCCGGTAATGAAAAAGGCGAACTGGTGGTGCTTGGACGCAACGGTTCCGACTACTCTGCTGCGGTGCTGGCTGCCTGTTTACGCGCCGATTGTTGCGAGATTT
GGACGGACGTTGACGGGGTCTATACCTGCGACCCGCGTCAGGTGCCCGATGCGAGGTTGTTGAAGTCGATGTCCTACCAGGAAGCGATGGAGCTTTCCTACTT
CGGCGCTAAAGTTCTTCACCCCCGCACCATTACCCCCATCGCCCAGTTCCAGATCCCTTGCCTGATTAAAAATACCGGAAATCCTCAAGCACCAGGTACGCTCA`;

export const GcSkewTool: React.FC<ToolProps> = ({ lang }) => {
  const [inputText, setInputText] = useState(SAMPLE);
  const [windowSize, setWindowSize] = useState(100);
  const [stepSize, setStepSize] = useState(20);
  const [showTracks, setShowTracks] = useState({
    gcContent: true, gcSkew: true, cumulative: true, atSkew: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isRTL = lang === 'fa';

  const entries = useMemo(() => parseFastaGC(inputText), [inputText]);
  const seq = entries[0]?.sequence || '';
  const seqName = entries[0]?.name || 'Sequence';

  const result = useMemo(() => {
    if (seq.length < 50) return null;
    return analyzeGcSkew(seq, seqName, windowSize, stepSize);
  }, [seq, seqName, windowSize, stepSize]);

  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const [fileError, setFileError] = useState<string | null>(null);
  const readSequenceFile = (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setFileError(getTranslation(lang, 'fileTooLargeError').replace('{size}', (file.size / 1024 / 1024).toFixed(1)));
      return;
    }
    setFileError(null);
    const reader = new FileReader();
    reader.onload = (ev) => setInputText(ev.target?.result as string);
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readSequenceFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    readSequenceFile(file);
  };

  const toggleTrack = (track: keyof typeof showTracks) => {
    setShowTracks(prev => ({ ...prev, [track]: !prev[track] }));
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Input */}
      <div
        className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-3 dark:bg-slate-900 dark:border-slate-700"
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      >
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-[#12312B] flex items-center gap-1.5 dark:text-slate-100">
            <Dna className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
            {getTranslation(lang, 'tool_gcskew_input_label')}
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#64748B] font-mono dark:text-slate-400">{seq.length.toLocaleString()} bp</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-[#0F766E] text-white rounded-lg hover:bg-[#0D6B64] transition-colors cursor-pointer shadow-xs"
            >
              <Upload className="w-3 h-3" />
              {getTranslation(lang, 'tool_gcskew_upload_fasta')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".fasta,.fa,.fna,.gbk,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          rows={5}
          className="w-full p-3 text-[11px] font-mono bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl text-[#12312B] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 resize-y dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
          placeholder={getTranslation(lang, 'tool_gcskew_placeholder')}
          dir="ltr"
        />
        <p className="text-[10px] text-[#94A3B8] flex items-center gap-1">
          <Info className="w-3 h-3" />
          {getTranslation(lang, 'tool_gcskew_drag_hint')}
        </p>
      </div>

      {/* Parameters */}
      <div className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs dark:bg-slate-900 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
          <span className="text-xs font-bold text-[#12312B] dark:text-slate-100">{getTranslation(lang, 'tool_gcskew_params')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-[#64748B] dark:text-slate-400">{getTranslation(lang, 'tool_gcskew_window')}</label>
            <input type="range" min={20} max={2000} step={10} value={windowSize}
              onChange={(e) => setWindowSize(+e.target.value)} className="w-24 accent-[#0F766E]" />
            <span className="text-[10px] font-mono font-bold text-[#0F766E] bg-[#F3FAF7] px-2 py-0.5 rounded border border-[#DDEDE8] min-w-[3rem] text-center dark:text-teal-400 dark:bg-slate-800 dark:border-slate-700">{windowSize}</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-[#64748B] dark:text-slate-400">{getTranslation(lang, 'tool_gcskew_step')}</label>
            <input type="range" min={1} max={500} step={5} value={stepSize}
              onChange={(e) => setStepSize(+e.target.value)} className="w-24 accent-[#0F766E]" />
            <span className="text-[10px] font-mono font-bold text-[#0F766E] bg-[#F3FAF7] px-2 py-0.5 rounded border border-[#DDEDE8] min-w-[3rem] text-center dark:text-teal-400 dark:bg-slate-800 dark:border-slate-700">{stepSize}</span>
          </div>
        </div>

        {/* Track toggles */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[#DDEDE8] dark:border-slate-700">
          {[
            { key: 'gcContent' as const, label: 'GC%', color: '#0F766E', icon: BarChart2 },
            { key: 'gcSkew' as const, label: 'GC Skew', color: '#3B82F6', icon: TrendingUp },
            { key: 'cumulative' as const, label: getTranslation(lang, 'tool_gcskew_cumulative'), color: '#8B5CF6', icon: Layers },
            { key: 'atSkew' as const, label: 'AT Skew', color: '#F59E0B', icon: Activity },
          ].map(({ key, label, color, icon: Icon }) => (
            <button key={key} type="button" onClick={() => toggleTrack(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                showTracks[key]
                  ? `border-current text-white shadow-xs`
                  : 'bg-[#F3FAF7] border-[#DDEDE8] text-[#64748B]'
              }`}
              style={showTracks[key] ? { backgroundColor: color, borderColor: color } : {}}
            >
              {showTracks[key] ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {seq.length > 50000 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-700 font-medium flex items-center gap-2 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {getTranslation(lang, 'tool_gcskew_large_warning')}
        </div>
      )}

      {fileError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-medium dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">{fileError}</div>
      )}

      {result && !result.isValid && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-medium dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">{getTranslation(lang, 'tool_gcskew_error_too_short')}</div>
      )}

      {/* Chart */}
      {result?.isValid && (
        <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm dark:bg-slate-900 dark:border-slate-700">
          <GcSkewChart result={result} lang={lang} showTracks={showTracks} />
        </div>
      )}

      {/* Stats */}
      {result?.isValid && (
        <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-3 dark:bg-slate-900 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#12312B] flex items-center gap-2 dark:text-slate-100">
              <BarChart2 className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
              {getTranslation(lang, 'tool_gcskew_statistics')}
            </h4>
            <ExportButton
              data={result.dataPoints.map(p => ({
                position: p.position,
                gc_percent: (p.gcContent * 100).toFixed(2),
                at_percent: (p.atContent * 100).toFixed(2),
                gc_skew: p.gcSkew.toFixed(6),
                at_skew: p.atSkew.toFixed(6),
                cumulative_gc_skew: p.cumulativeGcSkew.toFixed(4),
              }))}
              filename="gc_skew_data"
              format="json"
              lang={lang}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: getTranslation(lang, 'tool_gcskew_seq_length'), value: result.stats.seqLength.toLocaleString() + ' bp', color: '#12312B' },
              { label: getTranslation(lang, 'tool_gcskew_overall_gc'), value: (result.stats.overallGC * 100).toFixed(1) + '%', color: '#0F766E' },
              { label: getTranslation(lang, 'tool_gcskew_mean_skew'), value: result.stats.meanGcSkew.toFixed(4), color: '#3B82F6' },
              { label: getTranslation(lang, 'tool_gcskew_std_skew'), value: result.stats.stdGcSkew.toFixed(4), color: '#8B5CF6' },
            ].map((s, i) => (
              <div key={i} className="p-3 bg-[#F3FAF7] rounded-xl border border-[#DDEDE8] text-center dark:bg-slate-800 dark:border-slate-700">
                <div className="text-[10px] font-bold text-[#64748B] mb-1 dark:text-slate-400">{s.label}</div>
                <div className="text-lg font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Landmarks */}
          {result.landmarks.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-[#DDEDE8] dark:border-slate-700">
              <h5 className="text-xs font-bold text-[#12312B] flex items-center gap-1.5 dark:text-slate-100">
                <Target className="w-3.5 h-3.5 text-[#EF4444]" />
                {getTranslation(lang, 'tool_gcskew_landmarks')} ({result.landmarks.length})
              </h5>
              {result.landmarks.map((lm, i) => {
                const label = lm.type === 'ori'
                  ? getTranslation(lang, 'tool_gcskew_landmark_ori').replace('{pos}', lm.position.toLocaleString())
                  : lm.type === 'ter'
                  ? getTranslation(lang, 'tool_gcskew_landmark_ter').replace('{pos}', lm.position.toLocaleString())
                  : lm.type === 'gc_island'
                  ? getTranslation(lang, 'tool_gcskew_landmark_gc_island')
                      .replace('{start}', String(lm.rangeStart ?? lm.position))
                      .replace('{end}', String(lm.rangeEnd ?? lm.position))
                      .replace('{pct}', (lm.value * 100).toFixed(1))
                  : getTranslation(lang, 'tool_gcskew_landmark_at_rich')
                      .replace('{start}', String(lm.rangeStart ?? lm.position))
                      .replace('{end}', String(lm.rangeEnd ?? lm.position))
                      .replace('{pct}', (lm.value * 100).toFixed(1));
                return (
                  <div key={i} className="flex items-center gap-3 p-2 bg-[#F3FAF7] rounded-lg border border-[#DDEDE8] text-[10px] dark:bg-slate-800 dark:border-slate-700">
                    <span className={`px-2 py-0.5 rounded font-bold text-white shrink-0 ${
                      lm.type === 'ori' ? 'bg-red-500' :
                      lm.type === 'ter' ? 'bg-blue-500' :
                      lm.type === 'gc_island' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}>
                      {lm.type === 'ori' ? 'ORI' : lm.type === 'ter' ? 'TER' : lm.type === 'gc_island' ? 'GC+' : 'AT+'}
                    </span>
                    <span className="text-[#334155] font-medium">{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <ScientificExplanation lang={lang}
        formula={getTranslation(lang, 'tool_gcskew_formula')}
        biologicalMeaning={getTranslation(lang, 'tool_gcskew_when')}
        assumptions={getTranslation(lang, 'tool_gcskew_input_desc')}
        limitations={getTranslation(lang, 'tool_gcskew_limitations')}
      />
    </div>
  );
};
