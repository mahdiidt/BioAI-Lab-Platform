// Numerical helper functions (Lanczos log-gamma, incomplete beta via
// continued fraction, incomplete gamma via series/continued fraction).
// These are the standard Numerical-Recipes-style implementations used
// throughout scientific computing for exact-enough p-value calculation
// without a heavy statistics dependency.

function logGamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function betaContinuedFraction(x: number, a: number, b: number): number {
  const MAXIT = 200;
  const EPS = 3e-7;
  const FPMIN = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta function I_x(a, b), 0 <= x <= 1. */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
  );
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betaContinuedFraction(x, a, b)) / a;
  }
  return 1 - (bt * betaContinuedFraction(1 - x, b, a)) / b;
}

function gammaSeries(a: number, x: number): number {
  const ITMAX = 200;
  const EPS = 3e-7;
  if (x <= 0) return 0;
  let ap = a;
  let sum = 1 / a;
  let del = sum;
  for (let n = 1; n <= ITMAX; n++) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * EPS) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

function gammaContinuedFraction(a: number, x: number): number {
  const ITMAX = 200;
  const EPS = 3e-7;
  const FPMIN = 1e-30;
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= ITMAX; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** Regularized lower incomplete gamma function P(a, x). */
function lowerIncompleteGammaRegularized(a: number, x: number): number {
  if (x < 0 || a <= 0) return NaN;
  if (x === 0) return 0;
  if (x < a + 1) return gammaSeries(a, x);
  return 1 - gammaContinuedFraction(a, x);
}

/** Two-tailed p-value for Student's t-distribution. */
export function tDistributionPValue(t: number, df: number): number {
  if (df <= 0) return NaN;
  const x = df / (df + t * t);
  return Math.max(0, Math.min(1, incompleteBeta(x, df / 2, 0.5)));
}

/** Upper-tail p-value for the chi-square distribution. */
export function chiSquarePValue(chiSquare: number, df: number): number {
  if (chiSquare < 0 || df <= 0) return NaN;
  if (chiSquare === 0) return 1;
  const p = lowerIncompleteGammaRegularized(df / 2, chiSquare / 2);
  return Math.max(0, Math.min(1, 1 - p));
}

// ---------------------------------------------------------------------
// Descriptive statistics helpers
// ---------------------------------------------------------------------

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** Sample variance (n-1 denominator, Bessel's correction). */
function sampleVariance(arr: number[], m: number): number {
  if (arr.length < 2) return NaN;
  return arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
}

// ---------------------------------------------------------------------
// t-tests
// ---------------------------------------------------------------------

export interface OneSampleTTestResult {
  isValid: boolean;
  errorMessage?: string;
  n?: number;
  mean?: number;
  sd?: number;
  se?: number;
  t?: number;
  df?: number;
  pValue?: number;
  populationMean?: number;
}

export function oneSampleTTest(sample: number[], populationMean: number): OneSampleTTestResult {
  const clean = sample.filter((v) => Number.isFinite(v));
  if (clean.length < 2) {
    return { isValid: false, errorMessage: 'Sample needs at least 2 numeric data points.' };
  }
  if (!Number.isFinite(populationMean)) {
    return { isValid: false, errorMessage: 'Population mean (H0) must be a valid number.' };
  }

  const m = mean(clean);
  const variance = sampleVariance(clean, m);
  const sd = Math.sqrt(variance);
  const n = clean.length;
  const se = sd / Math.sqrt(n);

  if (se === 0) {
    return { isValid: false, errorMessage: 'Sample has zero variance (all values identical) — t cannot be computed.' };
  }

  const t = (m - populationMean) / se;
  const df = n - 1;
  const pValue = tDistributionPValue(t, df);

  return { isValid: true, n, mean: m, sd, se, t, df, pValue, populationMean };
}

export interface TwoSampleTTestResult {
  isValid: boolean;
  errorMessage?: string;
  nA?: number;
  nB?: number;
  meanA?: number;
  meanB?: number;
  sdA?: number;
  sdB?: number;
  t?: number;
  df?: number;
  pValue?: number;
  equalVariance?: boolean;
}

/**
 * Two-sample independent t-test. Uses Welch's t-test (unequal variance)
 * by default, which is the generally-recommended default since it does
 * not assume the two groups have equal population variance.
 */
export function twoSampleTTest(
  sampleA: number[],
  sampleB: number[],
  equalVariance = false
): TwoSampleTTestResult {
  const a = sampleA.filter((v) => Number.isFinite(v));
  const b = sampleB.filter((v) => Number.isFinite(v));

  if (a.length < 2 || b.length < 2) {
    return { isValid: false, errorMessage: 'Each group needs at least 2 numeric data points.' };
  }

  const nA = a.length;
  const nB = b.length;
  const meanA = mean(a);
  const meanB = mean(b);
  const varA = sampleVariance(a, meanA);
  const varB = sampleVariance(b, meanB);

  let t: number;
  let df: number;

  if (equalVariance) {
    const pooledVar = ((nA - 1) * varA + (nB - 1) * varB) / (nA + nB - 2);
    const se = Math.sqrt(pooledVar * (1 / nA + 1 / nB));
    if (se === 0) {
      return { isValid: false, errorMessage: 'Both groups have zero variance — t cannot be computed.' };
    }
    t = (meanA - meanB) / se;
    df = nA + nB - 2;
  } else {
    const se = Math.sqrt(varA / nA + varB / nB);
    if (se === 0) {
      return { isValid: false, errorMessage: 'Both groups have zero variance — t cannot be computed.' };
    }
    t = (meanA - meanB) / se;
    const num = (varA / nA + varB / nB) ** 2;
    const den = (varA / nA) ** 2 / (nA - 1) + (varB / nB) ** 2 / (nB - 1);
    df = den === 0 ? nA + nB - 2 : num / den;
  }

  const pValue = tDistributionPValue(t, df);

  return {
    isValid: true,
    nA,
    nB,
    meanA,
    meanB,
    sdA: Math.sqrt(varA),
    sdB: Math.sqrt(varB),
    t,
    df,
    pValue,
    equalVariance,
  };
}

// ---------------------------------------------------------------------
// Chi-square tests
// ---------------------------------------------------------------------

export interface ChiSquareGoodnessOfFitResult {
  isValid: boolean;
  errorMessage?: string;
  chiSquare?: number;
  df?: number;
  pValue?: number;
  observed?: number[];
  expected?: number[];
}

export function chiSquareGoodnessOfFit(observed: number[], expected: number[]): ChiSquareGoodnessOfFitResult {
  if (observed.length !== expected.length) {
    return { isValid: false, errorMessage: 'Observed and expected lists must have the same number of categories.' };
  }
  if (observed.length < 2) {
    return { isValid: false, errorMessage: 'Need at least 2 categories.' };
  }
  if (expected.some((e) => !Number.isFinite(e) || e <= 0)) {
    return { isValid: false, errorMessage: 'All expected values must be positive numbers.' };
  }
  if (observed.some((o) => !Number.isFinite(o) || o < 0)) {
    return { isValid: false, errorMessage: 'Observed counts cannot be negative.' };
  }

  let chiSquare = 0;
  for (let i = 0; i < observed.length; i++) {
    chiSquare += (observed[i] - expected[i]) ** 2 / expected[i];
  }

  const df = observed.length - 1;
  const pValue = chiSquarePValue(chiSquare, df);

  return { isValid: true, chiSquare, df, pValue, observed, expected };
}

export interface ChiSquareIndependenceResult {
  isValid: boolean;
  errorMessage?: string;
  chiSquare?: number;
  df?: number;
  pValue?: number;
  expectedTable?: number[][];
  rowTotals?: number[];
  colTotals?: number[];
  grandTotal?: number;
}

/** Chi-square test of independence for an R x C contingency table. */
export function chiSquareIndependence(table: number[][]): ChiSquareIndependenceResult {
  const rows = table.length;
  if (rows < 2) {
    return { isValid: false, errorMessage: 'Contingency table needs at least 2 rows.' };
  }
  const cols = table[0].length;
  if (cols < 2) {
    return { isValid: false, errorMessage: 'Contingency table needs at least 2 columns.' };
  }
  if (table.some((r) => r.length !== cols)) {
    return { isValid: false, errorMessage: 'All rows must have the same number of columns.' };
  }
  if (table.some((r) => r.some((v) => !Number.isFinite(v) || v < 0))) {
    return { isValid: false, errorMessage: 'Cell counts must be non-negative numbers.' };
  }

  const rowTotals = table.map((r) => r.reduce((a, b) => a + b, 0));
  const colTotals: number[] = new Array(cols).fill(0);
  for (const r of table) {
    for (let c = 0; c < cols; c++) colTotals[c] += r[c];
  }
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0);

  if (grandTotal === 0) {
    return { isValid: false, errorMessage: 'Table total cannot be zero.' };
  }

  let chiSquare = 0;
  const expectedTable: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const rowExpected: number[] = [];
    for (let j = 0; j < cols; j++) {
      const expected = (rowTotals[i] * colTotals[j]) / grandTotal;
      rowExpected.push(expected);
      if (expected > 0) {
        chiSquare += (table[i][j] - expected) ** 2 / expected;
      }
    }
    expectedTable.push(rowExpected);
  }

  const df = (rows - 1) * (cols - 1);
  const pValue = chiSquarePValue(chiSquare, df);

  return { isValid: true, chiSquare, df, pValue, expectedTable, rowTotals, colTotals, grandTotal };
}
