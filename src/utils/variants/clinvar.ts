// OPTIONAL, user-initiated lookup of public ClinVar records through NCBI
// E-utilities. Only chromosome, position, REF and ALT of the variants the user
// explicitly selects are sent - never sequences, genotypes, sample names or
// files. No API key is used or stored in the frontend.
//
// Matching policy (deliberately conservative):
//  - 'exact_match'   : ClinVar's GRCh38 canonical SPDI (or, for GRCh37 SNVs, the
//                      reported GRCh37 location + alleles) equals the queried allele.
//  - 'position_only' : records overlap the position but the allele could not be
//                      verified. Their classification must NOT be applied to the
//                      queried variant.
//  - 'no_record'     : ClinVar returned no record at that position. This does not
//                      mean the variant is benign.

import type { GenomeBuild } from './vcfParser';
import { normalizeChromName } from './vcfParser';

export const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
export const CLINVAR_MAX_BATCH = 10;

export interface ClinVarQuery {
  key: string;
  chrom: string;
  pos: number;
  ref: string;
  alt: string;
  build: GenomeBuild;
}

export type NormalizedClass =
  | 'pathogenic'
  | 'likely_pathogenic'
  | 'pathogenic_likely_pathogenic'
  | 'uncertain_significance'
  | 'likely_benign'
  | 'benign'
  | 'benign_likely_benign'
  | 'conflicting'
  | 'not_provided'
  | 'other';

export interface ClinVarRecord {
  uid: string;
  accession: string;
  title: string;
  url: string;
  classification: string | null;
  normalizedClass: NormalizedClass;
  reviewStatus: string | null;
  stars: number | null;
  isConflicting: boolean;
  lastEvaluated: string | null;
  conditions: string[];
  variantType: string | null;
  canonicalSpdi: string | null;
  alleleMatch: boolean;
  /**
   * Somatic (tumour) classifications reported by ClinVar, kept SEPARATE from the
   * germline classification above. Empty when ClinVar has none.
   */
  somatic: SomaticClassification[];
}

export interface SomaticClassification {
  kind: 'oncogenicity' | 'clinical_impact';
  description: string;
  reviewStatus: string | null;
}

export type LookupStatus = 'exact_match' | 'position_only' | 'no_record' | 'not_queryable' | 'rate_limited' | 'error';

export interface ClinVarLookupResult {
  key: string;
  status: LookupStatus;
  records: ClinVarRecord[];
  queryTerm: string | null;
  /** True when ClinVar reported more records at this position than were retrieved. */
  moreRecords?: boolean;
  errorCode?: 'network' | 'timeout' | 'http' | 'parse' | 'unsupported_chrom' | 'unsupported_allele';
  httpStatus?: number;
  /** Client timestamp when this result was completed (ISO 8601). */
  retrievedAt: string;
}

const QUERYABLE_CHROMS = new Set([...Array.from({ length: 22 }, (_, i) => String(i + 1)), 'X', 'Y', 'MT']);

const GRCH38_ACCESSIONS: Record<string, string> = {
  '1': 'NC_000001', '2': 'NC_000002', '3': 'NC_000003', '4': 'NC_000004', '5': 'NC_000005', '6': 'NC_000006',
  '7': 'NC_000007', '8': 'NC_000008', '9': 'NC_000009', '10': 'NC_000010', '11': 'NC_000011', '12': 'NC_000012',
  '13': 'NC_000013', '14': 'NC_000014', '15': 'NC_000015', '16': 'NC_000016', '17': 'NC_000017', '18': 'NC_000018',
  '19': 'NC_000019', '20': 'NC_000020', '21': 'NC_000021', '22': 'NC_000022', X: 'NC_000023', Y: 'NC_000024', MT: 'NC_012920',
};

/** Minimal (trimmed) representation: suffix trimmed first, then prefix -> leftmost interbase start. */
export function minimalAllele(pos0: number, ref: string, alt: string): { start0: number; del: string; ins: string } {
  let r = ref.toUpperCase();
  let a = alt.toUpperCase();
  let s = pos0;
  while (r.length && a.length && r[r.length - 1] === a[a.length - 1]) {
    r = r.slice(0, -1);
    a = a.slice(0, -1);
  }
  while (r.length && a.length && r[0] === a[0]) {
    r = r.slice(1);
    a = a.slice(1);
    s++;
  }
  return { start0: s, del: r, ins: a };
}

export function spdiMatchesQuery(spdi: string, q: ClinVarQuery): boolean {
  const parts = spdi.split(':');
  if (parts.length !== 4) return false;
  const [seqId, posStr, del, ins] = parts;
  const chrom = normalizeChromName(q.chrom);
  const acc = GRCH38_ACCESSIONS[chrom];
  if (!acc || !seqId.startsWith(acc + '.')) return false;
  if (!/^\d+$/.test(posStr) || !/^[ACGTN]*$/i.test(del) || !/^[ACGTN]*$/i.test(ins)) return false;
  const a = minimalAllele(Number(posStr), del, ins);
  const b = minimalAllele(q.pos - 1, q.ref, q.alt);
  return a.start0 === b.start0 && a.del === b.del && a.ins === b.ins;
}

export function reviewStatusStars(status: string | null | undefined): number | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s.includes('practice guideline')) return 4;
  if (s.includes('expert panel')) return 3;
  if (s.includes('no assertion') || s.includes('no classification') || s.includes('no interpretation')) return 0;
  if (s.includes('multiple submitters') && s.includes('no conflicts')) return 2;
  if (s.includes('criteria provided')) return 1; // single submitter, or conflicting classifications
  return null;
}

export function normalizeClassification(desc: string | null | undefined): NormalizedClass {
  if (!desc) return 'not_provided';
  const d = desc.trim().toLowerCase();
  if (d.includes('conflicting')) return 'conflicting';
  const map: Record<string, NormalizedClass> = {
    pathogenic: 'pathogenic',
    'likely pathogenic': 'likely_pathogenic',
    'pathogenic/likely pathogenic': 'pathogenic_likely_pathogenic',
    'uncertain significance': 'uncertain_significance',
    'likely benign': 'likely_benign',
    benign: 'benign',
    'benign/likely benign': 'benign_likely_benign',
    'not provided': 'not_provided',
    '': 'not_provided',
  };
  return map[d] ?? 'other';
}

export function buildClinVarTerm(q: ClinVarQuery): { term: string | null; reason?: 'unsupported_chrom' | 'unsupported_allele' } {
  const chrom = normalizeChromName(q.chrom);
  if (!QUERYABLE_CHROMS.has(chrom)) return { term: null, reason: 'unsupported_chrom' };
  if (!/^[ACGTN]+$/i.test(q.ref) || !/^[ACGTN]+$/i.test(q.alt)) return { term: null, reason: 'unsupported_allele' };
  const field = q.build === 'GRCh38' ? 'chrpos38' : 'chrpos37';
  const start = q.pos;
  // SNVs: exact position. Indels: include the base after the VCF anchor/REF span,
  // because ClinVar locates indels on the changed bases rather than the anchor.
  const end = q.ref.length === 1 && q.alt.length === 1 ? q.pos : q.pos + q.ref.length;
  const posTerm = start === end ? `${start}` : `${start}:${end}`;
  return { term: `${chrom}[chr] AND ${posTerm}[${field}]` };
}

export const ESEARCH_RETMAX = 20;

/** Total hit count reported by ESearch (may exceed the number of returned ids). */
export function parseESearchCount(json: unknown): number | null {
  const c = (json as { esearchresult?: { count?: unknown } })?.esearchresult?.count;
  const n = typeof c === 'string' ? Number(c) : typeof c === 'number' ? c : NaN;
  return Number.isFinite(n) ? n : null;
}

export function parseESearchIds(json: unknown): string[] {
  const ids = (json as { esearchresult?: { idlist?: unknown } })?.esearchresult?.idlist;
  if (!Array.isArray(ids)) throw new Error('parse');
  return ids.filter((x): x is string => typeof x === 'string' && /^\d+$/.test(x));
}

interface RawSummary {
  uid?: string;
  accession?: string;
  title?: string;
  obj_type?: string;
  germline_classification?: { description?: string; review_status?: string; last_evaluated?: string; trait_set?: { trait_name?: string }[] };
  clinical_significance?: { description?: string; review_status?: string; last_evaluated?: string };
  oncogenicity_classification?: { description?: string; review_status?: string };
  clinical_impact_classification?: { description?: string; review_status?: string };
  trait_set?: { trait_name?: string }[];
  variation_set?: {
    canonical_spdi?: string;
    variant_type?: string;
    variation_loc?: { assembly_name?: string; chr?: string; start?: string; stop?: string; ref?: string; alt?: string }[];
  }[];
}

export function parseESummary(json: unknown, q: ClinVarQuery): ClinVarRecord[] {
  const result = (json as { result?: Record<string, unknown> & { uids?: unknown } })?.result;
  if (!result || !Array.isArray(result.uids)) throw new Error('parse');
  const out: ClinVarRecord[] = [];
  for (const uid of result.uids as string[]) {
    const r = result[uid] as RawSummary | undefined;
    if (!r || typeof r !== 'object') continue;
    const germ = r.germline_classification || r.clinical_significance || {};
    const description = (germ.description ?? '').trim() || null;
    const reviewStatus = (germ.review_status ?? '').trim() || null;
    const traitSource = r.germline_classification?.trait_set || r.trait_set || [];
    const conditions = traitSource.map((t) => (t?.trait_name ?? '').trim()).filter((t) => t !== '');
    const vs = Array.isArray(r.variation_set) ? r.variation_set : [];
    const single = vs.length === 1 ? vs[0] : null;
    const spdi = single?.canonical_spdi?.trim() || null;
    let alleleMatch = false;
    if (single) {
      if (q.build === 'GRCh38' && spdi) {
        alleleMatch = spdiMatchesQuery(spdi, q);
      } else if (q.build === 'GRCh37' && q.ref.length === 1 && q.alt.length === 1) {
        const loc = (single.variation_loc || []).find((l) => l.assembly_name === 'GRCh37');
        alleleMatch =
          !!loc &&
          normalizeChromName(loc.chr ?? '') === normalizeChromName(q.chrom) &&
          Number(loc.start) === q.pos &&
          Number(loc.stop) === q.pos &&
          (loc.ref ?? '').toUpperCase() === q.ref.toUpperCase() &&
          (loc.alt ?? '').toUpperCase() === q.alt.toUpperCase();
      }
    }
    const accession = (r.accession ?? '').trim();
    const somatic: SomaticClassification[] = [];
    const onco = (r.oncogenicity_classification?.description ?? '').trim();
    if (onco) somatic.push({ kind: 'oncogenicity', description: onco, reviewStatus: (r.oncogenicity_classification?.review_status ?? '').trim() || null });
    const impact = (r.clinical_impact_classification?.description ?? '').trim();
    if (impact) somatic.push({ kind: 'clinical_impact', description: impact, reviewStatus: (r.clinical_impact_classification?.review_status ?? '').trim() || null });
    out.push({
      uid,
      accession,
      title: (r.title ?? '').trim(),
      url: `https://www.ncbi.nlm.nih.gov/clinvar/variation/${encodeURIComponent(uid)}/`,
      classification: description,
      normalizedClass: normalizeClassification(description),
      reviewStatus,
      stars: reviewStatusStars(reviewStatus),
      isConflicting: /conflicting/i.test(description ?? '') || /conflicting/i.test(reviewStatus ?? ''),
      lastEvaluated: (germ.last_evaluated ?? '').trim() || null,
      conditions,
      variantType: single?.variant_type ?? null,
      canonicalSpdi: spdi,
      alleleMatch,
      somatic,
    });
  }
  return out;
}

export interface LookupOptions {
  fetchImpl?: typeof fetch;
  minIntervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Wait helper. Receives the abort signal so rate-limit and retry waits can be cancelled. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  onProgress?: (done: number, total: number) => void;
}

class HttpError extends Error {
  constructor(public status: number) {
    super(`http_${status}`);
  }
}

/** Timer that rejects with an AbortError as soon as the signal fires, so a pending wait never keeps a cancelled lookup alive. */
export const abortableSleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const fail = () => {
      const e = new Error('aborted');
      e.name = 'AbortError';
      reject(e);
    };
    if (signal?.aborted) return fail();
    const onAbort = () => {
      clearTimeout(timer);
      fail();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
const defaultSleep = abortableSleep;

export async function lookupClinVar(queries: ClinVarQuery[], opts: LookupOptions = {}): Promise<ClinVarLookupResult[]> {
  const fetchImpl = opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined);
  const sleep = opts.sleep ?? defaultSleep;
  const minInterval = opts.minIntervalMs ?? 400; // NCBI allows 3 requests/s without an API key
  const timeoutMs = opts.timeoutMs ?? 15000;
  const results: ClinVarLookupResult[] = [];
  let lastCall = 0;
  const timestamp = () => new Date().toISOString();

  const abortedError = () => {
    const e = new Error('aborted');
    e.name = 'AbortError';
    return e;
  };

  const getJson = async (url: string): Promise<unknown> => {
    if (!fetchImpl) throw new TypeError('fetch unavailable');
    const wait = lastCall + minInterval - Date.now();
    if (wait > 0) await sleep(wait, opts.signal);
    // Never start a request after the user cancelled (the signal may have fired while waiting).
    if (opts.signal?.aborted) throw abortedError();
    lastCall = Date.now();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const onAbort = () => controller?.abort();
    opts.signal?.addEventListener('abort', onAbort);
    try {
      const res = await fetchImpl(url, { signal: controller?.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!res.ok) throw new HttpError(res.status);
      return await res.json();
    } finally {
      if (timer) clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
    }
  };

  const getWithRetry = async (url: string): Promise<unknown> => {
    try {
      return await getJson(url);
    } catch (e) {
      if (e instanceof HttpError && e.status === 429) {
        await sleep(2000, opts.signal);
        if (opts.signal?.aborted) throw abortedError();
        return await getJson(url);
      }
      throw e;
    }
  };

  const batch = queries.slice(0, CLINVAR_MAX_BATCH);
  for (let k = 0; k < batch.length; k++) {
    if (opts.signal?.aborted) break;
    const q = batch[k];
    const { term, reason } = buildClinVarTerm(q);
    if (!term) {
      results.push({ key: q.key, status: 'not_queryable', records: [], queryTerm: null, errorCode: reason, retrievedAt: timestamp() });
      opts.onProgress?.(k + 1, batch.length);
      continue;
    }
    try {
      const search = await getWithRetry(`${EUTILS_BASE}/esearch.fcgi?db=clinvar&retmode=json&retmax=${ESEARCH_RETMAX}&tool=bioai_lab&term=${encodeURIComponent(term)}`);
      const ids = parseESearchIds(search);
      const total = parseESearchCount(search);
      const moreRecords = total !== null && total > ids.length;
      if (ids.length === 0) {
        results.push({ key: q.key, status: 'no_record', records: [], queryTerm: term, retrievedAt: timestamp() });
      } else {
        const summary = await getWithRetry(`${EUTILS_BASE}/esummary.fcgi?db=clinvar&retmode=json&tool=bioai_lab&id=${ids.join(',')}`);
        const records = parseESummary(summary, q);
        const exact = records.filter((r) => r.alleleMatch);
        results.push({
          key: q.key,
          status: exact.length > 0 ? 'exact_match' : records.length > 0 ? 'position_only' : 'no_record',
          records: exact.length > 0 ? exact : records,
          queryTerm: term,
          moreRecords,
          retrievedAt: timestamp(),
        });
      }
    } catch (e) {
      if (opts.signal?.aborted) break;
      if (e instanceof HttpError) {
        results.push({ key: q.key, status: e.status === 429 ? 'rate_limited' : 'error', records: [], queryTerm: term, errorCode: 'http', httpStatus: e.status, retrievedAt: timestamp() });
      } else if (e instanceof Error && e.name === 'AbortError') {
        results.push({ key: q.key, status: 'error', records: [], queryTerm: term, errorCode: 'timeout', retrievedAt: timestamp() });
      } else if ((e instanceof Error && e.message === 'parse') || e instanceof SyntaxError) {
        results.push({ key: q.key, status: 'error', records: [], queryTerm: term, errorCode: 'parse', retrievedAt: timestamp() });
      } else {
        results.push({ key: q.key, status: 'error', records: [], queryTerm: term, errorCode: 'network', retrievedAt: timestamp() });
      }
    }
    opts.onProgress?.(k + 1, batch.length);
  }
  return results;
}
