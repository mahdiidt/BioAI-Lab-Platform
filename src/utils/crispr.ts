import { validateSequence } from './sequenceValidator';
import { reverseComplement, countKmers } from './dna';

export type PamType = 'NGG' | 'NG' | 'NNGRR';

export const PAM_OPTIONS: { id: PamType; label: string; enzyme: string }[] = [
  { id: 'NGG', label: 'NGG', enzyme: 'SpCas9 (S. pyogenes)' },
  { id: 'NG', label: 'NG', enzyme: 'SpCas9-NG (relaxed variant)' },
  { id: 'NNGRR', label: 'NNGRR', enzyme: 'SaCas9 (S. aureus)' },
];

const IUPAC_MATCH: Record<string, string[]> = {
  A: ['A'], C: ['C'], G: ['G'], T: ['T'],
  R: ['A', 'G'], Y: ['C', 'T'], S: ['G', 'C'], W: ['A', 'T'], K: ['G', 'T'], M: ['A', 'C'],
  B: ['C', 'G', 'T'], D: ['A', 'G', 'T'], H: ['A', 'C', 'T'], V: ['A', 'C', 'G'],
  N: ['A', 'C', 'G', 'T'],
};

function matchesIupacBase(patternChar: string, actualChar: string): boolean {
  return (IUPAC_MATCH[patternChar] || []).includes(actualChar);
}

function matchesPam(pamPattern: string, candidate: string): boolean {
  if (candidate.length !== pamPattern.length) return false;
  for (let i = 0; i < pamPattern.length; i++) {
    if (!matchesIupacBase(pamPattern[i], candidate[i])) return false;
  }
  return true;
}

interface RawHit {
  guideStart: number; // 1-based, local to the strand string scanned
  guideEnd: number;
  pamStart: number;
  pamEnd: number;
  guideSeq: string;
  pamSeq: string;
}

function scanStrandForPam(strandSeq: string, pamPattern: string, guideLength: number): RawHit[] {
  const hits: RawHit[] = [];
  const pamLen = pamPattern.length;

  for (let i = guideLength; i <= strandSeq.length - pamLen; i++) {
    const candidatePam = strandSeq.substring(i, i + pamLen);
    if (matchesPam(pamPattern, candidatePam)) {
      hits.push({
        guideStart: i - guideLength + 1,
        guideEnd: i,
        pamStart: i + 1,
        pamEnd: i + pamLen,
        guideSeq: strandSeq.substring(i - guideLength, i),
        pamSeq: candidatePam,
      });
    }
  }

  return hits;
}

export interface CrisprGuide {
  strand: '+' | '-';
  guideStart: number; // 1-based, in the coordinates of the original input sequence
  guideEnd: number;
  pamStart: number;
  pamEnd: number;
  guideSeq: string; // the actual 5'->3' protospacer sequence on the strand it targets
  pamSeq: string;
  gcContent: number; // 0-100, rounded to 1 decimal
  hasPolyT: boolean; // TTTT+ run — terminates Pol III (U6/H1 promoter) transcription of the gRNA
  hasHomopolymer: boolean; // any 4+ run of a single base (A/C/G, or T if not already flagged as polyT)
  seedOffTargetCount: number; // occurrences of this guide's 12nt PAM-proximal seed elsewhere in the input (both strands), beyond the guide's own site
  qualityScore: number; // 0-100 heuristic ranking score, higher is better
}

export interface CrisprScanResult {
  isValid: boolean;
  errorMessage?: string;
  warning?: string;
  sequenceLength: number;
  pamPattern: string;
  guideLength: number;
  guides: CrisprGuide[];
}

const MAX_SEQ_LEN = 20_000;
const SEED_LEN = 12;

export function findCrisprGuides(
  sequence: string,
  pamPattern: PamType = 'NGG',
  guideLength = 20
): CrisprScanResult {
  const val = validateSequence(sequence, 'DNA');

  if (!val.isValid) {
    return {
      isValid: false,
      errorMessage: val.errorMessage,
      sequenceLength: 0,
      pamPattern,
      guideLength,
      guides: [],
    };
  }

  const seq = val.cleanSequence;

  // Guide design requires a fully deterministic sequence: an IUPAC
  // ambiguity code (R, Y, N, etc.) does not identify a single base, so it
  // cannot be safely committed to a synthesized guide RNA or reliably
  // scored for off-target risk. Rather than silently skipping ambiguous
  // windows and returning a partial (and misleadingly clean-looking)
  // guide list, we surface this explicitly so the user understands why
  // no results are shown.
  if (val.hasAmbiguityChars) {
    return {
      isValid: true,
      warning: 'AMBIGUITY_BLOCKS_DESIGN',
      sequenceLength: seq.length,
      pamPattern,
      guideLength,
      guides: [],
    };
  }

  if (seq.length > MAX_SEQ_LEN) {
    return {
      isValid: false,
      errorMessage: `Sequence length (${seq.length.toLocaleString()} bp) exceeds the maximum supported limit of ${MAX_SEQ_LEN.toLocaleString()} bp for in-browser guide scanning.`,
      sequenceLength: seq.length,
      pamPattern,
      guideLength,
      guides: [],
    };
  }

  const minLen = guideLength + pamPattern.length;
  if (seq.length < minLen) {
    return {
      isValid: true,
      sequenceLength: seq.length,
      pamPattern,
      guideLength,
      guides: [],
    };
  }

  const revSeq = reverseComplement(seq, 'DNA');
  const L = seq.length;

  const forwardHits = scanStrandForPam(seq, pamPattern, guideLength).map((h) => ({ ...h, strand: '+' as const }));

  const reverseHitsRaw = scanStrandForPam(revSeq, pamPattern, guideLength);
  const reverseHits = reverseHitsRaw.map((h) => ({
    strand: '-' as const,
    guideStart: L - h.guideEnd + 1,
    guideEnd: L - h.guideStart + 1,
    pamStart: L - h.pamEnd + 1,
    pamEnd: L - h.pamStart + 1,
    guideSeq: h.guideSeq,
    pamSeq: h.pamSeq,
  }));

  const combined = [...forwardHits, ...reverseHits];

  // Precompute seed (12nt, PAM-proximal) occurrence counts across both
  // strands of the whole input once, rather than per-guide, so scanning
  // stays fast even with many candidate sites.
  const fwdSeedCounts = countKmers(seq, SEED_LEN);
  const revSeedCounts = countKmers(revSeq, SEED_LEN);

  const guides: CrisprGuide[] = combined.map((h) => {
    const gc = (h.guideSeq.match(/[GC]/g) || []).length;
    const gcContent = Number(((gc / h.guideSeq.length) * 100).toFixed(1));

    const hasPolyT = /TTTT/.test(h.guideSeq);
    const hasHomopolymer = /(.)\1{3,}/.test(h.guideSeq);

    const seed = h.guideSeq.slice(-SEED_LEN);
    const totalSeedOccurrences = (fwdSeedCounts[seed] || 0) + (revSeedCounts[seed] || 0);
    // The guide's own site accounts for exactly one occurrence on its own
    // strand; anything beyond that is a same-input off-target signal.
    const seedOffTargetCount = Math.max(0, totalSeedOccurrences - 1);

    let score = 100;
    if (hasPolyT) score -= 30;
    else if (hasHomopolymer) score -= 15;
    if (seedOffTargetCount > 0) score -= 25;
    score -= Math.min(30, Math.abs(gcContent - 50) * 0.6);
    score = Math.max(0, Math.round(score));

    return {
      strand: h.strand,
      guideStart: h.guideStart,
      guideEnd: h.guideEnd,
      pamStart: h.pamStart,
      pamEnd: h.pamEnd,
      guideSeq: h.guideSeq,
      pamSeq: h.pamSeq,
      gcContent,
      hasPolyT,
      hasHomopolymer,
      seedOffTargetCount,
      qualityScore: score,
    };
  });

  guides.sort((a, b) => b.qualityScore - a.qualityScore || a.guideStart - b.guideStart);

  return {
    isValid: true,
    sequenceLength: seq.length,
    pamPattern,
    guideLength,
    guides,
  };
}
