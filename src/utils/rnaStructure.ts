import { validateSequence } from './sequenceValidator';

export interface RnaStructureResult {
  isValid: boolean;
  errorMessage?: string;
  warning?: string;
  sequence: string;
  dotBracket: string;
  pairs: Array<[number, number]>; // 0-based indices into `sequence`, i < j
  numPairs: number;
  minLoopLength: number;
}

const CANONICAL_PAIRS = new Set(['AU', 'UA', 'GC', 'CG', 'GU', 'UG']); // Watson-Crick + G-U wobble

function canPair(a: string, b: string): boolean {
  return CANONICAL_PAIRS.has(a + b);
}

const MAX_LEN = 300; // O(n^3) DP — keep interactive in-browser
const DEFAULT_MIN_LOOP_LENGTH = 3; // minimum unpaired bases required inside a hairpin loop

/**
 * Nussinov algorithm: predicts an RNA secondary structure that maximizes
 * the number of base pairs (Watson-Crick A-U/G-C plus G-U wobble pairs),
 * subject to a minimum hairpin loop size. This is the classic maximum
 * base-pairing dynamic-programming algorithm — it does NOT model stacking
 * energies, so it is not equivalent to a minimum-free-energy (MFE)
 * predictor such as Zuker's algorithm (used by mfold/RNAfold).
 */
export function predictRnaSecondaryStructure(
  sequence: string,
  minLoopLength: number = DEFAULT_MIN_LOOP_LENGTH
): RnaStructureResult {
  const val = validateSequence(sequence, 'RNA');

  if (!val.isValid) {
    return {
      isValid: false,
      errorMessage: val.errorMessage,
      sequence: '',
      dotBracket: '',
      pairs: [],
      numPairs: 0,
      minLoopLength,
    };
  }

  const seq = val.cleanSequence;

  // A base pair is a specific, deterministic chemical bond. An IUPAC
  // ambiguity code doesn't identify a single base, so it can't be
  // reliably evaluated for Watson-Crick/wobble complementarity. Rather
  // than silently treating it as unpairable (which would look like a
  // normal, if unpaired, result), we surface this explicitly.
  if (val.hasAmbiguityChars) {
    return {
      isValid: true,
      warning: 'AMBIGUITY_BLOCKS_STRUCTURE',
      sequence: seq,
      dotBracket: '',
      pairs: [],
      numPairs: 0,
      minLoopLength,
    };
  }

  if (seq.length > MAX_LEN) {
    return {
      isValid: false,
      errorMessage: `Sequence length (${seq.length.toLocaleString()} nt) exceeds the maximum supported limit of ${MAX_LEN.toLocaleString()} nt for in-browser O(n³) structure prediction.`,
      sequence: '',
      dotBracket: '',
      pairs: [],
      numPairs: 0,
      minLoopLength,
    };
  }

  const n = seq.length;

  if (n === 0) {
    return {
      isValid: true,
      sequence: seq,
      dotBracket: '',
      pairs: [],
      numPairs: 0,
      minLoopLength,
    };
  }

  // dp[i][j] = max number of base pairs achievable within seq[i..j] inclusive.
  const dp: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let len = 1; len < n; len++) {
    for (let i = 0; i + len < n; i++) {
      const j = i + len;

      let best = dp[i + 1][j]; // i unpaired
      best = Math.max(best, dp[i][j - 1]); // j unpaired

      if (j - i > minLoopLength && canPair(seq[i], seq[j])) {
        const inner = i + 1 <= j - 1 ? dp[i + 1][j - 1] : 0;
        best = Math.max(best, inner + 1);
      }

      for (let k = i; k < j; k++) {
        best = Math.max(best, dp[i][k] + dp[k + 1][j]);
      }

      dp[i][j] = best;
    }
  }

  const pairs: Array<[number, number]> = [];

  function traceback(i: number, j: number): void {
    if (i >= j) return;

    if (dp[i][j] === dp[i + 1][j]) {
      traceback(i + 1, j);
      return;
    }
    if (dp[i][j] === dp[i][j - 1]) {
      traceback(i, j - 1);
      return;
    }
    if (j - i > minLoopLength && canPair(seq[i], seq[j])) {
      const inner = i + 1 <= j - 1 ? dp[i + 1][j - 1] : 0;
      if (dp[i][j] === inner + 1) {
        pairs.push([i, j]);
        traceback(i + 1, j - 1);
        return;
      }
    }
    for (let k = i; k < j; k++) {
      if (dp[i][j] === dp[i][k] + dp[k + 1][j]) {
        traceback(i, k);
        traceback(k + 1, j);
        return;
      }
    }
  }

  traceback(0, n - 1);
  pairs.sort((a, b) => a[0] - b[0]);

  const dotBracketArr = new Array(n).fill('.');
  for (const [i, j] of pairs) {
    dotBracketArr[i] = '(';
    dotBracketArr[j] = ')';
  }

  return {
    isValid: true,
    sequence: seq,
    dotBracket: dotBracketArr.join(''),
    pairs,
    numPairs: pairs.length,
    minLoopLength,
  };
}
