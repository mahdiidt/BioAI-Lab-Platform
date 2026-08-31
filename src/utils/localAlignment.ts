import { validateSequence } from './sequenceValidator';
import { AlignmentResult } from '../types';

const MAX_LEN = 1000;

/**
 * Smith-Waterman local alignment. Unlike Needleman-Wunsch (global
 * alignment, which forces the ENTIRE length of both sequences into one
 * alignment), this finds the single highest-scoring similar SUBREGION
 * shared between the two input sequences — useful for finding a
 * conserved domain or motif shared between two otherwise dissimilar or
 * differently-sized sequences.
 */
export function smithWatermanAlignment(
  seqA: string,
  seqB: string,
  matchScore: number = 2,
  mismatchPenalty: number = -1,
  gapPenalty: number = -2
): AlignmentResult & { warning?: string } {
  if (
    !Number.isFinite(matchScore) ||
    !Number.isFinite(mismatchPenalty) ||
    !Number.isFinite(gapPenalty)
  ) {
    return {
      alignedA: '',
      alignedB: '',
      matchLine: '',
      score: 0,
      identityPercent: 0,
      matches: 0,
      mismatches: 0,
      gaps: 0,
      warning: 'Scoring parameters (match score, mismatch penalty, gap penalty) must be finite numbers.',
    };
  }

  // A positive gap penalty (or a non-negative mismatch penalty) would make
  // the algorithm behave nonsensically (rewarding gaps/mismatches), and
  // Smith-Waterman specifically requires negative gap/mismatch scoring for
  // the "reset to 0" local-alignment property to be meaningful.
  if (gapPenalty > 0 || mismatchPenalty > 0) {
    return {
      alignedA: '',
      alignedB: '',
      matchLine: '',
      score: 0,
      identityPercent: 0,
      matches: 0,
      mismatches: 0,
      gaps: 0,
      warning: 'Gap penalty and mismatch penalty must be zero or negative for local alignment to behave correctly.',
    };
  }

  const valA = validateSequence(seqA, 'DNA');
  const valB = validateSequence(seqB, 'DNA');

  if (!valA.isValid || !valB.isValid) {
    return {
      alignedA: '',
      alignedB: '',
      matchLine: '',
      score: 0,
      identityPercent: 0,
      matches: 0,
      mismatches: 0,
      gaps: 0,
      warning: [valA.errorMessage, valB.errorMessage].filter(Boolean).join(' | '),
    };
  }

  const cleanA = valA.cleanSequence;
  const cleanB = valB.cleanSequence;

  if (cleanA.length > MAX_LEN || cleanB.length > MAX_LEN) {
    return {
      alignedA: '',
      alignedB: '',
      matchLine: '',
      score: 0,
      identityPercent: 0,
      matches: 0,
      mismatches: 0,
      gaps: 0,
      warning: `Sequence length (${Math.max(cleanA.length, cleanB.length)} bp) exceeds maximum supported limit of ${MAX_LEN} bp for browser pairwise DP matrix alignment. Please reduce sequence length to proceed.`,
    };
  }

  if (cleanA.length === 0 || cleanB.length === 0) {
    return {
      alignedA: '',
      alignedB: '',
      matchLine: '',
      score: 0,
      identityPercent: 0,
      matches: 0,
      mismatches: 0,
      gaps: 0,
      warning: 'Both sequences must be non-empty.',
    };
  }

  const m = cleanA.length;
  const n = cleanB.length;

  // dp[i][j] = best local alignment score ending exactly at A[i-1], B[j-1].
  // Traceback direction stored separately: 0 = stop (score reset to 0),
  // 1 = diagonal, 2 = up (gap in B), 3 = left (gap in A).
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  const trace: Uint8Array[] = Array.from({ length: m + 1 }, () => new Uint8Array(n + 1));

  let maxScore = 0;
  let maxI = 0;
  let maxJ = 0;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const diag = dp[i - 1][j - 1] + (cleanA[i - 1] === cleanB[j - 1] ? matchScore : mismatchPenalty);
      const up = dp[i - 1][j] + gapPenalty;
      const left = dp[i][j - 1] + gapPenalty;

      let best = 0;
      let dir = 0;
      if (diag > best) { best = diag; dir = 1; }
      if (up > best) { best = up; dir = 2; }
      if (left > best) { best = left; dir = 3; }

      dp[i][j] = best;
      trace[i][j] = dir;

      if (best > maxScore) {
        maxScore = best;
        maxI = i;
        maxJ = j;
      }
    }
  }

  if (maxScore === 0) {
    // No positive-scoring local similarity exists between the two
    // sequences under the given scoring scheme.
    return {
      alignedA: '',
      alignedB: '',
      matchLine: '',
      score: 0,
      identityPercent: 0,
      matches: 0,
      mismatches: 0,
      gaps: 0,
      startA: 0,
      endA: 0,
      startB: 0,
      endB: 0,
    };
  }

  let alignedA = '';
  let alignedB = '';
  let matchLine = '';
  let matches = 0;
  let mismatches = 0;
  let gaps = 0;

  let i = maxI;
  let j = maxJ;
  const endA = i; // 1-based, inclusive
  const endB = j;

  while (i > 0 && j > 0 && trace[i][j] !== 0) {
    const dir = trace[i][j];
    if (dir === 1) {
      const a = cleanA[i - 1];
      const b = cleanB[j - 1];
      alignedA = a + alignedA;
      alignedB = b + alignedB;
      if (a === b) {
        matchLine = '|' + matchLine;
        matches++;
      } else {
        matchLine = '.' + matchLine;
        mismatches++;
      }
      i--; j--;
    } else if (dir === 2) {
      alignedA = cleanA[i - 1] + alignedA;
      alignedB = '-' + alignedB;
      matchLine = ' ' + matchLine;
      gaps++;
      i--;
    } else if (dir === 3) {
      alignedA = '-' + alignedA;
      alignedB = cleanB[j - 1] + alignedB;
      matchLine = ' ' + matchLine;
      gaps++;
      j--;
    }
  }

  const startA = i + 1; // 1-based, inclusive
  const startB = j + 1;

  const alignedLength = matches + mismatches + gaps;
  const identityPercent = alignedLength > 0 ? Number(((matches / alignedLength) * 100).toFixed(1)) : 0;

  return {
    alignedA,
    alignedB,
    matchLine,
    score: maxScore,
    identityPercent,
    matches,
    mismatches,
    gaps,
    startA,
    endA,
    startB,
    endB,
  };
}
