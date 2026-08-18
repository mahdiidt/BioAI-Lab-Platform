import {
  SequenceStats,
  ProteinStats,
  ORFResult,
  PrimerResult,
  PrimerPairResult,
  AlignmentResult,
  NewickNode,
  CodonOptimizationResult,
} from '../types';

import { parseNewick as parseNewickReal, PhyloNode } from './newickParser';
import { optimizeCodons as optimizeCodonsReal, HostOrganism } from './codonOptimization';
import { reverseComplement, complementSequence, getComplementBase, translateRnaToProtein as translateDnaReal, calculateSequenceStats as calcSeqStats, findOpenReadingFrames as findOrfsReal } from './dna';
import { analyzeProtein as analyzeProteinReal } from './protein';
import { validateSequence } from './sequenceValidator';
import { calculatePrimerTm } from './pcr';

export const AA_NAMES_3: Record<string, string> = {
  A: 'Ala', R: 'Arg', N: 'Asn', D: 'Asp', C: 'Cys', E: 'Glu', Q: 'Gln', G: 'Gly',
  H: 'His', I: 'Ile', L: 'Leu', K: 'Lys', M: 'Met', F: 'Phe', P: 'Pro', S: 'Ser',
  T: 'Thr', W: 'Trp', Y: 'Tyr', V: 'Val', '*': 'STOP',
};

// 1. DNA/RNA Analyzer
export function analyzeDnaRnaSequence(input: string): SequenceStats {
  const val = validateSequence(input, 'DNA');
  const seq = val.isValid ? val.cleanSequence : '';
  const stats = calcSeqStats(seq, seq.includes('U') ? 'RNA' : 'ssDNA');

  return {
    length: stats.length,
    gcContent: stats.gcContent,
    atContent: stats.atContent,
    molecularWeight: stats.molecularWeightDa,
    molecularWeightDa: stats.molecularWeightDa,
    baseCounts: {
      A: stats.baseCounts.A || 0,
      T: stats.baseCounts.T || 0,
      C: stats.baseCounts.C || 0,
      G: stats.baseCounts.G || 0,
    },
  };
}

// 2. Reverse Complement
export function getReverseComplement(sequence: string): {
  isValid: boolean;
  cleaned: string;
  reverseComplement: string;
  complement: string;
  errorMessage?: string;
} {
  const val = validateSequence(sequence, 'DNA');
  if (!val.isValid) {
    return {
      isValid: false,
      cleaned: val.cleanSequence,
      reverseComplement: '',
      complement: '',
      errorMessage: val.errorMessage || 'Invalid sequence.',
    };
  }

  const cleaned = val.cleanSequence;
  const revComp = reverseComplement(cleaned);
  const complement = complementSequence(cleaned, 'DNA');

  return {
    isValid: true,
    cleaned,
    complement,
    reverseComplement: revComp,
  };
}

// 3. Protein Analyzer - delegates to canonical protein.ts
export function analyzeProtein(input: string): ProteinStats {
  const res = analyzeProteinReal(input);

  if (!res) {
    return {
      length: 0,
      molecularWeightDa: 0,
      isoelectricPointPI: 0,
      extinctionCoefficient: 0,
      gravyIndex: 0,
      chargeAtpH7: 0,
      aaComposition: {},
      aaPercentage: {},
    };
  }

  return {
    length: res.length,
    molecularWeightDa: res.molecularWeightDa,
    isoelectricPointPI: res.isoelectricPointPI,
    extinctionCoefficient: res.extinctionCoeff,
    gravyIndex: res.gravyIndex,
    chargeAtpH7: res.chargeAtpH7,
    aaComposition: res.aaCounts,
    aaPercentage: res.aaPercentages,
  };
}

// 4. ORF Finder
// Delegates to the single authoritative ORF-detection implementation in
// dna.ts. Previously this was a separate, duplicated re-implementation
// of the same reading-frame/start/stop-codon algorithm that: (a) risked
// drifting out of sync with the canonical version, and (b) never
// checked `isValid` before calling reverseComplement(), so it could
// throw an uncaught InvalidNucleotideError instead of failing safe.
export function findOpenReadingFrames(dnaSeq: string, minAaLen: number = 20): ORFResult[] {
  const val = validateSequence(dnaSeq, 'DNA');
  if (!val.isValid || !val.cleanSequence) return [];

  const clean = val.cleanSequence.replace(/U/g, 'T');
  return findOrfsReal(clean, minAaLen).map((orf) => ({
    ...orf,
    // dna.ts encodes frame as a display string (e.g. "+1", "-2");
    // this module's ORFResult type declares frame as a plain number
    // (+1/+2/+3 forward, -1/-2/-3 reverse) - convert here so callers
    // get a type-correct value rather than a stringly-typed one.
    frame: Number(orf.frame),
  }));
}

// Translate DNA
export function translateDna(dna: string): string {
  return translateDnaReal(dna);
}

/**
 * بررسی وجود Homopolymer طولانی
 * مثال: AAAAA یا GGGGG
 */
function hasLongHomopolymer(
  sequence: string,
  maxRun = 4
): boolean {
  return new RegExp(
    `(A{${maxRun + 1},}|T{${maxRun + 1},}|C{${maxRun + 1},}|G{${maxRun + 1},})`
  ).test(sequence);
}

/**
 * بررسی ساده complementarity بین دو sequence.
 *
 * این یک بررسی heuristic است و جایگزین محاسبات
 * thermodynamic واقعی Primer3 نیست.
 */
function longest3PrimeComplement(
  sequenceA: string,
  sequenceB: string
): number {
  // Uses the single authoritative DNA complement map (dna.ts) instead
  // of a local copy. Primer candidates are always canonical A/T/C/G by
  // this point, but we fall back gracefully rather than throwing here
  // since this is a heuristic warning check, not a validation gate.
  const reverseComplementB = sequenceB
    .split('')
    .reverse()
    .map((base) => {
      try {
        return getComplementBase(base, 'DNA');
      } catch {
        return 'N';
      }
    })
    .join('');

  let bestMatch = 0;

  for (
    let offset = -Math.min(
      sequenceA.length,
      reverseComplementB.length
    );
    offset <= sequenceA.length;
    offset++
  ) {
    let currentMatch = 0;

    for (let i = 0; i < sequenceA.length; i++) {
      const j = i - offset;

      if (
        j >= 0 &&
        j < reverseComplementB.length &&
        sequenceA[i] === reverseComplementB[j]
      ) {
        currentMatch++;
        bestMatch = Math.max(
          bestMatch,
          currentMatch
        );
      } else {
        currentMatch = 0;
      }
    }
  }

  return bestMatch;
}

/**
 * Warningهای اولیه کیفیت Primer
 */
function getPrimerWarnings(
  sequence: string,
  tmInfo: ReturnType<typeof calculatePrimerTm>
): string[] {
  const warnings = [...tmInfo.warnings];

  if (hasLongHomopolymer(sequence)) {
    warnings.push(
      'Contains a homopolymer run longer than 4 bases.'
    );
  }

  // بررسی GC زیاد در انتهای 3'
  const last5Bases = sequence.slice(-5);

  const gcAt3Prime = [...last5Bases].filter(
    (base) => base === 'G' || base === 'C'
  ).length;

  if (gcAt3Prime >= 4) {
    warnings.push(
      "Very GC-rich 3' end may increase non-specific priming."
    );
  }

  // بررسی ساده self-complementarity
  const selfComplement = longest3PrimeComplement(
    sequence,
    sequence
  );

  if (selfComplement >= 5) {
    warnings.push(
      `Potential self-complementarity detected (max contiguous match: ${selfComplement}).`
    );
  }

  return warnings;
}

/**
 * تبدیل یک sequence به PrimerResult
 */
function createPrimerResult(
  sequence: string
): PrimerResult {
  const tmInfo = calculatePrimerTm(sequence);

  return {
    sequence,
    length: sequence.length,
    gcContent: tmInfo.gcContent,
    tm: tmInfo.tm,
    warnings: getPrimerWarnings(
      sequence,
      tmInfo
    ),
  };
}

/**
 * امتیاز کیفیت یک Primer
 *
 * امتیاز بالاتر = بهتر
 */
function scorePrimer(
  primer: PrimerResult
): number {
  if (!primer.sequence || primer.tm === 0) {
    return -1000;
  }

  let score = 100;

  // GC ideal تقریباً 50 درصد
  score -= Math.abs(
    primer.gcContent - 50
  ) * 0.8;

  // Tm ideal تقریبی 60 درجه
  score -= Math.abs(
    primer.tm - 60
  ) * 1.2;

  // هر Warning امتیاز را کم میکند
  score -= primer.warnings.length * 6;

  // داشتن G/C در انتهای 3' کمی مثبت است
  if (
    primer.sequence.endsWith('G') ||
    primer.sequence.endsWith('C')
  ) {
    score += 3;
  }

  return score;
}

// 5. Primer Designer (Advanced Heuristic Primer Designer)
export function designPrimers(
  sequence: string,
  targetLen: number = 20
): PrimerPairResult {
  const validation = validateSequence(
    sequence,
    'DNA',
    false
  );

  const cleanSequence =
    validation.cleanSequence;

  const fail = (
    message: string
  ): PrimerPairResult => ({
    forward: {
      sequence: '',
      length: 0,
      gcContent: 0,
      tm: 0,
      warnings: [message],
    },

    reverse: {
      sequence: '',
      length: 0,
      gcContent: 0,
      tm: 0,
      warnings: [message],
    },

    score: 0,
    warnings: [message],
  });

  if (
    !validation.isValid ||
    !cleanSequence
  ) {
    return fail(
      validation.errorMessage ||
        'Invalid or empty DNA sequence.'
    );
  }

  if (
    !Number.isInteger(targetLen) ||
    targetLen < 15 ||
    targetLen > 35
  ) {
    return fail(
      'Primer length must be a whole number between 15 and 35 bases.'
    );
  }

  if (
    cleanSequence.length <
    targetLen * 2
  ) {
    return fail(
      `Template is too short for two ${targetLen} bp primers. ` +
        `Provide at least ${targetLen * 2} bp.`
    );
  }

  const reverseTemplate =
    reverseComplement(cleanSequence);

  // بررسی طولهای نزدیک به طول انتخابشده
  const candidateLengths = Array.from(
    new Set(
      [
        targetLen - 2,
        targetLen - 1,
        targetLen,
        targetLen + 1,
        targetLen + 2,
      ].filter(
        (length) =>
          length >= 15 && length <= 35
      )
    )
  );

  // تعداد موقعیتهایی که از هر سر بررسی میشود
  const scanWindow = Math.min(
    30,
    Math.max(
      0,
      Math.floor(
        cleanSequence.length / 2 - 15
      )
    )
  );

  const forwardCandidates: PrimerResult[] =
    [];

  const reverseCandidates: PrimerResult[] =
    [];

  for (const length of candidateLengths) {
    for (
      let offset = 0;
      offset <= scanWindow;
      offset++
    ) {
      // Forward primer از ابتدای template
      const forwardSequence =
        cleanSequence.slice(
          offset,
          offset + length
        );

      // Reverse primer از reverse complement
      const reverseSequence =
        reverseTemplate.slice(
          offset,
          offset + length
        );

      if (
        forwardSequence.length === length
      ) {
        forwardCandidates.push(
          createPrimerResult(
            forwardSequence
          )
        );
      }

      if (
        reverseSequence.length === length
      ) {
        reverseCandidates.push(
          createPrimerResult(
            reverseSequence
          )
        );
      }
    }
  }

  if (
    forwardCandidates.length === 0 ||
    reverseCandidates.length === 0
  ) {
    return fail(
      'Unable to generate enough primer candidates from this template.'
    );
  }

  // فقط بهترین Candidateها را برای Pairing نگه میداریم
  const rankedForward =
    forwardCandidates
      .map((primer) => ({
        primer,
        score: scorePrimer(primer),
      }))
      .sort(
        (a, b) => b.score - a.score
      )
      .slice(0, 25);

  const rankedReverse =
    reverseCandidates
      .map((primer) => ({
        primer,
        score: scorePrimer(primer),
      }))
      .sort(
        (a, b) => b.score - a.score
      )
      .slice(0, 25);

  let bestPair: PrimerPairResult | null =
    null;

  // مقایسه Candidateهای Forward و Reverse
  for (const forwardCandidate of rankedForward) {
    for (const reverseCandidate of rankedReverse) {
      const tmDifference = Math.abs(
        forwardCandidate.primer.tm -
          reverseCandidate.primer.tm
      );

      const heteroComplement =
        longest3PrimeComplement(
          forwardCandidate.primer.sequence,
          reverseCandidate.primer.sequence
        );

      let pairScore =
        forwardCandidate.score +
        reverseCandidate.score;

      // اختلاف Tm
      pairScore -= tmDifference * 3;

      if (tmDifference > 5) {
        pairScore -= 20;
      }

      // احتمال complementarity بین دو primer
      if (heteroComplement >= 5) {
        pairScore -=
          (heteroComplement - 4) * 12;
      }

      const pairWarnings: string[] = [];

      if (tmDifference > 3) {
        pairWarnings.push(
          `Forward/reverse Tm difference is ${tmDifference.toFixed(
            1
          )}°C.`
        );
      }

      if (heteroComplement >= 5) {
        pairWarnings.push(
          `Potential primer-pair complementarity detected (max contiguous match: ${heteroComplement}).`
        );
      }

      pairWarnings.push(
        'Heuristic browser-based design. Confirm final primers with Primer3 or equivalent thermodynamic analysis.'
      );

      const result: PrimerPairResult = {
        forward:
          forwardCandidate.primer,

        reverse:
          reverseCandidate.primer,

        score: Number(
          pairScore.toFixed(1)
        ),

        warnings: pairWarnings,
      };

      if (
        !bestPair ||
        result.score > bestPair.score
      ) {
        bestPair = result;
      }
    }
  }

  return (
    bestPair ||
    fail('No suitable primer pair was found.')
  );
}

// 6. Restriction Enzyme Finder
//
// NOTE: This used to contain a second, independent restriction-site
// search (its own local COMMON_ENZYMES list and a simple linear-only
// indexOf scan with no circular/origin-crossing support). That was a
// duplicate of the canonical, circular-aware digestDna() in
// restriction.ts, was not used by any UI component, and would have
// given inconsistent results (different enzyme set, no circular
// support) if it had ever been wired up. It has been removed - use
// digestDna() from '../utils/restriction' for all restriction-site
// analysis.

// 7. Pairwise Sequence Alignment (Needleman-Wunsch) with explicit threshold checks
export function needlemanWunschAlignment(
  seqA: string,
  seqB: string,
  matchScore: number = 2,
  mismatchPenalty: number = -1,
  gapPenalty: number = -2
): AlignmentResult & { warning?: string } {
  const maxLen = 1000;
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
  const warning: string | undefined = undefined;

  if (cleanA.length > maxLen || cleanB.length > maxLen) {
    return {
      alignedA: '',
      alignedB: '',
      matchLine: '',
      score: 0,
      identityPercent: 0,
      matches: 0,
      mismatches: 0,
      gaps: 0,
      warning: `Sequence length (${Math.max(cleanA.length, cleanB.length)} bp) exceeds maximum supported limit of ${maxLen} bp for browser pairwise DP matrix alignment. Please reduce sequence length to proceed.`,
    };
  }

  const m = cleanA.length;
  const n = cleanB.length;

  if (m === 0 || n === 0) {
    return {
      alignedA: '',
      alignedB: '',
      matchLine: '',
      score: 0,
      identityPercent: 0,
      matches: 0,
      mismatches: 0,
      gaps: 0,
      warning,
    };
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i * gapPenalty;
  for (let j = 0; j <= n; j++) dp[0][j] = j * gapPenalty;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const match = dp[i - 1][j - 1] + (cleanA[i - 1] === cleanB[j - 1] ? matchScore : mismatchPenalty);
      const deleteGap = dp[i - 1][j] + gapPenalty;
      const insertGap = dp[i][j - 1] + gapPenalty;
      dp[i][j] = Math.max(match, deleteGap, insertGap);
    }
  }

  let alignedA = '';
  let alignedB = '';
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const scoreDiag = dp[i - 1][j - 1] + (cleanA[i - 1] === cleanB[j - 1] ? matchScore : mismatchPenalty);
      if (dp[i][j] === scoreDiag) {
        alignedA = cleanA[i - 1] + alignedA;
        alignedB = cleanB[j - 1] + alignedB;
        i--;
        j--;
        continue;
      }
    }

    if (i > 0 && dp[i][j] === dp[i - 1][j] + gapPenalty) {
      alignedA = cleanA[i - 1] + alignedA;
      alignedB = '-' + alignedB;
      i--;
    } else {
      alignedA = '-' + alignedA;
      alignedB = cleanB[j - 1] + alignedB;
      j--;
    }
  }

  let matchLine = '';
  let matchCount = 0;
  let mismatchCount = 0;
  let gapCount = 0;

  for (let k = 0; k < alignedA.length; k++) {
    const charA = alignedA[k];
    const charB = alignedB[k];
    if (charA === '-' || charB === '-') {
      matchLine += ' ';
      gapCount++;
    } else if (charA === charB) {
      matchLine += '|';
      matchCount++;
    } else {
      matchLine += '.';
      mismatchCount++;
    }
  }

  const alignLen = alignedA.length;
  const identityPercent = Number(((matchCount / (alignLen || 1)) * 100).toFixed(1));

  return {
    alignedA,
    alignedB,
    matchLine,
    score: dp[m][n],
    identityPercent,
    matches: matchCount,
    mismatches: mismatchCount,
    gaps: gapCount,
    warning,
  };
}

// 8. Codon Optimization wrapper
export function optimizeCodonsForHost(
  input: string,
  host: HostOrganism = 'ecoli'
): CodonOptimizationResult {
  const res = optimizeCodonsReal(input, host);

  return {
    optimizedSequence: res.optimizedDna,
    caiScore: res.optimizedCai,
  };
}

// 9. Newick Tree Parser wrapper
export function parseNewick(newick: string): NewickNode {
  const parsed = parseNewickReal(newick);
  if (!parsed.root) {
    return { name: 'Root', children: [] };
  }

  const convertNode = (node: PhyloNode): NewickNode => {
    return {
      name: node.name,
      length: node.branchLength,
      children: node.children.map(convertNode),
    };
  };

  return convertNode(parsed.root);
}