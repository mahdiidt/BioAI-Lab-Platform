import React, { useMemo, useRef, useState } from 'react';
import { calculateQpcrEfficiency, StandardCurvePoint, EfficiencyVerdict } from '../../utils/qpcr';
import { QpcrStandardCurveChart } from '../visualizers/QpcrStandardCurveChart';
import { ExportButton } from '../common/ExportButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { TrendingDown, Plus, Trash2, Sparkles, AlertTriangle, FileUp } from 'lucide-react';

interface ToolProps {
  lang: Language;
}

interface Row {
  id: number;
  dilution: string;
  ct: string;
}

// Relative quantity convention: HIGHER quantity = MORE template = LOWER Ct.
// (A "10-fold dilution series" read this way means each row has 10x LESS
// template than the row above it, so Ct increases going down.)
const SAMPLE_ROWS: Row[] = [
  { id: 1, dilution: '1000', ct: '18.2' },
  { id: 2, dilution: '100', ct: '21.6' },
  { id: 3, dilution: '10', ct: '25.0' },
  { id: 4, dilution: '1', ct: '28.3' },
];

const VERDICT_STYLE: Record<EfficiencyVerdict, { bg: string; border: string; text: string }> = {
  ideal: { bg: '#ECFDF5', border: '#0F766E', text: '#0F766E' },
  acceptable: { bg: '#FFFBEB', border: '#F59E0B', text: '#B45309' },
  poor: { bg: '#FEF2F2', border: '#EF4444', text: '#DC2626' },
};

const VERDICT_KEY: Record<EfficiencyVerdict, string> = {
  ideal: 'tool_qpcr_verdict_ideal',
  acceptable: 'tool_qpcr_verdict_acceptable',
  poor: 'tool_qpcr_verdict_poor',
};

let nextId = 100;

/**
 * Parses a small CSV/TSV of (quantity, Ct) pairs - e.g. exported from a
 * real-time PCR machine. Accepts comma or tab separators, tolerates an
 * optional header row (skipped if its first cell isn't a plain number),
 * and ignores blank lines.
 */
function parseStandardCurveCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const rows: Row[] = [];
  let idCounter = 500;

  for (const line of lines) {
    const cells = line.split(/[,\t]/).map((c) => c.trim());
    if (cells.length < 2) continue;
    const [first, second] = cells;
    if (!Number.isFinite(parseFloat(first)) || !Number.isFinite(parseFloat(second))) {
      continue; // likely a header row - skip silently
    }
    rows.push({ id: idCounter++, dilution: first, ct: second });
  }

  return rows;
}

export const QpcrEfficiencyTool: React.FC<ToolProps> = ({ lang }) => {
  const [rows, setRows] = useState<Row[]>(SAMPLE_ROWS);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError(getTranslation(lang, 'fileTooLargeError').replace('{size}', (file.size / 1024 / 1024).toFixed(1)));
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = text ? parseStandardCurveCsv(text) : [];
      if (parsed.length < 2) {
        setUploadError(getTranslation(lang, 'tool_qpcr_csv_parse_error'));
        return;
      }
      setUploadError(null);
      setRows(parsed);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const points: StandardCurvePoint[] = useMemo(
    () =>
      rows
        .map((r) => ({ dilution: parseFloat(r.dilution), ct: parseFloat(r.ct) }))
        .filter((p) => Number.isFinite(p.dilution) && Number.isFinite(p.ct)),
    [rows]
  );

  const result = useMemo(() => calculateQpcrEfficiency(points), [points]);

  const updateRow = (id: number, field: 'dilution' | 'ct', value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { id: nextId++, dilution: '', ct: '' }]);
  };

  const removeRow = (id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm text-[#12312B] flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-[#0F766E]" />
            {getTranslation(lang, 'tool_qpcr_standard_curve_data')}
          </h4>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F3FAF7] border border-[#DDEDE8] text-xs font-bold text-[#0F766E] hover:bg-white cursor-pointer"
            >
              <FileUp className="w-3.5 h-3.5" />
              {getTranslation(lang, 'tool_qpcr_upload_csv')}
            </button>
            <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" onChange={handleCsvUpload} className="hidden" />
            <button
              type="button"
              onClick={() => {
                setUploadError(null);
                setRows(SAMPLE_ROWS);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F3FAF7] border border-[#DDEDE8] text-xs font-bold text-[#0F766E] hover:bg-white cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {getTranslation(lang, 'tool_qpcr_load_sample')}
            </button>
          </div>
        </div>

        {uploadError && (
          <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" /> {uploadError}
          </p>
        )}

        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_32px] gap-2 text-[10px] font-bold text-[#64748B] uppercase tracking-wide px-1">
            <span>{getTranslation(lang, 'tool_qpcr_dilution')}</span>
            <span>{getTranslation(lang, 'tool_qpcr_ct')}</span>
            <span />
          </div>
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-[1fr_1fr_32px] gap-2">
              <input
                type="number"
                value={row.dilution}
                onChange={(e) => updateRow(row.id, 'dilution', e.target.value)}
                placeholder="e.g. 1000 = most template"
                className="px-3 py-2 rounded-lg border border-[#DDEDE8] bg-[#F3FAF7] text-xs font-mono font-semibold outline-none focus:border-[#0F766E]"
              />
              <input
                type="number"
                value={row.ct}
                onChange={(e) => updateRow(row.id, 'ct', e.target.value)}
                placeholder="e.g. 21.6"
                className="px-3 py-2 rounded-lg border border-[#DDEDE8] bg-[#F3FAF7] text-xs font-mono font-semibold outline-none focus:border-[#0F766E]"
              />
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="flex items-center justify-center rounded-lg border border-[#DDEDE8] text-red-500 hover:bg-red-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F3FAF7] border border-[#DDEDE8] text-xs font-bold text-[#0F766E] hover:bg-white cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          {getTranslation(lang, 'tool_qpcr_add_row')}
        </button>
      </div>

      {!result.isValid ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{result.errorMessage}</span>
        </div>
      ) : (
        <>
          <div
            className="p-5 rounded-2xl border-2 flex flex-wrap items-center justify-between gap-4"
            style={{ backgroundColor: VERDICT_STYLE[result.verdict].bg, borderColor: VERDICT_STYLE[result.verdict].border }}
          >
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wide" style={{ color: VERDICT_STYLE[result.verdict].text }}>
                {getTranslation(lang, 'tool_qpcr_efficiency')}
              </span>
              <span className="block text-3xl font-extrabold font-mono" style={{ color: VERDICT_STYLE[result.verdict].text }}>
                {result.efficiencyPercent.toFixed(1)}%
              </span>
            </div>
            <span
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ backgroundColor: VERDICT_STYLE[result.verdict].border, color: 'white' }}
            >
              {getTranslation(lang, VERDICT_KEY[result.verdict])}
            </span>
            <div className="flex gap-5 text-xs font-mono" style={{ color: VERDICT_STYLE[result.verdict].text }}>
              <span>{getTranslation(lang, 'tool_qpcr_slope')}: {result.slope.toFixed(3)}</span>
              <span>{getTranslation(lang, 'tool_qpcr_intercept')}: {result.intercept.toFixed(2)}</span>
              <span>R²: {result.r2.toFixed(4)}</span>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <ExportButton filename="qpcr_efficiency.json" data={result} format="json" lang={lang} />
          </div>

          <QpcrStandardCurveChart points={result.fittedPoints} slope={result.slope} intercept={result.intercept} />
        </>
      )}

      <ScientificExplanation
        formula="Ct = intercept + slope x log10(dilution); Efficiency (%) = (10^(-1/slope) - 1) x 100"
        biologicalMeaning="qPCR amplification efficiency describes how well the target sequence doubles each cycle. Running a dilution series and plotting Ct against log10(dilution) gives a straight line whose slope directly reflects that doubling rate - a slope of -3.32 corresponds to perfect doubling (100% efficiency), since 10-fold more template should need log2(10) ≈ 3.32 fewer cycles to reach the same Ct."
        assumptions="Assumes the dilution series spans the assay's truly linear dynamic range and that pipetting/dilution error is small compared to the Ct differences being measured - at least 3-4 points across several orders of magnitude give a much more reliable slope than 2 points ever can."
        limitations="A good R² and a slope near -3.32 show the assay behaves consistently across this dilution range, but neither one proves the assay is specific for the intended target - always confirm specificity separately (e.g. melt curve or gel check) before trusting quantification results."
        lang={lang}
      />
    </div>
  );
};
