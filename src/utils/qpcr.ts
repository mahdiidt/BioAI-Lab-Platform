// qPCR Amplification Efficiency
//
// From a dilution-series standard curve (known dilution/quantity paired
// with the Ct observed at that dilution), fits a linear regression of Ct
// against log10(dilution) and derives amplification efficiency from the
// slope - the standard method used to validate a qPCR assay before relying
// on it for quantification.

export interface StandardCurvePoint {
  /** Dilution factor or starting quantity - must be > 0. Log-transformed internally. */
  dilution: number;
  ct: number;
}

export interface LinearRegressionResult {
  slope: number;
  intercept: number;
  r2: number;
}

export type EfficiencyVerdict = 'ideal' | 'acceptable' | 'poor';

export interface QpcrEfficiencyResult {
  isValid: boolean;
  errorMessage?: string;
  slope: number;
  intercept: number;
  r2: number;
  efficiencyPercent: number;
  verdict: EfficiencyVerdict;
  /** log10(dilution), ct pairs actually used for the fit - handy for plotting. */
  fittedPoints: { x: number; y: number }[];
}

const MIN_POINTS = 3;

export function linearRegression(points: { x: number; y: number }[]): LinearRegressionResult {
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  let ssXY = 0;
  let ssXX = 0;
  let ssYY = 0;
  for (const p of points) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    ssXY += dx * dy;
    ssXX += dx * dx;
    ssYY += dy * dy;
  }

  const slope = ssXX !== 0 ? ssXY / ssXX : 0;
  const intercept = meanY - slope * meanX;
  const r2 = ssXX !== 0 && ssYY !== 0 ? (ssXY * ssXY) / (ssXX * ssYY) : 0;

  return { slope, intercept, r2 };
}

function classifyEfficiency(efficiencyPercent: number): EfficiencyVerdict {
  if (efficiencyPercent >= 90 && efficiencyPercent <= 110) return 'ideal';
  if ((efficiencyPercent >= 80 && efficiencyPercent < 90) || (efficiencyPercent > 110 && efficiencyPercent <= 120)) return 'acceptable';
  return 'poor';
}

export function calculateQpcrEfficiency(points: StandardCurvePoint[]): QpcrEfficiencyResult {
  const empty = { slope: 0, intercept: 0, r2: 0, efficiencyPercent: 0, verdict: 'poor' as EfficiencyVerdict, fittedPoints: [] };

  if (points.length < MIN_POINTS) {
    return {
      isValid: false,
      errorMessage: `At least ${MIN_POINTS} standard curve points are required to fit a line.`,
      ...empty,
    };
  }

  if (points.some((p) => p.dilution <= 0)) {
    return {
      isValid: false,
      errorMessage: 'Dilution / quantity values must be greater than 0 (they are log-transformed).',
      ...empty,
    };
  }

  if (points.some((p) => p.ct <= 0)) {
    return {
      isValid: false,
      errorMessage: 'Ct values must be greater than 0.',
      ...empty,
    };
  }

  const fittedPoints = points.map((p) => ({ x: Math.log10(p.dilution), y: p.ct }));
  const { slope, intercept, r2 } = linearRegression(fittedPoints);

  if (slope === 0) {
    return {
      isValid: false,
      errorMessage: 'Ct values do not change across dilutions (slope is zero) - efficiency cannot be calculated from flat data.',
      ...empty,
      fittedPoints,
    };
  }

  const efficiencyPercent = (Math.pow(10, -1 / slope) - 1) * 100;

  if (!Number.isFinite(efficiencyPercent) || efficiencyPercent < 0) {
    return {
      isValid: false,
      errorMessage: 'The fitted slope produced a non-physical efficiency value - check that Ct decreases as dilution/quantity increases.',
      slope,
      intercept,
      r2,
      efficiencyPercent: 0,
      verdict: 'poor',
      fittedPoints,
    };
  }

  return {
    isValid: true,
    slope,
    intercept,
    r2,
    efficiencyPercent,
    verdict: classifyEfficiency(efficiencyPercent),
    fittedPoints,
  };
}
