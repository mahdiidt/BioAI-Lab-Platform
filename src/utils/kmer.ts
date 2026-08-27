// k-Mer Analysis Utility
import { validateSequence, SequenceType } from './sequenceValidator';

export interface KmerFrequency {
  kmer: string;
  count: number;
  frequency: number; // percentage (0 - 100)
}

export interface KmerAnalysisResult {
  k: number;
  totalKmers: number;
  uniqueKmers: number;
  frequencies: KmerFrequency[];
  isValid: boolean;
  errorMessage?: string;
  sequenceType: SequenceType;
  sequenceLength: number;
}

export function analyzeKmers(
  sequenceInput: string,
  k: number,
  sequenceType: SequenceType = 'DNA'
): KmerAnalysisResult {
  const validation = validateSequence(sequenceInput, sequenceType);

  if (!validation.isValid) {
    return {
      k,
      totalKmers: 0,
      uniqueKmers: 0,
      frequencies: [],
      isValid: false,
      errorMessage: validation.errorMessage,
      sequenceType,
      sequenceLength: validation.cleanSequence.length,
    };
  }

  const seq = validation.cleanSequence;

  const MAX_SEQ_LEN = 500_000;
  if (seq.length > MAX_SEQ_LEN) {
    return {
      k,
      totalKmers: 0,
      uniqueKmers: 0,
      frequencies: [],
      isValid: false,
      errorMessage: `Sequence length (${seq.length.toLocaleString()} bp) exceeds maximum supported limit of ${MAX_SEQ_LEN.toLocaleString()} bp for in-browser k-mer analysis.`,
      sequenceType,
      sequenceLength: seq.length,
    };
  }

  if (k < 1) {
    return {
      k,
      totalKmers: 0,
      uniqueKmers: 0,
      frequencies: [],
      isValid: false,
      errorMessage: 'k must be at least 1.',
      sequenceType,
      sequenceLength: seq.length,
    };
  }

  if (k > 30) {
    return {
      k,
      totalKmers: 0,
      uniqueKmers: 0,
      frequencies: [],
      isValid: false,
      errorMessage: 'k value exceeds maximum limit of 30 to prevent memory overhead.',
      sequenceType,
      sequenceLength: seq.length,
    };
  }

  if (seq.length < k) {
    return {
      k,
      totalKmers: 0,
      uniqueKmers: 0,
      frequencies: [],
      isValid: false,
      errorMessage: `Sequence length (${seq.length} bp) is shorter than k (${k}).`,
      sequenceType,
      sequenceLength: seq.length,
    };
  }

  const counts: Record<string, number> = {};
  const totalKmers = seq.length - k + 1;

  for (let i = 0; i <= seq.length - k; i++) {
    const kmer = seq.substring(i, i + k);
    counts[kmer] = (counts[kmer] || 0) + 1;
  }

  const frequencies: KmerFrequency[] = Object.entries(counts)
    .map(([kmer, count]) => ({
      kmer,
      count,
      frequency: Number(((count / totalKmers) * 100).toFixed(2)),
    }))
    .sort((a, b) => b.count - a.count);

  return {
    k,
    totalKmers,
    uniqueKmers: frequencies.length,
    frequencies,
    isValid: true,
    sequenceType,
    sequenceLength: seq.length,
  };
}
