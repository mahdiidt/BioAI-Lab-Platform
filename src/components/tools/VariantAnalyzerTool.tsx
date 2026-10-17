import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ScanSearch, FileUp, Sparkles, RotateCcw, AlertTriangle, Info, ShieldAlert, Repeat, Database, Loader2, ExternalLink, XCircle } from 'lucide-react';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { SequenceInput } from '../common/SequenceInput';
import { ExportButton } from '../common/ExportButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { reverseComplement } from '../../utils/dna';
import { compareSequences, variantsToVcf, type ComparisonIssue } from '../../utils/variants/sequenceVariants';
import { parseVcf, looksGzipped, normalizeChromName, DEMO_VCF, VCF_LIMITS, type VcfParseResult, type GenomeBuild, type VcfIssue } from '../../utils/variants/vcfParser';
import { lookupClinVar, buildClinVarTerm, CLINVAR_MAX_BATCH, type ClinVarLookupResult, type ClinVarQuery, type NormalizedClass } from '../../utils/variants/clinvar';

interface ToolProps {
  lang: Language;
}

type Translator = (key: string, params?: Record<string, string | number>) => string;
type Tab = 'sequence' | 'vcf';

function makeTranslator(lang: Language): Translator {
  return (key, params) => {
    let s = getTranslation(lang, key);
    if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}

// SYNTHETIC toy coding sequence (not a real gene) used for the demo.
const DEMO_REF = 'ATGGCTGAAAAACTGTGGGAACGTTCTGGCATCCAGTTCGATAAATAA';
const DEMO_SAMPLE = 'ATGGCTGTAAAACTGTGGGAACGTTCCGGCATCTTCGATAAATAA';

const card = 'p-5 bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-700 rounded-2xl shadow-xs space-y-4';
const btnSecondary =
  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F3FAF7] dark:bg-slate-800 border border-[#DDEDE8] dark:border-slate-700 text-xs font-bold text-[#0F766E] dark:text-teal-400 hover:bg-white dark:hover:bg-slate-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const inputCls =
  'p-2 text-xs bg-[#F3FAF7] dark:bg-slate-800 border border-[#DDEDE8] dark:border-slate-700 rounded-xl text-[#12312B] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/30';

function Issues({ issues, tr }: { issues: (ComparisonIssue | VcfIssue)[]; tr: Translator }) {
  if (issues.length === 0) return null;
  const order = { error: 0, warning: 1, info: 2 } as const;
  return (
    <ul className="space-y-1.5" aria-live="polite">
      {issues
        .slice()
        .sort((a, b) => order[a.severity] - order[b.severity])
        .map((iss, idx) => {
          const cls =
            iss.severity === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              : iss.severity === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300';
          const Icon = iss.severity === 'info' ? Info : AlertTriangle;
          const params = iss.params ? { ...iss.params, which: iss.params.which ? tr(`var_which_${iss.params.which}`) : '' } : undefined;
          return (
            <li key={`${iss.code}-${idx}`} className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs leading-relaxed ${cls}`}>
              <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{tr(`var_issue_${iss.code}`, params)}</span>
            </li>
          );
        })}
    </ul>
  );
}

const CLASS_STYLE: Record<NormalizedClass, string> = {
  pathogenic: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-800',
  likely_pathogenic: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/50 dark:text-orange-200 dark:border-orange-800',
  pathogenic_likely_pathogenic: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-800',
  uncertain_significance: 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800',
  likely_benign: 'bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950/40 dark:text-teal-200 dark:border-teal-800',
  benign: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800',
  benign_likely_benign: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800',
  conflicting: 'bg-violet-50 text-violet-800 border-violet-300 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-800',
  not_provided: 'bg-slate-50 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
  other: 'bg-slate-50 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
};

const LOOKUP_TYPES = new Set(['SNV', 'MNV', 'insertion', 'deletion', 'delins']);

function AlignmentView({ a, b, tr }: { a: string; b: string; tr: Translator }) {
  const maxCols = 3000;
  const width = 60;
  const shownA = a.slice(0, maxCols);
  const shownB = b.slice(0, maxCols);
  const blocks: { start: number; ra: string; rb: string }[] = [];
  for (let i = 0; i < shownA.length; i += width) blocks.push({ start: i, ra: shownA.slice(i, i + width), rb: shownB.slice(i, i + width) });
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto p-3 rounded-xl bg-[#F3FAF7] dark:bg-slate-800 border border-[#DDEDE8] dark:border-slate-700 font-mono text-[11px] leading-5 sequence-mono-ltr" dir="ltr" aria-label={tr('var_alignment_title')}>
        {blocks.map((blk) => (
          <div key={blk.start} className="mb-2 whitespace-pre">
            <div>
              <span className="inline-block w-12 text-[#64748B] select-none">REF</span>
              {blk.ra.split('').map((c, i) => (
                <span key={i} className={c !== blk.rb[i] ? 'bg-amber-200 dark:bg-amber-700/60 text-[#12312B] dark:text-white font-bold' : ''}>{c}</span>
              ))}
            </div>
            <div>
              <span className="inline-block w-12 text-[#64748B] select-none">ALT</span>
              {blk.rb.split('').map((c, i) => (
                <span key={i} className={c !== blk.ra[i] ? 'bg-amber-200 dark:bg-amber-700/60 text-[#12312B] dark:text-white font-bold' : ''}>{c}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {a.length > maxCols && <p className="text-[11px] text-[#64748B]">{tr('var_alignment_truncated', { n: maxCols })}</p>}
    </div>
  );
}

export const VariantAnalyzerTool: React.FC<ToolProps> = ({ lang }) => {
  const tr = useMemo(() => makeTranslator(lang), [lang]);
  const [tab, setTab] = useState<Tab>('sequence');

  // ---- Sequence comparison state
  const [refSeq, setRefSeq] = useState(DEMO_REF);
  const [sampleSeq, setSampleSeq] = useState(DEMO_SAMPLE);
  const [isCoding, setIsCoding] = useState(true);
  const [cdsStart, setCdsStart] = useState(1);
  const [rcError, setRcError] = useState<string | null>(null);
  const dRef = useDeferredValue(refSeq);
  const dSample = useDeferredValue(sampleSeq);
  const comparison = useMemo(() => compareSequences(dRef, dSample, { isCoding, cdsStart }), [dRef, dSample, isCoding, cdsStart]);

  const reverseBoth = () => {
    try {
      setRefSeq(reverseComplement(comparison.reference || refSeq.replace(/^>.*$/gm, '').replace(/\s+/g, '')));
      setSampleSeq(reverseComplement(comparison.sample || sampleSeq.replace(/^>.*$/gm, '').replace(/\s+/g, '')));
      setRcError(null);
    } catch {
      setRcError(tr('var_rc_failed'));
    }
  };

  // ---- VCF state
  const fileRef = useRef<HTMLInputElement>(null);
  const [vcfName, setVcfName] = useState<string | null>(null);
  const [vcf, setVcf] = useState<VcfParseResult | null>(null);
  const [vcfIsDemo, setVcfIsDemo] = useState(false);
  const [vcfError, setVcfError] = useState<string | null>(null);
  const [buildChoice, setBuildChoice] = useState<'auto' | GenomeBuild>('auto');
  const [shown, setShown] = useState(200);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Consent is bound to the exact file + genome build + variant selection it was given for (see currentSig).
  const [consentSig, setConsentSig] = useState<string | null>(null);
  const [vcfEpoch, setVcfEpoch] = useState(0);
  const [cancelledNote, setCancelledNote] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const [lookupResults, setLookupResults] = useState<Record<string, ClinVarLookupResult>>({});
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  /** Cancels any in-flight lookup (network request AND retry waits) and discards its late results. */
  const invalidateLookup = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    runIdRef.current++;
    setLookupBusy(false);
  };
  useEffect(
    () => () => {
      abortRef.current?.abort();
      runIdRef.current++;
    },
    []
  );

  const loadVcfText = (text: string, name: string, demo: boolean) => {
    invalidateLookup();
    setConsentSig(null);
    setCancelledNote(false);
    setVcfEpoch((n) => n + 1);
    setVcf(parseVcf(text));
    setVcfName(name);
    setVcfIsDemo(demo);
    setVcfError(null);
    setSelected(new Set());
    setLookupResults({});
    setShown(200);
    setBuildChoice('auto');
  };

  const handleVcfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > VCF_LIMITS.maxFileBytes) {
      setVcfError(tr('var_vcf_too_large', { size: (file.size / 1024 / 1024).toFixed(1), max: VCF_LIMITS.maxFileBytes / 1024 / 1024 }));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const buf = ev.target?.result;
      if (!(buf instanceof ArrayBuffer)) {
        setVcfError(tr('var_vcf_read_error'));
        return;
      }
      if (looksGzipped(new Uint8Array(buf.slice(0, 2)))) {
        setVcfError(tr('var_vcf_gzip'));
        return;
      }
      loadVcfText(new TextDecoder('utf-8').decode(buf), file.name, false);
    };
    reader.onerror = () => setVcfError(tr('var_vcf_read_error'));
    reader.readAsArrayBuffer(file);
  };

  const resetVcf = () => {
    invalidateLookup();
    setVcfEpoch((n) => n + 1);
    setCancelledNote(false);
    setVcf(null);
    setVcfName(null);
    setVcfIsDemo(false);
    setVcfError(null);
    setSelected(new Set());
    setLookupResults({});
    setConsentSig(null);
    setBuildChoice('auto');
  };

  const effectiveBuild: GenomeBuild | null = buildChoice === 'auto' ? vcf?.build.build ?? null : buildChoice;

  const rows = useMemo(() => {
    if (!vcf) return [];
    return vcf.records.flatMap((r) =>
      r.alleles.map((a, ai) => ({
        key: `${r.line}:${ai}`,
        record: r,
        alt: a.alt,
        type: a.type,
        queryable: LOOKUP_TYPES.has(a.type) && buildClinVarTerm({ key: '', chrom: r.chrom, pos: r.pos, ref: r.ref, alt: a.alt, build: 'GRCh38' }).term !== null,
      }))
    );
  }, [vcf]);

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.key)), [rows, selected]);
  const currentSig = `${vcfEpoch}|${effectiveBuild ?? ''}|${selectedRows.map((r) => r.key).sort().join(',')}`;
  const consent = consentSig !== null && consentSig === currentSig;

  const toggle = (key: string) => {
    if (lookupBusy) invalidateLookup();
    setConsentSig(null); // consent covered the previous selection only; it must be given again, never restored silently
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (next.size < CLINVAR_MAX_BATCH) next.add(key);
      return next;
    });
  };

  const runLookup = async () => {
    if (!effectiveBuild || !consent || selected.size === 0) return;
    const queries: ClinVarQuery[] = rows
      .filter((r) => selected.has(r.key))
      .map((r) => ({ key: r.key, chrom: r.record.chrom, pos: r.record.pos, ref: r.record.ref, alt: r.alt, build: effectiveBuild }));
    invalidateLookup();
    const runId = ++runIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setCancelledNote(false);
    setLookupBusy(true);
    setProgress([0, queries.length]);
    try {
      const res = await lookupClinVar(queries, {
        signal: controller.signal,
        onProgress: (d, t) => {
          if (runId === runIdRef.current) setProgress([d, t]);
        },
      });
      // A newer file/selection/build (or unmount) invalidated this run: never attach its results.
      if (runId !== runIdRef.current) return;
      setLookupResults((prev) => {
        const next = { ...prev };
        res.forEach((r) => (next[r.key] = r));
        return next;
      });
    } finally {
      if (runId === runIdRef.current) {
        setLookupBusy(false);
        abortRef.current = null;
      }
    }
  };

  const cancelLookup = () => {
    abortRef.current?.abort(); // partial results of the current run are still kept (same file, same selection)
    setCancelledNote(true);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'sequence', label: tr('var_tab_sequence'), icon: <ScanSearch className="w-4 h-4" aria-hidden="true" /> },
    { id: 'vcf', label: tr('var_tab_vcf'), icon: <Database className="w-4 h-4" aria-hidden="true" /> },
  ];

  const lookupExport = useMemo(() => {
    const entries = Object.values(lookupResults);
    if (entries.length === 0) return null;
    return {
      source: 'NCBI ClinVar via E-utilities (retrieved on user request)',
      retrievedAt: new Date().toISOString(),
      build: effectiveBuild,
      note: 'position_only records were NOT verified to be the same allele; no_record does not imply benign.',
      results: entries,
    };
  }, [lookupResults, effectiveBuild]);

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <div className="p-4 rounded-2xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 text-sky-900 dark:text-sky-100 flex items-start gap-3" role="note">
        <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-sky-600" aria-hidden="true" />
        <div className="space-y-1 text-xs leading-relaxed">
          <p className="font-bold">{tr('var_disclaimer_title')}</p>
          <p>{tr('var_disclaimer_body')}</p>
        </div>
      </div>

      <div role="tablist" aria-label={tr('tool_variant_analyzer_title')} className="flex items-center gap-2 border-b border-[#DDEDE8] dark:border-slate-700 pb-3 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`var-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`var-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              tab === t.id ? 'bg-[#0F766E] text-white shadow-xs' : 'bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-700 text-[#64748B] hover:text-[#12312B] dark:hover:text-slate-100'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'sequence' && (
        <div id="var-panel-sequence" role="tabpanel" aria-labelledby="var-tab-sequence" className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SequenceInput value={refSeq} onChange={setRefSeq} label={tr('var_reference_seq')} sampleSequence={DEMO_REF} sampleLabel={tr('var_load_demo')} lang={lang} />
            <SequenceInput value={sampleSeq} onChange={setSampleSeq} label={tr('var_sample_seq')} sampleSequence={DEMO_SAMPLE} sampleLabel={tr('var_load_demo')} lang={lang} />
          </div>
          <p className="text-[11px] text-[#64748B] dark:text-slate-400">{tr('var_demo_note')}</p>

          <div className={card}>
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex items-center gap-2 text-xs font-bold text-[#12312B] dark:text-slate-100 cursor-pointer">
                <input type="checkbox" checked={isCoding} onChange={(e) => setIsCoding(e.target.checked)} />
                {tr('var_is_coding')}
              </label>
              {isCoding && (
                <div>
                  <label htmlFor="var-cds-start" className="text-xs font-bold text-[#12312B] dark:text-slate-100 block mb-1">{tr('var_cds_start')}</label>
                  <input id="var-cds-start" type="number" min={1} step={1} value={cdsStart} onChange={(e) => setCdsStart(Math.max(1, Math.floor(Number(e.target.value) || 1)))} className={`${inputCls} w-28`} />
                </div>
              )}
              <button type="button" className={btnSecondary} onClick={reverseBoth}>
                <Repeat className="w-3.5 h-3.5" aria-hidden="true" /> {tr('var_rc_both')}
              </button>
            </div>
            <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed">{isCoding ? tr('var_coding_assumptions') : tr('var_noncoding_note')}</p>
            {rcError && <p className="text-xs text-rose-600" role="alert">{rcError}</p>}
          </div>

          <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-bold text-sm text-[#12312B] dark:text-slate-100">{tr('var_results_title')}</h4>
              {comparison.ok && (
                <div className="flex items-center gap-2">
                  <ExportButton filename="variant_comparison.json" data={{ tool: 'BioAI.Lab Variant Analyzer', coordinates: 'relative to the supplied reference sequence', ...comparison }} format="json" lang={lang} />
                  <ExportButton filename="variant_comparison.vcf" data={variantsToVcf(comparison)} format="vcf" lang={lang} />
                </div>
              )}
            </div>
            {comparison.ok && (
              <div className="flex flex-wrap gap-2 text-[11px] font-mono" dir="ltr">
                <span className="px-2 py-1 rounded-lg bg-[#F3FAF7] dark:bg-slate-800">REF {comparison.reference.length} bp</span>
                <span className="px-2 py-1 rounded-lg bg-[#F3FAF7] dark:bg-slate-800">ALT {comparison.sample.length} bp</span>
                <span className="px-2 py-1 rounded-lg bg-[#F3FAF7] dark:bg-slate-800">identity {comparison.identityPercent}%</span>
                <span className="px-2 py-1 rounded-lg bg-[#F3FAF7] dark:bg-slate-800">{tr('var_n_differences', { n: comparison.variants.length })}</span>
              </div>
            )}
            <Issues issues={comparison.issues} tr={tr} />

            {comparison.ok && comparison.variants.length > 0 && (
              <div className="overflow-x-auto border border-[#DDEDE8] dark:border-slate-700 rounded-xl">
                <table className="w-full text-xs">
                  <caption className="sr-only">{tr('var_table_caption')}</caption>
                  <thead className="bg-[#ECFDF5] dark:bg-slate-800 text-[#12312B] dark:text-slate-100">
                    <tr>
                      <th scope="col" className="p-2 text-start">{tr('var_col_type')}</th>
                      <th scope="col" className="p-2 text-start">{tr('var_col_position')}</th>
                      <th scope="col" className="p-2 text-start">{tr('var_col_hgvs')}</th>
                      <th scope="col" className="p-2 text-start">{tr('var_col_vcf')}</th>
                      {comparison.coding && <th scope="col" className="p-2 text-start">{tr('var_col_consequence')}</th>}
                      {comparison.coding && <th scope="col" className="p-2 text-start">{tr('var_col_protein')}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDEDE8] dark:divide-slate-700">
                    {comparison.variants.map((v, i) => (
                      <tr key={i}>
                        <td className="p-2 font-semibold">{tr(`var_type_${v.type}`)}</td>
                        <td className="p-2 font-mono" dir="ltr">{v.refStart === v.refEnd ? v.refStart : `${v.refStart}–${v.refEnd}`}</td>
                        <td className="p-2 font-mono break-all" dir="ltr">{v.hgvs}</td>
                        <td className="p-2 font-mono break-all" dir="ltr">{`${v.vcf.pos} ${v.vcf.ref}>${v.vcf.alt}`}</td>
                        {comparison.coding && <td className="p-2">{v.coding ? tr(`var_csq_${v.coding.consequence}`) : '—'}</td>}
                        {comparison.coding && (
                          <td className="p-2 font-mono" dir="ltr">
                            {v.coding?.proteinChange ?? '—'}
                            {v.coding?.codonChanges.map((c) => (
                              <div key={c.codonNumber} className="text-[10px] text-[#64748B]">
                                {`codon ${c.codonNumber}: ${c.refCodon}(${c.refAa})→${c.altCodon}(${c.altAa})`}
                              </div>
                            ))}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {comparison.ok && comparison.coding && (
              <div className="space-y-1 text-xs">
                <p className="font-bold text-[#12312B] dark:text-slate-100">{tr('var_protein_summary')}</p>
                <p className="text-[#64748B] dark:text-slate-400">
                  {comparison.coding.proteinIdentical
                    ? tr('var_protein_identical')
                    : tr('var_protein_differs', { pos: comparison.coding.firstProteinDifference ?? '?' })}
                </p>
                <div className="font-mono text-[11px] break-all p-2 rounded-lg bg-[#F3FAF7] dark:bg-slate-800 sequence-mono-ltr" dir="ltr">
                  <div>REF: {comparison.coding.refProtein}</div>
                  <div>ALT: {comparison.coding.sampleProtein}</div>
                </div>
              </div>
            )}

            {comparison.ok && comparison.variants.length > 0 && <AlignmentView a={comparison.alignedReference} b={comparison.alignedSample} tr={tr} />}
            <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed">{tr('var_no_lookup_for_sequences')}</p>
          </div>
        </div>
      )}

      {tab === 'vcf' && (
        <div id="var-panel-vcf" role="tabpanel" aria-labelledby="var-tab-vcf" className="space-y-5">
          <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-bold text-sm text-[#12312B] dark:text-slate-100">{tr('var_vcf_title')}</h4>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnSecondary} onClick={() => fileRef.current?.click()}>
                  <FileUp className="w-3.5 h-3.5" aria-hidden="true" /> {tr('var_vcf_upload')}
                </button>
                <input ref={fileRef} type="file" accept=".vcf,text/plain" className="hidden" onChange={handleVcfUpload} aria-label={tr('var_vcf_upload')} />
                <button type="button" className={btnSecondary} onClick={() => loadVcfText(DEMO_VCF, 'synthetic_demo.vcf', true)}>
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> {tr('var_vcf_demo')}
                </button>
                <button type="button" className={btnSecondary} onClick={resetVcf} disabled={!vcf && !vcfError}>
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> {tr('ml_reset')}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed">{tr('var_vcf_help', { max: VCF_LIMITS.maxFileBytes / 1024 / 1024 })}</p>
            {vcfError && (
              <p className="flex items-center gap-1.5 text-xs text-rose-600 font-medium" role="alert">
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> {vcfError}
              </p>
            )}
            {vcfIsDemo && (
              <div className="p-3 rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30 text-xs font-bold text-violet-900 dark:text-violet-200" role="note">
                {tr('var_vcf_demo_banner')}
              </div>
            )}

            {vcf && (
              <>
                <div className="flex flex-wrap gap-2 text-[11px] font-mono" dir="ltr">
                  <span className="px-2 py-1 rounded-lg bg-[#F3FAF7] dark:bg-slate-800">{vcfName}</span>
                  <span className="px-2 py-1 rounded-lg bg-[#F3FAF7] dark:bg-slate-800">{vcf.fileFormat ?? 'fileformat ?'}</span>
                  <span className="px-2 py-1 rounded-lg bg-[#F3FAF7] dark:bg-slate-800">{vcf.records.length} records</span>
                  <span className="px-2 py-1 rounded-lg bg-[#F3FAF7] dark:bg-slate-800">{vcf.sampleCount} sample column(s)</span>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label htmlFor="var-build" className="text-xs font-bold text-[#12312B] dark:text-slate-100 block mb-1">{tr('var_build')}</label>
                    <select id="var-build" className={inputCls} value={buildChoice} onChange={(e) => { invalidateLookup(); setConsentSig(null); setBuildChoice(e.target.value as 'auto' | GenomeBuild); setLookupResults({}); }}>
                      <option value="auto">{vcf.build.build ? tr('var_build_auto', { build: vcf.build.build }) : tr('var_build_auto_none')}</option>
                      <option value="GRCh37">GRCh37 / hg19</option>
                      <option value="GRCh38">GRCh38 / hg38</option>
                    </select>
                  </div>
                  {vcf.build.sources.length > 0 && (
                    <p className="text-[11px] text-[#64748B] dark:text-slate-400 font-mono" dir="ltr">{vcf.build.sources.join(' · ')}</p>
                  )}
                </div>
                <Issues issues={vcf.issues} tr={tr} />
              </>
            )}
          </div>

          {vcf && rows.length > 0 && (
            <div className={card}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-bold text-sm text-[#12312B] dark:text-slate-100">{tr('var_records_title', { n: rows.length })}</h4>
                <span className="text-[11px] text-[#64748B]">{tr('var_selected', { n: selected.size, max: CLINVAR_MAX_BATCH })}</span>
              </div>
              <div className="overflow-x-auto max-h-96 border border-[#DDEDE8] dark:border-slate-700 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-[#ECFDF5] dark:bg-slate-800 sticky top-0 text-[#12312B] dark:text-slate-100">
                    <tr>
                      <th scope="col" className="p-2"><span className="sr-only">{tr('var_select')}</span></th>
                      <th scope="col" className="p-2 text-start">CHROM</th>
                      <th scope="col" className="p-2 text-start">POS</th>
                      <th scope="col" className="p-2 text-start">ID</th>
                      <th scope="col" className="p-2 text-start">REF</th>
                      <th scope="col" className="p-2 text-start">ALT</th>
                      <th scope="col" className="p-2 text-start">{tr('var_col_type')}</th>
                      <th scope="col" className="p-2 text-start">FILTER</th>
                      <th scope="col" className="p-2 text-start">GT</th>
                      <th scope="col" className="p-2 text-start">ClinVar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDEDE8] dark:divide-slate-700 font-mono">
                    {rows.slice(0, shown).map((r) => {
                      const res = lookupResults[r.key];
                      return (
                        <tr key={r.key}>
                          <td className="p-2">
                            <input
                              type="checkbox"
                              disabled={!r.queryable || (!selected.has(r.key) && selected.size >= CLINVAR_MAX_BATCH)}
                              checked={selected.has(r.key)}
                              onChange={() => toggle(r.key)}
                              aria-label={`${tr('var_select')} ${r.record.chrom}:${r.record.pos}`}
                            />
                          </td>
                          <td className="p-2" dir="ltr">{r.record.chrom}</td>
                          <td className="p-2" dir="ltr">{r.record.pos}</td>
                          <td className="p-2 max-w-[120px] truncate" dir="ltr">{r.record.id}</td>
                          <td className="p-2 max-w-[120px] break-all" dir="ltr">{r.record.ref}</td>
                          <td className="p-2 max-w-[120px] break-all" dir="ltr">{r.alt}</td>
                          <td className="p-2 font-sans">{tr(`var_vcftype_${r.type}`)}</td>
                          <td className="p-2" dir="ltr">{r.record.filter}</td>
                          <td className="p-2" dir="ltr">{r.record.firstSampleGenotype ?? '—'}</td>
                          <td className="p-2 font-sans">{res ? tr(`var_status_${res.status}`) : r.queryable ? '' : tr('var_not_queryable_short')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rows.length > shown && (
                <button type="button" className={btnSecondary} onClick={() => setShown((s) => s + 200)}>
                  {tr('var_show_more', { n: Math.min(200, rows.length - shown) })}
                </button>
              )}

              {/* ClinVar lookup (optional, explicit) */}
              <div className="p-4 rounded-xl border border-[#DDEDE8] dark:border-slate-700 bg-[#F3FAF7] dark:bg-slate-800 space-y-3">
                <h5 className="text-xs font-bold text-[#12312B] dark:text-slate-100 flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#0F766E]" aria-hidden="true" /> {tr('var_clinvar_title')}
                </h5>
                <p className="text-xs text-[#12312B] dark:text-slate-200 leading-relaxed">{tr('var_clinvar_disclosure')}</p>
                {!effectiveBuild && <p className="text-xs font-bold text-amber-700 dark:text-amber-300">{tr('var_build_required')}</p>}
                {selectedRows.length > 0 && effectiveBuild && (
                  <div className="text-xs text-[#12312B] dark:text-slate-200">
                    <p className="font-bold">{tr('var_clinvar_will_send')}</p>
                    <ul className="font-mono mt-1 space-y-0.5" dir="ltr" data-testid="clinvar-send-list">
                      {selectedRows.map((r) => (
                        <li key={r.key}>{`${r.record.chrom}:${r.record.pos} ${r.record.ref}>${r.alt} (${effectiveBuild})`}</li>
                      ))}
                    </ul>
                    <p className="mt-1 text-[11px] text-[#64748B] dark:text-slate-400">{tr('var_clinvar_ip_note')}</p>
                  </div>
                )}
                <label className="flex items-start gap-2 text-xs text-[#12312B] dark:text-slate-100 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={consent}
                    disabled={selected.size === 0 || !effectiveBuild}
                    onChange={(e) => setConsentSig(e.target.checked ? currentSig : null)}
                  />
                  <span>{tr('var_clinvar_consent', { n: selected.size })}</span>
                </label>
                <p className="text-[11px] text-[#64748B] dark:text-slate-400">{tr('var_clinvar_consent_scope')}</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    onClick={runLookup}
                    disabled={!consent || !effectiveBuild || selected.size === 0 || lookupBusy}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F766E] text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:bg-[#115E59]"
                  >
                    {lookupBusy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Database className="w-4 h-4" aria-hidden="true" />}
                    {lookupBusy ? tr('var_clinvar_running', { done: progress[0], total: progress[1] }) : tr('var_clinvar_run', { n: selected.size })}
                  </button>
                  {lookupBusy && (
                    <button type="button" className={btnSecondary} onClick={cancelLookup}>
                      <XCircle className="w-3.5 h-3.5" aria-hidden="true" /> {tr('var_cancel')}
                    </button>
                  )}
                  {cancelledNote && !lookupBusy && <span role="status" className="text-xs text-[#64748B] dark:text-slate-400">{tr('var_clinvar_cancelled')}</span>}
                  {lookupExport && <ExportButton filename="clinvar_lookup.json" data={lookupExport} format="json" lang={lang} />}
                </div>
              </div>

              {Object.values(lookupResults).length > 0 && (
                <div className="space-y-3" aria-live="polite">
                  {rows
                    .filter((r) => lookupResults[r.key])
                    .map((r) => {
                      const res = lookupResults[r.key];
                      return (
                        <article key={r.key} className="p-4 rounded-xl border border-[#DDEDE8] dark:border-slate-700 space-y-2">
                          <header className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold" dir="ltr">{`${normalizeChromName(r.record.chrom)}:${r.record.pos} ${r.record.ref}>${r.alt}`}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-[#DDEDE8] dark:border-slate-600">{tr(`var_status_${res.status}`)}</span>
                            <span className="text-[10px] text-[#64748B] font-mono" dir="ltr">{effectiveBuild}</span>
                          </header>
                          <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                            {tr(`var_status_${res.status}_explain`, { code: res.httpStatus ?? res.errorCode ?? '' })}
                            <span className="ms-2 font-mono" dir="ltr">{tr('var_retrieved_at')}: {res.retrievedAt}</span>
                          </p>
                          {res.moreRecords && <p className="text-[11px] text-amber-700 dark:text-amber-300">{tr('var_clinvar_more_records')}</p>}
                          {res.records.map((rec) => (
                            <div key={rec.uid} className="p-3 rounded-lg bg-[#F3FAF7] dark:bg-slate-800 space-y-1.5 text-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                <a href={rec.url} target="_blank" rel="noopener noreferrer" className="font-mono font-bold text-[#0F766E] dark:text-teal-400 underline inline-flex items-center gap-1" dir="ltr">
                                  {rec.accession || `VariationID ${rec.uid}`} <ExternalLink className="w-3 h-3" aria-hidden="true" />
                                </a>
                                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${CLASS_STYLE[rec.normalizedClass]}`}>{tr(`var_class_${rec.normalizedClass}`)}</span>
                                {rec.isConflicting && <span className="px-2 py-0.5 rounded-full border text-[10px] font-bold bg-violet-50 text-violet-800 border-violet-300">{tr('var_conflicting')}</span>}
                                {!rec.alleleMatch && <span className="px-2 py-0.5 rounded-full border text-[10px] font-bold bg-amber-50 text-amber-800 border-amber-300">{tr('var_allele_unverified')}</span>}
                              </div>
                              <p className="text-[#12312B] dark:text-slate-100" dir="ltr">{rec.title}</p>
                              <dl className="grid grid-cols-1 sm:grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-[11px]">
                                <dt className="font-bold">{tr('var_cv_classification')}</dt>
                                <dd>{rec.classification ?? '—'}</dd>
                                <dt className="font-bold">{tr('var_cv_review')}</dt>
                                <dd>
                                  {rec.reviewStatus ?? '—'}
                                  {rec.stars !== null && <span className="ms-1 text-amber-500" aria-label={tr('var_stars', { n: rec.stars })}>{'★'.repeat(rec.stars)}{'☆'.repeat(4 - rec.stars)}</span>}
                                </dd>
                                <dt className="font-bold">{tr('var_cv_conditions')}</dt>
                                <dd>{rec.conditions.length ? rec.conditions.slice(0, 6).join('; ') : '—'}</dd>
                                <dt className="font-bold">{tr('var_cv_last_evaluated')}</dt>
                                <dd dir="ltr">{rec.lastEvaluated ?? '—'}</dd>
                                {rec.somatic.length > 0 && (
                                  <>
                                    <dt className="font-bold">{tr('var_cv_somatic')}</dt>
                                    <dd>{rec.somatic.map((x) => `${x.kind}: ${x.description}`).join('; ')}</dd>
                                  </>
                                )}
                                {rec.canonicalSpdi && (
                                  <>
                                    <dt className="font-bold">SPDI</dt>
                                    <dd className="font-mono break-all" dir="ltr">{rec.canonicalSpdi}</dd>
                                  </>
                                )}
                              </dl>
                            </div>
                          ))}
                        </article>
                      );
                    })}
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed">{tr('var_clinvar_caveat')}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <ScientificExplanation
        formula={tr('var_expl_formula')}
        biologicalMeaning={tr('var_expl_meaning')}
        assumptions={tr('var_expl_assumptions')}
        limitations={tr('var_expl_limitations')}
        lang={lang}
      />
    </div>
  );
};
