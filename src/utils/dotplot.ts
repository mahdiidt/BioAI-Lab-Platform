// ─────────────────────────────────────────────────────────────
// Dot Plot Engine
// Sliding-window comparison of two sequences with configurable
// window size and match threshold. Supports DNA, RNA, Protein.
// ─────────────────────────────────────────────────────────────

export type DotPlotAlphabet = 'DNA' | 'RNA' | 'PROTEIN';

export interface DotPlotPoint {
  x: number; // position in seq1
  y: number; // position in seq2
  score: number; // match ratio within window (0-1)
}

export interface DotPlotRegion {
  type: 'direct_repeat' | 'inverted_repeat' | 'palindrome' | 'diagonal';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  length: number;
}

export interface DotPlotStats {
  totalDots: number;
  density: number;            // fraction of possible dots that are hits
  longestDiagonal: number;    // longest unbroken diagonal (direct match)
  longestAntiDiag: number;    // longest anti-diagonal (inverted match)
  selfComparison: boolean;
}

export interface DotPlotResult {
  isValid: boolean;
  /** Machine-readable reason code; the UI maps this to a translated message. */
  errorCode?: 'too_short' | 'too_long' | 'too_dense';
  dots: DotPlotPoint[];
  regions: DotPlotRegion[];
  stats: DotPlotStats;
  seq1Length: number;
  seq2Length: number;
  seq1Name: string;
  seq2Name: string;
  windowSize: number;
  threshold: number;
}

// ── FASTA parser ──────────────────────────────────────────────
export interface FastaEntry {
  name: string;
  sequence: string;
}

export function parseFasta(text: string): FastaEntry[] {
  const entries: FastaEntry[] = [];
  const lines = text.trim().split('\n');
  let currentName = '';
  let currentSeq = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('>')) {
      if (currentSeq) {
        entries.push({ name: currentName || 'Sequence', sequence: currentSeq.toUpperCase() });
      }
      currentName = trimmed.substring(1).trim() || `Sequence ${entries.length + 1}`;
      currentSeq = '';
    } else {
      currentSeq += trimmed.replace(/\s/g, '');
    }
  }
  if (currentSeq) {
    entries.push({ name: currentName || 'Sequence', sequence: currentSeq.toUpperCase() });
  }

  // If no FASTA headers, treat each non-empty line as a sequence
  if (entries.length === 0) {
    const seqs = text.trim().split('\n')
      .map(l => l.trim().replace(/\s/g, '').toUpperCase())
      .filter(l => l.length > 0 && /^[A-Z]+$/.test(l));
    seqs.forEach((s, i) => entries.push({ name: `Sequence ${i + 1}`, sequence: s }));
  }

  return entries;
}

// ── Reverse complement ────────────────────────────────────────
const RC_MAP: Record<string, string> = {
  A: 'T', T: 'A', C: 'G', G: 'C', U: 'A',
  R: 'Y', Y: 'R', S: 'S', W: 'W', K: 'M', M: 'K',
  B: 'V', V: 'B', D: 'H', H: 'D', N: 'N',
};

function reverseComplement(seq: string): string {
  return seq.split('').reverse().map(c => RC_MAP[c] || c).join('');
}

// Hard cap so a pasted genome cannot freeze the tab (analysis re-runs on
// every parameter change). Benchmarked: cost is ~ (L / step) * L * window.
export const DOTPLOT_MAX_LENGTH = 20000;
// A plot with hundreds of thousands of dots is unreadable noise (threshold too
// low / window too small) and costs seconds plus hundreds of MB. Abort early.
export const DOTPLOT_MAX_DOTS = 400000;

// ── Scoring ───────────────────────────────────────────────────
// Simple identity scoring within a window. Stops as soon as the window can no
// longer reach `threshold` (most random windows fail after a few positions),
// returning 0 in that case.
function windowScore(s1: string, s2: string, i: number, j: number, w: number, threshold: number): number {
  const maxMismatches = Math.floor(w * (1 - threshold) + 1e-9);
  let mismatches = 0;
  for (let k = 0; k < w; k++) {
    if (i + k >= s1.length || j + k >= s2.length) return 0;
    if (s1[i + k] !== s2[j + k]) {
      mismatches++;
      if (mismatches > maxMismatches) return 0;
    }
  }
  return (w - mismatches) / w;
}

// ── Main dot plot computation ─────────────────────────────────
export function computeDotPlot(
  seq1: string,
  seq2: string,
  seq1Name: string,
  seq2Name: string,
  windowSize: number = 11,
  threshold: number = 0.7,
  includeReverse: boolean = true,
  maxResolution: number = 800,
): DotPlotResult {
  const s1 = seq1.toUpperCase().replace(/[^A-Z]/g, '');
  const s2 = seq2.toUpperCase().replace(/[^A-Z]/g, '');

  if (s1.length < 5 || s2.length < 5) {
    return {
      isValid: false,
      errorCode: 'too_short',
      dots: [], regions: [],
      stats: { totalDots: 0, density: 0, longestDiagonal: 0, longestAntiDiag: 0, selfComparison: false },
      seq1Length: s1.length, seq2Length: s2.length,
      seq1Name, seq2Name, windowSize, threshold,
    };
  }

  if (s1.length > DOTPLOT_MAX_LENGTH || s2.length > DOTPLOT_MAX_LENGTH) {
    return {
      isValid: false,
      errorCode: 'too_long',
      dots: [], regions: [],
      stats: { totalDots: 0, density: 0, longestDiagonal: 0, longestAntiDiag: 0, selfComparison: false },
      seq1Length: s1.length, seq2Length: s2.length,
      seq1Name, seq2Name, windowSize, threshold,
    };
  }

  // Downsampling for very long sequences. Only the ROWS (positions in seq 1)
  // are subsampled; every column (position in seq 2) is scanned. Subsampling
  // both axes only visits diagonals whose offset is a multiple of `step`, so a
  // repeat at any other offset produced no dots at all (false negative).
  let step = 1;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen > maxResolution) {
    step = Math.ceil(maxLen / maxResolution);
  }

  const w = Math.max(1, windowSize);
  const dots: DotPlotPoint[] = [];
  const selfComp = s1 === s2;

  const tooDense = (): DotPlotResult => ({
    isValid: false,
    errorCode: 'too_dense',
    dots: [], regions: [],
    stats: { totalDots: 0, density: 0, longestDiagonal: 0, longestAntiDiag: 0, selfComparison: false },
    seq1Length: s1.length, seq2Length: s2.length,
    seq1Name, seq2Name, windowSize, threshold,
  });

  // Forward comparison
  for (let i = 0; i <= s1.length - w; i += step) {
    for (let j = 0; j <= s2.length - w; j++) {
      const score = windowScore(s1, s2, i, j, w, threshold);
      if (score >= threshold) {
        dots.push({ x: i, y: j, score });
        if (dots.length > DOTPLOT_MAX_DOTS) return tooDense();
      }
    }
  }

  // Reverse complement comparison (for nucleotide sequences)
  const revDots: DotPlotPoint[] = [];
  if (includeReverse) {
    const s2rc = reverseComplement(s2);
    for (let i = 0; i <= s1.length - w; i += step) {
      for (let j = 0; j <= s2rc.length - w; j++) {
        const score = windowScore(s1, s2rc, i, j, w, threshold);
        if (score >= threshold) {
          // Map back to original s2 coordinates (inverted)
          revDots.push({ x: i, y: s2.length - 1 - j, score: -score }); // negative = reverse
          if (dots.length + revDots.length > DOTPLOT_MAX_DOTS) return tooDense();
        }
      }
    }
  }

  // Find longest diagonals
  let longestDiag = 0;
  let longestAntiDiag = 0;

  // Simple diagonal tracking
  const diagMap = new Map<number, number>();
  for (const d of dots) {
    const key = d.x - d.y;
    diagMap.set(key, (diagMap.get(key) || 0) + 1);
  }
  for (const count of diagMap.values()) {
    if (count * step > longestDiag) longestDiag = count * step;
  }

  const antiDiagMap = new Map<number, number>();
  for (const d of revDots) {
    const key = d.x + d.y;
    antiDiagMap.set(key, (antiDiagMap.get(key) || 0) + 1);
  }
  for (const count of antiDiagMap.values()) {
    if (count * step > longestAntiDiag) longestAntiDiag = count * step;
  }

  // Detect regions
  const regions: DotPlotRegion[] = [];

  // Main diagonal (self-comparison identity)
  if (selfComp) {
    regions.push({
      type: 'diagonal',
      startX: 0, startY: 0,
      endX: s1.length, endY: s2.length,
      length: s1.length,
    });
  }

  // Off-diagonal repeats (top 3 longest diagonals that aren't the main diagonal)
  const sortedDiags = [...diagMap.entries()]
    .filter(([key]) => selfComp ? key !== 0 : true)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  for (const [key, count] of sortedDiags) {
    if (count * step >= w * 2) {
      const startX = key > 0 ? key : 0;
      const startY = key > 0 ? 0 : -key;
      regions.push({
        type: 'direct_repeat',
        startX, startY,
        endX: startX + count * step,
        endY: startY + count * step,
        length: count * step,
      });
    }
  }

  // Anti-diagonals → inverted repeats
  const sortedAnti = [...antiDiagMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  for (const [key, count] of sortedAnti) {
    if (count * step >= w * 2) {
      regions.push({
        type: 'inverted_repeat',
        startX: 0, startY: key,
        endX: count * step, endY: key - count * step,
        length: count * step,
      });
    }
  }

  const allDots = [...dots, ...revDots];
  const totalPossible = ((s1.length - w + 1) / step) * (s2.length - w + 1);

  return {
    isValid: true,
    dots: allDots,
    regions,
    stats: {
      totalDots: allDots.length,
      density: totalPossible > 0 ? dots.length / totalPossible : 0,
      longestDiagonal: longestDiag,
      longestAntiDiag,
      selfComparison: selfComp,
    },
    seq1Length: s1.length,
    seq2Length: s2.length,
    seq1Name,
    seq2Name,
    windowSize: w,
    threshold,
  };
}
