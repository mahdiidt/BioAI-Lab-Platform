// Binary classification metrics. A metric is returned as null when it is
// mathematically undefined for the given data (never silently 0 or 1).

export interface ConfusionMatrix {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

export interface ClassificationMetrics {
  n: number;
  positives: number;
  negatives: number;
  confusion: ConfusionMatrix;
  accuracy: number | null;
  balancedAccuracy: number | null;
  precision: number | null;
  recall: number | null;
  specificity: number | null;
  f1: number | null;
  rocAuc: number | null;
  /** Codes explaining why a metric is null. */
  undefinedReasons: string[];
}

export function confusionMatrix(yTrue: number[], yPred: number[]): ConfusionMatrix {
  const cm = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (let i = 0; i < yTrue.length; i++) {
    if (yTrue[i] === 1 && yPred[i] === 1) cm.tp++;
    else if (yTrue[i] === 0 && yPred[i] === 1) cm.fp++;
    else if (yTrue[i] === 0 && yPred[i] === 0) cm.tn++;
    else cm.fn++;
  }
  return cm;
}

/** ROC-AUC via the Mann-Whitney U statistic with mid-ranks for ties. Null if only one class is present. */
export function rocAuc(yTrue: number[], scores: number[]): number | null {
  const n1 = yTrue.filter((v) => v === 1).length;
  const n0 = yTrue.length - n1;
  if (n1 === 0 || n0 === 0) return null;
  const order = scores.map((s, i) => ({ s, i })).sort((a, b) => a.s - b.s);
  const ranks = new Array<number>(scores.length);
  let k = 0;
  while (k < order.length) {
    let m = k;
    while (m + 1 < order.length && order[m + 1].s === order[k].s) m++;
    const avg = (k + m) / 2 + 1;
    for (let t = k; t <= m; t++) ranks[order[t].i] = avg;
    k = m + 1;
  }
  let rankSum = 0;
  for (let i = 0; i < yTrue.length; i++) if (yTrue[i] === 1) rankSum += ranks[i];
  return (rankSum - (n1 * (n1 + 1)) / 2) / (n1 * n0);
}

export interface RocPoint {
  fpr: number;
  tpr: number;
  threshold: number;
}

export function rocCurve(yTrue: number[], scores: number[]): RocPoint[] {
  const n1 = yTrue.filter((v) => v === 1).length;
  const n0 = yTrue.length - n1;
  if (n1 === 0 || n0 === 0) return [];
  const order = scores.map((s, i) => ({ s, y: yTrue[i] })).sort((a, b) => b.s - a.s);
  const pts: RocPoint[] = [{ fpr: 0, tpr: 0, threshold: Infinity }];
  let tp = 0;
  let fp = 0;
  let k = 0;
  while (k < order.length) {
    const s = order[k].s;
    while (k < order.length && order[k].s === s) {
      if (order[k].y === 1) tp++;
      else fp++;
      k++;
    }
    pts.push({ fpr: fp / n0, tpr: tp / n1, threshold: s });
  }
  return pts;
}

export function classificationMetrics(yTrue: number[], scores: number[], threshold = 0.5): ClassificationMetrics {
  const yPred = scores.map((s) => (s >= threshold ? 1 : 0));
  const cm = confusionMatrix(yTrue, yPred);
  const n = yTrue.length;
  const positives = cm.tp + cm.fn;
  const negatives = cm.tn + cm.fp;
  const reasons: string[] = [];
  const accuracy = n > 0 ? (cm.tp + cm.tn) / n : null;
  const recall = positives > 0 ? cm.tp / positives : null;
  const specificity = negatives > 0 ? cm.tn / negatives : null;
  const precision = cm.tp + cm.fp > 0 ? cm.tp / (cm.tp + cm.fp) : null;
  if (precision === null) reasons.push('precision_no_positive_predictions');
  if (recall === null) reasons.push('recall_no_positive_samples');
  const f1 = precision !== null && recall !== null && precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : precision === 0 || recall === 0 ? 0 : null;
  const balancedAccuracy = recall !== null && specificity !== null ? (recall + specificity) / 2 : null;
  const auc = rocAuc(yTrue, scores);
  if (auc === null) reasons.push('auc_single_class');
  return {
    n,
    positives,
    negatives,
    confusion: cm,
    accuracy,
    balancedAccuracy,
    precision,
    recall,
    specificity,
    f1,
    rocAuc: auc,
    undefinedReasons: reasons,
  };
}
