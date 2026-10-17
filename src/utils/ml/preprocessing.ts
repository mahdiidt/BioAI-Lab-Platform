// Leakage-safe preprocessing. Every statistic (medians, means, SDs, feature
// ranking) is FITTED ON TRAINING ROWS ONLY and then APPLIED to other rows.

export interface PreprocessConfig {
  /** Apply log2(x + 1). Only valid when every value is >= 0 (e.g. counts/TPM). */
  log2Transform: boolean;
  /** Drop features whose missing fraction in the TRAINING set exceeds this. */
  maxMissingFraction: number;
  /** Rank features by |Welch t| on training data and keep the top K (0 = keep all). */
  topK: number;
}

export interface FittedPreprocessor {
  log2Transform: boolean;
  /** Indices into the original feature list, in model column order. */
  selected: number[];
  medians: Float64Array; // indexed by original feature index
  means: Float64Array; // indexed by original feature index
  sds: Float64Array; // indexed by original feature index
  /** |t| statistic for selected features (same order as `selected`), null when no ranking was done. */
  scores: number[] | null;
  droppedForMissing: number;
  droppedConstant: number;
  candidateCount: number;
}

export function hasNegativeValues(X: Float64Array[]): boolean {
  for (const row of X) for (let j = 0; j < row.length; j++) if (row[j] < 0) return true;
  return false;
}

function applyLog(v: number, log2: boolean): number {
  if (!log2 || Number.isNaN(v)) return v;
  return Math.log2(v + 1);
}

function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = values.slice().sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function welchT(a: number[], b: number[]): number {
  const n1 = a.length;
  const n0 = b.length;
  if (n1 < 2 || n0 < 2) return 0;
  const m1 = a.reduce((s, x) => s + x, 0) / n1;
  const m0 = b.reduce((s, x) => s + x, 0) / n0;
  const v1 = a.reduce((s, x) => s + (x - m1) ** 2, 0) / (n1 - 1);
  const v0 = b.reduce((s, x) => s + (x - m0) ** 2, 0) / (n0 - 1);
  const den = Math.sqrt(v1 / n1 + v0 / n0);
  if (!(den > 0)) return 0;
  return (m1 - m0) / den;
}

export function fitPreprocessor(Xtrain: Float64Array[], ytrain: number[], cfg: PreprocessConfig): FittedPreprocessor {
  const n = Xtrain.length;
  const p = n > 0 ? Xtrain[0].length : 0;
  const medians = new Float64Array(p).fill(NaN);
  const means = new Float64Array(p).fill(NaN);
  const sds = new Float64Array(p).fill(NaN);
  const candidates: number[] = [];
  let droppedForMissing = 0;
  let droppedConstant = 0;

  for (let j = 0; j < p; j++) {
    const observed: number[] = [];
    for (let i = 0; i < n; i++) {
      const v = applyLog(Xtrain[i][j], cfg.log2Transform);
      if (!Number.isNaN(v)) observed.push(v);
    }
    const missingFrac = n > 0 ? 1 - observed.length / n : 1;
    if (observed.length === 0 || missingFrac > cfg.maxMissingFraction) {
      droppedForMissing++;
      continue;
    }
    const med = median(observed);
    medians[j] = med;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const v = applyLog(Xtrain[i][j], cfg.log2Transform);
      sum += Number.isNaN(v) ? med : v;
    }
    const mean = sum / n;
    let ss = 0;
    for (let i = 0; i < n; i++) {
      const v = applyLog(Xtrain[i][j], cfg.log2Transform);
      ss += ((Number.isNaN(v) ? med : v) - mean) ** 2;
    }
    const sd = n > 1 ? Math.sqrt(ss / (n - 1)) : 0;
    if (!(sd > 1e-12)) {
      droppedConstant++;
      continue;
    }
    means[j] = mean;
    sds[j] = sd;
    candidates.push(j);
  }

  let selected = candidates;
  let scores: number[] | null = null;
  if (cfg.topK > 0 && cfg.topK < candidates.length) {
    const ranked = candidates.map((j) => {
      const pos: number[] = [];
      const neg: number[] = [];
      for (let i = 0; i < n; i++) {
        const raw = applyLog(Xtrain[i][j], cfg.log2Transform);
        const v = Number.isNaN(raw) ? medians[j] : raw;
        (ytrain[i] === 1 ? pos : neg).push(v);
      }
      return { j, t: Math.abs(welchT(pos, neg)) };
    });
    ranked.sort((a, b) => b.t - a.t || a.j - b.j);
    const top = ranked.slice(0, cfg.topK);
    selected = top.map((r) => r.j);
    scores = top.map((r) => r.t);
  }

  return {
    log2Transform: cfg.log2Transform,
    selected,
    medians,
    means,
    sds,
    scores,
    droppedForMissing,
    droppedConstant,
    candidateCount: candidates.length,
  };
}

/** Applies a fitted preprocessor: log transform -> train-median imputation -> train z-score -> selection. */
export function transformRows(pp: FittedPreprocessor, X: Float64Array[]): Float64Array[] {
  return X.map((row) => {
    const out = new Float64Array(pp.selected.length);
    for (let k = 0; k < pp.selected.length; k++) {
      const j = pp.selected[k];
      const raw = applyLog(row[j], pp.log2Transform);
      const v = Number.isNaN(raw) ? pp.medians[j] : raw;
      out[k] = (v - pp.means[j]) / pp.sds[j];
    }
    return out;
  });
}
