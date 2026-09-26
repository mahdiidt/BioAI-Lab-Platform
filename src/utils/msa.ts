// Multiple Sequence Alignment (Progressive MSA)
// Uses Needleman-Wunsch pairwise alignment + UPGMA guide tree
// for progressive profile-to-sequence alignment.

import { validateSequence } from './sequenceValidator';

// ---- Types ----
export interface MsaInput {
  name: string;
  seq: string;
}

export interface MsaResult {
  isValid: boolean;
  errorMessage?: string;
  names: string[];
  aligned: string[];
  consensus: string;
  conservation: number[];
  stats: MsaStats;
  type: 'dna' | 'protein';
}

export interface MsaStats {
  numSeqs: number;
  alignLen: number;
  identCols: number;
  identPct: number;
  gapPct: number;
}

// ---- FASTA Parser ----
export function parseFasta(text: string): MsaInput[] {
  const seqs: MsaInput[] = [];
  let name = '';
  let seq = '';
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('>')) {
      if (name) seqs.push({ name, seq: seq.toUpperCase().replace(/\s/g, '') });
      name = trimmed.slice(1).trim();
      seq = '';
    } else {
      seq += trimmed;
    }
  }
  if (name) seqs.push({ name, seq: seq.toUpperCase().replace(/\s/g, '') });
  return seqs;
}

// ---- Detect sequence type ----
export function detectSequenceType(seqs: MsaInput[]): 'dna' | 'protein' {
  const all = seqs.map((s) => s.seq).join('');
  const dnaChars = (all.match(/[ATCGUN]/g) || []).length;
  return dnaChars / all.length > 0.85 ? 'dna' : 'protein';
}

// ---- Needleman-Wunsch pairwise ----
function nwPairwise(
  a: string,
  b: string,
  match: number,
  mismatch: number,
  gap: number
): { a: string; b: string; score: number } {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));

  for (let i = 0; i <= m; i++) dp[i][0] = i * gap;
  for (let j = 0; j <= n; j++) dp[0][j] = j * gap;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const s = a[i - 1] === b[j - 1] ? match : mismatch;
      dp[i][j] = Math.max(
        dp[i - 1][j - 1] + s,
        dp[i - 1][j] + gap,
        dp[i][j - 1] + gap
      );
    }
  }

  let ai = '';
  let bi = '';
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      dp[i][j] === dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? match : mismatch)
    ) {
      ai = a[--i] + ai;
      bi = b[--j] + bi;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + gap) {
      ai = a[--i] + ai;
      bi = '-' + bi;
    } else {
      ai = '-' + ai;
      bi = b[--j] + bi;
    }
  }

  return { a: ai, b: bi, score: dp[m][n] };
}

// ---- Profile alignment ----
function alignProfileToSeq(
  profile: string[],
  seq: string,
  match: number,
  mismatch: number,
  gap: number
): { profile: string[]; seq: string } {
  const pLen = profile[0].length;
  const sLen = seq.length;
  const dp = Array.from({ length: sLen + 1 }, () => new Float64Array(pLen + 1));

  for (let i = 0; i <= sLen; i++) dp[i][0] = i * gap;
  for (let j = 0; j <= pLen; j++) dp[0][j] = j * gap;

  for (let i = 1; i <= sLen; i++) {
    for (let j = 1; j <= pLen; j++) {
      let score = 0;
      for (const p of profile) {
        const pc = p[j - 1];
        if (pc === '-' && seq[i - 1] === '-') score += 0;
        else if (pc === '-' || seq[i - 1] === '-') score += gap;
        else score += pc === seq[i - 1] ? match : mismatch;
      }
      score /= profile.length;
      dp[i][j] = Math.max(dp[i - 1][j - 1] + score, dp[i - 1][j] + gap, dp[i][j - 1] + gap);
    }
  }

  const newProfile = profile.map(() => '');
  let newSeq = '';
  let i = sLen;
  let j = pLen;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      let score = 0;
      for (const p of profile) {
        const pc = p[j - 1];
        if (pc === '-' && seq[i - 1] === '-') score += 0;
        else if (pc === '-' || seq[i - 1] === '-') score += gap;
        else score += pc === seq[i - 1] ? match : mismatch;
      }
      score /= profile.length;
      if (Math.abs(dp[i][j] - (dp[i - 1][j - 1] + score)) < 0.001) {
        for (let k = 0; k < profile.length; k++) newProfile[k] = profile[k][j - 1] + newProfile[k];
        newSeq = seq[i - 1] + newSeq;
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && Math.abs(dp[i][j] - (dp[i - 1][j] + gap)) < 0.001) {
      for (let k = 0; k < profile.length; k++) newProfile[k] = '-' + newProfile[k];
      newSeq = seq[i - 1] + newSeq;
      i--;
    } else {
      for (let k = 0; k < profile.length; k++) newProfile[k] = profile[k][j - 1] + newProfile[k];
      newSeq = '-' + newSeq;
      j--;
    }
  }

  return { profile: newProfile, seq: newSeq };
}

// ---- Progressive MSA with UPGMA guide tree ----
// Pairwise distance + profile alignment are both O(L^2) DP tables, and the
// distance stage runs one per sequence pair (O(n^2)), so total cost scales
// with n^2 * L^2. Benchmarked in Node (a reasonable proxy for a browser JS
// engine): n=20, L=1000 already took ~26-30s of blocked main-thread time;
// the previous limits (50 seqs x 2000 residues) extrapolate to several
// minutes of a frozen tab, which browsers will flag as unresponsive.
// These limits keep the worst case under ~3s (n=20, L=400 benchmarked at
// ~3s; n=25, L=400 at ~6s), appropriate for an in-browser educational tool
// without moving the computation to a Web Worker.
const MAX_SEQS = 20;
const MAX_SEQ_LEN = 400;

export function progressiveMSA(
  sequences: MsaInput[],
  match = 2,
  mismatch = -1,
  gap = -2,
  seqType: 'auto' | 'dna' | 'protein' = 'auto'
): MsaResult {
  if (sequences.length < 2) {
    return {
      isValid: false,
      errorMessage: 'At least 2 sequences in FASTA format are required.',
      names: [],
      aligned: [],
      consensus: '',
      conservation: [],
      stats: { numSeqs: 0, alignLen: 0, identCols: 0, identPct: 0, gapPct: 0 },
      type: 'dna',
    };
  }

  if (sequences.length > MAX_SEQS) {
    return {
      isValid: false,
      errorMessage: `Too many sequences (${sequences.length}). Maximum supported: ${MAX_SEQS} for in-browser alignment.`,
      names: [],
      aligned: [],
      consensus: '',
      conservation: [],
      stats: { numSeqs: 0, alignLen: 0, identCols: 0, identPct: 0, gapPct: 0 },
      type: 'dna',
    };
  }

  const type = seqType === 'auto' ? detectSequenceType(sequences) : seqType;

  // Validate sequences
  for (const s of sequences) {
    if (s.seq.length > MAX_SEQ_LEN) {
      return {
        isValid: false,
        errorMessage: `Sequence "${s.name}" is too long (${s.seq.length} residues). Maximum: ${MAX_SEQ_LEN}.`,
        names: [],
        aligned: [],
        consensus: '',
        conservation: [],
        stats: { numSeqs: 0, alignLen: 0, identCols: 0, identPct: 0, gapPct: 0 },
        type,
      };
    }
    // The shared validator strictly separates DNA (T, no U allowed) from RNA
    // (U, no T allowed) - it does not have a combined "DNA/RNA" target. The
    // 'dna' type here covers both per this tool's UI ("DNA/RNA" option), so
    // each sequence must be sniffed for U vs T and validated against the
    // matching target; validating an RNA sequence as 'DNA' would reject
    // every legitimate U and break RNA input entirely.
    const valType: 'DNA' | 'RNA' | 'PROTEIN' =
      type === 'protein' ? 'PROTEIN' : /U/.test(s.seq) ? 'RNA' : 'DNA';
    const val = validateSequence(s.seq, valType);
    if (!val.isValid) {
      return {
        isValid: false,
        errorMessage: `Invalid sequence "${s.name}": ${val.errorMessage}`,
        names: [],
        aligned: [],
        consensus: '',
        conservation: [],
        stats: { numSeqs: 0, alignLen: 0, identCols: 0, identPct: 0, gapPct: 0 },
        type,
      };
    }
  }

  const n = sequences.length;

  // Step 1: Pairwise distance matrix
  const dist: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const res = nwPairwise(sequences[i].seq, sequences[j].seq, match, mismatch, gap);
      const maxLen = Math.max(sequences[i].seq.length, sequences[j].seq.length);
      let ident = 0;
      for (let k = 0; k < res.a.length; k++) {
        if (res.a[k] === res.b[k] && res.a[k] !== '-') ident++;
      }
      dist[i][j] = dist[j][i] = 1 - ident / maxLen;
    }
  }

  // Step 2: UPGMA guide tree
  const clusters: number[][] = sequences.map((_, i) => [i]);
  const mergeChildren = new Map<number, [number, number]>();
  const clusterDist: number[][] = dist.map((r) => [...r]);
  const active = new Set(Array.from({ length: n }, (_, i) => i));

  while (active.size > 1) {
    let minD = Infinity;
    let mi = -1;
    let mj = -1;
    const arr = [...active];
    for (let a = 0; a < arr.length; a++) {
      for (let b = a + 1; b < arr.length; b++) {
        if (clusterDist[arr[a]][arr[b]] < minD) {
          minD = clusterDist[arr[a]][arr[b]];
          mi = arr[a];
          mj = arr[b];
        }
      }
    }
    const newCluster = [...clusters[mi], ...clusters[mj]];
    clusters.push(newCluster);
    const newIdx = clusters.length - 1;
    mergeChildren.set(newIdx, [mi, mj]);

    for (let k = 0; k < newIdx; k++) {
      if (!clusterDist[k]) clusterDist[k] = [];
      const d =
        ((clusterDist[mi]?.[k] || 0) * clusters[mi].length +
          (clusterDist[mj]?.[k] || 0) * clusters[mj].length) /
        newCluster.length;
      clusterDist[k][newIdx] = d;
      if (!clusterDist[newIdx]) clusterDist[newIdx] = [];
      clusterDist[newIdx][k] = d;
    }
    clusterDist[newIdx][newIdx] = 0;
    active.delete(mi);
    active.delete(mj);
    active.add(newIdx);
  }

  // Step 3: Progressive alignment
  type ProfileEntry = { index: number; seq: string };
  const aligned: Record<number, ProfileEntry[]> = {};

  function getAligned(clusterIdx: number): ProfileEntry[] {
    if (aligned[clusterIdx]) return aligned[clusterIdx];
    const cluster = clusters[clusterIdx];
    if (cluster.length === 1) {
      aligned[clusterIdx] = [{ index: cluster[0], seq: sequences[cluster[0]].seq }];
      return aligned[clusterIdx];
    }

    const children = mergeChildren.get(clusterIdx);
    if (!children) {
      return [];
    }

    const left = getAligned(children[0]);
    const right = getAligned(children[1]);
    let profile = left.map((entry) => entry.seq);
    let entries = [...left];

    for (const entry of right) {
      const res = alignProfileToSeq(profile, entry.seq, match, mismatch, gap);
      profile = [...res.profile, res.seq];
      entries = [
        ...entries.map((item, idx) => ({ ...item, seq: res.profile[idx] })),
        { index: entry.index, seq: res.seq },
      ];
    }

    aligned[clusterIdx] = entries;
    return entries;
  }

  const rootIdx = clusters.length - 1;
  const profileEntries = getAligned(rootIdx);
  const alignedSeqs = profileEntries
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.seq);
  const names = sequences.map((s) => s.name);

  // Conservation
  const conservation = calcConservation(alignedSeqs);
  const consensus = calcConsensus(alignedSeqs);
  const stats = calcStats(alignedSeqs);

  return {
    isValid: true,
    names,
    aligned: alignedSeqs,
    consensus,
    conservation,
    stats: { ...stats, numSeqs: n },
    type,
  };
}

// ---- Conservation ----
function calcConservation(alignedSeqs: string[]): number[] {
  if (!alignedSeqs.length) return [];
  const len = alignedSeqs[0].length;
  const cons: number[] = [];
  for (let j = 0; j < len; j++) {
    const col = alignedSeqs.map((s) => s[j]);
    const nonGap = col.filter((c) => c !== '-');
    if (nonGap.length === 0) {
      cons.push(0);
      continue;
    }
    const freq: Record<string, number> = {};
    nonGap.forEach((c) => (freq[c] = (freq[c] || 0) + 1));
    const maxFreq = Math.max(...Object.values(freq));
    cons.push(maxFreq / alignedSeqs.length);
  }
  return cons;
}

function calcConsensus(alignedSeqs: string[]): string {
  if (!alignedSeqs.length) return '';
  const len = alignedSeqs[0].length;
  let consensus = '';
  for (let j = 0; j < len; j++) {
    const freq: Record<string, number> = {};
    alignedSeqs.forEach((s) => {
      const c = s[j];
      if (c !== '-') freq[c] = (freq[c] || 0) + 1;
    });
    const entries = Object.entries(freq);
    if (entries.length === 0) {
      consensus += '-';
      continue;
    }
    entries.sort((a, b) => b[1] - a[1]);
    const top = entries[0];
    if (top[1] === alignedSeqs.length) consensus += top[0];
    else if (top[1] / alignedSeqs.length >= 0.5) consensus += top[0].toLowerCase();
    else consensus += '.';
  }
  return consensus;
}

function calcStats(aligned: string[]): Omit<MsaStats, 'numSeqs'> {
  const len = aligned[0]?.length || 0;
  let identCols = 0;
  let totalGaps = 0;
  let totalCells = 0;

  for (let j = 0; j < len; j++) {
    const col = aligned.map((s) => s[j]);
    const nonGap = col.filter((c) => c !== '-');
    totalGaps += col.length - nonGap.length;
    totalCells += col.length;
    if (nonGap.length > 0) {
      const freq: Record<string, number> = {};
      nonGap.forEach((c) => (freq[c] = (freq[c] || 0) + 1));
      if (Math.max(...Object.values(freq)) === nonGap.length) identCols++;
    }
  }

  return {
    alignLen: len,
    identCols,
    identPct: len > 0 ? Number(((identCols / len) * 100).toFixed(1)) : 0,
    gapPct: totalCells > 0 ? Number(((totalGaps / totalCells) * 100).toFixed(1)) : 0,
  };
}
