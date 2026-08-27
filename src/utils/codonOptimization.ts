// Codon Optimization Engine and Usage Tables
import { CODON_TABLE } from './dna';
import { validateSequence } from './sequenceValidator';

export type HostOrganism = 'ecoli' | 'human' | 'yeast' | 'generic';

// Codon usage frequencies (per 1000 codons) based on Kazusa / GenBank codon usage database
export const CODON_USAGE_TABLES: Record<
  HostOrganism,
  { name: string; description: string; frequencies: Record<string, number> }
> = {
  ecoli: {
    name: 'Escherichia coli (K-12)',
    description: 'Optimized for high-level expression in E. coli expression strains (e.g. BL21(DE3)).',
    frequencies: {
      TTT: 22.2, TTC: 16.6, TTA: 13.7, TTG: 13.6,
      CTT: 11.2, CTC: 10.4, CTA: 3.9,  CTG: 52.8, // Leu (CTG max)
      ATT: 30.1, ATC: 25.1, ATA: 4.4,             // Ile (ATT/ATC high)
      ATG: 27.9,                                  // Met
      GTT: 18.3, GTC: 15.3, GTA: 10.9, GTG: 26.3, // Val (GTG max)
      TCT: 8.6,  TCC: 8.6,  TCA: 7.2,  TCG: 8.9,  // Ser
      CCT: 7.0,  CCC: 5.5,  CCA: 8.4,  CCG: 23.3, // Pro (CCG max)
      ACT: 8.9,  ACC: 23.4, ACA: 7.1,  ACG: 14.4, // Thr (ACC max)
      GCT: 15.3, GCC: 25.5, GCA: 21.1, GCG: 33.6, // Ala (GCG max)
      TAT: 16.2, TAC: 12.2,                      // Tyr
      TAA: 2.0,  TAG: 0.3,  TGA: 1.0,             // Stop (TAA max)
      CAT: 12.8, CAC: 9.7,                        // His
      CAA: 15.4, CAG: 28.9,                       // Gln (CAG max)
      AAT: 17.8, AAC: 21.6,                       // Asn (AAC max)
      AAA: 33.6, AAG: 12.1,                       // Lys (AAA max)
      GAT: 32.2, GAC: 19.2,                       // Asp (GAT max)
      GAA: 39.6, GAG: 17.8,                       // Glu (GAA max)
      TGT: 5.1,  TGC: 6.4,                        // Cys (TGC max)
      TGG: 15.2,                                  // Trp
      CGT: 20.9, CGC: 22.0, CGA: 3.6,  CGG: 5.4,  // Arg (CGC/CGT max)
      AGT: 8.8,  AGC: 16.0,                       // Ser
      AGA: 2.1,  AGG: 1.2,                        // Arg (min)
      GGT: 24.8, GGC: 29.6, GGA: 7.9,  GGG: 11.0, // Gly (GGC max)
    },
  },
  human: {
    name: 'Homo sapiens (Human)',
    description: 'Optimized for mammalian cell line expression (HEK293, CHO, human tissues).',
    frequencies: {
      TTT: 17.6, TTC: 20.3, TTA: 7.7,  TTG: 12.9,
      CTT: 13.2, CTC: 19.6, CTA: 7.2,  CTG: 39.6, // Leu (CTG max)
      ATT: 16.0, ATC: 20.8, ATA: 7.5,             // Ile (ATC max)
      ATG: 22.0,                                  // Met
      GTT: 11.0, GTC: 14.5, GTA: 7.1,  GTG: 28.1, // Val (GTG max)
      TCT: 15.2, TCC: 17.7, TCA: 12.2, TCG: 4.4,  // Ser (TCC max)
      CCT: 17.5, CCC: 19.8, CCA: 16.9, CCG: 6.9,  // Pro (CCC max)
      ACT: 13.1, ACC: 18.9, ACA: 15.1, ACG: 6.1,  // Thr (ACC max)
      GCT: 18.4, GCC: 27.7, GCA: 15.8, GCG: 7.4,  // Ala (GCC max)
      TAT: 12.2, TAC: 15.3,                      // Tyr (TAC max)
      TAA: 1.0,  TAG: 0.8,  TGA: 1.6,             // Stop (TGA max)
      CAT: 10.9, CAC: 15.1,                       // His (CAC max)
      CAA: 12.3, CAG: 34.2,                       // Gln (CAG max)
      AAT: 17.0, AAC: 19.1,                       // Asn (AAC max)
      AAA: 24.4, AAG: 31.9,                       // Lys (AAG max)
      GAT: 21.8, GAC: 25.1,                       // Asp (GAC max)
      GAA: 29.0, GAG: 39.6,                       // Glu (GAG max)
      TGT: 10.6, TGC: 12.6,                       // Cys (TGC max)
      TGG: 13.2,                                  // Trp
      CGT: 4.5,  CGC: 10.4, CGA: 6.2,  CGG: 11.4, // Arg (CGG max)
      AGT: 12.1, AGC: 19.5,                       // Ser (AGC max)
      AGA: 12.2, AGG: 12.0,                       // Arg
      GGT: 10.8, GGC: 22.2, GGA: 16.5, GGG: 16.5, // Gly (GGC max)
    },
  },
  yeast: {
    name: 'Saccharomyces cerevisiae (Yeast)',
    description: 'Optimized for high-expression in baker’s yeast (S. cerevisiae).',
    frequencies: {
      TTT: 26.1, TTC: 18.4, TTA: 26.2, TTG: 27.2,
      CTT: 12.3, CTC: 5.4, CTA: 13.4, CTG: 10.5,
      ATT: 30.1, ATC: 17.2, ATA: 17.8,
      ATG: 20.9,
      GTT: 22.1, GTC: 11.8, GTA: 11.8, GTG: 10.8,
      TCT: 23.5, TCC: 14.2, TCA: 18.7, TCG: 8.6,
      CCT: 13.5, CCC: 6.8, CCA: 18.3, CCG: 5.3,
      ACT: 20.3, ACC: 12.7, ACA: 17.8, ACG: 8.0,
      GCT: 21.2, GCC: 12.6, GCA: 16.2, GCG: 6.2,
      TAT: 18.8, TAC: 14.8,
      TAA: 1.1, TAG: 0.5, TGA: 0.7,
      CAT: 13.6, CAC: 7.8,
      CAA: 27.3, CAG: 12.1,
      AAT: 35.7, AAC: 24.8,
      AAA: 41.9, AAG: 30.8,
      GAT: 37.6, GAC: 20.2,
      GAA: 45.6, GAG: 19.2,
      TGT: 8.1, TGC: 4.8,
      TGG: 10.4,
      CGT: 6.4, CGC: 2.6, CGA: 3.0, CGG: 1.7,
      AGT: 14.2, AGC: 9.8,
      AGA: 21.3, AGG: 9.2,
      GGT: 23.9, GGC: 9.8, GGA: 10.9, GGG: 6.0,
    },
  },
  generic: {
    name: 'Generic / Balanced',
    description: 'Standard codon usage profile for general organisms.',
    frequencies: Object.keys(CODON_TABLE).reduce((acc, codon) => {
      acc[codon] = 20.0;
      return acc;
    }, {} as Record<string, number>),
  },
};

/**
 * Calculates Codon Adaptation Index (CAI) for a DNA coding sequence given a host organism.
 * CAI = geometric mean of relative adaptiveness values (w_i = f_i / f_max).
 */
export function calculateCai(dnaSeq: string, host: HostOrganism): { cai: number; warning?: string } {
  const val = validateSequence(dnaSeq, 'DNA');
  if (!val.isValid) {
    return { cai: 0, warning: `Sequence contains invalid characters: ${val.invalidChars.join(', ')}` };
  }
  const seq = val.cleanSequence.replace(/U/g, 'T');
  if (seq.length < 3) return { cai: 0 };

  // CAI requires unambiguous codons. IUPAC ambiguity codes do not
  // identify a single codon and must not be silently skipped.
  if (!/^[ACGT]+$/i.test(seq)) {
    return {
      cai: 0,
      warning: 'CAI cannot be calculated reliably for ambiguous codons.',
    };
  }

  const hostTable = CODON_USAGE_TABLES[host].frequencies;

  // Group codons by amino acid to compute f_max for each amino acid
  const maxFreqPerAa: Record<string, number> = {};
  for (const [codon, info] of Object.entries(CODON_TABLE)) {
    const aa = info.letter;
    const freq = hostTable[codon] || 1.0;
    if (!maxFreqPerAa[aa] || freq > maxFreqPerAa[aa]) {
      maxFreqPerAa[aa] = freq;
    }
  }

  let logSum = 0;
  let validCodonCount = 0;

  for (let i = 0; i <= seq.length - 3; i += 3) {
    const codon = seq.substring(i, i + 3);
    const info = CODON_TABLE[codon];
    if (!info) continue;

    const aa = info.letter;
    if (aa === '*') break; // CAI is defined over the coding region only - translation (and CAI accounting) terminates at the first stop codon

    const freq = hostTable[codon] || 0.1;
    const maxFreq = maxFreqPerAa[aa] || 1.0;

    const w = Math.min(1.0, Math.max(0.01, freq / maxFreq));
    logSum += Math.log(w);
    validCodonCount++;
  }

  if (validCodonCount === 0) return { cai: 0 };

  const cai = Math.exp(logSum / validCodonCount);
  return { cai: Number(cai.toFixed(3)) };
}

/**
 * Optimizes a DNA coding sequence for high expression in the target host organism.
 * Preserves exact amino acid sequence.
 */
export function optimizeCodons(
  dnaSeq: string,
  host: HostOrganism
): {
  originalDna: string;
  optimizedDna: string;
  originalCai: number;
  optimizedCai: number;
  hostName: string;
  proteinSequence: string;
  originalGcContent: number;
  optimizedGcContent: number;
  codonsChanged: number;
  totalCodons: number;
  warning?: string;
} {
  const val = validateSequence(dnaSeq, 'DNA');
  const hasAmbiguity = val.isValid && !/^[ACGT]+$/i.test(val.cleanSequence);
  const seq = val.isValid && !hasAmbiguity
    ? val.cleanSequence.replace(/U/g, 'T')
    : '';

  // Codon optimization requires a deterministic codon-by-codon substitution.
  // IUPAC ambiguity codes (e.g. N, R, Y) do not identify a single codon, so
  // they cannot be safely reassigned to a host-preferred codon. Rather than
  // silently discarding the sequence with no explanation, surface this to
  // the caller so the UI can inform the user instead of showing an empty
  // "optimized" result with no context.
  let warning: string | undefined;
  if (dnaSeq.trim().length > 0) {
    if (!val.isValid) {
      warning = `Sequence contains invalid characters: ${val.invalidChars.join(', ')}`;
    } else if (hasAmbiguity) {
      warning = 'Codon optimization requires unambiguous bases. IUPAC ambiguity codes (N, R, Y, etc.) do not identify a single codon and were not optimized.';
    }
  }

  const hostTable = CODON_USAGE_TABLES[host].frequencies;

  // Build top codon map for each amino acid in selected host
  const topCodonPerAa: Record<string, string> = {};
  const maxFreqPerAa: Record<string, number> = {};

  for (const [codon, info] of Object.entries(CODON_TABLE)) {
    const aa = info.letter;
    const freq = hostTable[codon] || 0;
    if (!maxFreqPerAa[aa] || freq > maxFreqPerAa[aa]) {
      maxFreqPerAa[aa] = freq;
      topCodonPerAa[aa] = codon;
    }
  }

  let optimizedDna = '';
  let proteinSequence = '';
  let codonsChanged = 0;
  let totalCodons = 0;
  let stopIndex = -1; // index (in seq) of the first stop codon, if any

  for (let i = 0; i <= seq.length - 3; i += 3) {
    const origCodon = seq.substring(i, i + 3);
    const info = CODON_TABLE[origCodon];
    totalCodons++;

    if (!info) {
      optimizedDna += origCodon;
      proteinSequence += 'X';
      continue;
    }

    const aa = info.letter;
    proteinSequence += aa;

    if (aa === '*') {
      // Use best stop codon for host (TAA for ecoli, TGA for human)
      const bestStop = host === 'ecoli' ? 'TAA' : host === 'human' ? 'TGA' : 'TAA';
      optimizedDna += bestStop;
      if (origCodon !== bestStop) codonsChanged++;
      stopIndex = i;
      // Real translation - and therefore codon optimization of the CDS -
      // terminates at the first in-frame stop codon. Anything after it
      // (3' UTR, vector backbone, etc.) is not part of the coding
      // sequence and must not be reinterpreted as amino acids / rewritten.
      break;
    } else {
      const bestCodon = topCodonPerAa[aa] || origCodon;
      optimizedDna += bestCodon;
      if (origCodon !== bestCodon) codonsChanged++;
    }
  }

  // Preserve any sequence after the first stop codon (3' UTR, trailing
  // partial codon, etc.) completely unmodified - it is not part of the
  // coding region this function optimizes.
  if (stopIndex !== -1) {
    optimizedDna += seq.substring(stopIndex + 3);
  } else {
    // No in-frame stop codon was found (e.g. incomplete/partial CDS):
    // append any trailing bases that didn't form a full codon, unchanged.
    const consumed = totalCodons * 3;
    optimizedDna += seq.substring(consumed);
  }

  // Calculate CAI
  const origCaiRes = calculateCai(seq, host);
  const optCaiRes = calculateCai(optimizedDna, host);

  // Calculate GC contents
  const gcCount = (s: string) => (s.match(/[GC]/g) || []).length;
  const origGc = seq.length > 0 ? Number(((gcCount(seq) / seq.length) * 100).toFixed(1)) : 0;
  const optGc = optimizedDna.length > 0 ? Number(((gcCount(optimizedDna) / optimizedDna.length) * 100).toFixed(1)) : 0;

  return {
    originalDna: seq,
    optimizedDna,
    originalCai: origCaiRes.cai,
    optimizedCai: optCaiRes.cai,
    hostName: CODON_USAGE_TABLES[host].name,
    proteinSequence,
    originalGcContent: origGc,
    optimizedGcContent: optGc,
    codonsChanged,
    totalCodons,
    warning,
  };
}
