// Central sequence parsing and validation utilities.
export type SequenceType = 'DNA' | 'RNA' | 'PROTEIN';

export interface ValidationResult {
  isValid: boolean;
  cleanSequence: string;
  sequenceType: SequenceType;
  invalidChars: string[];
  errorMessage?: string;
  hasAmbiguityChars: boolean;
  ambiguityCharsFound: string[];
  headers: string[];
  recordCount: number;
  isFasta: boolean;
}

export interface NormalizedSequenceInput {
  headers: string[];
  sequence: string;
  recordCount: number;
  isFasta: boolean;
  hasLeadingSequence: boolean;
}

const CANONICAL_DNA = new Set(['A', 'C', 'G', 'T']);
const CANONICAL_RNA = new Set(['A', 'C', 'G', 'U']);
const AMBIGUITY_NUCLEOTIDES = new Set(['N', 'R', 'Y', 'S', 'W', 'K', 'M', 'B', 'D', 'H', 'V']);

const STANDARD_AMINO_ACIDS = new Set([
  'A', 'R', 'N', 'D', 'C', 'E', 'Q', 'G', 'H', 'I',
  'L', 'K', 'M', 'F', 'P', 'S', 'T', 'W', 'Y', 'V', '*',
]);

function normalizeSequenceLine(line: string): string {
  return line.replace(/\s+/g, '').toUpperCase();
}

/**
 * Parses plain sequence input or FASTA input without silently merging
 * separate FASTA records into one biological sequence.
 */
export function normalizeSequenceInput(rawInput: string): NormalizedSequenceInput {
  if (!rawInput) {
    return { headers: [], sequence: '', recordCount: 0, isFasta: false, hasLeadingSequence: false };
  }

  const lines = rawInput.replace(/^\uFEFF/, '').split(/\r?\n/);
  const headers: string[] = [];
  const sequenceParts: string[] = [];
  let isFasta = false;
  let hasLeadingSequence = false;
  let seenHeader = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('>')) {
      isFasta = true;
      headers.push(line.slice(1).trim());
      seenHeader = true;
      continue;
    }

    if (!seenHeader && isFasta === false && headers.length === 0) {
      // Plain sequence is allowed. If a FASTA header appears later, this is
      // detected as malformed leading sequence below.
      sequenceParts.push(normalizeSequenceLine(line));
    } else if (seenHeader) {
      sequenceParts.push(normalizeSequenceLine(line));
    } else {
      sequenceParts.push(normalizeSequenceLine(line));
    }
  }

  // Re-parse when a FASTA header exists so record boundaries are preserved.
  if (headers.length > 0) {
    const records: string[] = [];
    let current: string[] = [];
    let headerSeen = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('>')) {
        if (headerSeen) records.push(current.join(''));
        headerSeen = true;
        current = [];
      } else if (headerSeen) {
        current.push(normalizeSequenceLine(line));
      } else {
        hasLeadingSequence = true;
      }
    }
    if (headerSeen) records.push(current.join(''));

    return {
      headers,
      sequence: records.join(''),
      recordCount: records.length,
      isFasta: true,
      hasLeadingSequence,
    };
  }

  const sequence = sequenceParts.join('');
  return {
    headers: [],
    sequence,
    recordCount: sequence ? 1 : 0,
    isFasta: false,
    hasLeadingSequence: false,
  };
}

/**
 * Validates a nucleotide or protein sequence based on target type.
 * Multi-FASTA input is rejected here rather than silently concatenated.
 */
export function validateSequence(
  input: string,
  targetType: SequenceType = 'DNA',
  allowAmbiguity = true
): ValidationResult {
  const normalized = normalizeSequenceInput(input);
  const baseResult = {
    cleanSequence: normalized.sequence,
    sequenceType: targetType,
    headers: normalized.headers,
    recordCount: normalized.recordCount,
    isFasta: normalized.isFasta,
  };

  if (!normalized.sequence) {
    return {
      isValid: false,
      ...baseResult,
      invalidChars: [],
      errorMessage: 'Sequence is empty. Please enter or paste a valid sequence.',
      hasAmbiguityChars: false,
      ambiguityCharsFound: [],
    };
  }

  if (normalized.isFasta && normalized.hasLeadingSequence) {
    return {
      isValid: false,
      ...baseResult,
      invalidChars: [],
      errorMessage: "Malformed FASTA: sequence data was found before the first '>' header.",
      hasAmbiguityChars: false,
      ambiguityCharsFound: [],
    };
  }

  if (normalized.isFasta && normalized.recordCount > 1) {
    return {
      isValid: false,
      ...baseResult,
      // Deliberately never expose the joined multi-record string as
      // `cleanSequence`. Single-sequence tools must not be able to read a
      // silently-merged sequence out of this field even if a future
      // caller forgets to check `isValid` first.
      cleanSequence: '',
      invalidChars: [],
      errorMessage: `Multiple FASTA records were provided (${normalized.recordCount}). This tool accepts one sequence at a time.`,
      hasAmbiguityChars: false,
      ambiguityCharsFound: [],
    };
  }

  const invalidSet = new Set<string>();
  const ambiguitySet = new Set<string>();

  if (targetType === 'DNA') {
    for (const char of normalized.sequence) {
      if (CANONICAL_DNA.has(char)) continue;
      if (char === 'U') {
        invalidSet.add(char);
        continue;
      }
      if (AMBIGUITY_NUCLEOTIDES.has(char)) {
        ambiguitySet.add(char);
        if (!allowAmbiguity) invalidSet.add(char);
      } else {
        invalidSet.add(char);
      }
    }
  } else if (targetType === 'RNA') {
    for (const char of normalized.sequence) {
      if (CANONICAL_RNA.has(char)) continue;
      if (char === 'T') {
        invalidSet.add(char);
        continue;
      }
      if (AMBIGUITY_NUCLEOTIDES.has(char)) {
        ambiguitySet.add(char);
        if (!allowAmbiguity) invalidSet.add(char);
      } else {
        invalidSet.add(char);
      }
    }
  } else {
    for (const char of normalized.sequence) {
      if (!STANDARD_AMINO_ACIDS.has(char)) invalidSet.add(char);
    }
  }

  const invalidChars = Array.from(invalidSet);
  const ambiguityCharsFound = Array.from(ambiguitySet);

  return {
    isValid: invalidChars.length === 0,
    ...baseResult,
    invalidChars,
    errorMessage:
      invalidChars.length > 0
        ? `Sequence contains invalid character(s) for ${targetType}: ${invalidChars.join(', ')}`
        : undefined,
    hasAmbiguityChars: ambiguityCharsFound.length > 0,
    ambiguityCharsFound,
  };
}