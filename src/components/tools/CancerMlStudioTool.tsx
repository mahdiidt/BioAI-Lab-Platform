import React, { useMemo, useRef, useState } from 'react';
import { BrainCircuit, FileUp, Sparkles, RotateCcw, Play, AlertTriangle, Info, ShieldAlert, Loader2, Table2 } from 'lucide-react';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { ExportButton } from '../common/ExportButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import {
  parseDelimitedTable,
  profileColumns,
  suggestColumns,
  buildDataset,
  ML_LIMITS,
  type ParsedTable,
  type ColumnProfile,
  type MlIssue,
  type DuplicateHandling,
} from '../../utils/ml/csvDataset';
import {
  isExperimentError,
  DEFAULT_EXPERIMENT_CONFIG,
  predictionsToCsv,
  featureWeightsToCsv,
  featureStatsToCsv,
  MAX_MODEL_FEATURES,
  type ExperimentConfig,
  type ExperimentResult,
} from '../../utils/ml/pipeline';
import { runExperimentAsync } from '../../utils/ml/runExperimentAsync';
import { generateSyntheticExpressionCsv } from '../../utils/ml/syntheticData';
import type { ClassificationMetrics } from '../../utils/ml/metrics';

interface ToolProps {
  lang: Language;
}

type Translator = (key: string, params?: Record<string, string | number>) => string;

function makeTranslator(lang: Language): Translator {
  return (key, params) => {
    let s = getTranslation(lang, key);
    if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}

const card = 'p-5 bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-700 rounded-2xl shadow-xs space-y-4';
const labelCls = 'text-xs font-bold text-[#12312B] dark:text-slate-100 block mb-1';
const inputCls =
  'w-full p-2 text-xs bg-[#F3FAF7] dark:bg-slate-800 border border-[#DDEDE8] dark:border-slate-700 rounded-xl text-[#12312B] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/30';
const btnSecondary =
  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F3FAF7] dark:bg-slate-800 border border-[#DDEDE8] dark:border-slate-700 text-xs font-bold text-[#0F766E] dark:text-teal-400 hover:bg-white dark:hover:bg-slate-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

const fmt = (v: number | null | undefined, digits = 3) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(digits));

function IssueList({ issues, tr }: { issues: MlIssue[]; tr: Translator }) {
  if (issues.length === 0) return null;
  const order = { error: 0, warning: 1, info: 2 } as const;
  const sorted = issues.slice().sort((a, b) => order[a.severity] - order[b.severity]);
  return (
    <ul className="space-y-1.5" aria-live="polite">
      {sorted.map((iss, idx) => {
        const cls =
          iss.severity === 'error'
            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            : iss.severity === 'warning'
            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300';
        const Icon = iss.severity === 'info' ? Info : AlertTriangle;
        return (
          <li key={`${iss.code}-${idx}`} className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs leading-relaxed ${cls}`}>
            <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              <span className="sr-only">{tr(`ml_severity_${iss.severity}`)}: </span>
              {tr(`ml_issue_${iss.code}`, iss.params)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function RocChart({ result, tr }: { result: ExperimentResult; tr: Translator }) {
  const size = 220;
  const pad = 28;
  const inner = size - pad * 2;
  if (result.roc.length === 0) return <p className="text-xs text-[#64748B]">{tr('ml_roc_unavailable')}</p>;
  const pts = result.roc.map((p) => `${pad + p.fpr * inner},${pad + (1 - p.tpr) * inner}`).join(' ');
  return (
    <figure className="space-y-1" dir="ltr">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[260px]" role="img" aria-label={tr('ml_roc_aria', { auc: fmt(result.test.rocAuc) })}>
        <rect x={pad} y={pad} width={inner} height={inner} fill="none" stroke="#DDEDE8" />
        <line x1={pad} y1={pad + inner} x2={pad + inner} y2={pad} stroke="#94A3B8" strokeDasharray="4 4" />
        <polyline points={pts} fill="none" stroke="#0F766E" strokeWidth={2.5} />
        <text x={size / 2} y={size - 6} textAnchor="middle" fontSize="10" fill="#64748B">
          {tr('ml_roc_fpr')}
        </text>
        <text x={10} y={size / 2} textAnchor="middle" fontSize="10" fill="#64748B" transform={`rotate(-90 10 ${size / 2})`}>
          {tr('ml_roc_tpr')}
        </text>
        <text x={pad + 4} y={pad + 12} fontSize="10" fill="#0F766E" fontWeight="bold">
          AUC {fmt(result.test.rocAuc)}
        </text>
      </svg>
      <figcaption className="text-[11px] text-[#64748B] dark:text-slate-400">{tr('ml_roc_caption')}</figcaption>
    </figure>
  );
}

export const CancerMlStudioTool: React.FC<ToolProps> = ({ lang }) => {
  const tr = useMemo(() => makeTranslator(lang), [lang]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [isSynthetic, setIsSynthetic] = useState(false);
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [profiles, setProfiles] = useState<ColumnProfile[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [labelColumn, setLabelColumn] = useState('');
  const [idColumn, setIdColumn] = useState('');
  const [groupColumn, setGroupColumn] = useState('');
  const [positiveClass, setPositiveClass] = useState('');
  const [featureOverrides, setFeatureOverrides] = useState<Record<string, 'include' | 'exclude'>>({});
  const [extraExclude, setExtraExclude] = useState('');
  const [duplicateHandling, setDuplicateHandling] = useState<DuplicateHandling>('keep');
  const [config, setConfig] = useState<ExperimentConfig>(DEFAULT_EXPERIMENT_CONFIG);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [runError, setRunError] = useState<MlIssue | null>(null);
  const [busy, setBusy] = useState(false);
  const runningRef = useRef<ReturnType<typeof runExperimentAsync> | null>(null);

  const loadText = (text: string, name: string, synthetic: boolean) => {
    const parsed = parseDelimitedTable(text);
    const profs = parsed.issues.some((i) => i.severity === 'error') ? [] : profileColumns(parsed);
    setTable(parsed);
    setProfiles(profs);
    setFileName(name);
    setIsSynthetic(synthetic);
    setResult(null);
    setRunError(null);
    setPositiveClass('');
    setFeatureOverrides({});
    setExtraExclude('');
    setDuplicateHandling('keep');
    if (profs.length > 0) {
      const s = suggestColumns(parsed, profs);
      setLabelColumn(s.labelColumn ?? '');
      setIdColumn(s.idColumn ?? '');
      setGroupColumn(s.groupColumn ?? '');
    } else {
      setLabelColumn('');
      setIdColumn('');
      setGroupColumn('');
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > ML_LIMITS.maxFileBytes) {
      setUploadError(tr('ml_file_too_large', { size: (file.size / 1024 / 1024).toFixed(1), max: ML_LIMITS.maxFileBytes / 1024 / 1024 }));
      return;
    }
    if (!/\.(csv|tsv|txt)$/i.test(file.name)) {
      setUploadError(tr('ml_file_type'));
      return;
    }
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (ev) => loadText(String(ev.target?.result ?? ''), file.name, false);
    reader.onerror = () => setUploadError(tr('ml_file_read_error'));
    reader.readAsText(file);
  };

  const reset = () => {
    setTable(null);
    setProfiles([]);
    setFileName(null);
    setIsSynthetic(false);
    setUploadError(null);
    setLabelColumn('');
    setIdColumn('');
    setGroupColumn('');
    setPositiveClass('');
    setFeatureOverrides({});
    setExtraExclude('');
    setDuplicateHandling('keep');
    setConfig(DEFAULT_EXPERIMENT_CONFIG);
    setResult(null);
    setRunError(null);
  };

  // Explicit panel toggles win over the free-text exclusion list.
  const effectiveOverrides = useMemo(() => {
    const o: Record<string, 'include' | 'exclude'> = {};
    for (const name of extraExclude.split(/[\n,]/).map((x) => x.trim()).filter(Boolean)) o[name] = 'exclude';
    return { ...o, ...featureOverrides };
  }, [extraExclude, featureOverrides]);

  const built = useMemo(() => {
    if (!table || profiles.length === 0 || !labelColumn) return null;
    return buildDataset(table, profiles, {
      labelColumn,
      idColumn: idColumn || null,
      groupColumn: groupColumn || null,
      positiveClass: positiveClass || undefined,
      featureOverrides: effectiveOverrides,
      duplicateHandling,
    });
  }, [table, profiles, labelColumn, idColumn, groupColumn, positiveClass, effectiveOverrides, duplicateHandling]);

  const dataset = built?.dataset ?? null;
  const tableIssues = table?.issues ?? [];
  const datasetIssues = built?.issues ?? [];
  const allIssues = [...tableIssues, ...datasetIssues];

  const featureReview = built?.featureReview ?? [];
  const duplicateRowCount = (dataset?.qc?.duplicateRows ?? 0) + (dataset?.qc?.duplicatesRemoved ?? 0);

  const updateConfig = (patch: Partial<ExperimentConfig>) => {
    setConfig((c) => ({ ...c, ...patch }));
    setResult(null);
    setRunError(null);
  };
  const updatePre = (patch: Partial<ExperimentConfig['preprocess']>) => updateConfig({ preprocess: { ...config.preprocess, ...patch } });

  const train = () => {
    if (!dataset || busy) return;
    setBusy(true);
    setRunError(null);
    setResult(null);
    // Group-aware evaluation needs a group column; never run it silently without one.
    const runConfig = config.groupAware && !dataset.groups ? { ...config, groupAware: false } : config;
    const running = runExperimentAsync(dataset, runConfig);
    runningRef.current = running;
    running.promise
      .then((r) => {
        if (isExperimentError(r)) setRunError(r.error);
        else setResult(r);
      })
      .catch((err: unknown) => {
        if (!(err instanceof Error && err.name === 'AbortError')) setRunError({ severity: 'error', code: 'unexpected_failure' });
      })
      .finally(() => {
        runningRef.current = null;
        setBusy(false);
      });
  };

  React.useEffect(() => () => runningRef.current?.cancel(), []);

  const report = useMemo(() => {
    if (!result || !dataset) return null;
    return {
      tool: 'BioAI.Lab Cancer ML Studio',
      purpose: 'Research classification of samples into two labelled groups. Not a diagnosis and not an estimate of future cancer risk.',
      generatedAt: new Date().toISOString(),
      dataSource: isSynthetic ? 'SYNTHETIC educational example (not real data)' : `User-supplied file: ${fileName}`,
      dataset: {
        samples: dataset.y.length,
        features: dataset.featureNames.length,
        classes: { negative: dataset.classes[0], positive: dataset.classes[1] },
        classCounts: dataset.classCounts,
        missingValues: dataset.missingValueCount,
        excludedColumns: dataset.excludedColumns,
        qualityControl: dataset.qc,
        groupColumn: dataset.groupColumn,
        fingerprint: dataset.fingerprint,
      },
      ...result,
      roc: result.roc.map((p) => ({ fpr: p.fpr, tpr: p.tpr, threshold: Number.isFinite(p.threshold) ? p.threshold : null })),
    };
  }, [result, dataset, isSynthetic, fileName]);

  const metricRows: { key: string; pick: (m: ClassificationMetrics) => number | null }[] = [
    { key: 'ml_metric_accuracy', pick: (m) => m.accuracy },
    { key: 'ml_metric_balanced_accuracy', pick: (m) => m.balancedAccuracy },
    { key: 'ml_metric_precision', pick: (m) => m.precision },
    { key: 'ml_metric_recall', pick: (m) => m.recall },
    { key: 'ml_metric_specificity', pick: (m) => m.specificity },
    { key: 'ml_metric_f1', pick: (m) => m.f1 },
    { key: 'ml_metric_auc', pick: (m) => m.rocAuc },
  ];
  const cvFor = (key: string) => {
    if (!result?.cv) return '—';
    const c = key === 'ml_metric_accuracy' ? result.cv.accuracy : key === 'ml_metric_balanced_accuracy' ? result.cv.balancedAccuracy : key === 'ml_metric_auc' ? result.cv.rocAuc : null;
    return c ? `${c.mean.toFixed(3)} ± ${c.sd.toFixed(3)}` : '—';
  };

  const previewCols = table ? table.header.slice(0, 8) : [];
  const previewRows = table ? table.rows.slice(0, 6) : [];

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      {/* Scope disclaimer */}
      <div className="p-4 rounded-2xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 text-sky-900 dark:text-sky-100 flex items-start gap-3" role="note">
        <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-sky-600" aria-hidden="true" />
        <div className="space-y-1 text-xs leading-relaxed">
          <p className="font-bold">{tr('ml_disclaimer_title')}</p>
          <p>{tr('ml_disclaimer_body')}</p>
        </div>
      </div>

      {/* 1. DATA */}
      <section className={card} aria-labelledby="ml-data-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 id="ml-data-heading" className="font-bold text-sm text-[#12312B] dark:text-slate-100 flex items-center gap-2">
            <Table2 className="w-4 h-4 text-[#0F766E] dark:text-teal-400" aria-hidden="true" />
            {tr('ml_step_data')}
          </h4>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btnSecondary} onClick={() => fileRef.current?.click()}>
              <FileUp className="w-3.5 h-3.5" aria-hidden="true" /> {tr('ml_upload_csv')}
            </button>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" onChange={handleUpload} className="hidden" aria-label={tr('ml_upload_csv')} />
            <button type="button" className={btnSecondary} onClick={() => loadText(generateSyntheticExpressionCsv(), 'synthetic_example.csv', true)}>
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> {tr('ml_load_synthetic')}
            </button>
            <button type="button" className={btnSecondary} onClick={reset} disabled={!table && !uploadError}>
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> {tr('ml_reset')}
            </button>
          </div>
        </div>

        <details className="rounded-xl border border-[#DDEDE8] dark:border-slate-700 bg-[#F3FAF7] dark:bg-slate-800 p-3 text-xs text-[#12312B] dark:text-slate-200">
          <summary className="font-bold cursor-pointer">{tr('ml_format_title')}</summary>
          <div className="mt-2 space-y-2 leading-relaxed">
            <p>{tr('ml_format_body')}</p>
            <pre className="sequence-mono-ltr p-2 rounded-lg bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-700 overflow-x-auto font-mono text-[11px]" dir="ltr">
{`sample_id,condition,batch,GENE_A,GENE_B,GENE_C
S001,tumor,B1,12.4,0.85,301.2
S002,control,B2,8.1,NA,280.9`}
            </pre>
            <p>{tr('ml_format_rules', { maxMb: ML_LIMITS.maxFileBytes / 1024 / 1024, maxSamples: ML_LIMITS.maxSamples, minPerClass: ML_LIMITS.minSamplesPerClass })}</p>
            <p className="font-semibold">{tr('ml_privacy_local')}</p>
          </div>
        </details>

        {uploadError && (
          <p className="flex items-center gap-1.5 text-xs text-rose-600 font-medium" role="alert">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> {uploadError}
          </p>
        )}

        {isSynthetic && (
          <div className="p-3 rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30 text-xs font-bold text-violet-900 dark:text-violet-200" role="note">
            {tr('ml_synthetic_banner')}
          </div>
        )}

        {table && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-[11px] font-mono">
              <span className="px-2 py-1 rounded-lg bg-[#ECFDF5] dark:bg-slate-800 text-[#0F766E] dark:text-teal-300">{fileName}</span>
              <span className="px-2 py-1 rounded-lg bg-[#ECFDF5] dark:bg-slate-800 text-[#0F766E] dark:text-teal-300">{tr('ml_rows_count', { n: table.rows.length })}</span>
              <span className="px-2 py-1 rounded-lg bg-[#ECFDF5] dark:bg-slate-800 text-[#0F766E] dark:text-teal-300">{tr('ml_cols_count', { n: table.header.length })}</span>
              {dataset && (
                <>
                  <span className="px-2 py-1 rounded-lg bg-[#ECFDF5] dark:bg-slate-800 text-[#0F766E] dark:text-teal-300">{tr('ml_features_count', { n: dataset.featureNames.length })}</span>
                  <span className="px-2 py-1 rounded-lg bg-[#ECFDF5] dark:bg-slate-800 text-[#0F766E] dark:text-teal-300" dir="ltr">
                    {dataset.classes[1]}: {dataset.classCounts[1]} · {dataset.classes[0]}: {dataset.classCounts[0]}
                  </span>
                </>
              )}
            </div>

            {previewCols.length > 0 && (
              <div className="overflow-x-auto border border-[#DDEDE8] dark:border-slate-700 rounded-xl" dir="ltr">
                <table className="w-full text-[11px] font-mono text-left">
                  <caption className="sr-only">{tr('ml_preview_caption')}</caption>
                  <thead className="bg-[#ECFDF5] dark:bg-slate-800 text-[#12312B] dark:text-slate-100">
                    <tr>
                      {previewCols.map((h, i) => (
                        <th key={i} scope="col" className="p-2 font-bold whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                      {table.header.length > previewCols.length && <th className="p-2">…</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDEDE8] dark:divide-slate-700 text-[#334155] dark:text-slate-300">
                    {previewRows.map((r, ri) => (
                      <tr key={ri}>
                        {previewCols.map((_, ci) => (
                          <td key={ci} className="p-2 whitespace-nowrap">
                            {r[ci]}
                          </td>
                        ))}
                        {table.header.length > previewCols.length && <td className="p-2">…</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <IssueList issues={allIssues} tr={tr} />
            {dataset?.qc && <details className="text-xs"><summary className="font-bold cursor-pointer text-[#12312B] dark:text-slate-100">{tr('ml_qc_details')}</summary><div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono"><span className="p-2 rounded-lg bg-[#F3FAF7] dark:bg-slate-800">{tr('ml_missing_cells')}: {dataset.qc.missingCells} ({(dataset.qc.missingFraction * 100).toFixed(2)}%)</span><span className="p-2 rounded-lg bg-[#F3FAF7] dark:bg-slate-800">{tr('ml_invalid_cells')}: {dataset.qc.invalidCells}</span><span className="p-2 rounded-lg bg-[#F3FAF7] dark:bg-slate-800">{tr('ml_duplicate_rows')}: {dataset.qc.duplicateRows}</span><span className="p-2 rounded-lg bg-[#F3FAF7] dark:bg-slate-800">{tr('ml_memory_estimate')}: {(dataset.qc.estimatedMatrixBytes / 1024 / 1024).toFixed(1)} MB</span></div>{dataset.qc.topMissingFeatures.length > 0 && <p className="mt-2 text-[11px] text-[#64748B] dark:text-slate-400">{tr('ml_top_missing')}: {dataset.qc.topMissingFeatures.slice(0, 5).map((x) => `${x.name} ${(x.fraction * 100).toFixed(1)}%`).join(' · ')}</p>}</details>}
          </div>
        )}
      </section>

      {/* 2. CONFIGURE */}
      {table && profiles.length > 0 && (
        <section className={card} aria-labelledby="ml-config-heading">
          <h4 id="ml-config-heading" className="font-bold text-sm text-[#12312B] dark:text-slate-100 flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-[#0F766E] dark:text-teal-400" aria-hidden="true" />
            {tr('ml_step_configure')}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="ml-label" className={labelCls}>{tr('ml_label_column')}</label>
              <select id="ml-label" className={inputCls} value={labelColumn} onChange={(e) => { setLabelColumn(e.target.value); setPositiveClass(''); setResult(null); if (e.target.value === groupColumn) setGroupColumn(''); }}>
                <option value="">{tr('ml_choose')}</option>
                {profiles.filter((p) => !p.isNumeric || (!p.distinctCapped && p.distinctValues.length <= 10)).map((p) => (
                  <option key={p.index} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ml-id" className={labelCls}>{tr('ml_id_column')}</label>
              <select id="ml-id" className={inputCls} value={idColumn} onChange={(e) => { setIdColumn(e.target.value); setResult(null); }}>
                <option value="">{tr('ml_no_id_column')}</option>
                {profiles.filter((p) => p.name !== labelColumn && p.name !== groupColumn).map((p) => (
                  <option key={p.index} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ml-group" className={labelCls}>{tr('ml_group_column')}</label>
              <select
                id="ml-group"
                className={inputCls}
                value={groupColumn}
                aria-describedby="ml-group-help"
                onChange={(e) => {
                  const v = e.target.value;
                  setGroupColumn(v);
                  setResult(null);
                  setRunError(null);
                  if (!v) setConfig((c) => ({ ...c, groupAware: false }));
                }}
              >
                <option value="">{tr('ml_no_group_column')}</option>
                {profiles.filter((p) => p.name !== labelColumn).map((p) => (
                  <option key={p.index} value={p.name}>{tr('ml_group_option_count', { name: p.name, count: p.distinctCapped ? '50+' : p.distinctValues.length })}</option>
                ))}
              </select>
              <p id="ml-group-help" className="text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed mt-1">{tr('ml_group_help')}</p>
            </div>
            <div>
              <label htmlFor="ml-pos" className={labelCls}>{tr('ml_positive_class')}</label>
              <select id="ml-pos" className={inputCls} value={positiveClass || dataset?.classes[1] || ''} onChange={(e) => { setPositiveClass(e.target.value); setResult(null); }} disabled={!built || built.labelValues.length !== 2}>
                {(built?.labelValues ?? []).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ml-model" className={labelCls}>{tr('ml_model')}</label>
              <select id="ml-model" className={inputCls} value={config.model} onChange={(e) => updateConfig({ model: e.target.value as ExperimentConfig['model'] })}>
                <option value="logistic_regression">{tr('ml_model_logreg')}</option>
                <option value="gaussian_nb">{tr('ml_model_gnb')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="ml-test" className={labelCls}>{tr('ml_test_fraction')}</label>
              <select id="ml-test" className={inputCls} value={config.testFraction} onChange={(e) => updateConfig({ testFraction: Number(e.target.value) })}>
                {[0.2, 0.25, 0.3, 0.4].map((f) => (
                  <option key={f} value={f}>{Math.round(f * 100)}%</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ml-seed" className={labelCls}>{tr('ml_seed')}</label>
              <input id="ml-seed" type="number" className={inputCls} value={config.seed} min={0} step={1} onChange={(e) => updateConfig({ seed: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
            </div>
            <div>
              <label htmlFor="ml-topk" className={labelCls}>{tr('ml_top_k', { max: MAX_MODEL_FEATURES })}</label>
              <input id="ml-topk" type="number" className={inputCls} value={config.preprocess.topK} min={0} max={MAX_MODEL_FEATURES} step={1} onChange={(e) => updatePre({ topK: Math.min(MAX_MODEL_FEATURES, Math.max(0, Math.floor(Number(e.target.value) || 0))) })} />
            </div>
            <div>
              <label htmlFor="ml-cv" className={labelCls}>{tr('ml_cv_folds')}</label>
              <select id="ml-cv" className={inputCls} value={config.cvFolds} onChange={(e) => updateConfig({ cvFolds: Number(e.target.value) })}>
                <option value={0}>{tr('ml_cv_off')}</option>
                <option value={3}>3</option>
                <option value={5}>5</option>
              </select>
            </div>
            {config.model === 'logistic_regression' && (
              <div>
                <label htmlFor="ml-lambda" className={labelCls}>{tr('ml_l2')}</label>
                <select id="ml-lambda" className={inputCls} value={config.lambda} onChange={(e) => updateConfig({ lambda: Number(e.target.value) })}>
                  {[0.01, 0.1, 1, 10, 100].map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-[#12312B] dark:text-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={config.preprocess.log2Transform} onChange={(e) => updatePre({ log2Transform: e.target.checked })} />
              {tr('ml_log2')}
            </label>
            {config.model === 'logistic_regression' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={config.classWeight === 'balanced'} onChange={(e) => updateConfig({ classWeight: e.target.checked ? 'balanced' : 'none' })} />
                {tr('ml_balanced')}
              </label>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={config.groupAware === true && !!dataset?.groups} disabled={!dataset?.groups} onChange={(e) => updateConfig({ groupAware: e.target.checked })} />
              {tr('ml_group_aware')}
            </label>
          </div>
          {dataset?.groups && <p className="text-[11px] text-[#64748B] dark:text-slate-400">{tr('ml_group_note', { column: dataset.groupColumn ?? '', groups: dataset.qc?.groupSummary?.groups ?? 0 })}</p>}
          {built && (
            <div className="space-y-2" role="group" aria-labelledby="ml-review-heading">
              <h5 id="ml-review-heading" className="text-xs font-bold text-[#12312B] dark:text-slate-100">{tr('ml_features_review_title')}</h5>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed">{tr('ml_features_review_note')}</p>
              {featureReview.length > 0 && (
                <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                  {featureReview.slice(0, 50).map((item) => (
                    <li key={item.name} className="p-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-xs">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.used}
                          aria-label={`${tr('ml_feature_use')}: ${item.name}`}
                          onChange={(e) => {
                            setFeatureOverrides((o) => ({ ...o, [item.name]: e.target.checked ? 'include' : 'exclude' }));
                            setResult(null);
                          }}
                        />
                        <span>
                          <b dir="ltr" className="font-mono">{item.name}</b> — {item.flags.map((f) => tr(`ml_flag_${f}`)).join('; ')} · {tr(item.defaultExcluded ? 'ml_feature_default_off' : 'ml_feature_default_on')}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <div>
                <label htmlFor="ml-exclude-extra" className={labelCls}>{tr('ml_exclude_extra')}</label>
                <input id="ml-exclude-extra" type="text" dir="ltr" className={inputCls} value={extraExclude} onChange={(e) => { setExtraExclude(e.target.value); setResult(null); }} />
              </div>
            </div>
          )}
          {(duplicateRowCount > 0 || duplicateHandling !== 'keep') && (
            <fieldset className="space-y-1 text-xs">
              <legend className="font-bold text-[#12312B] dark:text-slate-100">{tr('ml_duplicates_title')}</legend>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed">{tr('ml_duplicates_help', { count: duplicateRowCount })}</p>
              {(['keep', 'group', 'remove'] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="ml-dup" value={mode} checked={duplicateHandling === mode} onChange={() => { setDuplicateHandling(mode); setResult(null); }} />
                  {tr(`ml_duplicates_${mode}`)}
                </label>
              ))}
            </fieldset>
          )}
          <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed">{tr('ml_leakage_note')}</p>
          <button
            type="button"
            onClick={train}
            disabled={!dataset || busy}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F766E] text-white text-xs font-bold shadow-xs hover:bg-[#115E59] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Play className="w-4 h-4" aria-hidden="true" />}
            {busy ? tr('ml_training') : tr('ml_train')}
          </button>
          {runError && <IssueList issues={[runError]} tr={tr} />}
        </section>
      )}

      {/* 3. RESULTS */}
      {result && dataset && (
        <section className={card} aria-labelledby="ml-results-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 id="ml-results-heading" className="font-bold text-sm text-[#12312B] dark:text-slate-100">{tr('ml_step_results')}</h4>
            <div className="flex flex-wrap items-center gap-2">
              {report && <ExportButton filename="cancer_ml_report.json" data={report} format="json" lang={lang} />}
              <ExportButton filename="cancer_ml_test_predictions.csv" data={predictionsToCsv(result)} format="csv" lang={lang} />
              {result.featureWeights && <ExportButton filename="cancer_ml_feature_weights.csv" data={featureWeightsToCsv(result)} format="csv" lang={lang} />}
              <ExportButton filename="cancer_ml_feature_statistics.csv" data={featureStatsToCsv(result)} format="csv" lang={lang} />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-100 leading-relaxed" role="note">
            {tr('ml_score_meaning', { positive: dataset.classes[1] })}
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] font-mono" dir="ltr">
            <span className="px-2 py-1 rounded-lg bg-[#F3FAF7] dark:bg-slate-800">train n={result.nTrain} ({result.trainClassCounts[1]}/{result.trainClassCounts[0]})</span>
            <span className="px-2 py-1 rounded-lg bg-[#F3FAF7] dark:bg-slate-800">test n={result.nTest} ({result.testClassCounts[1]}/{result.testClassCounts[0]})</span>
            <span className="px-2 py-1 rounded-lg bg-[#F3FAF7] dark:bg-slate-800">features {result.featuresUsed}/{result.featuresAvailable}</span>
            <span className="px-2 py-1 rounded-lg bg-[#F3FAF7] dark:bg-slate-800">seed {result.config.seed}</span>
            <span className="px-2 py-1 rounded-lg bg-[#F3FAF7] dark:bg-slate-800">{result.runtimeMs} ms</span>
          </div>

          <div className="overflow-x-auto border border-[#DDEDE8] dark:border-slate-700 rounded-xl">
            <table className="w-full text-xs">
              <caption className="sr-only">{tr('ml_metrics_caption')}</caption>
              <thead className="bg-[#ECFDF5] dark:bg-slate-800 text-[#12312B] dark:text-slate-100">
                <tr>
                  <th scope="col" className="p-2.5 text-start font-bold">{tr('ml_metric')}</th>
                  <th scope="col" className="p-2.5 text-start font-bold">{tr('ml_col_test')}</th>
                  <th scope="col" className="p-2.5 text-start font-bold">{tr('ml_col_train')}</th>
                  <th scope="col" className="p-2.5 text-start font-bold">{tr('ml_col_cv')}</th>
                  <th scope="col" className="p-2.5 text-start font-bold">{tr('ml_col_majority')}</th>
                  <th scope="col" className="p-2.5 text-start font-bold">{tr('ml_col_shuffled')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDEDE8] dark:divide-slate-700 font-mono">
                {metricRows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row" className="p-2.5 text-start font-sans font-semibold text-[#12312B] dark:text-slate-100">{tr(row.key)}</th>
                    <td className="p-2.5 font-bold text-[#0F766E] dark:text-teal-400" dir="ltr">{fmt(row.pick(result.test))}</td>
                    <td className="p-2.5" dir="ltr">{fmt(row.pick(result.train))}</td>
                    <td className="p-2.5" dir="ltr">{cvFor(row.key)}</td>
                    <td className="p-2.5" dir="ltr">{fmt(row.pick(result.baselines.majority))}</td>
                    <td className="p-2.5" dir="ltr">{result.baselines.shuffledLabels ? fmt(row.pick(result.baselines.shuffledLabels)) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-[#64748B] dark:text-slate-400">{tr('ml_metrics_note', { majority: result.baselines.majority.predictedClass, folds: result.cv?.folds ?? 0 })}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-[#12312B] dark:text-slate-100">{tr('ml_confusion_title')}</h5>
              <table className="text-xs border border-[#DDEDE8] dark:border-slate-700 rounded-xl overflow-hidden">
                <thead className="bg-[#ECFDF5] dark:bg-slate-800">
                  <tr>
                    <th className="p-2" />
                    <th scope="col" className="p-2 font-bold">{tr('ml_pred')} {dataset.classes[1]}</th>
                    <th scope="col" className="p-2 font-bold">{tr('ml_pred')} {dataset.classes[0]}</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-center">
                  <tr>
                    <th scope="row" className="p-2 font-sans font-bold bg-[#ECFDF5] dark:bg-slate-800">{tr('ml_true')} {dataset.classes[1]}</th>
                    <td className="p-3 bg-emerald-50 dark:bg-emerald-950/30 font-bold">{result.test.confusion.tp}</td>
                    <td className="p-3 bg-rose-50 dark:bg-rose-950/30">{result.test.confusion.fn}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="p-2 font-sans font-bold bg-[#ECFDF5] dark:bg-slate-800">{tr('ml_true')} {dataset.classes[0]}</th>
                    <td className="p-3 bg-rose-50 dark:bg-rose-950/30">{result.test.confusion.fp}</td>
                    <td className="p-3 bg-emerald-50 dark:bg-emerald-950/30 font-bold">{result.test.confusion.tn}</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">{tr('ml_threshold_note', { t: result.config.threshold })}</p>
            </div>
            <RocChart result={result} tr={tr} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#F3FAF7] dark:bg-slate-800"><b>{tr('ml_eval_mode')}</b><br />{result.evaluation.mode === 'group' ? tr('ml_group_aware') : tr('ml_row_split')} {result.evaluation.groupColumn ? `(${result.evaluation.groupColumn})` : ''}</div>
            <div className="p-3 rounded-xl bg-[#F3FAF7] dark:bg-slate-800"><b>{tr('ml_permutation_control')}</b><br />{result.baselines.permutation.mode === 'unavailable' ? tr('ml_permutation_unavailable') : <>{result.baselines.permutation.n} {tr('ml_permutations')} {result.baselines.permutation.pValue === null ? '·' : `· p=${result.baselines.permutation.pValue.toFixed(3)}`}</>}{result.baselines.permutation.mode === 'group' && <span className="block text-[11px] mt-1">{tr('ml_permutation_group_note', { groups: result.baselines.permutation.permutableGroups ?? 0 })}</span>}</div>
            <div className="p-3 rounded-xl bg-[#F3FAF7] dark:bg-slate-800"><b>{tr('ml_fingerprint')}</b><br /><span dir="ltr" className="font-mono">{result.datasetFingerprint ?? '—'}</span></div>
          </div>
          {result.featureStats.length > 0 && <details className="text-xs"><summary className="font-bold cursor-pointer">{tr('ml_stats_title')}</summary><p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-2">{tr('ml_stats_note')}</p>{result.featureStatsInference === 'unavailable_repeated_groups' && <p className="text-[11px] text-amber-800 dark:text-amber-200 mt-1">{tr('ml_stats_unavailable_group')}</p>}{result.featureStatsInference === 'rows_with_ignored_groups' && <p className="text-[11px] text-amber-800 dark:text-amber-200 mt-1">{tr('ml_stats_ignored_groups')}</p>}<div className="overflow-x-auto max-h-64 mt-2 border border-[#DDEDE8] dark:border-slate-700 rounded-xl"><table className="w-full text-xs"><thead className="bg-[#ECFDF5] dark:bg-slate-800 sticky top-0"><tr><th className="p-2 text-start">{tr('ml_feature')}</th><th className="p-2 text-start">Δ</th><th className="p-2 text-start">p</th><th className="p-2 text-start">q</th><th className="p-2 text-start">g</th></tr></thead><tbody className="font-mono">{result.featureStats.slice(0, 20).map((f) => <tr key={f.feature}><td className="p-2" dir="ltr">{f.feature}</td><td className="p-2" dir="ltr">{f.difference.toFixed(3)}</td><td className="p-2" dir="ltr">{f.pValue === null ? '—' : f.pValue.toExponential(2)}</td><td className="p-2" dir="ltr">{f.qValue === null ? '—' : f.qValue.toExponential(2)}</td><td className="p-2" dir="ltr">{f.hedgesG === null ? '—' : f.hedgesG.toFixed(3)}</td></tr>)}</tbody></table></div></details>}
          {result.heatmap && <details className="text-xs"><summary className="font-bold cursor-pointer">{tr('ml_heatmap_title')}</summary><p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-2">{tr('ml_heatmap_note')}</p><div className="overflow-x-auto mt-2" dir="ltr"><table className="text-[9px] font-mono"><tbody>{result.heatmap.values.map((row, ri) => <tr key={ri}><th className="p-1 text-end whitespace-nowrap">{result.heatmap!.features[ri]}</th>{row.map((v, ci) => <td key={ci} title={`${result.heatmap!.sampleIds[ci]}: ${v}`} className="p-1 text-center" style={{ backgroundColor: v >= 0 ? `rgba(15,118,110,${Math.min(.9, Math.abs(v)/3)})` : `rgba(225,29,72,${Math.min(.9, Math.abs(v)/3)})`, color: Math.abs(v) > 1.5 ? 'white' : 'inherit' }}>{v.toFixed(1)}</td>)}</tr>)}</tbody></table></div></details>}
          <IssueList issues={result.warnings} tr={tr} />
          <IssueList issues={[{ severity: 'info', code: 'always_batch_effects' }]} tr={tr} />

          <div className="space-y-2">
            <h5 className="text-xs font-bold text-[#12312B] dark:text-slate-100">{tr('ml_importance_title')}</h5>
            {result.featureWeights ? (
              <>
                <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed">{tr('ml_importance_note')}</p>
                <div className="overflow-x-auto max-h-72 border border-[#DDEDE8] dark:border-slate-700 rounded-xl">
                  <table className="w-full text-xs">
                    <thead className="bg-[#ECFDF5] dark:bg-slate-800 sticky top-0">
                      <tr>
                        <th scope="col" className="p-2 text-start">#</th>
                        <th scope="col" className="p-2 text-start">{tr('ml_feature')}</th>
                        <th scope="col" className="p-2 text-start">{tr('ml_coefficient')}</th>
                        <th scope="col" className="p-2 text-start">|t|</th>
                        <th scope="col" className="p-2 text-start">{tr('ml_higher_in')}</th>
                        <th scope="col" className="p-2 text-start">{tr('ml_selection_stability')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DDEDE8] dark:divide-slate-700 font-mono">
                      {result.featureWeights.slice(0, 25).map((f, i) => (
                        <tr key={f.feature}>
                          <td className="p-2">{i + 1}</td>
                          <td className="p-2" dir="ltr">{f.feature}</td>
                          <td className="p-2" dir="ltr">{f.coefficient.toFixed(4)}</td>
                          <td className="p-2" dir="ltr">{f.trainTStat === null ? '—' : f.trainTStat.toFixed(2)}</td>
                          <td className="p-2">{f.direction === 'positive_class' ? dataset.classes[1] : dataset.classes[0]}</td>
                          <td className="p-2" dir="ltr">{f.cvSelectionFrequency === null ? '—' : `${Math.round(f.cvSelectionFrequency * 100)}%`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-xs text-[#64748B] dark:text-slate-400">{tr('ml_importance_unsupported')}</p>
            )}
          </div>

          <details className="text-xs">
            <summary className="font-bold cursor-pointer text-[#12312B] dark:text-slate-100">{tr('ml_predictions_title', { n: result.predictions.length })}</summary>
            <div className="overflow-x-auto max-h-72 mt-2 border border-[#DDEDE8] dark:border-slate-700 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-[#ECFDF5] dark:bg-slate-800 sticky top-0">
                  <tr>
                    <th scope="col" className="p-2 text-start">{tr('ml_sample')}</th>
                    <th scope="col" className="p-2 text-start">{tr('ml_true')}</th>
                    <th scope="col" className="p-2 text-start">{tr('ml_pred')}</th>
                    <th scope="col" className="p-2 text-start">{tr('ml_model_score')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDEDE8] dark:divide-slate-700 font-mono">
                  {result.predictions.map((p) => (
                    <tr key={p.sampleId} className={p.trueLabel !== p.predictedLabel ? 'bg-rose-50/60 dark:bg-rose-950/20' : ''}>
                      <td className="p-2" dir="ltr">{p.sampleId}</td>
                      <td className="p-2">{p.trueLabel}</td>
                      <td className="p-2">{p.predictedLabel}</td>
                      <td className="p-2" dir="ltr">{p.score.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}

      <ScientificExplanation
        formula={tr('ml_expl_formula')}
        biologicalMeaning={tr('ml_expl_meaning')}
        assumptions={tr('ml_expl_assumptions')}
        limitations={tr('ml_expl_limitations')}
        lang={lang}
      />
    </div>
  );
};
