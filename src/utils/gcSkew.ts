// ─────────────────────────────────────────────────────────────
// GC Content & GC Skew Sliding Window Engine
// Calculates GC%, AT%, GC skew ((G-C)/(G+C)), AT skew,
// cumulative GC skew, and detects replication origin/terminus.
// ─────────────────────────────────────────────────────────────

export interface WindowDataPoint {
  position: number;        // center of window
  gcContent: number;       // GC% (0-1)
  atContent: number;       // AT% (0-1)
  gcSkew: number;          // (G-C)/(G+C)
  atSkew: number;          // (A-T)/(A+T)
  cumulativeGcSkew: number;
}

export interface SkewLandmark {
  type: 'ori' | 'ter' | 'gc_island' | 'at_rich';
  position: number;
  value: number;
  /** Present only for gc_island / at_rich: the region's start/end position, for building a translated label. */
  rangeStart?: number;
  rangeEnd?: number;
}

export interface GcSkewStats {
  seqLength: number;
  overallGC: number;
  overallAT: number;
  meanGcSkew: number;
  stdGcSkew: number;
  minGC: { position: number; value: number };
  maxGC: { position: number; value: number };
  minSkew: { position: number; value: number };
  maxSkew: { position: number; value: number };
}

export interface GcSkewResult {
  isValid: boolean;
  /** Machine-readable reason code; the UI maps this to a translated message. */
  errorCode?: 'too_short';
  dataPoints: WindowDataPoint[];
  stats: GcSkewStats;
  landmarks: SkewLandmark[];
  seqName: string;
  windowSize: number;
  stepSize: number;
}

// ── FASTA parser (reusable) ───────────────────────────────────
export interface FastaEntry {
  name: string;
  sequence: string;
}

export function parseFastaGC(text: string): FastaEntry[] {
  const entries: FastaEntry[] = [];
  const lines = text.trim().split('\n');
  let currentName = '';
  let currentSeq = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('>')) {
      if (currentSeq) entries.push({ name: currentName || 'Sequence', sequence: currentSeq.toUpperCase() });
      currentName = trimmed.substring(1).trim() || `Sequence ${entries.length + 1}`;
      currentSeq = '';
    } else {
      currentSeq += trimmed.replace(/\s/g, '');
    }
  }
  if (currentSeq) entries.push({ name: currentName || 'Sequence', sequence: currentSeq.toUpperCase() });

  if (entries.length === 0) {
    const raw = text.trim().replace(/\s/g, '').toUpperCase();
    if (raw.length > 0 && /^[ATCGRYSWKMBDHVNU]+$/i.test(raw)) {
      entries.push({ name: 'Sequence', sequence: raw });
    }
  }

  return entries;
}

// ── Main analysis ─────────────────────────────────────────────
export function analyzeGcSkew(
  sequence: string,
  seqName: string,
  windowSize: number = 500,
  stepSize: number = 100,
): GcSkewResult {
  const seq = sequence.toUpperCase().replace(/[^ATCGU]/g, '');

  if (seq.length < 50) {
    return {
      isValid: false,
      errorCode: 'too_short',
      dataPoints: [], stats: {} as GcSkewStats, landmarks: [],
      seqName, windowSize, stepSize,
    };
  }

  const w = Math.min(windowSize, seq.length);
  // Cost is O(windows * w) and the chart needs one point per window, so a
  // small step on a multi-megabase genome (e.g. step 1 on 5 Mb) meant billions
  // of operations and millions of points - benchmarked at ~9s for 1 Mb with
  // step 1, and far worse at genome scale. Raise the effective step so there
  // are never more than MAX_WINDOWS windows; the step actually used is
  // reported back in `stepSize`.
  const MAX_WINDOWS = 20000;
  const minStepForCap = Math.ceil((seq.length - w + 1) / MAX_WINDOWS);
  const s = Math.max(1, stepSize, minStepForCap);

  const dataPoints: WindowDataPoint[] = [];
  let cumulativeSkew = 0;

  // Overall composition
  let totalG = 0, totalC = 0, totalA = 0, totalT = 0;
  for (const ch of seq) {
    if (ch === 'G') totalG++;
    else if (ch === 'C') totalC++;
    else if (ch === 'A') totalA++;
    else if (ch === 'T' || ch === 'U') totalT++;
  }

  let minGC = { position: 0, value: 1 };
  let maxGC = { position: 0, value: 0 };
  let minSkew = { position: 0, value: Infinity };
  let maxSkew = { position: 0, value: -Infinity };

  for (let i = 0; i <= seq.length - w; i += s) {
    let g = 0, c = 0, a = 0, t = 0;
    for (let j = i; j < i + w; j++) {
      const ch = seq[j];
      if (ch === 'G') g++;
      else if (ch === 'C') c++;
      else if (ch === 'A') a++;
      else if (ch === 'T' || ch === 'U') t++;
    }

    const gc = w > 0 ? (g + c) / w : 0;
    const at = w > 0 ? (a + t) / w : 0;
    const gcSkew = (g + c) > 0 ? (g - c) / (g + c) : 0;
    const atSkew = (a + t) > 0 ? (a - t) / (a + t) : 0;
    cumulativeSkew += gcSkew;

    const pos = i + Math.floor(w / 2);

    dataPoints.push({
      position: pos,
      gcContent: gc,
      atContent: at,
      gcSkew,
      atSkew,
      cumulativeGcSkew: cumulativeSkew,
    });

    if (gc < minGC.value) minGC = { position: pos, value: gc };
    if (gc > maxGC.value) maxGC = { position: pos, value: gc };
    if (gcSkew < minSkew.value) minSkew = { position: pos, value: gcSkew };
    if (gcSkew > maxSkew.value) maxSkew = { position: pos, value: gcSkew };
  }

  // Statistics
  const n = dataPoints.length;
  const meanSkew = n > 0 ? dataPoints.reduce((s, p) => s + p.gcSkew, 0) / n : 0;
  const variance = n > 1 ? dataPoints.reduce((s, p) => s + (p.gcSkew - meanSkew) ** 2, 0) / (n - 1) : 0;

  const overallGC = (totalG + totalC) / seq.length;
  const overallAT = (totalA + totalT) / seq.length;

  // Detect landmarks
  const landmarks: SkewLandmark[] = [];

  // Find cumulative skew minimum (likely replication origin)
  // and maximum (likely terminus)
  if (dataPoints.length > 10) {
    let minCum = { idx: 0, val: Infinity };
    let maxCum = { idx: 0, val: -Infinity };
    for (let i = 0; i < dataPoints.length; i++) {
      if (dataPoints[i].cumulativeGcSkew < minCum.val) {
        minCum = { idx: i, val: dataPoints[i].cumulativeGcSkew };
      }
      if (dataPoints[i].cumulativeGcSkew > maxCum.val) {
        maxCum = { idx: i, val: dataPoints[i].cumulativeGcSkew };
      }
    }

    landmarks.push({
      type: 'ori',
      position: dataPoints[minCum.idx].position,
      value: minCum.val,
    });

    landmarks.push({
      type: 'ter',
      position: dataPoints[maxCum.idx].position,
      value: maxCum.val,
    });

    // GC islands (regions where GC > mean + 2*std)
    const gcMean = overallGC;
    const gcValues = dataPoints.map(p => p.gcContent);
    const gcStd = Math.sqrt(gcValues.reduce((s, v) => s + (v - gcMean) ** 2, 0) / n);
    const gcIslandThreshold = gcMean + 2 * gcStd;

    let islandStart = -1;
    for (let i = 0; i < dataPoints.length; i++) {
      if (dataPoints[i].gcContent > gcIslandThreshold) {
        if (islandStart < 0) islandStart = i;
      } else {
        if (islandStart >= 0 && i - islandStart >= 3) {
          const mid = Math.floor((islandStart + i) / 2);
          landmarks.push({
            type: 'gc_island',
            position: dataPoints[mid].position,
            value: dataPoints[mid].gcContent,
            rangeStart: dataPoints[islandStart].position,
            rangeEnd: dataPoints[i - 1].position,
          });
        }
        islandStart = -1;
      }
    }

    // AT-rich regions
    const atIslandThreshold = (1 - gcMean) + 2 * gcStd;
    let atStart = -1;
    for (let i = 0; i < dataPoints.length; i++) {
      if (dataPoints[i].atContent > atIslandThreshold) {
        if (atStart < 0) atStart = i;
      } else {
        if (atStart >= 0 && i - atStart >= 3) {
          const mid = Math.floor((atStart + i) / 2);
          landmarks.push({
            type: 'at_rich',
            position: dataPoints[mid].position,
            value: dataPoints[mid].atContent,
            rangeStart: dataPoints[atStart].position,
            rangeEnd: dataPoints[i - 1].position,
          });
        }
        atStart = -1;
      }
    }
  }

  return {
    isValid: true,
    dataPoints,
    stats: {
      seqLength: seq.length,
      overallGC,
      overallAT,
      meanGcSkew: meanSkew,
      stdGcSkew: Math.sqrt(variance),
      minGC,
      maxGC,
      minSkew,
      maxSkew,
    },
    landmarks,
    seqName,
    windowSize: w,
    stepSize: s,
  };
}
