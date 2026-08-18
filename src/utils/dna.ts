// DNA & RNA Sequence Utilities
import { validateSequence } from './sequenceValidator';

export const CODON_TABLE: Record<string, { aa: string; name: string; letter: string }> = {
  TTT: { aa: 'Phe', name: 'Phenylalanine', letter: 'F' },
  TTC: { aa: 'Phe', name: 'Phenylalanine', letter: 'F' },
  TTA: { aa: 'Leu', name: 'Leucine', letter: 'L' },
  TTG: { aa: 'Leu', name: 'Leucine', letter: 'L' },
  CTT: { aa: 'Leu', name: 'Leucine', letter: 'L' },
  CTC: { aa: 'Leu', name: 'Leucine', letter: 'L' },
  CTA: { aa: 'Leu', name: 'Leucine', letter: 'L' },
  CTG: { aa: 'Leu', name: 'Leucine', letter: 'L' },
  ATT: { aa: 'Ile', name: 'Isoleucine', letter: 'I' },
  ATC: { aa: 'Ile', name: 'Isoleucine', letter: 'I' },
  ATA: { aa: 'Ile', name: 'Isoleucine', letter: 'I' },
  ATG: { aa: 'Met', name: 'Methionine', letter: 'M' },
  GTT: { aa: 'Val', name: 'Valine', letter: 'V' },
  GTC: { aa: 'Val', name: 'Valine', letter: 'V' },
  GTA: { aa: 'Val', name: 'Valine', letter: 'V' },
  GTG: { aa: 'Val', name: 'Valine', letter: 'V' },
  TCT: { aa: 'Ser', name: 'Serine', letter: 'S' },
  TCC: { aa: 'Ser', name: 'Serine', letter: 'S' },
  TCA: { aa: 'Ser', name: 'Serine', letter: 'S' },
  TCG: { aa: 'Ser', name: 'Serine', letter: 'S' },
  CCT: { aa: 'Pro', name: 'Proline', letter: 'P' },
  CCC: { aa: 'Pro', name: 'Proline', letter: 'P' },
  CCA: { aa: 'Pro', name: 'Proline', letter: 'P' },
  CCG: { aa: 'Pro', name: 'Proline', letter: 'P' },
  ACT: { aa: 'Thr', name: 'Threonine', letter: 'T' },
  ACC: { aa: 'Thr', name: 'Threonine', letter: 'T' },
  ACA: { aa: 'Thr', name: 'Threonine', letter: 'T' },
  ACG: { aa: 'Thr', name: 'Threonine', letter: 'T' },
  GCT: { aa: 'Ala', name: 'Alanine', letter: 'A' },
  GCC: { aa: 'Ala', name: 'Alanine', letter: 'A' },
  GCA: { aa: 'Ala', name: 'Alanine', letter: 'A' },
  GCG: { aa: 'Ala', name: 'Alanine', letter: 'A' },
  TAT: { aa: 'Tyr', name: 'Tyrosine', letter: 'Y' },
  TAC: { aa: 'Tyr', name: 'Tyrosine', letter: 'Y' },
  TAA: { aa: 'STOP', name: 'Stop Codon (Ochre)', letter: '*' },
  TAG: { aa: 'STOP', name: 'Stop Codon (Amber)', letter: '*' },
  CAT: { aa: 'His', name: 'Histidine', letter: 'H' },
  CAC: { aa: 'His', name: 'Histidine', letter: 'H' },
  CAA: { aa: 'Gln', name: 'Glutamine', letter: 'Q' },
  CAG: { aa: 'Gln', name: 'Glutamine', letter: 'Q' },
  AAT: { aa: 'Asn', name: 'Asparagine', letter: 'N' },
  AAC: { aa: 'Asn', name: 'Asparagine', letter: 'N' },
  AAA: { aa: 'Lys', name: 'Lysine', letter: 'K' },
  AAG: { aa: 'Lys', name: 'Lysine', letter: 'K' },
  GAT: { aa: 'Asp', name: 'Aspartic Acid', letter: 'D' },
  GAC: { aa: 'Asp', name: 'Aspartic Acid', letter: 'D' },
  GAA: { aa: 'Glu', name: 'Glutamic Acid', letter: 'E' },
  GAG: { aa: 'Glu', name: 'Glutamic Acid', letter: 'E' },
  TGT: { aa: 'Cys', name: 'Cysteine', letter: 'C' },
  TGC: { aa: 'Cys', name: 'Cysteine', letter: 'C' },
  TGA: { aa: 'STOP', name: 'Stop Codon (Opal)', letter: '*' },
  TGG: { aa: 'Trp', name: 'Tryptophan', letter: 'W' },
  CGT: { aa: 'Arg', name: 'Arginine', letter: 'R' },
  CGC: { aa: 'Arg', name: 'Arginine', letter: 'R' },
  CGA: { aa: 'Arg', name: 'Arginine', letter: 'R' },
  CGG: { aa: 'Arg', name: 'Arginine', letter: 'R' },
  AGT: { aa: 'Ser', name: 'Serine', letter: 'S' },
  AGC: { aa: 'Ser', name: 'Serine', letter: 'S' },
  AGA: { aa: 'Arg', name: 'Arginine', letter: 'R' },
  AGG: { aa: 'Arg', name: 'Arginine', letter: 'R' },
  GGT: { aa: 'Gly', name: 'Glycine', letter: 'G' },
  GGC: { aa: 'Gly', name: 'Glycine', letter: 'G' },
  GGA: { aa: 'Gly', name: 'Glycine', letter: 'G' },
  GGG: { aa: 'Gly', name: 'Glycine', letter: 'G' },
};

/**
 * SINGLE SOURCE OF TRUTH for nucleotide complementation.
 *
 * These two maps (uppercase keys only) are the ONLY authoritative
 * IUPAC complement definitions in the codebase. Every function that
 * needs to complement a base (reverseComplement, complementSequence,
 * primer self-complementarity heuristics, etc.) must derive its
 * answer from getComplementBase() / these maps rather than defining
 * its own copy.
 *
 * Case is handled by getComplementBase()/complementSequence(), so
 * these maps intentionally do not duplicate lowercase entries.
 */
export const DNA_COMPLEMENT_MAP: Record<string, string> = {
  A: 'T',
  T: 'A',
  C: 'G',
  G: 'C',
  R: 'Y', // Purine (A/G) <-> Pyrimidine (C/T)
  Y: 'R',
  S: 'S', // Strong (C/G)
  W: 'W', // Weak (A/T)
  K: 'M', // Keto (G/T) <-> Amino (A/C)
  M: 'K',
  B: 'V', // not A <-> not T
  V: 'B',
  D: 'H', // not C <-> not G
  H: 'D',
  N: 'N',
};

export const RNA_COMPLEMENT_MAP: Record<string, string> = {
  A: 'U',
  U: 'A',
  C: 'G',
  G: 'C',
  R: 'Y',
  Y: 'R',
  S: 'S',
  W: 'W',
  K: 'M',
  M: 'K',
  B: 'V',
  V: 'B',
  D: 'H',
  H: 'D',
  N: 'N',
};

export class InvalidNucleotideError extends Error {
  constructor(char: string, mode: 'DNA' | 'RNA') {
    super(`Invalid ${mode} character '${char}' encountered during complementation.`);
    this.name = 'InvalidNucleotideError';
  }
}

/**
 * Returns the complement of a single base (case-insensitive), preserving
 * the case of the input. Throws InvalidNucleotideError for any character
 * that is not a recognized IUPAC nucleotide code for the given mode -
 * invalid characters are never silently mapped to 'N'.
 */
export function getComplementBase(base: string, mode: 'DNA' | 'RNA' = 'DNA'): string {
  const map = mode === 'DNA' ? DNA_COMPLEMENT_MAP : RNA_COMPLEMENT_MAP;
  const upper = base.toUpperCase();
  const comp = map[upper];
  if (comp === undefined) {
    throw new InvalidNucleotideError(base, mode);
  }
  return base === upper ? comp : comp.toLowerCase();
}

/**
 * Returns the complement strand (3' -> 5' when read directly under the
 * original 5' -> 3' strand, i.e. NOT reversed) while preserving the
 * selected molecule type.
 * DNA: A <-> T
 * RNA: A <-> U
 *
 * Throws InvalidNucleotideError if the sequence contains a character
 * that is not a valid IUPAC nucleotide code for the given mode. Callers
 * are expected to validate/clean the sequence (see sequenceValidator.ts)
 * before calling this function.
 */
export function complementSequence(
  sequence: string,
  mode: 'DNA' | 'RNA' = 'DNA'
): string {
  if (!sequence) return '';

  const result: string[] = [];
  for (const base of sequence) {
    result.push(getComplementBase(base, mode));
  }
  return result.join('');
}

export function validateDna(sequence: string): { isValid: boolean; invalidChars: string[] } {
  const val = validateSequence(sequence, 'DNA');
  return {
    isValid: val.isValid,
    invalidChars: val.invalidChars,
  };
}

/**
 * Computes 5' -> 3' reverse complement with full IUPAC support.
 * Delegates to complementSequence() (the single authoritative
 * complementation implementation) and reverses the result.
 *
 * Throws InvalidNucleotideError if the sequence contains a character
 * that is not a valid IUPAC nucleotide code for the given mode.
 */
export function reverseComplement(sequence: string, mode: 'DNA' | 'RNA' = 'DNA'): string {
  if (!sequence) return '';
  return complementSequence(sequence, mode).split('').reverse().join('');
}

export function transcribeDnaToRna(dnaSeq: string): string {
  if (!dnaSeq) return '';

  const val = validateSequence(dnaSeq, 'DNA');
  if (!val.isValid) return '';

  return val.cleanSequence.replace(/T/g, 'U');
}

/**
 * Translates a DNA/RNA sequence into a protein sequence, terminating
 * translation at the FIRST in-frame stop codon (TAA/TAG/TGA), matching
 * real ribosomal translation. The stop codon itself is represented once
 * as '*' and nothing after it is translated.
 *
 * If no in-frame stop codon is present, translation runs to the end of
 * the available complete codons (no trailing '*').
 */
export function translateRnaToProtein(rnaOrDnaSeq: string): string {
  if (!rnaOrDnaSeq) return '';

  const normalized = rnaOrDnaSeq.toUpperCase().replace(/\s+/g, '');
  const targetType = normalized.includes('U') ? 'RNA' : 'DNA';
  const val = validateSequence(normalized, targetType);
  if (!val.isValid) return '';

  const dna = val.cleanSequence.replace(/U/g, 'T');
  let protein = '';

  for (let i = 0; i <= dna.length - 3; i += 3) {
    const codon = dna.substring(i, i + 3);
    const info = CODON_TABLE[codon];
    if (info) {
      protein += info.letter;
      if (info.letter === '*') {
        // Translation terminates at the first stop codon.
        break;
      }
    } else {
      protein += 'X';
    }
  }

  return protein;
}

export function calculateSequenceStats(sequence: string, mode: 'ssDNA' | 'dsDNA' | 'RNA' = 'ssDNA') {
  const seq = sequence.toUpperCase().replace(/\s+/g, '');
  if (seq) {
    const targetType = mode === 'RNA' ? 'RNA' : 'DNA';
    const val = validateSequence(seq, targetType);
    if (!val.isValid) {
      return {
        length: 0,
        gcContent: 0,
        atContent: 0,
        molecularWeightDa: 0,
        baseCounts: { A: 0, T: 0, C: 0, G: 0, U: 0, N: 0 },
        mode,
      };
    }
  }
  const len = seq.length;

  if (len === 0) {
    return {
      length: 0,
      gcContent: 0,
      atContent: 0,
      molecularWeightDa: 0,
      baseCounts: { A: 0, T: 0, C: 0, G: 0, U: 0, N: 0 },
      mode,
    };
  }

  const baseCounts: Record<string, number> = { A: 0, T: 0, C: 0, G: 0, U: 0, N: 0 };
  for (const b of seq) {
    if (baseCounts[b] !== undefined) {
      baseCounts[b]++;
    }
    // IUPAC ambiguity codes are valid DNA/RNA symbols, but they are
    // not equivalent to a literal N. Keep N reserved for actual N bases.
  }

  const gcCount = baseCounts.G + baseCounts.C;
  const atCount = baseCounts.A + baseCounts.T + baseCounts.U;

  const gcContent = Number(((gcCount / len) * 100).toFixed(2));
  const atContent = Number(((atCount / len) * 100).toFixed(2));

  let mw = 0;
  if (mode === 'dsDNA') {
    mw = len * 617.9 + 36.0;
  } else if (mode === 'RNA') {
    mw = baseCounts.A * 329.2 + baseCounts.U * 306.2 + baseCounts.C * 305.2 + baseCounts.G * 345.2 + 159.0;
  } else {
    mw = baseCounts.A * 313.21 + baseCounts.T * 304.2 + baseCounts.C * 289.18 + baseCounts.G * 329.21 - 61.96;
  }

  return {
    length: len,
    gcContent,
    atContent,
    molecularWeightDa: Math.max(0, Math.round(mw)),
    baseCounts,
    mode,
  };
}

export function findOpenReadingFrames(dnaSeq: string, minAaLength = 10) {
  const val = validateSequence(dnaSeq, 'DNA');
  if (!val.isValid || !val.cleanSequence) return [];
  if (!Number.isInteger(minAaLength) || minAaLength < 1) return [];

  const seq = val.cleanSequence.replace(/U/g, 'T');
  const len = seq.length;
  if (len < 9) return [];

  const rev = reverseComplement(seq);
  const orfs: Array<{
    frame: string;
    start: number;
    end: number;
    lengthBp: number;
    lengthAa: number;
    proteinSequence: string;
  }> = [];

  const searchFrame = (targetSeq: string, isReverse: boolean) => {
    for (let f = 0; f < 3; f++) {
      let inOrf = false;
      let startIdx = 0;

      for (let i = f; i <= targetSeq.length - 3; i += 3) {
        const codon = targetSeq.substring(i, i + 3);

        if (!inOrf && codon === 'ATG') {
          inOrf = true;
          startIdx = i;
        } else if (inOrf && (codon === 'TAA' || codon === 'TAG' || codon === 'TGA')) {
          inOrf = false;
          const endIdx = i + 3;
          const orfDna = targetSeq.substring(startIdx, endIdx);
          const prot = translateRnaToProtein(orfDna);
          const lengthAa = prot.replace(/\*/g, '').length;

          if (lengthAa >= minAaLength) {
            const posStart = isReverse ? len - startIdx : startIdx + 1;
            const posEnd = isReverse ? len - endIdx + 1 : endIdx;

            orfs.push({
              frame: `${isReverse ? '-' : '+'}${f + 1}`,
              start: Math.min(posStart, posEnd),
              end: Math.max(posStart, posEnd),
              lengthBp: orfDna.length,
              lengthAa,
              proteinSequence: prot,
            });
          }
        }
      }
    }
  };

  searchFrame(seq, false);
  searchFrame(rev, true);

  return orfs.sort((a, b) => b.lengthBp - a.lengthBp);
}

export function countKmers(sequence: string, k: number) {
  const val = validateSequence(sequence, 'DNA');
  const seq = val.isValid ? val.cleanSequence : '';
  const kmers: Record<string, number> = {};

  if (!val.isValid || !Number.isInteger(k) || k <= 0 || seq.length < k) return kmers;

  for (let i = 0; i <= seq.length - k; i++) {
    const kmer = seq.substring(i, i + k);
    kmers[kmer] = (kmers[kmer] || 0) + 1;
  }

  return kmers;
}

export function findMotifPositions(sequence: string, motif: string): number[] {
  const val = validateSequence(sequence, 'DNA');
  const seq = val.isValid ? val.cleanSequence : '';
  const pat = motif.toUpperCase().replace(/\s+/g, '');
  const positions: number[] = [];

  if (!val.isValid || !pat || seq.length < pat.length) return positions;

  let pos = seq.indexOf(pat);
  while (pos !== -1) {
    positions.push(pos + 1);
    pos = seq.indexOf(pat, pos + 1);
  }

  return positions;
}