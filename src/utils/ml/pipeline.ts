// End-to-end, leakage-safe experiment runner for Cancer ML Studio.
//
// 1. Stratified, seeded train/test split.
// 2. Preprocessing + feature selection fitted on the TRAINING split only.
// 3. Model fitted on the training split; metrics on the untouched test split.
// 4. Stratified k-fold cross-validation inside the training split (the whole
//    pipeline is re-fitted per fold).
// 5. Baselines: majority-class predictor and shuffled-label (permutation) controls.
// 6. Optional GROUP-AWARE evaluation: whole subjects/patients/cohorts are kept on
//    one side of every train/test and train/validation boundary.
// 7. Univariate, training-split-only gene statistics (Welch t, BH-FDR, Hedges g),
//    a test-set heatmap and per-class distributions for interpretation.

import { createRng, shuffled } from './random';
import type { MlDataset, MlIssue } from './csvDataset';
import { fitPreprocessor, transformRows, hasNegativeValues, type PreprocessConfig, type FittedPreprocessor } from './preprocessing';
import { fitLogisticRegression, fitGaussianNb, predictScores, type ModelKind, type TrainedModel } from './models';
import { classificationMetrics, rocCurve, rocAuc, type ClassificationMetrics, type RocPoint } from './metrics';
import { stratifiedGroupTrainTestSplit, stratifiedGroupKFold, groupsAreDisjoint, groupRows, permuteGroupLabels, type PermutationUnavailableReason } from './groups';
import { tDistributionPValue } from '../statistics';

export interface ExperimentConfig {
  model: ModelKind;
  testFraction: number;
  seed: number;
  lambda: number;
  classWeight: 'none' | 'balanced';
  cvFolds: number;
  threshold: number;
  preprocess: PreprocessConfig;
  /** Keep every group (subject/patient/cohort) on one side of each split. Requires dataset.groups. */
  groupAware?: boolean;
  /** Number of shuffled-label refits (1 = single control; >= 19 also gives an empirical permutation p-value). */
  permutations?: number;
}

export const DEFAULT_EXPERIMENT_CONFIG: ExperimentConfig = {
  model: 'logistic_regression',
  testFraction: 0.25,
  seed: 42,
  lambda: 1,
  classWeight: 'balanced',
  cvFolds: 5,
  threshold: 0.5,
  preprocess: { log2Transform: false, maxMissingFraction: 0.5, topK: 50 },
  groupAware: false,
  permutations: 1,
};

export const MAX_PERMUTATIONS = 50;

export const MAX_MODEL_FEATURES = 200;

export interface SplitResult {
  trainIdx: number[];
  testIdx: number[];
}

/** Stratified split: each class contributes round(n_c * testFraction) test samples, clamped to [1, n_c - 1]. */
export function stratifiedTrainTestSplit(y: number[], testFraction: number, seed: number): SplitResult {
  const rng = createRng(seed);
  const trainIdx: number[] = [];
  const testIdx: number[] = [];
  for (const c of [0, 1]) {
    const idx = y.map((v, i) => (v === c ? i : -1)).filter((i) => i >= 0);
    if (idx.length === 0) continue;
    const order = shuffled(idx, rng);
    let nTest = Math.round(idx.length * testFraction);
    nTest = Math.min(Math.max(nTest, idx.length >= 2 ? 1 : 0), Math.max(idx.length - 1, 0));
    testIdx.push(...order.slice(0, nTest));
    trainIdx.push(...order.slice(nTest));
  }
  trainIdx.sort((a, b) => a - b);
  testIdx.sort((a, b) => a - b);
  return { trainIdx, testIdx };
}

/** Stratified k-fold assignment (returns validation-index arrays). */
export function stratifiedKFold(y: number[], k: number, seed: number): number[][] {
  const rng = createRng(seed);
  const folds: number[][] = Array.from({ length: k }, () => []);
  for (const c of [0, 1]) {
    const idx = shuffled(
      y.map((v, i) => (v === c ? i : -1)).filter((i) => i >= 0),
      rng
    );
    idx.forEach((i, pos) => folds[pos % k].push(i));
  }
  return folds.map((f) => f.sort((a, b) => a - b));
}

function pick<T>(arr: T[], idx: number[]): T[] {
  return idx.map((i) => arr[i]);
}

interface FitOutput {
  pp: FittedPreprocessor;
  model: TrainedModel;
}

function fitPipeline(X: Float64Array[], y: number[], cfg: ExperimentConfig): FitOutput {
  const pp = fitPreprocessor(X, y, cfg.preprocess);
  const Xt = transformRows(pp, X);
  const model =
    cfg.model === 'logistic_regression'
      ? fitLogisticRegression(Xt, y, { lambda: cfg.lambda, classWeight: cfg.classWeight })
      : fitGaussianNb(Xt, y);
  return { pp, model };
}

function scorePipeline(fit: FitOutput, X: Float64Array[]): number[] {
  return predictScores(fit.model, transformRows(fit.pp, X));
}

export type MeanSd = { mean: number; sd: number; n: number };

export interface CvFold {
  accuracy: number | null;
  balancedAccuracy: number | null;
  rocAuc: number | null;
  precision: number | null;
  recall: number | null;
  specificity: number | null;
  f1: number | null;
  nValidation: number;
}

export interface CvSummary {
  folds: number;
  requestedFolds: number;
  /** Folds that could not be evaluated (empty, or the fitting part had one class). */
  skippedFolds: number;
  groupAware: boolean;
  accuracy: MeanSd | null;
  balancedAccuracy: MeanSd | null;
  rocAuc: MeanSd | null;
  precision: MeanSd | null;
  recall: MeanSd | null;
  specificity: MeanSd | null;
  f1: MeanSd | null;
  /** ROC-AUC of all out-of-fold scores pooled together (null if a class is missing). */
  pooledRocAuc: number | null;
  perFold: CvFold[];
}

export interface FeatureStat {
  feature: string;
  /** Means/SDs on the analysis scale (log2(x+1) if enabled), training split only, after train-median imputation. */
  meanPositive: number;
  meanNegative: number;
  sdPositive: number;
  sdNegative: number;
  /** meanPositive - meanNegative on the analysis scale (a log2 fold change when log2 was applied). */
  difference: number;
  welchT: number;
  df: number;
  pValue: number | null;
  /** Benjamini-Hochberg adjusted p over all candidate features. */
  qValue: number | null;
  hedgesG: number | null;
  inModel: boolean;
}

export interface HeatmapData {
  features: string[];
  sampleIds: string[];
  trueLabels: string[];
  /** z-scores using TRAINING means/SDs, clipped to [-3, 3]; rows = features, cols = samples. */
  values: number[][];
}

export interface BoxStats {
  n: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

export interface FeatureDistribution {
  feature: string;
  train: { negative: BoxStats | null; positive: BoxStats | null };
  test: { negative: BoxStats | null; positive: BoxStats | null };
}

export interface PermutationSummary {
  n: number;
  rocAuc: MeanSd | null;
  /** (1 + #{perm AUC >= observed}) / (n + 1); only reported for n >= 19. */
  pValue: number | null;
  /**
   * 'row'  - training labels are shuffled row by row (valid only when rows are independent);
   * 'group' - whole-group labels are exchanged between groups of equal size (group-aware mode);
   * 'unavailable' - group-aware mode but a valid group-level permutation is impossible; nothing is reported.
   * H0: the label of a whole group is exchangeable with that of another group of the same size
   * (group-level) / the label of any row is exchangeable (row-level). Statistic: held-out test AUC
   * of the pipeline refit on the permuted training labels.
   */
  mode: 'row' | 'group' | 'unavailable';
  unavailableReason?: PermutationUnavailableReason;
  /** Groups that took part in label exchange (group mode only). */
  permutableGroups?: number;
}

/**
 * How the univariate Welch t / p / q columns may be interpreted.
 * 'independent_rows': rows are treated as independent observations (no repeated groups were detected, or all groups are singletons);
 * 'unavailable_repeated_groups': group-aware mode with repeated groups: p and q are NOT computed because rows of one group are not independent;
 * 'rows_with_ignored_groups': repeated groups exist but group-aware mode is off: p and q are anti-conservative.
 */
export type FeatureStatsInference = 'independent_rows' | 'unavailable_repeated_groups' | 'rows_with_ignored_groups';

export interface FeatureWeight {
  feature: string;
  coefficient: number;
  /** |Welch t| on the training split, if features were ranked. */
  trainTStat: number | null;
  /**
   * Fraction of cross-validation folds whose (independently fitted) top-K
   * selection also contained this feature. null when CV or ranking was not run.
   * Low values mean the ranking is unstable and the feature should not be
   * over-interpreted.
   */
  cvSelectionFrequency: number | null;
  direction: 'positive_class' | 'negative_class';
}

export interface PredictionRow {
  sampleId: string;
  trueLabel: string;
  predictedLabel: string;
  score: number;
}

export interface ExperimentResult {
  config: ExperimentConfig;
  evaluation: { mode: 'row' | 'group'; trainGroups: number | null; testGroups: number | null; groupColumn: string | null };
  classes: [string, string];
  nTrain: number;
  nTest: number;
  trainClassCounts: [number, number];
  testClassCounts: [number, number];
  featuresAvailable: number;
  featuresUsed: number;
  droppedForMissing: number;
  droppedConstant: number;
  modelConverged: boolean | null;
  train: ClassificationMetrics;
  test: ClassificationMetrics;
  roc: RocPoint[];
  baselines: {
    majority: ClassificationMetrics & { predictedClass: string };
    /** null when a valid shuffled-label control is not possible (group-aware mode without a valid group-level permutation). */
    shuffledLabels: ClassificationMetrics | null;
    permutation: PermutationSummary;
  };
  cv: CvSummary | null;
  featureWeights: FeatureWeight[] | null;
  /** Univariate training-split statistics for up to 200 features (sorted by p-value). */
  featureStats: FeatureStat[];
  featureStatsInference: FeatureStatsInference;
  candidateFeatures: number;
  heatmap: HeatmapData | null;
  distributions: FeatureDistribution[];
  splitIds: { train: string[]; test: string[] };
  datasetFingerprint: string | null;
  predictions: PredictionRow[];
  warnings: MlIssue[];
  runtimeMs: number;
}

function meanSd(values: (number | null)[]): MeanSd | null {
  const v = values.filter((x): x is number => x !== null && Number.isFinite(x));
  if (v.length === 0) return null;
  const mean = v.reduce((s, x) => s + x, 0) / v.length;
  const sd = v.length > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / (v.length - 1)) : 0;
  return { mean, sd, n: v.length };
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Five-number summary (linear-interpolation quantiles, as in R type 7 / NumPy default). */
export function boxStats(values: number[]): BoxStats | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  return { n: v.length, min: v[0], q1: quantile(v, 0.25), median: quantile(v, 0.5), q3: quantile(v, 0.75), max: v[v.length - 1] };
}

/** Benjamini-Hochberg step-up adjusted p-values (null entries are skipped and stay null). */
export function benjaminiHochberg(p: (number | null)[]): (number | null)[] {
  const idx = p.map((v, i) => ({ v, i })).filter((x): x is { v: number; i: number } => x.v !== null && Number.isFinite(x.v));
  const m = idx.length;
  const out: (number | null)[] = p.map(() => null);
  idx.sort((a, b) => a.v - b.v);
  let running = 1;
  for (let r = m - 1; r >= 0; r--) {
    running = Math.min(running, (idx[r].v * m) / (r + 1));
    out[idx[r].i] = Math.min(1, running);
  }
  return out;
}

/** Welch two-sample t statistic, Welch-Satterthwaite df and two-sided p (null if undefined). */
export function welchTest(a: number[], b: number[]): { t: number; df: number; p: number | null } {
  const n1 = a.length;
  const n0 = b.length;
  if (n1 < 2 || n0 < 2) return { t: 0, df: 0, p: null };
  const m1 = a.reduce((s, x) => s + x, 0) / n1;
  const m0 = b.reduce((s, x) => s + x, 0) / n0;
  const v1 = a.reduce((s, x) => s + (x - m1) ** 2, 0) / (n1 - 1);
  const v0 = b.reduce((s, x) => s + (x - m0) ** 2, 0) / (n0 - 1);
  const se2 = v1 / n1 + v0 / n0;
  if (!(se2 > 0)) return { t: 0, df: 0, p: null };
  const t = (m1 - m0) / Math.sqrt(se2);
  const df = se2 ** 2 / ((v1 / n1) ** 2 / (n1 - 1) + (v0 / n0) ** 2 / (n0 - 1));
  return { t, df, p: tDistributionPValue(t, df) };
}

function analysisValue(pp: FittedPreprocessor, row: Float64Array, j: number): number {
  const raw = row[j];
  const v = pp.log2Transform && !Number.isNaN(raw) ? Math.log2(raw + 1) : raw;
  return Number.isNaN(v) ? pp.medians[j] : v;
}

function computeFeatureStats(
  pp: FittedPreprocessor,
  Xtr: Float64Array[],
  ytr: number[],
  names: string[],
  suppressInference: boolean
): { stats: FeatureStat[]; candidates: number } {
  // Candidate = passed the train-only missingness and variance filters (i.e. has a fitted SD).
  const candidates: number[] = [];
  for (let j = 0; j < pp.sds.length; j++) if (Number.isFinite(pp.sds[j]) && pp.sds[j] > 0) candidates.push(j);
  const inModel = new Set(pp.selected);
  const rows = candidates.map((j) => {
    const pos: number[] = [];
    const neg: number[] = [];
    for (let i = 0; i < Xtr.length; i++) (ytr[i] === 1 ? pos : neg).push(analysisValue(pp, Xtr[i], j));
    const mp = pos.reduce((s, x) => s + x, 0) / Math.max(pos.length, 1);
    const mn = neg.reduce((s, x) => s + x, 0) / Math.max(neg.length, 1);
    const sp = pos.length > 1 ? Math.sqrt(pos.reduce((s, x) => s + (x - mp) ** 2, 0) / (pos.length - 1)) : NaN;
    const sn = neg.length > 1 ? Math.sqrt(neg.reduce((s, x) => s + (x - mn) ** 2, 0) / (neg.length - 1)) : NaN;
    const w = welchTest(pos, neg);
    const dfPooled = pos.length + neg.length - 2;
    const pooled = dfPooled > 0 ? Math.sqrt(((pos.length - 1) * sp * sp + (neg.length - 1) * sn * sn) / dfPooled) : NaN;
    const correction = dfPooled > 1 ? 1 - 3 / (4 * dfPooled - 1) : NaN;
    const g = pooled > 0 && Number.isFinite(correction) ? ((mp - mn) / pooled) * correction : null;
    return {
      feature: names[j],
      meanPositive: mp,
      meanNegative: mn,
      sdPositive: sp,
      sdNegative: sn,
      difference: mp - mn,
      welchT: w.t,
      df: w.df,
      pValue: w.p,
      qValue: null as number | null,
      hedgesG: g,
      inModel: inModel.has(j),
    };
  });
  if (suppressInference) {
    // Repeated samples per group are not independent observations: no p / q is reported (t, df and effect size stay descriptive).
    rows.forEach((r) => (r.pValue = null));
  } else {
    const q = benjaminiHochberg(rows.map((r) => r.pValue));
    rows.forEach((r, k) => (r.qValue = q[k]));
  }
  rows.sort((a, b) => (a.pValue ?? 2) - (b.pValue ?? 2) || Math.abs(b.welchT) - Math.abs(a.welchT) || a.feature.localeCompare(b.feature));
  return { stats: rows.slice(0, 200), candidates: candidates.length };
}

export interface ExperimentError {
  error: MlIssue;
}

export function runExperiment(dataset: MlDataset, cfg: ExperimentConfig): ExperimentResult | ExperimentError {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const warnings: MlIssue[] = [];
  const { X, y } = dataset;
  const p = dataset.featureNames.length;

  if (!(cfg.testFraction >= 0.1 && cfg.testFraction <= 0.5)) {
    return { error: { severity: 'error', code: 'bad_test_fraction' } };
  }
  if (cfg.preprocess.log2Transform && hasNegativeValues(X)) {
    return { error: { severity: 'error', code: 'log_negative_values' } };
  }
  const effectiveK = cfg.preprocess.topK > 0 ? Math.min(cfg.preprocess.topK, p) : p;
  if (effectiveK > MAX_MODEL_FEATURES) {
    return { error: { severity: 'error', code: 'too_many_model_features', params: { count: effectiveK, max: MAX_MODEL_FEATURES } } };
  }

  const groupAware = cfg.groupAware === true;
  const groups = dataset.groups ?? null;
  let split: SplitResult;
  let trainGroups: number | null = null;
  let testGroups: number | null = null;
  if (groupAware) {
    if (!groups) return { error: { severity: 'error', code: 'groups_missing' } };
    const gs = stratifiedGroupTrainTestSplit(y, groups, cfg.testFraction, cfg.seed);
    if (!gs) return { error: { severity: 'error', code: 'group_split_infeasible' } };
    if (!groupsAreDisjoint(groups, gs.trainIdx, gs.testIdx)) return { error: { severity: 'error', code: 'unexpected_failure' } };
    split = gs;
    trainGroups = gs.trainGroups;
    testGroups = gs.testGroups;
  } else {
    split = stratifiedTrainTestSplit(y, cfg.testFraction, cfg.seed);
    if (groups && groupRows(groups, y).members.some((m) => m.length > 1)) {
      warnings.push({ severity: 'warning', code: 'groups_not_used' });
    }
  }
  const Xtr = pick(X, split.trainIdx);
  const ytr = pick(y, split.trainIdx);
  const Xte = pick(X, split.testIdx);
  const yte = pick(y, split.testIdx);
  const count = (arr: number[]): [number, number] => {
    const pos = arr.reduce((s, v) => s + v, 0);
    return [arr.length - pos, pos];
  };
  const trainCounts = count(ytr);
  const testCounts = count(yte);
  if (trainCounts[0] < 2 || trainCounts[1] < 2 || testCounts[0] < 1 || testCounts[1] < 1) {
    return { error: { severity: 'error', code: 'split_too_small' } };
  }

  const fit = fitPipeline(Xtr, ytr, cfg);
  if (fit.pp.selected.length === 0) {
    return { error: { severity: 'error', code: 'no_usable_features' } };
  }
  const trainScores = scorePipeline(fit, Xtr);
  const testScores = scorePipeline(fit, Xte);
  const train = classificationMetrics(ytr, trainScores, cfg.threshold);
  const test = classificationMetrics(yte, testScores, cfg.threshold);

  // Baseline 1: majority class of the training split, constant score.
  const majorityIsPositive = trainCounts[1] > trainCounts[0];
  const constScore = trainCounts[1] / ytr.length;
  const majorityMetrics = classificationMetrics(
    yte,
    yte.map(() => constScore),
    majorityIsPositive ? Math.min(cfg.threshold, constScore) : Math.max(cfg.threshold, constScore + 1e-9)
  );

  // Baseline 2: identical pipeline trained on PERMUTED training labels (permutation control).
  // Row mode: row-level shuffle (historical seeds, unchanged). Group-aware mode: only whole-group
  // labels are exchanged (see permuteGroupLabels); if that is impossible the control is reported as
  // unavailable instead of silently shuffling rows.
  const nPerm = Math.min(MAX_PERMUTATIONS, Math.max(1, Math.floor(cfg.permutations ?? 1)));
  const permGroups = groupAware && groups ? pick(groups, split.trainIdx) : null;
  let shuffledMetrics: ClassificationMetrics | null = null;
  const permAucs: (number | null)[] = [];
  let permUnavailable: PermutationUnavailableReason | null = null;
  let permutableGroups: number | undefined;
  for (let r = 0; r < nPerm; r++) {
    const rng = createRng(cfg.seed + 7919 + r * 104729);
    let shuffledY: number[];
    if (permGroups) {
      const gp = permuteGroupLabels(ytr, permGroups, rng);
      if (gp.y === null) {
        permUnavailable = gp.unavailable ?? 'too_few_groups';
        permutableGroups = gp.permutableGroups;
        break;
      }
      shuffledY = gp.y;
      permutableGroups = gp.permutableGroups;
    } else {
      shuffledY = shuffled(ytr, rng);
    }
    const shuffledFit = fitPipeline(Xtr, shuffledY, cfg);
    const m =
      shuffledFit.pp.selected.length > 0 && !shuffledY.every((v) => v === shuffledY[0])
        ? classificationMetrics(yte, scorePipeline(shuffledFit, Xte), cfg.threshold)
        : classificationMetrics(yte, yte.map(() => 0.5), cfg.threshold);
    if (r === 0) shuffledMetrics = m;
    permAucs.push(m.rocAuc);
  }
  const validPerm = permAucs.filter((a): a is number => a !== null);
  const permutation: PermutationSummary = permUnavailable
    ? { n: 0, rocAuc: null, pValue: null, mode: 'unavailable', unavailableReason: permUnavailable, permutableGroups }
    : {
        n: nPerm,
        rocAuc: meanSd(permAucs),
        pValue:
          nPerm >= 19 && test.rocAuc !== null && validPerm.length === nPerm
            ? (1 + validPerm.filter((a) => a >= (test.rocAuc as number)).length) / (nPerm + 1)
            : null,
        mode: permGroups ? 'group' : 'row',
        ...(permGroups ? { permutableGroups } : {}),
      };

  // Cross-validation inside the training split.
  let cv: CvSummary | null = null;
  let selectionCounts: Map<number, number> | null = null;
  let rankedFolds = 0;
  const groupsTr = groupAware && groups ? pick(groups, split.trainIdx) : null;
  const trainGroupCount = groupsTr ? new Set(groupsTr).size : Infinity;
  const k = Math.min(cfg.cvFolds, trainCounts[0], trainCounts[1], trainGroupCount);
  if (cfg.cvFolds >= 2 && k >= 2) {
    const folds = groupsTr ? stratifiedGroupKFold(ytr, groupsTr, k, cfg.seed + 1) : stratifiedKFold(ytr, k, cfg.seed + 1);
    const perFold: CvFold[] = [];
    selectionCounts = new Map<number, number>();
    rankedFolds = 0;
    let skipped = 0;
    const oofY: number[] = [];
    const oofS: number[] = [];
    for (const valIdx of folds) {
      if (valIdx.length === 0) {
        skipped++;
        continue;
      }
      const valSet = new Set(valIdx);
      const fitIdx = ytr.map((_, i) => i).filter((i) => !valSet.has(i));
      if (groupsTr && !groupsAreDisjoint(groupsTr, fitIdx, valIdx)) return { error: { severity: 'error', code: 'unexpected_failure' } };
      const yFit = pick(ytr, fitIdx);
      if (yFit.length < 2 || yFit.every((v) => v === yFit[0])) {
        skipped++;
        continue;
      }
      const f = fitPipeline(pick(Xtr, fitIdx), yFit, cfg);
      if (f.pp.selected.length === 0) {
        skipped++;
        continue;
      }
      if (f.pp.scores) {
        rankedFolds++;
        for (const j of f.pp.selected) selectionCounts.set(j, (selectionCounts.get(j) ?? 0) + 1);
      }
      const yVal = pick(ytr, valIdx);
      const sVal = scorePipeline(f, pick(Xtr, valIdx));
      oofY.push(...yVal);
      oofS.push(...sVal);
      const m = classificationMetrics(yVal, sVal, cfg.threshold);
      perFold.push({
        accuracy: m.accuracy,
        balancedAccuracy: m.balancedAccuracy,
        rocAuc: m.rocAuc,
        precision: m.precision,
        recall: m.recall,
        specificity: m.specificity,
        f1: m.f1,
        nValidation: yVal.length,
      });
    }
    cv = {
      folds: perFold.length,
      requestedFolds: cfg.cvFolds,
      skippedFolds: skipped,
      groupAware: !!groupsTr,
      accuracy: meanSd(perFold.map((f) => f.accuracy)),
      balancedAccuracy: meanSd(perFold.map((f) => f.balancedAccuracy)),
      rocAuc: meanSd(perFold.map((f) => f.rocAuc)),
      precision: meanSd(perFold.map((f) => f.precision)),
      recall: meanSd(perFold.map((f) => f.recall)),
      specificity: meanSd(perFold.map((f) => f.specificity)),
      f1: meanSd(perFold.map((f) => f.f1)),
      pooledRocAuc: oofY.length > 0 ? rocAuc(oofY, oofS) : null,
      perFold,
    };
    if (k < cfg.cvFolds) warnings.push({ severity: 'info', code: 'cv_folds_reduced', params: { requested: cfg.cvFolds, used: k } });
    if (skipped > 0) warnings.push({ severity: 'warning', code: 'cv_folds_skipped', params: { count: skipped } });
    if (perFold.length > 0 && perFold.some((f) => f.rocAuc === null)) warnings.push({ severity: 'info', code: 'cv_fold_single_class' });
  } else if (cfg.cvFolds >= 2) {
    warnings.push({ severity: 'warning', code: 'cv_skipped' });
  } else {
    warnings.push({ severity: 'info', code: 'cv_disabled' });
  }

  // Feature weights (only meaningful for the linear model on standardized inputs).
  let featureWeights: FeatureWeight[] | null = null;
  if (fit.model.kind === 'logistic_regression') {
    const lr = fit.model;
    featureWeights = fit.pp.selected
      .map((j, kIdx) => ({
        feature: dataset.featureNames[j],
        coefficient: lr.coef[kIdx],
        trainTStat: fit.pp.scores ? fit.pp.scores[kIdx] : null,
        cvSelectionFrequency: selectionCounts && rankedFolds > 0 && fit.pp.scores ? (selectionCounts.get(j) ?? 0) / rankedFolds : null,
        direction: (lr.coef[kIdx] >= 0 ? 'positive_class' : 'negative_class') as FeatureWeight['direction'],
      }))
      .sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));
    if (!lr.converged) warnings.push({ severity: 'warning', code: 'not_converged' });
  }

  // Scientific sanity warnings
  const trBal = train.balancedAccuracy ?? 0;
  const teBal = test.balancedAccuracy ?? 0;
  if (trBal - teBal > 0.15) {
    warnings.push({ severity: 'warning', code: 'overfitting_gap', params: { train: trBal.toFixed(2), test: teBal.toFixed(2) } });
  }
  if (yte.length < 20) warnings.push({ severity: 'warning', code: 'small_test_set', params: { n: yte.length } });
  if (test.rocAuc !== null && test.rocAuc >= 0.999 && yte.length < 50) {
    warnings.push({ severity: 'warning', code: 'perfect_score' });
  }
  const controlAuc = nPerm > 1 ? permutation.rocAuc?.mean ?? null : shuffledMetrics?.rocAuc ?? null;
  if (permUnavailable) {
    warnings.push({
      severity: 'warning',
      code: permUnavailable === 'mixed_label_groups' ? 'permutation_unavailable_mixed_groups' : 'permutation_unavailable_few_groups',
      params: { groups: permutableGroups ?? 0 },
    });
  }
  if (controlAuc !== null && controlAuc >= 0.7) {
    warnings.push({ severity: 'warning', code: 'shuffled_control_high', params: { auc: controlAuc.toFixed(2) } });
  }
  if (permutation.pValue !== null && permutation.pValue > 0.05) {
    warnings.push({ severity: 'warning', code: 'permutation_not_significant', params: { p: permutation.pValue.toFixed(3) } });
  }
  if (test.balancedAccuracy !== null && majorityMetrics.balancedAccuracy !== null && test.balancedAccuracy <= majorityMetrics.balancedAccuracy + 0.05) {
    warnings.push({ severity: 'warning', code: 'no_better_than_baseline' });
  }
  if (p > X.length) warnings.push({ severity: 'info', code: 'selection_inside_training', params: { k: fit.pp.selected.length } });
  if (featureWeights && featureWeights.length > 0 && featureWeights[0].cvSelectionFrequency !== null) {
    const top = featureWeights.slice(0, Math.min(10, featureWeights.length));
    const stable = top.filter((f) => (f.cvSelectionFrequency ?? 0) >= 0.8).length;
    if (stable < Math.ceil(top.length / 2)) {
      warnings.push({ severity: 'warning', code: 'unstable_feature_selection', params: { stable, total: top.length } });
    }
  }

  const predictions: PredictionRow[] = split.testIdx.map((i, kIdx) => ({
    sampleId: dataset.sampleIds[i],
    trueLabel: dataset.classes[y[i]],
    predictedLabel: dataset.classes[testScores[kIdx] >= cfg.threshold ? 1 : 0],
    score: testScores[kIdx],
  }));

  // Interpretation aids (training-split statistics; test-set heatmap uses TRAIN scaling).
  const trainHasRepeatedGroups = (() => {
    if (!groups) return false;
    return groupRows(pick(groups, split.trainIdx), ytr).members.some((m) => m.length > 1);
  })();
  const featureStatsInference: FeatureStatsInference = !trainHasRepeatedGroups
    ? 'independent_rows'
    : groupAware
      ? 'unavailable_repeated_groups'
      : 'rows_with_ignored_groups';
  const fstats = computeFeatureStats(fit.pp, Xtr, ytr, dataset.featureNames, featureStatsInference === 'unavailable_repeated_groups');
  const rankedModelFeatures: number[] = (() => {
    if (fit.model.kind === 'logistic_regression') {
      const lr = fit.model;
      return fit.pp.selected
        .map((j, kIdx) => ({ j, w: Math.abs(lr.coef[kIdx]) }))
        .sort((a, b) => b.w - a.w || a.j - b.j)
        .map((x) => x.j);
    }
    const order = new Map(fstats.stats.map((f, r) => [f.feature, r]));
    return fit.pp.selected.slice().sort((a, b) => (order.get(dataset.featureNames[a]) ?? 1e9) - (order.get(dataset.featureNames[b]) ?? 1e9) || a - b);
  })();
  const heatFeatures = rankedModelFeatures.slice(0, 25);
  const testOrder = split.testIdx
    .map((i, kIdx) => ({ i, kIdx }))
    .sort((a, b) => y[a.i] - y[b.i] || testScores[a.kIdx] - testScores[b.kIdx]);
  const zTest = transformRows(fit.pp, Xte);
  const colOf = new Map(fit.pp.selected.map((j, c) => [j, c]));
  const heatmap: HeatmapData | null =
    heatFeatures.length > 0 && testOrder.length > 0
      ? {
          features: heatFeatures.map((j) => dataset.featureNames[j]),
          sampleIds: testOrder.map((o) => dataset.sampleIds[o.i]),
          trueLabels: testOrder.map((o) => dataset.classes[y[o.i]]),
          values: heatFeatures.map((j) =>
            testOrder.map((o) => {
              const v = zTest[o.kIdx][colOf.get(j) as number];
              return Number(Math.max(-3, Math.min(3, v)).toFixed(3));
            })
          ),
        }
      : null;
  const distributions: FeatureDistribution[] = rankedModelFeatures.slice(0, 6).map((j) => {
    const vals = (rowsX: Float64Array[], ys: number[], cls: number) =>
      rowsX.map((r, i) => (ys[i] === cls ? analysisValue(fit.pp, r, j) : NaN)).filter((v) => Number.isFinite(v));
    return {
      feature: dataset.featureNames[j],
      train: { negative: boxStats(vals(Xtr, ytr, 0)), positive: boxStats(vals(Xtr, ytr, 1)) },
      test: { negative: boxStats(vals(Xte, yte, 0)), positive: boxStats(vals(Xte, yte, 1)) },
    };
  });

  const ended = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    config: cfg,
    evaluation: { mode: groupAware ? 'group' : 'row', trainGroups, testGroups, groupColumn: dataset.groupColumn ?? null },
    classes: dataset.classes,
    nTrain: ytr.length,
    nTest: yte.length,
    trainClassCounts: trainCounts,
    testClassCounts: testCounts,
    featuresAvailable: p,
    featuresUsed: fit.pp.selected.length,
    droppedForMissing: fit.pp.droppedForMissing,
    droppedConstant: fit.pp.droppedConstant,
    modelConverged: fit.model.kind === 'logistic_regression' ? fit.model.converged : null,
    train,
    test,
    roc: rocCurve(yte, testScores),
    baselines: {
      majority: { ...majorityMetrics, predictedClass: dataset.classes[majorityIsPositive ? 1 : 0] },
      shuffledLabels: shuffledMetrics,
      permutation,
    },
    cv,
    featureWeights,
    featureStats: fstats.stats,
    featureStatsInference,
    candidateFeatures: fstats.candidates,
    heatmap,
    distributions,
    splitIds: { train: split.trainIdx.map((i) => dataset.sampleIds[i]), test: split.testIdx.map((i) => dataset.sampleIds[i]) },
    datasetFingerprint: dataset.fingerprint ?? null,
    predictions,
    warnings,
    runtimeMs: Math.round(ended - started),
  };
}

export function isExperimentError(r: ExperimentResult | ExperimentError): r is ExperimentError {
  return (r as ExperimentError).error !== undefined;
}

/**
 * CSV-escapes a cell. Text that came from the uploaded file (sample IDs, labels,
 * feature names) is untrusted: cells starting with = + - @ or a control
 * character are prefixed with ' so spreadsheet programs do not execute them as
 * formulas (CSV/formula injection). Numbers are written unchanged.
 */
export function csvCell(v: string | number): string {
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function predictionsToCsv(result: ExperimentResult): string {
  const header = ['sample_id', 'true_label', 'predicted_label', `model_score_${result.classes[1]}`];
  const lines = [header.map(csvCell).join(',')];
  for (const r of result.predictions) lines.push([r.sampleId, r.trueLabel, r.predictedLabel, Number(r.score.toFixed(6))].map(csvCell).join(','));
  return lines.join('\n');
}

export function featureWeightsToCsv(result: ExperimentResult): string {
  const lines = ['feature,coefficient_standardized,train_abs_welch_t,cv_selection_frequency,associated_with'];
  for (const f of result.featureWeights || []) {
    lines.push(
      [
        f.feature,
        Number(f.coefficient.toFixed(6)),
        f.trainTStat === null ? '' : Number(f.trainTStat.toFixed(4)),
        f.cvSelectionFrequency === null ? '' : Number(f.cvSelectionFrequency.toFixed(2)),
        f.direction === 'positive_class' ? result.classes[1] : result.classes[0],
      ]
        .map(csvCell)
        .join(',')
    );
  }
  return lines.join('\n');
}

export function featureStatsToCsv(result: ExperimentResult): string {
  const [neg, pos] = result.classes;
  const lines = [
    [
      'feature',
      `mean_${pos}`,
      `mean_${neg}`,
      `sd_${pos}`,
      `sd_${neg}`,
      'difference_pos_minus_neg',
      'welch_t',
      'welch_df',
      'p_value',
      'bh_q_value',
      'hedges_g',
      'in_model',
    ]
      .map(csvCell)
      .join(','),
  ];
  const num = (v: number | null, d = 6) => (v === null || !Number.isFinite(v) ? '' : Number(v.toFixed(d)));
  for (const f of result.featureStats) {
    lines.push(
      [f.feature, num(f.meanPositive), num(f.meanNegative), num(f.sdPositive), num(f.sdNegative), num(f.difference), num(f.welchT, 4), num(f.df, 2), f.pValue === null ? '' : f.pValue.toExponential(4), f.qValue === null ? '' : f.qValue.toExponential(4), num(f.hedgesG, 4), f.inModel ? 'yes' : 'no']
        .map((c) => (typeof c === 'number' ? String(c) : csvCell(c)))
        .join(',')
    );
  }
  return lines.join('\n');
}
