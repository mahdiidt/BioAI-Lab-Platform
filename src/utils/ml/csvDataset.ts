// Gene-expression CSV ingestion and validation for Cancer ML Studio.
//
// Expected layout ("tidy", one row per sample):
//   sample_id,condition,GENE_A,GENE_B,...
//   S001,tumor,12.1,0.3,...
// - One optional sample-ID column (unique, non-numeric).
// - One label column with exactly two classes (binary classification).
// - All remaining columns are numeric expression features.
// Everything here runs locally; nothing is uploaded.

import { summarizeGroups } from './groups';

export type MlIssueSeverity = 'error' | 'warning' | 'info';

export interface MlIssue {
  severity: MlIssueSeverity;
  /** Stable machine-readable code; the UI maps it to an i18n key `ml_issue_<code>`. */
  code: string;
  params?: Record<string, string | number>;
}

export const ML_LIMITS = {
  maxFileBytes: 15 * 1024 * 1024,
  maxSamples: 5000,
  /** Wide enough for common microarray platforms (e.g. ~55k probes); maxCells still bounds memory. */
  maxColumns: 60000,
  maxCells: 5_000_000,
  minTotalSamples: 10,
  /** A mostly numeric column whose invalid (non-numeric) cells are at most this fraction is kept; those cells become missing. */
  maxInvalidCellFraction: 0.05,
  /** Matrix size (bytes, Float64) above which a memory/performance warning is shown. */
  memoryWarningBytes: 24 * 1024 * 1024,
  minSamplesPerClass: 5,
  maxLabelClasses: 2,
};

const MISSING_TOKENS = new Set(['', 'NA', 'N/A', 'NAN', 'NULL', 'NONE', '?', '#N/A']);
const NUMERIC_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

export function isMissingToken(raw: string): boolean {
  return MISSING_TOKENS.has(raw.trim().toUpperCase());
}

const DECIMAL_COMMA_RE = /^[+-]?\d+,\d+([eE][+-]?\d+)?$/;
const DECIMAL_DOT_RE = /^[+-]?\d*\.\d+([eE][+-]?\d+)?$/;

/**
 * Parses a strictly numeric cell. Returns NaN for missing, null for non-numeric text.
 * With `decimalComma`, a single comma is accepted as the decimal separator
 * (e.g. "3,25" from German/French/Spanish spreadsheet exports).
 */
export function parseNumericCell(raw: string, decimalComma = false): number | null {
  let s = raw.trim();
  if (isMissingToken(s)) return NaN;
  if (decimalComma && DECIMAL_COMMA_RE.test(s)) s = s.replace(',', '.');
  if (!NUMERIC_RE.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

export interface ParsedTable {
  header: string[];
  rows: string[][];
  /** 1-based source line number of each data row (for error messages). */
  rowLines: number[];
  delimiter: string;
  /** True when ';' or tab-delimited data use ',' as the decimal separator. */
  decimalComma?: boolean;
  issues: MlIssue[];
}

function detectDelimiter(headerLine: string): string {
  const candidates = [',', '\t', ';'];
  let best = ',';
  let bestCount = -1;
  for (const d of candidates) {
    const count = headerLine.split(d).length - 1;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/**
 * RFC 4180-style delimited-text parser (quoted fields, escaped quotes, CRLF).
 * Lines whose first character is '#' are treated as comments and skipped.
 */
export function parseDelimitedTable(text: string, forcedDelimiter?: string): ParsedTable {
  const issues: MlIssue[] = [];
  const clean = (text || '').replace(/^\uFEFF/, '');
  if (!clean.trim()) {
    return { header: [], rows: [], rowLines: [], delimiter: ',', issues: [{ severity: 'error', code: 'empty_file' }] };
  }
  if (clean.indexOf(String.fromCharCode(0)) !== -1) {
    return { header: [], rows: [], rowLines: [], delimiter: ',', issues: [{ severity: 'error', code: 'binary_file' }] };
  }

  // Find first non-comment, non-empty line for delimiter detection.
  const firstLine = clean.split(/\r?\n/).find((l) => l.trim() !== '' && !l.startsWith('#')) || '';
  const delimiter = forcedDelimiter || detectDelimiter(firstLine);

  const records: { fields: string[]; line: number }[] = [];
  let field = '';
  let fields: string[] = [];
  let inQuotes = false;
  let line = 1;
  let recordStartLine = 1;
  let atRecordStart = true;
  let isComment = false;
  const commentLines: { line: number; text: string }[] = [];
  let commentBuf = '';

  const pushRecord = () => {
    fields.push(field);
    const allEmpty = fields.every((f) => f.trim() === '');
    if (!isComment && !allEmpty) records.push({ fields, line: recordStartLine });
    fields = [];
    field = '';
    atRecordStart = true;
    isComment = false;
  };

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (atRecordStart) {
      recordStartLine = line;
      atRecordStart = false;
      if (ch === '#') isComment = true;
    }
    if (isComment) {
      if (ch === '\n') {
        commentLines.push({ line: recordStartLine, text: commentBuf });
        commentBuf = '';
        line++;
        fields = [];
        field = '';
        atRecordStart = true;
        isComment = false;
      } else if (ch !== '\r') {
        commentBuf += ch;
      }
      continue;
    }
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field.trim() === '') {
      inQuotes = true;
      field = '';
    } else if (ch === delimiter) {
      fields.push(field);
      field = '';
    } else if (ch === '\n') {
      pushRecord();
      line++;
    } else if (ch === '\r') {
      // ignore (CRLF)
    } else {
      field += ch;
    }
  }
  if (inQuotes) {
    issues.push({ severity: 'error', code: 'unterminated_quote', params: { line: recordStartLine } });
    return { header: [], rows: [], rowLines: [], delimiter, issues };
  }
  if (isComment) commentLines.push({ line: recordStartLine, text: commentBuf });
  if (!atRecordStart || field !== '' || fields.length > 0) pushRecord();

  if (records.length === 0) {
    return { header: [], rows: [], rowLines: [], delimiter, issues: [{ severity: 'error', code: 'empty_file' }] };
  }

  // Comment handling is explicit. A '#'-prefixed line directly above the first
  // data-like record is promoted to the header ONLY when it has the same number
  // of fields and the record below it contains numeric cells (i.e. it is a data
  // row, not a header). The promotion is always reported; otherwise comment
  // lines are skipped and counted. A header line is never silently dropped.
  let commentsSkipped = commentLines.length;
  const leading = commentLines.filter((c) => c.line < records[0].line);
  if (leading.length > 0) {
    const last = leading[leading.length - 1];
    const hashFields = last.text
      .replace(/^#+\s*/, '')
      .split(delimiter)
      .map((h) => h.trim().replace(/^"(.*)"$/, '$1'));
    const firstIsData = records[0].fields.some((f) => {
      const v = parseNumericCell(f.trim());
      return v !== null && !Number.isNaN(v);
    });
    if (hashFields.length >= 2 && hashFields.length === records[0].fields.length && hashFields.every((h) => h !== '') && firstIsData) {
      records.unshift({ fields: hashFields, line: last.line });
      commentsSkipped--;
      issues.push({ severity: 'warning', code: 'header_hash_prefixed', params: { line: last.line } });
    }
  }
  if (commentsSkipped > 0) issues.push({ severity: 'info', code: 'comment_lines_skipped', params: { count: commentsSkipped } });

  const header = records[0].fields.map((h) => h.trim());
  const rows: string[][] = [];
  const rowLines: number[] = [];
  const ragged: number[] = [];
  for (let r = 1; r < records.length; r++) {
    const rec = records[r];
    if (rec.fields.length !== header.length) {
      ragged.push(rec.line);
      continue;
    }
    rows.push(rec.fields.map((f) => f.trim()));
    rowLines.push(rec.line);
  }
  if (ragged.length > 0) {
    issues.push({
      severity: 'error',
      code: 'ragged_rows',
      params: { count: ragged.length, lines: ragged.slice(0, 5).join(', '), expected: header.length },
    });
  }
  if (header.length < 2) {
    issues.push({ severity: 'error', code: 'too_few_columns' });
  }
  if (rows.length === 0) {
    issues.push({ severity: 'error', code: 'no_data_rows' });
  }
  if (rows.length > ML_LIMITS.maxSamples) {
    issues.push({ severity: 'error', code: 'too_many_samples', params: { count: rows.length, max: ML_LIMITS.maxSamples } });
  }
  if (header.length > ML_LIMITS.maxColumns) {
    issues.push({ severity: 'error', code: 'too_many_columns', params: { count: header.length, max: ML_LIMITS.maxColumns } });
  }
  if (rows.length * header.length > ML_LIMITS.maxCells) {
    issues.push({ severity: 'error', code: 'too_many_cells', params: { max: ML_LIMITS.maxCells } });
  }

  // Decimal-comma detection (only for non-comma delimiters, where it is unambiguous).
  let decimalComma = false;
  if (delimiter !== ',' && rows.length > 0) {
    let commaDec = 0;
    let dotDec = 0;
    const sampleRows = rows.slice(0, 200);
    for (const r of sampleRows) {
      for (let c = 0; c < r.length && c < 200; c++) {
        if (DECIMAL_COMMA_RE.test(r[c])) commaDec++;
        else if (DECIMAL_DOT_RE.test(r[c])) dotDec++;
      }
    }
    if (commaDec > 0 && dotDec === 0) {
      decimalComma = true;
      issues.push({ severity: 'info', code: 'decimal_comma_detected' });
    } else if (commaDec > 0 && dotDec > 0) {
      issues.push({ severity: 'warning', code: 'mixed_decimal_separators' });
    }
  }

  // Duplicate / empty column names
  const seen = new Map<string, number>();
  const dups = new Set<string>();
  header.forEach((h) => {
    const key = h;
    seen.set(key, (seen.get(key) || 0) + 1);
    if ((seen.get(key) || 0) > 1) dups.add(h);
  });
  if (header.some((h) => h === '')) {
    issues.push({ severity: 'error', code: 'empty_column_name' });
  }
  if (dups.size > 0) {
    issues.push({
      severity: 'error',
      code: 'duplicate_columns',
      params: { names: Array.from(dups).filter((d) => d !== '').slice(0, 8).join(', ') || '""' },
    });
  }

  return { header, rows, rowLines, delimiter, decimalComma, issues };
}

export interface ColumnProfile {
  index: number;
  name: string;
  numericCount: number;
  missingCount: number;
  nonNumericCount: number;
  /** Example offending (non-numeric) values, max 3. */
  nonNumericExamples: string[];
  /** Distinct non-missing raw values (capped at 51 to stay cheap). */
  distinctValues: string[];
  distinctCapped: boolean;
  isNumeric: boolean;
}

export function profileColumns(table: ParsedTable): ColumnProfile[] {
  return table.header.map((name, index) => {
    let numericCount = 0;
    let missingCount = 0;
    let nonNumericCount = 0;
    const nonNumericExamples: string[] = [];
    const distinct = new Set<string>();
    let distinctCapped = false;
    for (const row of table.rows) {
      const raw = row[index] ?? '';
      const v = parseNumericCell(raw, table.decimalComma);
      if (v === null) {
        nonNumericCount++;
        if (nonNumericExamples.length < 3 && !nonNumericExamples.includes(raw)) nonNumericExamples.push(raw);
      } else if (Number.isNaN(v)) {
        missingCount++;
        continue;
      } else {
        numericCount++;
      }
      if (!distinctCapped) {
        distinct.add(raw);
        if (distinct.size > 50) distinctCapped = true;
      }
    }
    return {
      index,
      name,
      numericCount,
      missingCount,
      nonNumericCount,
      nonNumericExamples,
      distinctValues: Array.from(distinct).slice(0, 50),
      distinctCapped,
      isNumeric: nonNumericCount === 0 && numericCount > 0,
    };
  });
}

const LABEL_NAME_RE = /^(label|class|target|diagnosis|condition|status|group|phenotype|tissue_type|sample_type|type|outcome)$/i;

/** Splits a column name into lower-case tokens (camelCase, letter/digit and punctuation boundaries). "RUNX1" -> ["runx","1"]; "batch_ID" -> ["batch","id"]. */
export function nameTokens(name: string): string[] {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
const compact = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

const BATCH_TOKENS = new Set(['batch', 'site', 'center', 'centre', 'plate', 'run', 'lane', 'platform', 'lab', 'laboratory', 'instrument', 'machine', 'operator', 'sequencer', 'flowcell', 'library', 'protocol', 'scanner', 'chip', 'array', 'slide', 'hospital', 'institution']);
/** True when a WHOLE TOKEN of the name is a batch/site/run term. Substrings do not count (RUNX1, LABA1, PLATE-like gene names are not matched). Always a warning, never a reason to discard a column. */
export function isBatchLikeName(name: string): boolean {
  return nameTokens(name).some((t) => BATCH_TOKENS.has(t));
}

const SAMPLE_ID_KEYS = new Set(['sample', 'sampleid', 'id', 'samplename', 'sampleidentifier', 'barcode', 'specimen', 'specimenid', 'aliquot', 'aliquotid', 'accession', 'geoaccession', 'libraryid']);
const GROUP_KEYS = new Set(['patient', 'patientid', 'patientno', 'patientnumber', 'pid', 'subject', 'subjectid', 'subj', 'donor', 'donorid', 'individual', 'individualid', 'participant', 'participantid', 'tcgaparticipant', 'case', 'caseid', 'cohort', 'family', 'familyid', 'mrn', 'person', 'personid', 'animal', 'animalid', 'mouse', 'mouseid']);
const IDENTIFIER_TOKENS = new Set(['patient', 'subject', 'donor', 'participant', 'mrn', 'barcode', 'accession', 'specimen', 'aliquot', 'uuid', 'uid', 'pid', 'guid']);

export function isGroupLikeName(name: string): boolean {
  return GROUP_KEYS.has(compact(name));
}
/** Kept for compatibility with earlier code; prefer isGroupLikeName. */
export const GROUP_NAME_RE = /^(patient|patient_id|subject|subject_id|donor|donor_id|individual|individual_id|participant|participant_id|tcga_participant|case|cohort|family|family_id)$/i;

/** Name looks like an identifier. A trailing "id" token counts only after a word ("patient_id", "sampleID"); "ID1"/"ID2" (real genes) do not. */
export function isIdentifierLikeName(name: string): boolean {
  const t = nameTokens(name);
  if (t.length === 0) return false;
  if (t.length === 1 && (t[0] === 'id' || IDENTIFIER_TOKENS.has(t[0]))) return true;
  if (t.length >= 2 && t[t.length - 1] === 'id') return true;
  if (t.some((x) => IDENTIFIER_TOKENS.has(x)) && !/\d$/.test(compact(name))) return true;
  const c = compact(name);
  return SAMPLE_ID_KEYS.has(c) || GROUP_KEYS.has(c) || c === 'rowid' || c === 'rownumber' || c === 'rowindex' || c === 'index';
}

function columnDistinct(table: ParsedTable, idx: number): { distinct: number; nonEmpty: number } {
  const seen = new Set<string>();
  let nonEmpty = 0;
  for (const r of table.rows) {
    const v = (r[idx] ?? '').trim();
    if (v === '' || isMissingToken(v)) continue;
    nonEmpty++;
    seen.add(v);
  }
  return { distinct: seen.size, nonEmpty };
}

export function suggestColumns(
  table: ParsedTable,
  profiles: ColumnProfile[]
): { idColumn: string | null; labelColumn: string | null; groupColumn?: string | null } {
  let idColumn: string | null = null;
  let labelColumn: string | null = null;
  const n = table.rows.length;
  const uniqueNonNumeric = (p: ColumnProfile) =>
    !p.isNumeric && !p.distinctCapped ? p.distinctValues.length === n : !p.isNumeric && p.distinctCapped;
  const isUnique = (p: ColumnProfile) => {
    const d = columnDistinct(table, p.index);
    return d.nonEmpty === n && d.distinct === n;
  };

  // Sample ID: a sample-like name with unique values. Patient/subject-like names are NOT sample IDs.
  const byName = profiles.find((p) => SAMPLE_ID_KEYS.has(compact(p.name)) && isUnique(p));
  if (byName) idColumn = byName.name;
  else if (profiles[0] && !profiles[0].isNumeric && uniqueNonNumeric(profiles[0]) && !isGroupLikeName(profiles[0].name)) idColumn = profiles[0].name;

  const labelByName = profiles.find((p) => p.name !== idColumn && LABEL_NAME_RE.test(p.name));
  if (labelByName) labelColumn = labelByName.name;
  else {
    const candidate = profiles.find(
      (p) => p.name !== idColumn && !p.isNumeric && !p.distinctCapped && p.distinctValues.length >= 2 && p.distinctValues.length <= 10 && !isGroupLikeName(p.name)
    );
    if (candidate) labelColumn = candidate.name;
  }
  // Group column: a patient/subject-like name whose values REPEAT (several rows per subject).
  // A patient-like column with all-unique values is not a useful group; it is offered as the ID when no sample ID exists.
  const groupCandidate = profiles.find((p) => p.name !== idColumn && p.name !== labelColumn && isGroupLikeName(p.name) && !isUnique(p));
  const groupColumn = groupCandidate ? groupCandidate.name : null;
  if (!idColumn) {
    const uniquePatient = profiles.find((p) => p.name !== labelColumn && p.name !== groupColumn && isGroupLikeName(p.name) && isUnique(p));
    if (uniquePatient) idColumn = uniquePatient.name;
  }
  return groupColumn ? { idColumn, labelColumn, groupColumn } : { idColumn, labelColumn };
}

export interface MlDataset {
  /** Row-major feature matrix; NaN marks a missing value. */
  X: Float64Array[];
  /** 1 = positive class, 0 = negative class. */
  y: number[];
  sampleIds: string[];
  featureNames: string[];
  /** [negativeClass, positiveClass] as they appear in the label column. */
  classes: [string, string];
  classCounts: [number, number];
  missingValueCount: number;
  excludedColumns: { name: string; reason: 'non_numeric' | 'all_missing' | 'auxiliary' | 'suspected_identifier' | 'user_excluded' }[];
  /** Columns flagged by the (incomplete) leakage/confounding heuristics, with the decision that was applied. */
  featureReview?: FeatureReviewItem[];
  droppedSamples: number;
  /** Batch-like columns that were excluded as features but checked for confounding. */
  batchChecks: { column: string; cramersV: number; levels: number }[];
  /** Subject / patient / cohort group per sample (same order as y), when a group column was chosen. */
  groups?: string[] | null;
  groupColumn?: string | null;
  /** Data-quality summary shown before training and written into reports. */
  qc?: DatasetQc;
  /** Deterministic FNV-1a fingerprint of ids, labels, groups and values (reproducibility, not security). */
  fingerprint?: string;
}

export type FeatureFlag = 'identifier_name' | 'sequential' | 'integer_unique' | 'batch_name' | 'low_cardinality' | 'label_confounded';

export interface FeatureReviewItem {
  name: string;
  flags: FeatureFlag[];
  /** Distinct non-missing values. */
  distinct: number;
  /** Cramér's V against the label for low-cardinality columns, otherwise null. */
  cramersV: number | null;
  /** True when the column is left out unless the user explicitly includes it. */
  defaultExcluded: boolean;
  /** Final decision applied to this build. */
  used: boolean;
}

export type DuplicateHandling = 'keep' | 'group' | 'remove';

export interface DatasetQc {
  /** How exact duplicate feature rows were treated: kept (warned), merged into groups, or removed (same-label duplicates only). */
  duplicateHandling?: DuplicateHandling;
  duplicatesRemoved?: number;
  conflictingDuplicateSets?: number;
  samples: number;
  features: number;
  missingCells: number;
  missingFraction: number;
  featuresWithMissing: number;
  topMissingFeatures: { name: string; fraction: number }[];
  samplesWithMissing: number;
  topMissingSamples: { id: string; fraction: number }[];
  /** Non-numeric cells inside otherwise numeric feature columns, converted to missing. */
  invalidCells: number;
  invalidCellColumns: { name: string; count: number; examples: string[] }[];
  /** Sample-id groups whose feature vectors are identical (first 5 groups). */
  duplicateRowGroups: string[][];
  duplicateRows: number;
  constantFeatures: number;
  estimatedMatrixBytes: number;
  groupSummary: { groups: number; multiSampleGroups: number; mixedLabelGroups: number; largestGroup: number } | null;
}

/** 32-bit FNV-1a over a string stream; returned as 8 hex digits. */
export function fnv1a(parts: Iterable<string>): string {
  let h = 0x811c9dc5;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      h ^= part.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= 0x1f; // field separator
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export interface BuildDatasetOptions {
  labelColumn: string;
  idColumn: string | null;
  positiveClass?: string;
  /** Optional subject / patient / cohort column used for group-aware evaluation. */
  groupColumn?: string | null;
  /** Per-column override of the default feature decision. Absent = heuristic default. */
  featureOverrides?: Record<string, 'include' | 'exclude'>;
  /** What to do with rows whose feature vectors are identical (default 'keep' + warning). */
  duplicateHandling?: DuplicateHandling;
}

export interface BuildDatasetResult {
  dataset: MlDataset | null;
  /** Columns the leakage/confounding heuristics flagged (always shown to the user for review). */
  featureReview?: FeatureReviewItem[];
  issues: MlIssue[];
  /** Distinct non-missing label values found (for the positive-class picker). */
  labelValues: string[];
}

function cramersV(a: string[], b: string[]): { v: number; levels: number } {
  const la = Array.from(new Set(a));
  const lb = Array.from(new Set(b));
  if (la.length < 2 || lb.length < 2) return { v: 0, levels: la.length };
  const n = a.length;
  const table = la.map(() => lb.map(() => 0));
  for (let i = 0; i < n; i++) table[la.indexOf(a[i])][lb.indexOf(b[i])]++;
  const rowSums = table.map((r) => r.reduce((s, x) => s + x, 0));
  const colSums = lb.map((_, j) => table.reduce((s, r) => s + r[j], 0));
  let chi2 = 0;
  for (let i = 0; i < la.length; i++) {
    for (let j = 0; j < lb.length; j++) {
      const e = (rowSums[i] * colSums[j]) / n;
      if (e > 0) chi2 += (table[i][j] - e) ** 2 / e;
    }
  }
  const k = Math.min(la.length, lb.length) - 1;
  return { v: Math.sqrt(chi2 / (n * k)), levels: la.length };
}

const POSITIVE_LABEL_RE = /tumou?r|cancer|carcinoma|malignan|neoplas|case|disease|positive|^1$/i;
// Negations / control-like wording: "non-tumor", "no_disease", "cancer-free", "normal", "healthy", "benign"...
const NEGATIVE_LABEL_RE =
  /^(non|not|no|anti)([\s_-]|(?=(tumou?r|cancer|carcin|malignan|neoplas|disease|case)))|[\s_-]free$|normal|healthy|control|benign|negative|^0$/i;

/**
 * Picks the class that is treated as "positive" when the user has not chosen one:
 * a single tumour/case-like label that is not negated; otherwise the minority class
 * (ties broken alphabetically). The UI always lets the user override this.
 */
export function guessPositiveClass(labelValues: string[], labelCounts: Map<string, number>): string {
  const isNeg = (v: string) => NEGATIVE_LABEL_RE.test(v);
  const positiveLike = labelValues.filter((v) => POSITIVE_LABEL_RE.test(v) && !isNeg(v));
  if (positiveLike.length === 1) return positiveLike[0];
  const negativeLike = labelValues.filter((v) => isNeg(v));
  if (negativeLike.length === 1 && labelValues.length === 2) return labelValues.find((v) => v !== negativeLike[0])!;
  return labelValues.slice().sort((a, b) => (labelCounts.get(a)! - labelCounts.get(b)!) || a.localeCompare(b))[0];
}

interface ColumnScan {
  m: number;
  allInt: boolean;
  distinct: number;
  sequential: boolean;
}

function scanNumericColumn(table: ParsedTable, rows: number[], idx: number): ColumnScan {
  const seen = new Set<number>();
  let m = 0;
  let allInt = true;
  let prev = NaN;
  let inc = true;
  let dec = true;
  for (const i of rows) {
    const v = parseNumericCell(table.rows[i][idx] ?? '', table.decimalComma);
    if (v === null || Number.isNaN(v)) continue;
    m++;
    if (!Number.isInteger(v)) allInt = false;
    seen.add(v);
    if (m > 1) {
      if (!(v > prev)) inc = false;
      if (!(v < prev)) dec = false;
    }
    prev = v;
  }
  return { m, allInt, distinct: seen.size, sequential: m >= 10 && allInt && (inc || dec) };
}

/**
 * Heuristic leakage / confounding review of candidate feature columns. It can
 * only flag columns that LOOK like identifiers or batch codes; it cannot find
 * every leakage source, so the user must review the feature list themselves.
 *  - identifier_name / sequential / integer_unique -> excluded by default
 *    (integer_unique is skipped when most columns are integer-valued, e.g. a raw count matrix);
 *  - batch_name + low_cardinality -> excluded by default;
 *  - low_cardinality with strong label association (Cramér's V >= 0.5), or a
 *    batch-like name alone -> warned, included by default.
 */
export function reviewFeatureColumns(table: ParsedTable, candidates: number[], keptRows: number[], keptLabels: string[]): FeatureReviewItem[] {
  const scans = candidates.map((idx) => scanNumericColumn(table, keptRows, idx));
  const intCols = scans.filter((c) => c.m > 0 && c.allInt).length;
  const countLike = candidates.length > 0 && intCols / candidates.length >= 0.5;
  const out: FeatureReviewItem[] = [];
  candidates.forEach((idx, k) => {
    const name = table.header[idx];
    const sc = scans[k];
    const flags: FeatureFlag[] = [];
    if (isIdentifierLikeName(name)) flags.push('identifier_name');
    if (sc.sequential) flags.push('sequential');
    if (!countLike && sc.allInt && sc.m >= 10 && sc.distinct / sc.m >= 0.95) flags.push('integer_unique');
    const batchName = isBatchLikeName(name);
    if (batchName) flags.push('batch_name');
    let v: number | null = null;
    const lowCard = sc.m >= 10 && sc.distinct >= 2 && sc.distinct <= 8 && sc.distinct <= sc.m / 4;
    if (lowCard) {
      const vals = keptRows.map((i) => (table.rows[i][idx] ?? '').trim());
      const res = cramersV(vals, keptLabels);
      v = Number(res.v.toFixed(3));
      if (v >= 0.5 || batchName) flags.push('low_cardinality');
      if (v >= 0.5) flags.push('label_confounded');
    }
    if (flags.length === 0) return;
    const strong = flags.includes('identifier_name') || flags.includes('sequential') || flags.includes('integer_unique') || (flags.includes('batch_name') && flags.includes('low_cardinality'));
    out.push({ name, flags, distinct: sc.distinct, cramersV: v, defaultExcluded: strong, used: !strong });
  });
  // strongest first
  out.sort((a, b) => Number(b.defaultExcluded) - Number(a.defaultExcluded) || b.flags.length - a.flags.length || a.name.localeCompare(b.name));
  return out;
}

export function buildDataset(table: ParsedTable, profiles: ColumnProfile[], opts: BuildDatasetOptions): BuildDatasetResult {
  const issues: MlIssue[] = [];
  const labelIdx = table.header.indexOf(opts.labelColumn);
  if (labelIdx < 0) {
    return { dataset: null, issues: [{ severity: 'error', code: 'label_not_found', params: { name: opts.labelColumn } }], labelValues: [] };
  }
  const idIdx = opts.idColumn ? table.header.indexOf(opts.idColumn) : -1;
  if (opts.idColumn && idIdx < 0) {
    return { dataset: null, issues: [{ severity: 'error', code: 'id_not_found', params: { name: opts.idColumn } }], labelValues: [] };
  }
  if (idIdx === labelIdx) {
    return { dataset: null, issues: [{ severity: 'error', code: 'id_equals_label' }], labelValues: [] };
  }
  const groupIdx = opts.groupColumn ? table.header.indexOf(opts.groupColumn) : -1;
  if (opts.groupColumn && groupIdx < 0) {
    return { dataset: null, issues: [{ severity: 'error', code: 'group_not_found', params: { name: opts.groupColumn } }], labelValues: [] };
  }
  if (groupIdx >= 0 && groupIdx === labelIdx) {
    return { dataset: null, issues: [{ severity: 'error', code: 'group_equals_label' }], labelValues: [] };
  }

  // Labels
  const rawLabels = table.rows.map((r) => (r[labelIdx] ?? '').trim());
  let keep: number[] = [];
  rawLabels.forEach((l, i) => {
    if (!isMissingToken(l)) keep.push(i);
  });
  const droppedSamples = table.rows.length - keep.length;
  if (droppedSamples > 0) {
    issues.push({ severity: 'warning', code: 'missing_labels_dropped', params: { count: droppedSamples } });
  }
  const labelCounts = new Map<string, number>();
  keep.forEach((i) => labelCounts.set(rawLabels[i], (labelCounts.get(rawLabels[i]) || 0) + 1));
  const labelValues = Array.from(labelCounts.keys()).sort();

  if (labelValues.length === 0) {
    issues.push({ severity: 'error', code: 'no_labels' });
    return { dataset: null, issues, labelValues };
  }
  if (labelValues.length === 1) {
    issues.push({ severity: 'error', code: 'one_class', params: { label: labelValues[0] } });
    return { dataset: null, issues, labelValues };
  }
  if (labelValues.length > ML_LIMITS.maxLabelClasses) {
    const allNumeric = labelValues.every((v) => parseNumericCell(v, table.decimalComma) !== null);
    issues.push({
      severity: 'error',
      code: allNumeric && labelValues.length > 10 ? 'label_continuous' : 'too_many_classes',
      params: { count: labelValues.length, values: labelValues.slice(0, 6).join(', ') },
    });
    return { dataset: null, issues, labelValues };
  }

  let positive = opts.positiveClass && labelValues.includes(opts.positiveClass) ? opts.positiveClass : undefined;
  if (!positive) {
    positive = guessPositiveClass(labelValues, labelCounts);
    issues.push({ severity: 'info', code: 'positive_class_auto', params: { label: positive } });
  }
  const negative = labelValues.find((v) => v !== positive)!;
  const classCounts: [number, number] = [labelCounts.get(negative) || 0, labelCounts.get(positive) || 0];

  // Sample IDs
  let sampleIds = keep.map((i, k) => (idIdx >= 0 ? (table.rows[i][idIdx] ?? '').trim() : `row_${table.rowLines[i] ?? k + 2}`));
  if (idIdx >= 0) {
    const seen = new Set<string>();
    const dupIds: string[] = [];
    const emptyIds = sampleIds.filter((s) => s === '').length;
    sampleIds.forEach((s) => {
      if (seen.has(s) && s !== '') dupIds.push(s);
      seen.add(s);
    });
    if (dupIds.length > 0) {
      issues.push({ severity: 'error', code: 'duplicate_sample_ids', params: { ids: Array.from(new Set(dupIds)).slice(0, 5).join(', ') } });
    }
    if (emptyIds > 0) issues.push({ severity: 'warning', code: 'empty_sample_ids', params: { count: emptyIds } });
  }

  // Features
  const featureIdx: number[] = [];
  const excludedColumns: MlDataset['excludedColumns'] = [];
  const batchChecks: MlDataset['batchChecks'] = [];
  const keptLabels = keep.map((i) => rawLabels[i]);
  const invalidCellColumns: DatasetQc['invalidCellColumns'] = [];
  for (const p of profiles) {
    if (p.index === labelIdx || p.index === idIdx || p.index === groupIdx) continue;
    const observed = p.numericCount + p.nonNumericCount;
    const mostlyNumeric =
      !p.isNumeric &&
      p.numericCount > 0 &&
      observed > 0 &&
      p.nonNumericCount / observed <= ML_LIMITS.maxInvalidCellFraction;
    if (p.isNumeric) {
      featureIdx.push(p.index);
    } else if (mostlyNumeric) {
      // Keep the feature; its few invalid cells (e.g. "#DIV/0!", "inf") become missing values and are reported.
      featureIdx.push(p.index);
      invalidCellColumns.push({ name: p.name, count: p.nonNumericCount, examples: p.nonNumericExamples.slice(0, 3) });
    } else if (p.numericCount === 0 && p.nonNumericCount === 0) {
      excludedColumns.push({ name: p.name, reason: 'all_missing' });
    } else {
      const isAux = isBatchLikeName(p.name) || p.numericCount === 0;
      excludedColumns.push({ name: p.name, reason: isAux ? 'auxiliary' : 'non_numeric' });
      if (isBatchLikeName(p.name)) {
        const vals = keep.map((i) => (table.rows[i][p.index] ?? '').trim());
        const { v, levels } = cramersV(vals, keptLabels);
        if (levels >= 2) batchChecks.push({ column: p.name, cramersV: Number(v.toFixed(3)), levels });
      }
    }
  }
  // Explicit feature review: heuristic flags + user overrides decide which numeric columns become features.
  const review = reviewFeatureColumns(table, featureIdx, keep, keptLabels);
  const reviewByName = new Map(review.map((r) => [r.name, r]));
  const overrides = opts.featureOverrides ?? {};
  const usedIdx: number[] = [];
  for (const j of featureIdx) {
    const name = table.header[j];
    const r = reviewByName.get(name);
    const ov = overrides[name];
    const include = ov === 'include' ? true : ov === 'exclude' ? false : r ? !r.defaultExcluded : true;
    if (r) r.used = include;
    if (include) usedIdx.push(j);
    else excludedColumns.push({ name, reason: ov === 'exclude' ? 'user_excluded' : 'suspected_identifier' });
  }
  featureIdx.splice(0, featureIdx.length, ...usedIdx);
  const usedNames = new Set(featureIdx.map((j) => table.header[j]));
  for (let k = invalidCellColumns.length - 1; k >= 0; k--) if (!usedNames.has(invalidCellColumns[k].name)) invalidCellColumns.splice(k, 1);
  const autoExcluded = review.filter((r) => !r.used && overrides[r.name] !== 'exclude');
  if (autoExcluded.length > 0) {
    issues.push({ severity: 'warning', code: 'identifier_columns_excluded', params: { count: autoExcluded.length, names: autoExcluded.slice(0, 5).map((r) => r.name).join(', ') } });
  }
  const flaggedUsed = review.filter((r) => r.used);
  if (flaggedUsed.length > 0) {
    issues.push({ severity: 'warning', code: 'suspicious_columns_included', params: { count: flaggedUsed.length, names: flaggedUsed.slice(0, 5).map((r) => r.name).join(', ') } });
  }
  const nonNumeric = excludedColumns.filter((c) => c.reason === 'non_numeric');
  if (nonNumeric.length > 0) {
    const prof = profiles.find((p) => p.name === nonNumeric[0].name);
    issues.push({
      severity: 'warning',
      code: 'non_numeric_features_excluded',
      params: {
        count: nonNumeric.length,
        names: nonNumeric.slice(0, 5).map((c) => c.name).join(', '),
        example: prof?.nonNumericExamples[0] ?? '',
      },
    });
  }
  for (const b of batchChecks) {
    if (b.cramersV >= 0.5) {
      issues.push({ severity: 'warning', code: 'batch_confounded', params: { column: b.column, v: b.cramersV } });
    } else {
      issues.push({ severity: 'info', code: 'batch_column_found', params: { column: b.column, v: b.cramersV } });
    }
  }
  if (invalidCellColumns.length > 0) {
    const total = invalidCellColumns.reduce((s, c) => s + c.count, 0);
    issues.push({
      severity: 'warning',
      code: 'invalid_cells_as_missing',
      params: {
        count: total,
        columns: invalidCellColumns.length,
        names: invalidCellColumns.slice(0, 5).map((c) => c.name).join(', '),
        example: invalidCellColumns[0].examples[0] ?? '',
      },
    });
  }
  if (featureIdx.length === 0) {
    issues.push({ severity: 'error', code: 'no_numeric_features' });
    return { dataset: null, issues, labelValues, featureReview: review };
  }
  // Feature names that differ only by letter case (e.g. TP53 / tp53) are usually duplicated genes.
  const lowerSeen = new Map<string, string>();
  const caseDups: string[] = [];
  for (const j of featureIdx) {
    const name = table.header[j];
    const key = name.toLowerCase();
    const prev = lowerSeen.get(key);
    if (prev !== undefined && prev !== name) caseDups.push(`${prev}/${name}`);
    else lowerSeen.set(key, name);
  }
  if (caseDups.length > 0) {
    issues.push({ severity: 'warning', code: 'case_duplicate_features', params: { count: caseDups.length, names: caseDups.slice(0, 5).join(', ') } });
  }

  let X: Float64Array[] = [];
  let missingValueCount = 0;
  for (const i of keep) {
    const row = new Float64Array(featureIdx.length);
    for (let j = 0; j < featureIdx.length; j++) {
      const v = parseNumericCell(table.rows[i][featureIdx[j]] ?? '', table.decimalComma);
      const num = v === null ? NaN : v;
      if (Number.isNaN(num)) missingValueCount++;
      row[j] = num;
    }
    X.push(row);
  }
  let y = keep.map((i) => (rawLabels[i] === positive ? 1 : 0));
  const p = featureIdx.length;

  // Duplicate feature rows: the handling is an explicit user choice.
  //  keep   - leave them in and warn (they can sit on both sides of a split);
  //  group  - treat identical rows as ONE group so they always stay together;
  //  remove - drop repeats that also share the same label (conflicting-label repeats are kept and reported).
  const dupMode: DuplicateHandling = opts.duplicateHandling ?? 'keep';
  const keyOf = (row: Float64Array) => Array.from(row, (v) => (Number.isNaN(v) ? 'NA' : String(v))).join('|');
  let duplicatesRemoved = 0;
  if (dupMode === 'remove' && p > 1) {
    const firstSeen = new Set<string>();
    const alive: number[] = [];
    X.forEach((row, i) => {
      const k = `${keyOf(row)}#${y[i]}`;
      if (firstSeen.has(k)) duplicatesRemoved++;
      else {
        firstSeen.add(k);
        alive.push(i);
      }
    });
    if (duplicatesRemoved > 0) {
      const oldX = X;
      const oldY = y;
      const oldKeep = keep;
      const oldIds = sampleIds;
      X = alive.map((i) => oldX[i]);
      y = alive.map((i) => oldY[i]);
      keep = alive.map((i) => oldKeep[i]);
      sampleIds = alive.map((i) => oldIds[i]);
      classCounts[0] = y.filter((v) => v === 0).length;
      classCounts[1] = y.filter((v) => v === 1).length;
      issues.push({ severity: 'info', code: 'duplicates_removed', params: { count: duplicatesRemoved } });
    }
  }
  const n = y.length;

  // Leakage checks: identical feature vectors (duplicated samples under different IDs)
  // and binary features that reproduce the label exactly (e.g. an encoded copy of it).
  const rowKeys = new Map<string, number[]>();
  let duplicateRows = 0;
  X.forEach((row, i) => {
    const key = keyOf(row);
    const seen = rowKeys.get(key);
    if (seen) {
      duplicateRows++;
      seen.push(i);
    } else rowKeys.set(key, [i]);
  });
  const duplicateRowGroups = Array.from(rowKeys.values())
    .filter((g) => g.length > 1)
    .slice(0, 5)
    .map((g) => g.map((i) => sampleIds[i]));
  const conflictingDuplicateSets = Array.from(rowKeys.values()).filter((g) => g.length > 1 && new Set(g.map((i) => y[i])).size > 1).length;
  if (conflictingDuplicateSets > 0 && p > 1) {
    issues.push({ severity: 'warning', code: 'duplicate_rows_conflicting_labels', params: { count: conflictingDuplicateSets } });
  }
  if (duplicateRows > 0 && p > 1 && dupMode !== 'group') {
    issues.push({
      severity: 'warning',
      code: 'duplicate_feature_rows',
      params: { count: duplicateRows, ids: duplicateRowGroups.map((g) => g.join(' = ')).slice(0, 3).join('; ') },
    });
  }
  const leaky: string[] = [];
  for (let j = 0; j < p && leaky.length < 5; j++) {
    const levels = new Map<number, Set<number>>();
    let ok = true;
    for (let i = 0; i < n && ok; i++) {
      const v = X[i][j];
      if (Number.isNaN(v)) { ok = false; break; }
      if (!levels.has(v)) levels.set(v, new Set());
      levels.get(v)!.add(y[i]);
      if (levels.size > 2) ok = false;
    }
    if (ok && levels.size === 2 && Array.from(levels.values()).every((s) => s.size === 1)) leaky.push(table.header[featureIdx[j]]);
  }
  if (leaky.length > 0) {
    issues.push({ severity: 'warning', code: 'possible_label_leak', params: { names: leaky.join(', ') } });
  }

  // Dataset-size and balance checks
  const minority = Math.min(classCounts[0], classCounts[1]);
  if (n < ML_LIMITS.minTotalSamples) {
    issues.push({ severity: 'error', code: 'too_few_samples', params: { count: n, min: ML_LIMITS.minTotalSamples } });
  } else if (minority < ML_LIMITS.minSamplesPerClass) {
    issues.push({ severity: 'error', code: 'too_few_per_class', params: { count: minority, min: ML_LIMITS.minSamplesPerClass } });
  } else if (n < 50) {
    issues.push({ severity: 'warning', code: 'small_dataset', params: { count: n } });
  }
  const minorityFrac = minority / n;
  if (minorityFrac < 0.3) {
    issues.push({ severity: 'warning', code: 'class_imbalance', params: { pct: Number((minorityFrac * 100).toFixed(1)) } });
  }
  if (p > n) {
    issues.push({ severity: 'warning', code: 'high_dimensional', params: { p, n } });
  }
  if (missingValueCount > 0) {
    issues.push({
      severity: 'info',
      code: 'missing_values',
      params: { count: missingValueCount, pct: Number(((missingValueCount / (n * p)) * 100).toFixed(2)) },
    });
  }

  // Groups (subject / patient / cohort)
  let groups: string[] | null = null;
  let groupSummary: DatasetQc['groupSummary'] = null;
  if (groupIdx >= 0) {
    let missingGroups = 0;
    groups = keep.map((i, k) => {
      const g = (table.rows[i][groupIdx] ?? '').trim();
      if (isMissingToken(g)) {
        missingGroups++;
        return `__ungrouped_${sampleIds[k]}`;
      }
      return g;
    });
    if (missingGroups > 0) issues.push({ severity: 'warning', code: 'missing_groups', params: { count: missingGroups } });
    groupSummary = summarizeGroups(groups, y);
    issues.push({
      severity: 'info',
      code: 'group_summary',
      params: { groups: groupSummary.groups, multi: groupSummary.multiSampleGroups, mixed: groupSummary.mixedLabelGroups, largest: groupSummary.largestGroup },
    });
    if (groupSummary.groups < 4) issues.push({ severity: 'error', code: 'too_few_groups', params: { count: groupSummary.groups } });
    else if (groupSummary.multiSampleGroups === 0) issues.push({ severity: 'info', code: 'groups_all_singletons' });
  }

  // Identical rows treated as one group (union with any existing group labels).
  let mergedByDuplicates = false;
  if (dupMode === 'group' && duplicateRows > 0 && p > 1) {
    const base = groups ?? sampleIds.map((_, i) => `__row_${i}`);
    const parent = new Map<string, string>();
    const find = (a: string): string => {
      let r = a;
      while ((parent.get(r) ?? r) !== r) r = parent.get(r)!;
      let c = a;
      while ((parent.get(c) ?? c) !== r && c !== r) {
        const nx = parent.get(c)!;
        parent.set(c, r);
        c = nx;
      }
      return r;
    };
    for (const g of rowKeys.values()) {
      if (g.length < 2) continue;
      const root = find(base[g[0]]);
      for (let k = 1; k < g.length; k++) {
        const other = find(base[g[k]]);
        if (other !== root) parent.set(other, root);
      }
    }
    groups = base.map((b) => find(b));
    mergedByDuplicates = true;
    groupSummary = summarizeGroups(groups, y);
    issues.push({ severity: 'info', code: 'duplicates_grouped', params: { count: duplicateRows } });
    if (groupIdx < 0) {
      issues.push({
        severity: 'info',
        code: 'group_summary',
        params: { groups: groupSummary.groups, multi: groupSummary.multiSampleGroups, mixed: groupSummary.mixedLabelGroups, largest: groupSummary.largestGroup },
      });
    }
    if (groupSummary.groups < 4 && !issues.some((i) => i.code === 'too_few_groups')) {
      issues.push({ severity: 'error', code: 'too_few_groups', params: { count: groupSummary.groups } });
    }
  }

  // Missingness and size QC
  const featureMissing = new Array<number>(p).fill(0);
  const sampleMissing = new Array<number>(n).fill(0);
  let constantFeatures = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) if (Number.isNaN(X[i][j])) { featureMissing[j]++; sampleMissing[i]++; }
  for (let j = 0; j < p; j++) {
    let first = NaN;
    let constant = true;
    for (let i = 0; i < n && constant; i++) {
      const v = X[i][j];
      if (Number.isNaN(v)) continue;
      if (Number.isNaN(first)) first = v;
      else if (v !== first) constant = false;
    }
    if (constant) constantFeatures++;
  }
  const featureNames = featureIdx.map((i) => table.header[i]);
  const topMissingFeatures = featureMissing
    .map((m, j) => ({ name: featureNames[j], fraction: m / n }))
    .filter((f) => f.fraction > 0)
    .sort((a, b) => b.fraction - a.fraction || a.name.localeCompare(b.name))
    .slice(0, 10)
    .map((f) => ({ name: f.name, fraction: Number(f.fraction.toFixed(4)) }));
  const topMissingSamples = sampleMissing
    .map((m, i) => ({ id: sampleIds[i], fraction: m / p }))
    .filter((s) => s.fraction > 0)
    .sort((a, b) => b.fraction - a.fraction || a.id.localeCompare(b.id))
    .slice(0, 10)
    .map((s) => ({ id: s.id, fraction: Number(s.fraction.toFixed(4)) }));
  const badSamples = sampleMissing.filter((m) => m / p > 0.5).length;
  if (badSamples > 0) issues.push({ severity: 'warning', code: 'samples_mostly_missing', params: { count: badSamples } });
  if (constantFeatures > 0) issues.push({ severity: 'info', code: 'constant_features', params: { count: constantFeatures } });
  const estimatedMatrixBytes = n * p * 8;
  if (estimatedMatrixBytes > ML_LIMITS.memoryWarningBytes) {
    issues.push({ severity: 'warning', code: 'large_matrix', params: { mb: (estimatedMatrixBytes / 1024 / 1024).toFixed(1) } });
  }
  const invalidCells = invalidCellColumns.reduce((s, c) => s + c.count, 0);
  const qc: DatasetQc = {
    samples: n,
    features: p,
    missingCells: missingValueCount,
    missingFraction: n * p > 0 ? Number((missingValueCount / (n * p)).toFixed(6)) : 0,
    featuresWithMissing: featureMissing.filter((m) => m > 0).length,
    topMissingFeatures,
    samplesWithMissing: sampleMissing.filter((m) => m > 0).length,
    topMissingSamples,
    invalidCells,
    invalidCellColumns: invalidCellColumns.slice(0, 20),
    duplicateRowGroups,
    duplicateRows,
    duplicateHandling: dupMode,
    duplicatesRemoved,
    conflictingDuplicateSets,
    constantFeatures,
    estimatedMatrixBytes,
    groupSummary,
  };
  const fingerprint = fnv1a(
    (function* () {
      yield featureNames.join('\t');
      for (let i = 0; i < n; i++) {
        yield `${sampleIds[i]}\t${y[i]}\t${groups ? groups[i] : ''}`;
        yield Array.from(X[i], (v) => (Number.isNaN(v) ? 'NA' : String(v))).join(',');
      }
    })()
  );

  const dataset: MlDataset = {
    X,
    y,
    sampleIds,
    featureNames,
    classes: [negative, positive],
    classCounts,
    missingValueCount,
    excludedColumns,
    droppedSamples,
    batchChecks,
    groups,
    groupColumn: groupIdx >= 0 ? table.header[groupIdx] + (mergedByDuplicates ? ' + identical rows' : '') : mergedByDuplicates ? '(identical rows)' : null,
    featureReview: review,
    qc,
    fingerprint,
  };
  const hasError = issues.some((i) => i.severity === 'error');
  return { dataset: hasError ? null : dataset, issues, labelValues, featureReview: review };
}
