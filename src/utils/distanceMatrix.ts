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
