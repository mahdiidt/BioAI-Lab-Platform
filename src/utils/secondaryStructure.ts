// Chou-Fasman Secondary Structure Prediction
//
// Implements the classic Chou & Fasman (1974) empirical method for
// predicting alpha-helix, beta-sheet, and turn regions from a protein's
// amino acid sequence alone, using the original per-residue conformational
// propensity parameters derived from known protein structures.
//
// Reference: Chou, P.Y. & Fasman, G.D. (1974) "Prediction of protein
// conformation." Biochemistry, 13(2), 222-245.

import { validateSequence } from './sequenceValidator';

/** P(alpha): helix-forming propensity. */
export const P_ALPHA: Record<string, number> = {
  E: 1.51, M: 1.45, A: 1.42, L: 1.21, K: 1.16, F: 1.13, Q: 1.11, W: 1.08,
  I: 1.08, V: 1.06, D: 1.01, H: 1.0, R: 0.98, T: 0.83, S: 0.77, C: 0.7,
  Y: 0.69, N: 0.67, P: 0.57, G: 0.57,
};

/** P(beta): beta-sheet-forming propensity. */
export const P_BETA: Record<string, number> = {
  V: 1.7, I: 1.6, Y: 1.47, C: 1.19, W: 1.37, F: 1.38, L: 1.3, T: 1.19,
  M: 1.05, Q: 1.1, R: 0.93, N: 0.89, H: 0.87, A: 0.83, S: 0.75, G: 0.75,
  K: 0.74, P: 0.55, D: 0.54, E: 0.37,
};

/** P(turn): turn-forming propensity. */
export const P_TURN: Record<string, number> = {
  N: 1.56, G: 1.56, P: 1.52, D: 1.46, S: 1.43, C: 1.19, Y: 1.14, K: 1.01,
  Q: 0.98, T: 0.96, W: 0.96, R: 0.95, H: 0.95, E: 0.74, A: 0.66, M: 0.6,
  F: 0.6, L: 0.59, V: 0.5, I: 0.47,
};

export type StructureCode = 'H' | 'E' | 'C'; // Helix, Sheet (Extended), Coil

export interface SecondaryStructureResult {
  isValid: boolean;
  errorMessage?: string;
  sequence: string;
  length: number;
  structure: StructureCode[];
  helixPercent: number;
  sheetPercent: number;
  coilPercent: number;
  segments: { code: StructureCode; start: number; end: number }[];
}

const HELIX_WINDOW = 6;
const HELIX_NUCLEATION_AVG = 1.03;
const HELIX_EXTEND_AVG = 1.0;
const SHEET_WINDOW = 5;
const SHEET_NUCLEATION_AVG = 1.05;
const SHEET_EXTEND_AVG = 1.0;

const MIN_LENGTH = 10;
const MAX_LENGTH = 2000;

function windowAverage(table: Record<string, number>, seq: string, start: number, len: number): number {
  let sum = 0;
  let n = 0;
  for (let i = start; i < Math.min(start + len, seq.length); i++) {
    sum += table[seq[i]] ?? 1.0;
    n++;
  }
  return n > 0 ? sum / n : 0;
}

/**
 * Finds nucleation windows meeting the average-propensity threshold, then
 * extends each region outward one residue at a time while the propensity
 * of the incoming 4-residue stretch stays at or above the extend
 * threshold, and a "breaker" residue (Pro for helix) is not crossed —
 * the standard Chou-Fasman nucleate-and-extend procedure.
 */
function nucleateAndExtend(
  seq: string,
  table: Record<string, number>,
  window: number,
  nucleationAvg: number,
  extendAvg: number,
  isBreaker: (aa: string) => boolean
): boolean[] {
  const n = seq.length;
  const flagged = new Array(n).fill(false);

  for (let i = 0; i <= n - window; i++) {
    if (windowAverage(table, seq, i, window) >= nucleationAvg) {
      let start = i;
      let end = i + window - 1;
      for (let k = start; k <= end; k++) flagged[k] = true;

      // Extend left
      while (start > 0 && !isBreaker(seq[start - 1])) {
        const avg4 = windowAverage(table, seq, Math.max(0, start - 4), Math.min(4, start));
        if (avg4 < extendAvg) break;
        start -= 1;
        flagged[start] = true;
      }
      // Extend right
      while (end < n - 1 && !isBreaker(seq[end + 1])) {
        const avg4 = windowAverage(table, seq, end + 1, Math.min(4, n - end - 1));
        if (avg4 < extendAvg) break;
        end += 1;
        flagged[end] = true;
      }
    }
  }

  return flagged;
}

function toSegments(structure: StructureCode[]): { code: StructureCode; start: number; end: number }[] {
  const segments: { code: StructureCode; start: number; end: number }[] = [];
  let i = 0;
  while (i < structure.length) {
    const code = structure[i];
    let j = i;
    while (j + 1 < structure.length && structure[j + 1] === code) j++;
    segments.push({ code, start: i + 1, end: j + 1 }); // 1-indexed
    i = j + 1;
  }
  return segments;
}

export function predictSecondaryStructure(rawSequence: string): SecondaryStructureResult {
  const val = validateSequence(rawSequence, 'PROTEIN');

  const empty = { sequence: '', length: 0, structure: [], helixPercent: 0, sheetPercent: 0, coilPercent: 0, segments: [] };

  if (!val.isValid) {
    return { isValid: false, errorMessage: val.errorMessage || 'Invalid protein sequence.', ...empty };
  }

  const seq = val.cleanSequence.replace(/\*/g, '').toUpperCase();
  const len = seq.length;

  if (len < MIN_LENGTH) {
    return {
      isValid: false,
      errorMessage: `Sequence is too short for a reliable prediction (minimum ${MIN_LENGTH} residues).`,
      ...empty,
    };
  }

  if (len > MAX_LENGTH) {
    return {
      isValid: false,
      errorMessage: `Sequence is too long (${len} aa). This tool supports up to ${MAX_LENGTH.toLocaleString()} residues.`,
      ...empty,
    };
  }

  if (/[^ACDEFGHIKLMNPQRSTVWY]/.test(seq)) {
    return {
      isValid: false,
      errorMessage: 'Prediction requires a fully resolved sequence of the 20 standard amino acids (ambiguity codes like X, B, Z are not supported).',
      ...empty,
    };
  }

  const helixFlags = nucleateAndExtend(seq, P_ALPHA, HELIX_WINDOW, HELIX_NUCLEATION_AVG, HELIX_EXTEND_AVG, (aa) => aa === 'P');
  const sheetFlags = nucleateAndExtend(seq, P_BETA, SHEET_WINDOW, SHEET_NUCLEATION_AVG, SHEET_EXTEND_AVG, () => false);

  const structure: StructureCode[] = new Array(len).fill('C');

  for (let i = 0; i < len; i++) {
    const inHelix = helixFlags[i];
    const inSheet = sheetFlags[i];
    if (inHelix && inSheet) {
      // Overlap tie-break: compare the local window average for each conformation.
      const aH = windowAverage(P_ALPHA, seq, Math.max(0, i - 2), 5);
      const aE = windowAverage(P_BETA, seq, Math.max(0, i - 2), 5);
      structure[i] = aH >= aE ? 'H' : 'E';
    } else if (inHelix) {
      structure[i] = 'H';
    } else if (inSheet) {
      structure[i] = 'E';
    }
  }

  // Any position not flagged as helix or sheet is classified as coil.
  // (Turn propensity data (P_TURN) is exposed for callers that want it -
  // e.g. to flag likely turn residues within coil regions - but this
  // engine reports the standard 3-state H/E/C track by default.)

  const helixCount = structure.filter((s) => s === 'H').length;
  const sheetCount = structure.filter((s) => s === 'E').length;
  const coilCount = len - helixCount - sheetCount;

  return {
    isValid: true,
    sequence: seq,
    length: len,
    structure,
    helixPercent: (helixCount / len) * 100,
    sheetPercent: (sheetCount / len) * 100,
    coilPercent: (coilCount / len) * 100,
    segments: toSegments(structure),
  };
}
