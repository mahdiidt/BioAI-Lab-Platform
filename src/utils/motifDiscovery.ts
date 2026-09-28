// ─────────────────────────────────────────────────────────────
// Motif Discovery & Position Weight Matrix (PWM) Engine
// Covers: PWM construction, Information Content, Consensus,
//         simple motif enumeration, JASPAR/MEME export
// ─────────────────────────────────────────────────────────────

export type SeqAlphabet = 'DNA' | 'RNA' | 'PROTEIN';

export interface PWMPosition {
  counts: Record<string, number>;
  frequency: Record<string, number>;
  informationContent: number; // bits
  maxChar: string;
  entropy: number;
}

export interface MotifResult {
  isValid: boolean;
  errorMessage?: string;
  pwm: PWMPosition[];
  consensus: string;
  totalIC: number;
  sequenceCount: number;
  motifLength: number;
  eValue?: number;
  alphabet: SeqAlphabet;
  jasparMatrix: string;
  memeMotif: string;
  transfacMatrix: string;
}

export interface DiscoveredMotif {
  pattern: string;
  score: number;
  positions: { seqIndex: number; start: number }[];
  pwm: PWMPosition[];
  consensus: string;
  totalIC: number;
}

export interface MotifDiscoveryResult {
  isValid: boolean;
  errorMessage?: string;
  motifs: DiscoveredMotif[];
  sequenceCount: number;
  alphabet: SeqAlphabet;
}

// ── Alphabet helpers ──────────────────────────────────────────
const DNA_BASES = ['A', 'C', 'G', 'T'] as const;
const RNA_BASES = ['A', 'C', 'G', 'U'] as const;
const AA_LETTERS = [
  'A','R','N','D','C','E','Q','G','H','I',
  'L','K','M','F','P','S','T','W','Y','V',
] as const;

function getAlphabetChars(alphabet: SeqAlphabet): readonly string[] {
  switch (alphabet) {
    case 'DNA': return DNA_BASES;
    case 'RNA': return RNA_BASES;
    case 'PROTEIN': return AA_LETTERS;
  }
}

function detectAlphabet(sequences: string[]): SeqAlphabet {
  const combined = sequences.join('').toUpperCase();
  if (/[DEFHIKLMNPQRSVWY]/.test(combined)) return 'PROTEIN';
  if (/U/.test(combined) && !/T/.test(combined)) return 'RNA';
  return 'DNA';
}

// ── PWM Construction ──────────────────────────────────────────
function log2(x: number): number {
  return x <= 0 ? 0 : Math.log2(x);
}

export function buildPWM(
  alignedSequences: string[],
  alphabet: SeqAlphabet,
  pseudocount: number = 0.01,
): PWMPosition[] {
  if (alignedSequences.length === 0) return [];
  const chars = getAlphabetChars(alphabet);
  const width = alignedSequences[0].length;
  const n = alignedSequences.length;
  const maxEntropy = log2(chars.length); // 2 bits for DNA, ~4.32 for protein

  const pwm: PWMPosition[] = [];

  for (let pos = 0; pos < width; pos++) {
    const counts: Record<string, number> = {};
    const frequency: Record<string, number> = {};

    for (const c of chars) counts[c] = pseudocount;

    for (const seq of alignedSequences) {
      const ch = seq[pos]?.toUpperCase();
      if (ch && ch in counts) {
        counts[ch] += 1;
      }
    }

    const totalWithPseudo = n + pseudocount * chars.length;
    let entropy = 0;
    let maxChar = chars[0];
    let maxFreq = 0;

    for (const c of chars) {
      const f = counts[c] / totalWithPseudo;
      frequency[c] = f;
      if (f > 0) entropy -= f * log2(f);
      if (f > maxFreq) { maxFreq = f; maxChar = c; }
    }

    const ic = maxEntropy - entropy;

    pwm.push({
      counts,
      frequency,
      informationContent: Math.max(0, ic),
      maxChar,
      entropy,
    });
  }

  return pwm;
}

export function getConsensus(pwm: PWMPosition[]): string {
  return pwm.map((p) => p.maxChar).join('');
}

export function getTotalIC(pwm: PWMPosition[]): number {
  return pwm.reduce((sum, p) => sum + p.informationContent, 0);
}

// ── Motif Discovery (enumeration-based) ───────────────────────
// Simple but effective: enumerate all k-mers, cluster by Hamming
// distance, score by information content of the aligned instances.
function hammingDistance(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) d++;
  }
  return d;
}

export function discoverMotifs(
  sequences: string[],
  motifWidth: number,
  maxMismatches: number = 1,
  topN: number = 5,
  alphabet?: SeqAlphabet,
): MotifDiscoveryResult {
  const clean = sequences
    .map((s) => s.toUpperCase().replace(/[^A-Z]/g, ''))
    .filter((s) => s.length >= motifWidth);

  if (clean.length < 2) {
    return { isValid: false, errorMessage: 'Need at least 2 sequences.', motifs: [], sequenceCount: 0, alphabet: alphabet || 'DNA' };
  }

  // Enumeration scores every candidate k-mer against every position of every
  // sequence, so cost scales roughly with (sequenceCount * avgLength)^2.
  // Benchmarked in Node: 40 sequences x 400 residues already took ~16s of
  // blocked main-thread time, and 20 x 500 took ~9s - both well into
  // "browser tab looks frozen" territory for a client-side tool with no
  // Web Worker. These caps keep the worst case in the low single digits of
  // seconds.
  const MAX_SEQUENCES = 20;
  const MAX_SEQ_LENGTH = 300;
  if (clean.length > MAX_SEQUENCES) {
    return {
      isValid: false,
      errorMessage: `Too many sequences (${clean.length}). Motif discovery mode supports up to ${MAX_SEQUENCES} sequences in the browser.`,
      motifs: [], sequenceCount: 0, alphabet: alphabet || 'DNA',
    };
  }
  const tooLong = clean.find((s) => s.length > MAX_SEQ_LENGTH);
  if (tooLong) {
    return {
      isValid: false,
      errorMessage: `A sequence is too long (${tooLong.length} chars). Motif discovery mode supports sequences up to ${MAX_SEQ_LENGTH} characters in the browser.`,
      motifs: [], sequenceCount: 0, alphabet: alphabet || 'DNA',
    };
  }

  const alpha = alphabet || detectAlphabet(clean);

  // Collect all k-mers from all sequences
  const kmerMap = new Map<string, { seqIndex: number; start: number }[]>();

  for (let si = 0; si < clean.length; si++) {
    const seq = clean[si];
    for (let i = 0; i <= seq.length - motifWidth; i++) {
      const kmer = seq.substring(i, i + motifWidth);
      if (!kmerMap.has(kmer)) kmerMap.set(kmer, []);
      kmerMap.get(kmer)!.push({ seqIndex: si, start: i });
    }
  }

  // Score each unique k-mer as a potential motif center
  const scored: { pattern: string; instances: string[]; positions: { seqIndex: number; start: number }[]; uniqueSeqs: number }[] = [];

  for (const [pattern] of kmerMap) {
    const instances: string[] = [];
    const positions: { seqIndex: number; start: number }[] = [];
    const seqSet = new Set<number>();

    for (let si = 0; si < clean.length; si++) {
      const seq = clean[si];
      let bestDist = Infinity;
      let bestStart = 0;
      let bestKmer = '';

      for (let i = 0; i <= seq.length - motifWidth; i++) {
        const kmer = seq.substring(i, i + motifWidth);
        const d = hammingDistance(pattern, kmer);
        if (d < bestDist) {
          bestDist = d;
          bestStart = i;
          bestKmer = kmer;
        }
      }

      if (bestDist <= maxMismatches) {
        instances.push(bestKmer);
        positions.push({ seqIndex: si, start: bestStart });
        seqSet.add(si);
      }
    }

    if (seqSet.size >= Math.ceil(clean.length * 0.5)) {
      scored.push({ pattern, instances, positions, uniqueSeqs: seqSet.size });
    }
  }

  // Rank by coverage * IC
  const rankedMotifs: DiscoveredMotif[] = scored
    .map((s) => {
      const pwm = buildPWM(s.instances, alpha);
      const consensus = getConsensus(pwm);
      const totalIC = getTotalIC(pwm);
      return {
        pattern: s.pattern,
        score: totalIC * (s.uniqueSeqs / clean.length),
        positions: s.positions,
        pwm,
        consensus,
        totalIC,
      };
    })
    .sort((a, b) => b.score - a.score);

  // Deduplicate overlapping motifs
  const result: DiscoveredMotif[] = [];
  const usedPatterns = new Set<string>();

  for (const m of rankedMotifs) {
    if (result.length >= topN) break;
    // Skip if consensus is too similar to an already-selected motif
    let dominated = false;
    for (const sel of result) {
      if (hammingDistance(m.consensus, sel.consensus) <= 1) {
        dominated = true;
        break;
      }
    }
    if (!dominated && !usedPatterns.has(m.consensus)) {
      usedPatterns.add(m.consensus);
      result.push(m);
    }
  }

  return {
    isValid: true,
    motifs: result,
    sequenceCount: clean.length,
    alphabet: alpha,
  };
}

// ── PWM from user-aligned sequences ──────────────────────────
export function analyzeAlignedMotif(
  alignedSequences: string[],
  alphabet?: SeqAlphabet,
): MotifResult {
  const clean = alignedSequences
    .map((s) => s.toUpperCase().replace(/[^A-Z-]/g, ''))
    .filter((s) => s.length > 0);

  if (clean.length < 2) {
    return {
      isValid: false,
      errorMessage: 'Need at least 2 aligned sequences.',
      pwm: [], consensus: '', totalIC: 0, sequenceCount: 0, motifLength: 0,
      alphabet: alphabet || 'DNA', jasparMatrix: '', memeMotif: '', transfacMatrix: '',
    };
  }

  const maxLen = Math.max(...clean.map((s) => s.length));
  const padded = clean.map((s) => s.padEnd(maxLen, '-'));
  // Remove gap-only columns
  const columns: number[] = [];
  for (let i = 0; i < maxLen; i++) {
    const gapCount = padded.filter((s) => s[i] === '-').length;
    if (gapCount < padded.length * 0.8) columns.push(i);
  }
  const trimmed = padded.map((s) => columns.map((c) => s[c] === '-' ? 'N' : s[c]).join(''));

  const alpha = alphabet || detectAlphabet(trimmed);
  const pwm = buildPWM(trimmed, alpha);
  const consensus = getConsensus(pwm);
  const totalIC = getTotalIC(pwm);

  return {
    isValid: true,
    pwm,
    consensus,
    totalIC,
    sequenceCount: clean.length,
    motifLength: pwm.length,
    alphabet: alpha,
    jasparMatrix: exportJASPAR(pwm, consensus, alpha),
    memeMotif: exportMEME(pwm, consensus, clean.length, alpha),
    transfacMatrix: exportTRANSFAC(pwm, consensus, alpha),
  };
}

// ── Export formats ─────────────────────────────────────────────
function exportJASPAR(pwm: PWMPosition[], id: string, alpha: SeqAlphabet): string {
  const chars = getAlphabetChars(alpha);
  const lines: string[] = [`>${id}`];
  for (const c of chars) {
    const vals = pwm.map((p) => (p.counts[c] || 0).toFixed(0).padStart(6));
    lines.push(`${c} [${vals.join(' ')}]`);
  }
  return lines.join('\n');
}

function exportMEME(pwm: PWMPosition[], id: string, nsites: number, alpha: SeqAlphabet): string {
  const chars = getAlphabetChars(alpha);
  const lines: string[] = [
    'MEME version 5',
    '',
    `ALPHABET= ${chars.join('')}`,
    '',
    `MOTIF ${id}`,
    `letter-probability matrix: alength= ${chars.length} w= ${pwm.length} nsites= ${nsites}`,
  ];
  for (const pos of pwm) {
    const vals = chars.map((c) => (pos.frequency[c] || 0).toFixed(6).padStart(10));
    lines.push(vals.join(' '));
  }
  return lines.join('\n');
}

function exportTRANSFAC(pwm: PWMPosition[], id: string, alpha: SeqAlphabet): string {
  const chars = getAlphabetChars(alpha);
  const lines: string[] = [
    `ID ${id}`,
    'BF unknown',
    `P0\t${chars.join('\t')}`,
  ];
  pwm.forEach((pos, i) => {
    const vals = chars.map((c) => (pos.counts[c] || 0).toFixed(0));
    lines.push(`${String(i + 1).padStart(2, '0')}\t${vals.join('\t')}`);
  });
  lines.push('XX', '//');
  return lines.join('\n');
}
