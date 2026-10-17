// Local VCF (v4.x, uncompressed) parser and validator. Files never leave the
// browser. Variant presence in a VCF only describes what the file contains;
// it says nothing about clinical significance.

export type GenomeBuild = 'GRCh37' | 'GRCh38';

export const VCF_LIMITS = {
  maxFileBytes: 20 * 1024 * 1024,
  maxRecords: 100_000,
  maxReportedIssues: 50,
  /** Per issue type, at most this many individual messages are listed; the rest is summarised by a *_more issue and by `counts`. */
  maxDetailedPerCode: 10,
};

export type VcfAltType = 'SNV' | 'MNV' | 'insertion' | 'deletion' | 'delins' | 'symbolic' | 'breakend' | 'spanning_deletion' | 'no_alt';

export interface VcfAllele {
  alt: string;
  type: VcfAltType;
}

export interface VcfRecord {
  line: number;
  chrom: string;
  pos: number;
  id: string;
  ref: string;
  alleles: VcfAllele[];
  qual: string;
  filter: string;
  info: string;
  /** Genotype (GT) of the first sample, if FORMAT/GT are present. */
  firstSampleGenotype: string | null;
  /** Number of sample columns containing a syntactically valid GT, when FORMAT/GT is present. */
  validGenotypeSamples: number | null;
}

export interface VcfIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  params?: Record<string, string | number>;
}

export interface BuildEvidence {
  build: GenomeBuild | null;
  conflict: boolean;
  sources: string[];
}

export interface VcfParseResult {
  ok: boolean;
  fileFormat: string | null;
  sampleCount: number;
  records: VcfRecord[];
  build: BuildEvidence;
  issues: VcfIssue[];
  skippedLines: number;
  /** Exact totals, independent of how many individual issues are listed. */
  counts: { malformedGenotypes: number; unsupportedAlt: number; outOfContig: number };
}

/**
 * VCF GT validation (spec v4.x): alleles are '.' or non-negative integers
 * separated by '/' or '|'. A partially missing genotype such as './1' is valid.
 * An allele index must not exceed the number of ALT alleles of the record.
 */
export function isValidGenotype(gt: string, altCount: number): boolean {
  if (!/^(?:\.|\d+)(?:[\/|](?:\.|\d+))*$/.test(gt)) return false;
  return gt.split(/[\/|]/).every((a) => a === '.' || Number(a) <= altCount);
}

const REF_RE = /^[ACGTN]+$/;
const ALT_BASES_RE = /^[ACGTN]+$/;

// Primary-assembly chromosome lengths used only as build evidence.
// Primary-assembly chromosome lengths (GRCh37 = hg19 primary assembly, GRCh38 =
// GCA_000001405.15). Used only as build EVIDENCE from ##contig headers.
const CHROM_LENGTHS: Record<string, Record<GenomeBuild, number>> = {
  '1': { GRCh37: 249250621, GRCh38: 248956422 },
  '2': { GRCh37: 243199373, GRCh38: 242193529 },
  '3': { GRCh37: 198022430, GRCh38: 198295559 },
  '4': { GRCh37: 191154276, GRCh38: 190214555 },
  '5': { GRCh37: 180915260, GRCh38: 181538259 },
  '6': { GRCh37: 171115067, GRCh38: 170805979 },
  '7': { GRCh37: 159138663, GRCh38: 159345973 },
  '8': { GRCh37: 146364022, GRCh38: 145138636 },
  '9': { GRCh37: 141213431, GRCh38: 138394717 },
  '10': { GRCh37: 135534747, GRCh38: 133797422 },
  '11': { GRCh37: 135006516, GRCh38: 135086622 },
  '12': { GRCh37: 133851895, GRCh38: 133275309 },
  '13': { GRCh37: 115169878, GRCh38: 114364328 },
  '14': { GRCh37: 107349540, GRCh38: 107043718 },
  '15': { GRCh37: 102531392, GRCh38: 101991189 },
  '16': { GRCh37: 90354753, GRCh38: 90338345 },
  '17': { GRCh37: 81195210, GRCh38: 83257441 },
  '18': { GRCh37: 78077248, GRCh38: 80373285 },
  '19': { GRCh37: 59128983, GRCh38: 58617616 },
  '20': { GRCh37: 63025520, GRCh38: 64444167 },
  '21': { GRCh37: 48129895, GRCh38: 46709983 },
  '22': { GRCh37: 51304566, GRCh38: 50818468 },
  X: { GRCh37: 155270560, GRCh38: 156040895 },
  Y: { GRCh37: 59373566, GRCh38: 57227415 },
};

export function normalizeChromName(chrom: string): string {
  const c = chrom.trim().replace(/^chr/i, '').toUpperCase();
  if (c === 'M') return 'MT';
  return c;
}

function buildFromText(text: string): GenomeBuild | null {
  if (/GRCh38|hg38|\bb38\b/i.test(text)) return 'GRCh38';
  if (/GRCh37|hg19|\bb37\b|human_g1k_v37|hs37d5/i.test(text)) return 'GRCh37';
  return null;
}

export function classifyAllele(ref: string, alt: string): VcfAltType {
  if (alt === '.' || alt === '') return 'no_alt';
  if (alt === '*') return 'spanning_deletion';
  if (alt.startsWith('<') && alt.endsWith('>')) return 'symbolic';
  if (/[[\]]/.test(alt) || alt.startsWith('.') || alt.endsWith('.')) return 'breakend';
  // Trim shared suffix, then shared prefix, to find the minimal change.
  let r = ref;
  let a = alt;
  while (r.length > 0 && a.length > 0 && r[r.length - 1] === a[a.length - 1]) {
    r = r.slice(0, -1);
    a = a.slice(0, -1);
  }
  while (r.length > 0 && a.length > 0 && r[0] === a[0]) {
    r = r.slice(1);
    a = a.slice(1);
  }
  if (r.length === 0 && a.length > 0) return 'insertion';
  if (a.length === 0 && r.length > 0) return 'deletion';
  if (r.length === 1 && a.length === 1) return 'SNV';
  if (r.length === a.length) return r.length === 0 ? 'no_alt' : 'MNV';
  return 'delins';
}

export function looksGzipped(firstBytes: Uint8Array): boolean {
  return firstBytes.length >= 2 && firstBytes[0] === 0x1f && firstBytes[1] === 0x8b;
}

export function parseVcf(text: string): VcfParseResult {
  const issues: VcfIssue[] = [];
  const records: VcfRecord[] = [];
  let fileFormat: string | null = null;
  let headerColumns: string[] | null = null;
  let sampleCount = 0;
  let skippedLines = 0;
  const buildVotes: { build: GenomeBuild; source: string }[] = [];
  const lineErrors: VcfIssue[] = [];
  // Per-type counters/lists: reported regardless of whether any other line was skipped.
  const genotypeIssues: VcfIssue[] = [];
  const unsupportedIssues: VcfIssue[] = [];
  let malformedGenotypes = 0;
  let unsupportedAlt = 0;
  const pushLineError = (issue: VcfIssue) => {
    skippedLines++;
    if (lineErrors.length < VCF_LIMITS.maxReportedIssues) lineErrors.push(issue);
  };

  const clean = (text || '').replace(/^\uFEFF/, '');
  if (!clean.trim()) {
    return { ok: false, fileFormat, sampleCount, records, build: { build: null, conflict: false, sources: [] }, issues: [{ severity: 'error', code: 'vcf_empty' }], skippedLines, counts: { malformedGenotypes: 0, unsupportedAlt: 0, outOfContig: 0 } };
  }
  const lines = clean.split(/\r?\n/);
  const seenKeys = new Set<string>();
  let duplicates = 0;
  let unsorted = false;
  let lastChrom = '';
  let lastPos = 0;
  let truncated = false;

  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li];
    const lineNo = li + 1;
    if (raw.trim() === '') continue;
    if (raw.startsWith('##')) {
      if (raw.startsWith('##fileformat=')) fileFormat = raw.slice('##fileformat='.length).trim();
      else if (raw.startsWith('##reference=')) {
        const b = buildFromText(raw);
        if (b) buildVotes.push({ build: b, source: '##reference' });
      } else if (raw.startsWith('##contig=')) {
        const assembly = /assembly=([^,>]+)/i.exec(raw);
        if (assembly) {
          const b = buildFromText(assembly[1]);
          if (b) buildVotes.push({ build: b, source: '##contig assembly' });
        }
        const id = /ID=([^,>]+)/.exec(raw);
        const len = /length=(\d+)/.exec(raw);
        if (id && len) {
          const known = CHROM_LENGTHS[normalizeChromName(id[1])];
          const L = Number(len[1]);
          if (known) {
            if (known.GRCh37 === L) buildVotes.push({ build: 'GRCh37', source: `##contig ${id[1]} length` });
            else if (known.GRCh38 === L) buildVotes.push({ build: 'GRCh38', source: `##contig ${id[1]} length` });
          }
        }
      }
      continue;
    }
    if (raw.startsWith('#')) {
      headerColumns = raw.slice(1).split('\t');
      const expected = ['CHROM', 'POS', 'ID', 'REF', 'ALT', 'QUAL', 'FILTER', 'INFO'];
      if (headerColumns.length < 8 || expected.some((c, k) => headerColumns![k]?.trim().toUpperCase() !== c)) {
        issues.push({ severity: 'error', code: 'vcf_bad_header', params: { line: lineNo } });
        break;
      }
      sampleCount = Math.max(0, headerColumns.length - 9);
      continue;
    }
    if (!headerColumns) {
      issues.push({ severity: 'error', code: 'vcf_missing_header', params: { line: lineNo } });
      break;
    }
    if (records.length >= VCF_LIMITS.maxRecords) {
      truncated = true;
      break;
    }
    const cols = raw.split('\t');
    if (cols.length < 8) {
      pushLineError({ severity: 'error', code: cols.length === 1 && /\s/.test(raw) ? 'vcf_not_tab_delimited' : 'vcf_too_few_columns', params: { line: lineNo } });
      continue;
    }
    const [chrom, posStr, id, refRaw, altRaw, qual, filter, info] = cols;
    if (!chrom || /\s/.test(chrom)) {
      pushLineError({ severity: 'error', code: 'vcf_bad_chrom', params: { line: lineNo } });
      continue;
    }
    if (!/^\d+$/.test(posStr) || Number(posStr) < 1) {
      pushLineError({ severity: 'error', code: 'vcf_bad_pos', params: { line: lineNo, value: posStr.slice(0, 20) } });
      continue;
    }
    const ref = refRaw.toUpperCase();
    if (!REF_RE.test(ref)) {
      pushLineError({ severity: 'error', code: 'vcf_bad_ref', params: { line: lineNo, value: refRaw.slice(0, 20) } });
      continue;
    }
    const altList = altRaw.split(',');
    const alleles: VcfAllele[] = [];
    let altBad = false;
    for (const a0 of altList) {
      const a = a0.startsWith('<') || /[[\]]/.test(a0) ? a0 : a0.toUpperCase();
      const type = classifyAllele(ref, a);
      if ((type === 'SNV' || type === 'MNV' || type === 'insertion' || type === 'deletion' || type === 'delins' || type === 'no_alt') && a !== '.' && !ALT_BASES_RE.test(a)) {
        altBad = true;
        break;
      }
      if (a === ref) {
        altBad = true;
        break;
      }
      alleles.push({ alt: a, type });
    }
    if (altBad) {
      pushLineError({ severity: 'error', code: 'vcf_bad_alt', params: { line: lineNo, value: altRaw.slice(0, 20) } });
      continue;
    }
    const pos = Number(posStr);
    let gt: string | null = null;
    let validGenotypeSamples: number | null = null;
    if (cols.length >= 10) {
      const fmtKeys = cols[8].split(':');
      const gi = fmtKeys.indexOf('GT');
      if (gi >= 0) {
        validGenotypeSamples = 0;
        const maxAllele = altList.length;
        for (let si = 9; si < cols.length; si++) {
          const candidate = cols[si].split(':')[gi] ?? '.';
          if (si === 9) gt = candidate;
          if (isValidGenotype(candidate, maxAllele)) validGenotypeSamples++;
          else {
            malformedGenotypes++;
            if (genotypeIssues.length < VCF_LIMITS.maxDetailedPerCode) {
              genotypeIssues.push({ severity: 'warning', code: 'vcf_bad_genotype', params: { line: lineNo, value: candidate.slice(0, 20) } });
            }
          }
        }
      }
    }
    if (alleles.some((a) => ['symbolic', 'breakend', 'spanning_deletion'].includes(a.type))) {
      unsupportedAlt++;
      if (unsupportedIssues.length < VCF_LIMITS.maxDetailedPerCode) {
        unsupportedIssues.push({ severity: 'info', code: 'vcf_unsupported_alt', params: { line: lineNo, value: altRaw.slice(0, 30) } });
      }
    }
    const key = `${chrom}:${pos}:${ref}:${altRaw}`;
    if (seenKeys.has(key)) duplicates++;
    seenKeys.add(key);
    if (chrom === lastChrom && pos < lastPos) unsorted = true;
    lastChrom = chrom;
    lastPos = pos;
    records.push({ line: lineNo, chrom, pos, id, ref, alleles, qual, filter, info, firstSampleGenotype: gt, validGenotypeSamples });
  }

  if (!headerColumns && !issues.some((i) => i.severity === 'error')) {
    issues.push({ severity: 'error', code: 'vcf_missing_header', params: { line: 1 } });
  }
  if (!fileFormat) issues.push({ severity: 'warning', code: 'vcf_no_fileformat' });
  else if (!/^VCFv4\.[0-5]$/.test(fileFormat)) issues.push({ severity: 'warning', code: 'vcf_unusual_version', params: { version: fileFormat } });
  if (skippedLines > 0) {
    issues.push({ severity: 'warning', code: 'vcf_lines_skipped', params: { count: skippedLines } });
    issues.push(...lineErrors);
  }
  issues.push(...genotypeIssues);
  if (malformedGenotypes > genotypeIssues.length) {
    issues.push({ severity: 'warning', code: 'vcf_bad_genotype_more', params: { count: malformedGenotypes - genotypeIssues.length, total: malformedGenotypes } });
  }
  issues.push(...unsupportedIssues);
  if (unsupportedAlt > unsupportedIssues.length) {
    issues.push({ severity: 'info', code: 'vcf_unsupported_alt_more', params: { count: unsupportedAlt - unsupportedIssues.length, total: unsupportedAlt } });
  }
  if (duplicates > 0) issues.push({ severity: 'warning', code: 'vcf_duplicates', params: { count: duplicates } });
  if (unsorted) issues.push({ severity: 'info', code: 'vcf_unsorted' });
  if (truncated) issues.push({ severity: 'warning', code: 'vcf_truncated', params: { max: VCF_LIMITS.maxRecords } });
  if (headerColumns && records.length === 0 && !issues.some((i) => i.severity === 'error' && i.code !== 'vcf_bad_pos')) {
    issues.push({ severity: 'warning', code: 'vcf_no_records' });
  }

  const builds = Array.from(new Set(buildVotes.map((v) => v.build)));
  const build: BuildEvidence = {
    build: builds.length === 1 ? builds[0] : null,
    conflict: builds.length > 1,
    sources: Array.from(new Set(buildVotes.map((v) => `${v.source} → ${v.build}`))).slice(0, 6),
  };
  if (build.conflict) issues.push({ severity: 'warning', code: 'vcf_build_conflict' });
  else if (!build.build) issues.push({ severity: 'info', code: 'vcf_build_unknown' });
  // A contig length is evidence, not a complete reference validation. When it is
  // present, still reject coordinates outside the declared contig length.
  const contigLengths = new Map<string, number>();
  for (const raw of lines) {
    const m = /^##contig=<[^>]*ID=([^,>]+)[^>]*length=(\d+)/i.exec(raw);
    if (m) contigLengths.set(normalizeChromName(m[1]), Number(m[2]));
  }
  let outOfContig = 0;
  for (const r of records) {
    const length = contigLengths.get(normalizeChromName(r.chrom));
    if (length !== undefined && r.pos > length) {
      outOfContig++;
      if (outOfContig <= VCF_LIMITS.maxDetailedPerCode) {
        issues.push({ severity: 'error', code: 'vcf_pos_out_of_contig', params: { line: r.line, pos: r.pos, length } });
      }
    }
  }
  if (outOfContig > VCF_LIMITS.maxDetailedPerCode) {
    issues.push({ severity: 'info', code: 'vcf_pos_out_of_contig_more', params: { count: outOfContig - VCF_LIMITS.maxDetailedPerCode, total: outOfContig } });
  }

  const fatal = issues.some((i) => i.severity === 'error' && !i.code.startsWith('vcf_bad_') && i.code !== 'vcf_too_few_columns' && i.code !== 'vcf_not_tab_delimited');
  return { ok: !fatal, fileFormat, sampleCount, records, build, issues, skippedLines, counts: { malformedGenotypes, unsupportedAlt, outOfContig } };
}

/** A small, clearly SYNTHETIC demonstration VCF (no real individual's data). */
export const DEMO_VCF = [
  '##fileformat=VCFv4.2',
  '##source=BioAI.Lab_SYNTHETIC_DEMO (not real patient data)',
  '##reference=GRCh38',
  '##contig=<ID=chr7,length=159345973,assembly=GRCh38>',
  '##contig=<ID=chr17,length=83257441,assembly=GRCh38>',
  '##INFO=<ID=DEMO,Number=0,Type=Flag,Description="Synthetic demonstration record">',
  '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">',
  '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tSYNTHETIC_SAMPLE',
  'chr7\t117559590\t.\tATCT\tA\t50\tPASS\tDEMO\tGT\t0/1',
  'chr17\t43045712\t.\tG\tA\t50\tPASS\tDEMO\tGT\t0/1',
  'chr17\t43057051\t.\tC\tCA\t50\tPASS\tDEMO\tGT\t0/0',
  'chr17\t43082434\t.\tGA\tTC\t50\tPASS\tDEMO\tGT\t0/1',
].join('\n');
