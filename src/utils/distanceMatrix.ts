// Multi-sequence similarity / distance matrix.
//
// This module deliberately does NOT implement its own alignment or scoring
// logic. It builds an N x N matrix by calling the existing, already-tested
// needlemanWunschAlignment() from bioinformatics.ts once per sequence pair
// and reading off its identityPercent. This keeps the matrix numerically
// consistent with the standalone Global Alignment tool (same algorithm,
// same identity definition) and avoids introducing a second, potentially
// divergent scoring implementation.
//
// Scope note: distance here is simply (100 - identityPercent) from a
// pairwise global alignment - a raw "p-distance"-style figure, NOT a
// corrected evolutionary distance model (e.g. Jukes-Cantor, Kimura).
// This is stated explicitly in the UI so it is not over-interpreted.

import { validateSequence } from './sequenceValidator';
import { needlemanWunschAlignment } from './bioinformatics';
import { parseMultiFasta } from './fastaParser';

export interface DistanceMatrixInputSequence {
  id: string;
  sequence: string;
}

export interface ExcludedSequence {
  id: string;
  reason: string;
}

export interface DistanceMatrixResult {
  ids: string[];
  /** identityMatrix[i][j]: percent identity between ids[i] and ids[j]. null if that pair could not be aligned. */
  identityMatrix: (number | null)[][];
  /** distanceMatrix[i][j]: 100 - identityMatrix[i][j] (simple derived distance, not a corrected model). */
  distanceMatrix: (number | null)[][];
  excluded: ExcludedSequence[];
  warning?: string;
}

// Matches the per-pair DP matrix cap already enforced inside
// needlemanWunschAlignment, checked here up-front so a single oversized
// sequence doesn't silently blank out its entire row/column later.
const MAX_SEQ_LEN = 1000;

// An N x N matrix needs N*(N-1)/2 full DP alignments. Capped so the browser
// stays responsive; the UI surfaces a clear warning if input exceeds this.
const MAX_SEQUENCES = 12;

export function computeSequenceDistanceMatrix(
  inputs: DistanceMatrixInputSequence[],
  matchScore: number = 2,
  mismatchPenalty: number = -1,
  gapPenalty: number = -2
): DistanceMatrixResult {
  const excluded: ExcludedSequence[] = [];
  const valid: DistanceMatrixInputSequence[] = [];

  for (const rec of inputs) {
    const val = validateSequence(rec.sequence, 'DNA');
    if (!val.isValid) {
      excluded.push({ id: rec.id, reason: val.errorMessage || 'Invalid sequence for DNA alignment.' });
      continue;
    }
    if (val.cleanSequence.length > MAX_SEQ_LEN) {
      excluded.push({
        id: rec.id,
        reason: `Sequence length (${val.cleanSequence.length} bp) exceeds the ${MAX_SEQ_LEN} bp limit for pairwise DP alignment.`,
      });
      continue;
    }
    valid.push({ id: rec.id, sequence: val.cleanSequence });
  }

  let warning: string | undefined;
  let limited = valid;
  if (valid.length > MAX_SEQUENCES) {
    warning = `${valid.length} valid sequences were provided; only the first ${MAX_SEQUENCES} are compared to keep the O(n^2) pairwise alignment responsive in-browser.`;
    limited = valid.slice(0, MAX_SEQUENCES);
  }

  const n = limited.length;
  const ids = limited.map((r) => r.id);
  const identityMatrix: (number | null)[][] = Array.from({ length: n }, () => Array(n).fill(null));
  const distanceMatrix: (number | null)[][] = Array.from({ length: n }, () => Array(n).fill(null));

  for (let i = 0; i < n; i++) {
    // Diagonal is trivially "identical to self" by definition - not derived
    // from the alignment algorithm, same convention every distance matrix
    // (phylogenetics, BLAST self-hits, etc.) uses.
    identityMatrix[i][i] = 100;
    distanceMatrix[i][i] = 0;
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const res = needlemanWunschAlignment(limited[i].sequence, limited[j].sequence, matchScore, mismatchPenalty, gapPenalty);
      const identity = res.warning ? null : res.identityPercent;
      identityMatrix[i][j] = identity;
      identityMatrix[j][i] = identity;
      const distance = identity === null ? null : Number((100 - identity).toFixed(1));
      distanceMatrix[i][j] = distance;
      distanceMatrix[j][i] = distance;
    }
  }

  return { ids, identityMatrix, distanceMatrix, excluded, warning };
}

// ---------------------------------------------------------------------------
// computeDistanceMatrix — FASTA-text-in wrapper used by DistanceMatrixTool.
//
// Unlike computeSequenceDistanceMatrix() above (which takes pre-parsed
// {id, sequence} records and silently truncates + warns past MAX_SEQUENCES),
// this version parses raw multi-FASTA text directly and reports "too many
// sequences" as an explicit isValid:false error, since a truncate-and-warn
// result is easy for a UI to render as if it were the user's full input.
// ---------------------------------------------------------------------------

export interface DistanceMatrixSkippedRecord {
  id: string;
  reason: string;
}

export interface DistanceMatrixFailedPair {
  i: number;
  j: number;
  labelA: string;
  labelB: string;
  reason: string;
}

export interface DistanceMatrixComputeResult {
  isValid: boolean;
  errorMessage?: string;
  /** Sequence IDs, in input order, for every sequence actually included in the matrix. */
  labels: string[];
  /** similarityMatrix[i][j]: percent identity between labels[i] and labels[j]. null if that pair could not be aligned. */
  similarityMatrix: (number | null)[][];
  /** distanceMatrix[i][j]: 100 - similarityMatrix[i][j]. null if that pair could not be aligned. */
  distanceMatrix: (number | null)[][];
  /** Records dropped for being invalid DNA (bad characters, empty, etc.) - never entered the matrix. */
  skippedRecords: DistanceMatrixSkippedRecord[];
  /** Pairs that were attempted but could not be aligned (e.g. one sequence exceeds the DP length cap). */
  failedPairs: DistanceMatrixFailedPair[];
}

const MIN_SEQUENCES = 2;

export function computeDistanceMatrix(
  fastaInput: string,
  matchScore: number = 2,
  mismatchPenalty: number = -1,
  gapPenalty: number = -2
): DistanceMatrixComputeResult {
  const parsed = parseMultiFasta(fastaInput, 'DNA');

  const skippedRecords: DistanceMatrixSkippedRecord[] = [];
  const validRecords: DistanceMatrixInputSequence[] = [];

  for (const rec of parsed.records) {
    if (!rec.validation.isValid) {
      skippedRecords.push({ id: rec.id, reason: rec.validation.errorMessage || 'Invalid sequence for DNA alignment.' });
    } else {
      validRecords.push({ id: rec.id, sequence: rec.sequence });
    }
  }

  if (validRecords.length < MIN_SEQUENCES) {
    return {
      isValid: false,
      errorMessage: `At least ${MIN_SEQUENCES} valid DNA sequences are required to build a distance matrix.`,
      labels: [],
      similarityMatrix: [],
      distanceMatrix: [],
      skippedRecords,
      failedPairs: [],
    };
  }

  if (validRecords.length > MAX_SEQUENCES) {
    return {
      isValid: false,
      errorMessage: `Too many sequences (${validRecords.length} valid). This tool supports up to ${MAX_SEQUENCES} sequences at once so pairwise alignment stays responsive in the browser. Please remove some sequences and try again.`,
      labels: validRecords.map((r) => r.id),
      similarityMatrix: [],
      distanceMatrix: [],
      skippedRecords,
      failedPairs: [],
    };
  }

  const n = validRecords.length;
  const labels = validRecords.map((r) => r.id);
  const similarityMatrix: (number | null)[][] = Array.from({ length: n }, () => Array(n).fill(null));
  const distanceMatrix: (number | null)[][] = Array.from({ length: n }, () => Array(n).fill(null));
  const failedPairs: DistanceMatrixFailedPair[] = [];

  for (let i = 0; i < n; i++) {
    // Diagonal is trivially "identical to self" by definition, same
    // convention as computeSequenceDistanceMatrix() above.
    similarityMatrix[i][i] = 100;
    distanceMatrix[i][i] = 0;
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const res = needlemanWunschAlignment(validRecords[i].sequence, validRecords[j].sequence, matchScore, mismatchPenalty, gapPenalty);
      if (res.warning) {
        failedPairs.push({ i, j, labelA: labels[i], labelB: labels[j], reason: res.warning });
        continue; // matrix cells stay null
      }
      const identity = res.identityPercent;
      const distance = Number((100 - identity).toFixed(1));
      similarityMatrix[i][j] = identity;
      similarityMatrix[j][i] = identity;
      distanceMatrix[i][j] = distance;
      distanceMatrix[j][i] = distance;
    }
  }

  return {
    isValid: true,
    labels,
    similarityMatrix,
    distanceMatrix,
    skippedRecords,
    failedPairs,
  };
}
