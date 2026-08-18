// Multi-FASTA Parser Utility
import { validateSequence, SequenceType, ValidationResult } from './sequenceValidator';

export interface FastaRecord {
  id: string;
  description: string;
  sequence: string;
  length: number;
  validation: ValidationResult;
}

export interface FastaParseResult {
  records: FastaRecord[];
  totalRecords: number;
  hasErrors: boolean;
  globalErrorMessage?: string;
}

/**
 * Parses multi-FASTA format strings into structured records.
 * Disambiguates duplicate record IDs automatically.
 */
export function parseMultiFasta(
  rawInput: string,
  targetType: SequenceType = 'DNA'
): FastaParseResult {
  if (!rawInput || !rawInput.trim()) {
    return {
      records: [],
      totalRecords: 0,
      hasErrors: false,
    };
  }

  const lines = rawInput.split(/\r?\n/);
  const records: FastaRecord[] = [];
  const seenIds = new Map<string, number>();

  let currentHeader = '';
  let currentSeqLines: string[] = [];
  let recordIndex = 1;
  let seenFirstHeader = false;
  let leadingSequenceFound = false;

  const flushRecord = () => {
    if (currentHeader || currentSeqLines.length > 0) {
      const fullSeq = currentSeqLines.join('').replace(/\s+/g, '').toUpperCase();

      let rawId = `Seq_${recordIndex}`;
      let description = '';

      if (currentHeader) {
        const spaceIdx = currentHeader.indexOf(' ');
        if (spaceIdx !== -1) {
          rawId = currentHeader.substring(0, spaceIdx);
          description = currentHeader.substring(spaceIdx + 1).trim();
        } else {
          rawId = currentHeader;
        }
      }

      // Handle duplicate IDs
      let id = rawId;
      const count = seenIds.get(rawId) || 0;
      if (count > 0) {
        id = `${rawId}_${count + 1}`;
      }
      seenIds.set(rawId, count + 1);

      const validation = validateSequence(fullSeq, targetType);

      records.push({
        id,
        description,
        sequence: fullSeq,
        length: fullSeq.length,
        validation,
      });

      recordIndex++;
      currentHeader = '';
      currentSeqLines = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('>')) {
      if (currentSeqLines.length > 0 && !seenFirstHeader) {
        leadingSequenceFound = true;
      }
      flushRecord();
      seenFirstHeader = true;
      currentHeader = trimmed.substring(1).trim();
    } else {
      if (!seenFirstHeader) {
        leadingSequenceFound = true;
      }
      currentSeqLines.push(trimmed);
    }
  }

  flushRecord();

  const hasErrors = leadingSequenceFound || records.some((r) => !r.validation.isValid);
  const globalErrorMessage = leadingSequenceFound
    ? "Malformed FASTA format: Sequence data found before the first header line ('>')."
    : undefined;

  return {
    records,
    totalRecords: records.length,
    hasErrors,
    globalErrorMessage,
  };

}
