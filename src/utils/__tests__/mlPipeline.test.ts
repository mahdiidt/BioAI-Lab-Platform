import { describe, it, expect } from 'vitest';
import { classificationMetrics, rocAuc, confusionMatrix, rocCurve } from '../ml/metrics';
import { stratifiedTrainTestSplit, stratifiedKFold, runExperiment, isExperimentError, DEFAULT_EXPERIMENT_CONFIG, predictionsToCsv } from '../ml/pipeline';
import { fitPreprocessor, transformRows } from '../ml/preprocessing';
import { fitLogisticRegression, fitGaussianNb, predictScores } from '../ml/models';
import { parseDelimitedTable, profileColumns, buildDataset } from '../ml/csvDataset';
import { generateSyntheticExpressionCsv } from '../ml/syntheticData';

const rowsOf = (m: number[][]) => m.map((r) => Float64Array.from(r));

function syntheticDataset(opts = {}) {
  const table = parseDelimitedTable(generateSyntheticExpressionCsv(opts));
  const built = buildDataset(table, profileColumns(table), { labelColumn: 'condition', idColumn: 'sample_id' });
  return built.dataset!;
}

describe('Metrics', () => {
  it('computes a confusion matrix', () => {
    expect(confusionMatrix([1, 1, 0, 0, 1], [1, 0, 0, 1, 1])).toEqual({ tp: 2, fp: 1, tn: 1, fn: 1 });
  });

  it('computes accuracy, precision, recall, F1', () => {
    const m = classificationMetrics([1, 1, 0, 0, 1], [0.9, 0.2, 0.1, 0.7, 0.8]);
    expect(m.accuracy).toBeCloseTo(0.6, 6);
    expect(m.precision).toBeCloseTo(2 / 3, 6);
    expect(m.recall).toBeCloseTo(2 / 3, 6);
    expect(m.f1).toBeCloseTo(2 / 3, 6);
    expect(m.specificity).toBeCloseTo(0.5, 6);
  });

  it('computes ROC-AUC with ties using mid-ranks', () => {
    expect(rocAuc([0, 0, 1, 1], [0.1, 0.4, 0.35, 0.8])).toBeCloseTo(0.75, 6);
    expect(rocAuc([0, 1], [0.5, 0.5])).toBeCloseTo(0.5, 6);
    expect(rocAuc([0, 0, 1, 1], [0.1, 0.2, 0.3, 0.4])).toBe(1);
  });

  it('returns null (not a fake number) for undefined metrics', () => {
    const m = classificationMetrics([1, 1, 1], [0.9, 0.8, 0.7]);
    expect(m.rocAuc).toBeNull();
    expect(m.specificity).toBeNull();
    expect(m.undefinedReasons).toContain('auc_single_class');
    const noPos = classificationMetrics([1, 0, 0], [0.1, 0.2, 0.3]);
    expect(noPos.precision).toBeNull();
    expect(noPos.f1).toBe(0);
  });

  it('builds a monotone ROC curve from (0,0) to (1,1)', () => {
    const pts = rocCurve([0, 1, 0, 1], [0.2, 0.9, 0.6, 0.4]);
    expect(pts[0]).toMatchObject({ fpr: 0, tpr: 0 });
    expect(pts[pts.length - 1]).toMatchObject({ fpr: 1, tpr: 1 });
    for (let i = 1; i < pts.length; i++) expect(pts[i].fpr >= pts[i - 1].fpr && pts[i].tpr >= pts[i - 1].tpr).toBe(true);
  });
});

describe('Train/test split', () => {
  const y = [...Array(30).fill(0), ...Array(10).fill(1)];

  it('is stratified and reproducible', () => {
    const a = stratifiedTrainTestSplit(y, 0.25, 7);
    const b = stratifiedTrainTestSplit(y, 0.25, 7);
    expect(a).toEqual(b);
    expect(a.testIdx.filter((i) => y[i] === 1)).toHaveLength(3); // round(10 * 0.25)
    expect(a.testIdx.filter((i) => y[i] === 0)).toHaveLength(8); // round(30 * 0.25)
    const overlap = a.trainIdx.filter((i) => a.testIdx.includes(i));
    expect(overlap).toHaveLength(0);
    expect(a.trainIdx.length + a.testIdx.length).toBe(40);
  });

  it('changes with the seed', () => {
    expect(stratifiedTrainTestSplit(y, 0.25, 1).testIdx).not.toEqual(stratifiedTrainTestSplit(y, 0.25, 2).testIdx);
  });

  it('creates disjoint stratified folds that cover every sample', () => {
    const folds = stratifiedKFold(y, 5, 3);
    const all = folds.flat().sort((a, b) => a - b);
    expect(all).toEqual(y.map((_, i) => i));
    folds.forEach((f) => expect(f.filter((i) => y[i] === 1)).toHaveLength(2));
  });
});

describe('Preprocessing is fitted on training data only', () => {
  it('uses training medians/means for imputation and scaling', () => {
    const Xtr = rowsOf([[1], [3], [NaN], [5]]);
    const pp = fitPreprocessor(Xtr, [0, 0, 1, 1], { log2Transform: false, maxMissingFraction: 0.5, topK: 0 });
    expect(pp.medians[0]).toBe(3);
    const [out] = transformRows(pp, rowsOf([[NaN]]));
    // imputed with training median 3, centred on training mean (1+3+3+5)/4 = 3
    expect(out[0]).toBeCloseTo(0, 9);
    const [far] = transformRows(pp, rowsOf([[1000]]));
    expect(far[0]).toBeGreaterThan(100); // test values never change the fitted scaler
  });

  it('drops constant and mostly-missing training features', () => {
    const Xtr = rowsOf([
      [1, 7, NaN],
      [2, 7, NaN],
      [3, 7, 1],
      [4, 7, NaN],
    ]);
    const pp = fitPreprocessor(Xtr, [0, 0, 1, 1], { log2Transform: false, maxMissingFraction: 0.5, topK: 0 });
    expect(pp.selected).toEqual([0]);
    expect(pp.droppedConstant).toBe(1);
    expect(pp.droppedForMissing).toBe(1);
  });

  it('ranks features by training t-statistic', () => {
    const Xtr = rowsOf([
      [0, 5.1, 1],
      [0.1, 4.9, 2],
      [5, 5.0, 1.5],
      [5.2, 5.05, 1.4],
    ]);
    const pp = fitPreprocessor(Xtr, [0, 0, 1, 1], { log2Transform: false, maxMissingFraction: 0.5, topK: 1 });
    expect(pp.selected).toEqual([0]);
  });
});

describe('Models', () => {
  it('logistic regression separates a simple 1-D problem and converges', () => {
    const X = rowsOf([[-2], [-1.5], [-1], [-0.5], [0.5], [1], [1.5], [2]]);
    const y = [0, 0, 0, 0, 1, 1, 1, 1];
    const m = fitLogisticRegression(X, y, { lambda: 0.1, classWeight: 'none' });
    expect(m.converged).toBe(true);
    expect(m.coef[0]).toBeGreaterThan(0);
    const s = predictScores(m, rowsOf([[-3], [3]]));
    expect(s[0]).toBeLessThan(0.1);
    expect(s[1]).toBeGreaterThan(0.9);
  });

  it('logistic regression stays finite on perfectly separable data thanks to L2', () => {
    const X = rowsOf([[-1], [-1], [1], [1]]);
    const m = fitLogisticRegression(X, [0, 0, 1, 1], { lambda: 1, classWeight: 'none' });
    expect(Number.isFinite(m.coef[0])).toBe(true);
  });

  it('gaussian naive bayes produces scores in [0,1] that rank classes correctly', () => {
    const X = rowsOf([[-2], [-1.8], [-2.2], [2], [1.9], [2.1]]);
    const m = fitGaussianNb(X, [0, 0, 0, 1, 1, 1]);
    const s = predictScores(m, rowsOf([[-2], [2]]));
    expect(s[0]).toBeLessThan(0.5);
    expect(s[1]).toBeGreaterThan(0.5);
    s.forEach((v) => expect(v >= 0 && v <= 1).toBe(true));
  });
});

describe('End-to-end experiment', () => {
  it('learns the synthetic signal and beats the baselines', () => {
    const ds = syntheticDataset();
    const r = runExperiment(ds, DEFAULT_EXPERIMENT_CONFIG);
    expect(isExperimentError(r)).toBe(false);
    if (isExperimentError(r)) return;
    expect(r.nTrain + r.nTest).toBe(66);
    expect(r.test.rocAuc!).toBeGreaterThan(0.8);
    expect(r.baselines.majority.rocAuc).toBe(0.5);
    expect(r.test.balancedAccuracy!).toBeGreaterThan(r.baselines.majority.balancedAccuracy!);
    expect(r.cv).not.toBeNull();
    expect(r.cv!.folds).toBe(5);
    expect(r.featureWeights!.length).toBe(r.featuresUsed);
    // informative synthetic genes are SYN_GENE_001..008
    const top = r.featureWeights!.slice(0, 4).map((f) => f.feature);
    expect(top.every((f) => /^SYN_GENE_00[1-8]$/.test(f))).toBe(true);
    expect(predictionsToCsv(r).split('\n')).toHaveLength(r.nTest + 1);
  });

  it('is reproducible for a fixed seed', () => {
    const ds = syntheticDataset();
    const a = runExperiment(ds, DEFAULT_EXPERIMENT_CONFIG);
    const b = runExperiment(ds, DEFAULT_EXPERIMENT_CONFIG);
    if (isExperimentError(a) || isExperimentError(b)) throw new Error('unexpected error');
    expect(a.test).toEqual(b.test);
    expect(a.predictions).toEqual(b.predictions);
  });

  it('does not find signal in pure-noise data (no leakage through feature selection)', () => {
    const ds = syntheticDataset({ effectSize: 0, genes: 150, positives: 40, negatives: 40, seed: 99 });
    const r = runExperiment(ds, { ...DEFAULT_EXPERIMENT_CONFIG, preprocess: { ...DEFAULT_EXPERIMENT_CONFIG.preprocess, topK: 20 } });
    if (isExperimentError(r)) throw new Error('unexpected error');
    // With selection done on training data only, held-out AUC on noise should hover near 0.5.
    expect(r.test.rocAuc!).toBeLessThan(0.8);
    expect(r.cv!.rocAuc!.mean).toBeLessThan(0.75);
  });

  it('supports gaussian naive bayes and reports no feature weights for it', () => {
    const r = runExperiment(syntheticDataset(), { ...DEFAULT_EXPERIMENT_CONFIG, model: 'gaussian_nb' });
    if (isExperimentError(r)) throw new Error('unexpected error');
    expect(r.featureWeights).toBeNull();
    expect(r.test.rocAuc!).toBeGreaterThan(0.6);
  });

  it('refuses log2 transform on negative values', () => {
    const ds = syntheticDataset();
    ds.X[0][0] = -1;
    const r = runExperiment(ds, { ...DEFAULT_EXPERIMENT_CONFIG, preprocess: { ...DEFAULT_EXPERIMENT_CONFIG.preprocess, log2Transform: true } });
    expect(isExperimentError(r) && r.error.code).toBe('log_negative_values');
  });

  it('refuses too many model features without selection', () => {
    const ds = syntheticDataset({ genes: 250 });
    const r = runExperiment(ds, { ...DEFAULT_EXPERIMENT_CONFIG, preprocess: { ...DEFAULT_EXPERIMENT_CONFIG.preprocess, topK: 0 } });
    expect(isExperimentError(r) && r.error.code).toBe('too_many_model_features');
  });
});
