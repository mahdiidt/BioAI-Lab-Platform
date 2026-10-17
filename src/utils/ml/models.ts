// Classifiers for standardized numeric features. Both return a score in [0,1]
// for the positive class. Scores are model outputs, NOT calibrated
// probabilities and NOT a person's risk of developing cancer.

export type ModelKind = 'logistic_regression' | 'gaussian_nb';

export interface LogisticModel {
  kind: 'logistic_regression';
  intercept: number;
  coef: Float64Array;
  iterations: number;
  converged: boolean;
}

export interface GaussianNbModel {
  kind: 'gaussian_nb';
  logPrior: [number, number];
  mean: [Float64Array, Float64Array];
  variance: [Float64Array, Float64Array];
}

export type TrainedModel = LogisticModel | GaussianNbModel;

export interface LogisticOptions {
  /** L2 penalty strength (intercept is not penalized). */
  lambda: number;
  /** 'balanced' re-weights samples by n / (2 * n_class). */
  classWeight: 'none' | 'balanced';
  maxIter?: number;
  tol?: number;
}

const sigmoid = (z: number) => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)));

function sampleWeights(y: number[], mode: 'none' | 'balanced'): number[] {
  if (mode === 'none') return y.map(() => 1);
  const n = y.length;
  const n1 = y.reduce((s, v) => s + v, 0);
  const n0 = n - n1;
  return y.map((v) => (v === 1 ? n / (2 * Math.max(n1, 1)) : n / (2 * Math.max(n0, 1))));
}

/** Solves A x = b for symmetric positive-definite A (row-major, size d*d) via Cholesky. */
export function choleskySolve(A: Float64Array, b: Float64Array, d: number): Float64Array | null {
  const L = new Float64Array(d * d);
  for (let i = 0; i < d; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A[i * d + j];
      for (let k = 0; k < j; k++) sum -= L[i * d + k] * L[j * d + k];
      if (i === j) {
        if (!(sum > 0)) return null;
        L[i * d + i] = Math.sqrt(sum);
      } else {
        L[i * d + j] = sum / L[j * d + j];
      }
    }
  }
  const z = new Float64Array(d);
  for (let i = 0; i < d; i++) {
    let s = b[i];
    for (let k = 0; k < i; k++) s -= L[i * d + k] * z[k];
    z[i] = s / L[i * d + i];
  }
  const x = new Float64Array(d);
  for (let i = d - 1; i >= 0; i--) {
    let s = z[i];
    for (let k = i + 1; k < d; k++) s -= L[k * d + i] * x[k];
    x[i] = s / L[i * d + i];
  }
  return x;
}

function penalizedLoss(X: Float64Array[], y: number[], w: number[], beta: Float64Array, lambda: number): number {
  const p = beta.length - 1;
  let loss = 0;
  for (let i = 0; i < X.length; i++) {
    let z = beta[0];
    for (let j = 0; j < p; j++) z += beta[j + 1] * X[i][j];
    // numerically stable log(1 + exp(z)) - y*z
    const l = Math.max(z, 0) + Math.log1p(Math.exp(-Math.abs(z))) - y[i] * z;
    loss += w[i] * l;
  }
  let pen = 0;
  for (let j = 1; j <= p; j++) pen += beta[j] * beta[j];
  return loss + 0.5 * lambda * pen;
}

/**
 * L2-regularised logistic regression fitted by Newton-Raphson (IRLS) with
 * step halving. Deterministic: same data -> same coefficients.
 */
export function fitLogisticRegression(X: Float64Array[], y: number[], opts: LogisticOptions): LogisticModel {
  const n = X.length;
  const p = n > 0 ? X[0].length : 0;
  const d = p + 1;
  const lambda = Math.max(opts.lambda, 1e-6);
  const maxIter = opts.maxIter ?? 50;
  const tol = opts.tol ?? 1e-7;
  const w = sampleWeights(y, opts.classWeight);
  const beta = new Float64Array(d);
  let converged = false;
  let iter = 0;
  let loss = penalizedLoss(X, y, w, beta, lambda);

  for (iter = 1; iter <= maxIter; iter++) {
    const grad = new Float64Array(d);
    const H = new Float64Array(d * d);
    const xi = new Float64Array(d);
    for (let i = 0; i < n; i++) {
      xi[0] = 1;
      for (let j = 0; j < p; j++) xi[j + 1] = X[i][j];
      let z = 0;
      for (let j = 0; j < d; j++) z += beta[j] * xi[j];
      const mu = sigmoid(z);
      const r = w[i] * (mu - y[i]);
      const s = w[i] * Math.max(mu * (1 - mu), 1e-10);
      for (let a = 0; a < d; a++) {
        grad[a] += r * xi[a];
        const sa = s * xi[a];
        for (let b = 0; b <= a; b++) H[a * d + b] += sa * xi[b];
      }
    }
    for (let a = 0; a < d; a++) for (let b = 0; b < a; b++) H[b * d + a] = H[a * d + b];
    for (let j = 1; j < d; j++) {
      grad[j] += lambda * beta[j];
      H[j * d + j] += lambda;
    }
    H[0] += 1e-8;
    const step = choleskySolve(H, grad, d);
    if (!step) break;
    let t = 1;
    let next = new Float64Array(d);
    let nextLoss = Infinity;
    for (let h = 0; h < 30; h++) {
      for (let j = 0; j < d; j++) next[j] = beta[j] - t * step[j];
      nextLoss = penalizedLoss(X, y, w, next, lambda);
      if (nextLoss <= loss + 1e-12) break;
      t *= 0.5;
    }
    let maxDelta = 0;
    for (let j = 0; j < d; j++) maxDelta = Math.max(maxDelta, Math.abs(next[j] - beta[j]));
    beta.set(next);
    const improvement = loss - nextLoss;
    loss = nextLoss;
    if (maxDelta < tol || Math.abs(improvement) < tol * (1 + Math.abs(loss))) {
      converged = true;
      break;
    }
  }
  return { kind: 'logistic_regression', intercept: beta[0], coef: beta.slice(1), iterations: Math.min(iter, maxIter), converged };
}

/** Gaussian Naive Bayes with variance smoothing (as in common implementations). */
export function fitGaussianNb(X: Float64Array[], y: number[]): GaussianNbModel {
  const p = X.length > 0 ? X[0].length : 0;
  const mean: [Float64Array, Float64Array] = [new Float64Array(p), new Float64Array(p)];
  const variance: [Float64Array, Float64Array] = [new Float64Array(p), new Float64Array(p)];
  const counts = [0, 0];
  X.forEach((row, i) => {
    const c = y[i];
    counts[c]++;
    for (let j = 0; j < p; j++) mean[c][j] += row[j];
  });
  for (const c of [0, 1]) for (let j = 0; j < p; j++) mean[c][j] /= Math.max(counts[c], 1);
  X.forEach((row, i) => {
    const c = y[i];
    for (let j = 0; j < p; j++) variance[c][j] += (row[j] - mean[c][j]) ** 2;
  });
  let maxVar = 0;
  for (const c of [0, 1]) for (let j = 0; j < p; j++) {
    variance[c][j] /= Math.max(counts[c], 1);
    maxVar = Math.max(maxVar, variance[c][j]);
  }
  const eps = 1e-9 * Math.max(maxVar, 1) + 1e-9;
  for (const c of [0, 1]) for (let j = 0; j < p; j++) variance[c][j] += eps;
  const n = counts[0] + counts[1];
  return {
    kind: 'gaussian_nb',
    logPrior: [Math.log(Math.max(counts[0], 1) / n), Math.log(Math.max(counts[1], 1) / n)],
    mean,
    variance,
  };
}

export function predictScores(model: TrainedModel, X: Float64Array[]): number[] {
  if (model.kind === 'logistic_regression') {
    return X.map((row) => {
      let z = model.intercept;
      for (let j = 0; j < row.length; j++) z += model.coef[j] * row[j];
      return sigmoid(z);
    });
  }
  return X.map((row) => {
    const ll = [model.logPrior[0], model.logPrior[1]];
    for (const c of [0, 1]) {
      for (let j = 0; j < row.length; j++) {
        const v = model.variance[c][j];
        ll[c] += -0.5 * Math.log(2 * Math.PI * v) - ((row[j] - model.mean[c][j]) ** 2) / (2 * v);
      }
    }
    const m = Math.max(ll[0], ll[1]);
    const e0 = Math.exp(ll[0] - m);
    const e1 = Math.exp(ll[1] - m);
    return e1 / (e0 + e1);
  });
}
