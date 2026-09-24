import { describe, it, expect } from 'vitest';
import { linearRegression, calculateQpcrEfficiency, StandardCurvePoint } from '../qpcr';

describe('qPCR — linear regression', () => {
  it('fits a perfect line exactly (R² = 1)', () => {
    const points = [
      { x: 0, y: 20 },
      { x: 1, y: 16.68 },
      { x: 2, y: 13.36 },
      { x: 3, y: 10.04 },
    ];
    const { slope, intercept, r2 } = linearRegression(points);
    expect(slope).toBeCloseTo(-3.32, 1);
    expect(intercept).toBeCloseTo(20, 1);
    expect(r2).toBeCloseTo(1, 5);
  });

  it('gives a low R² for scattered, non-linear data', () => {
    const points = [
      { x: 0, y: 15 },
      { x: 1, y: 28 },
      { x: 2, y: 9 },
      { x: 3, y: 22 },
    ];
    const { r2 } = linearRegression(points);
    expect(r2).toBeLessThan(0.5);
  });
});

describe('qPCR — efficiency calculation', () => {
  it('reports ~100% efficiency for a perfect 10-fold dilution series with slope -3.32', () => {
    const points: StandardCurvePoint[] = [
      { dilution: 1, ct: 20 },
      { dilution: 10, ct: 16.68 },
      { dilution: 100, ct: 13.36 },
      { dilution: 1000, ct: 10.04 },
    ];
    const result = calculateQpcrEfficiency(points);
    expect(result.isValid).toBe(true);
    expect(result.efficiencyPercent).toBeCloseTo(100, 0);
    expect(result.r2).toBeCloseTo(1, 4);
    expect(result.verdict).toBe('ideal');
  });

  it('classifies efficiency below 80% as poor', () => {
    // A steeper-than-ideal slope (-5, vs the ideal -3.32) means each cycle
    // amplifies less than a perfect doubling => low efficiency.
    const points: StandardCurvePoint[] = [
      { dilution: 1, ct: 25 },
      { dilution: 10, ct: 20 },
      { dilution: 100, ct: 15 },
      { dilution: 1000, ct: 10 },
    ];
    const result = calculateQpcrEfficiency(points);
    expect(result.isValid).toBe(true);
    expect(result.verdict).toBe('poor');
    expect(result.efficiencyPercent).toBeLessThan(80);
  });

  it('classifies efficiency in the 90-110% range as ideal', () => {
    const points: StandardCurvePoint[] = [
      { dilution: 1, ct: 18 },
      { dilution: 10, ct: 14.7 },
      { dilution: 100, ct: 11.4 },
      { dilution: 1000, ct: 8.1 },
    ];
    const result = calculateQpcrEfficiency(points);
    expect(result.verdict).toBe('ideal');
  });

  it('rejects fewer than 3 data points', () => {
    const points: StandardCurvePoint[] = [
      { dilution: 1, ct: 20 },
      { dilution: 10, ct: 16.68 },
    ];
    const result = calculateQpcrEfficiency(points);
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toMatch(/at least 3/i);
  });

  it('rejects a non-positive dilution value', () => {
    const points: StandardCurvePoint[] = [
      { dilution: 0, ct: 20 },
      { dilution: 10, ct: 16.68 },
      { dilution: 100, ct: 13.36 },
    ];
    const result = calculateQpcrEfficiency(points);
    expect(result.isValid).toBe(false);
  });

  it('rejects a non-positive Ct value', () => {
    const points: StandardCurvePoint[] = [
      { dilution: 1, ct: 0 },
      { dilution: 10, ct: 16.68 },
      { dilution: 100, ct: 13.36 },
    ];
    const result = calculateQpcrEfficiency(points);
    expect(result.isValid).toBe(false);
  });

  it('returns fitted (log10-transformed) points matching the input count', () => {
    const points: StandardCurvePoint[] = [
      { dilution: 1, ct: 20 },
      { dilution: 10, ct: 16.68 },
      { dilution: 100, ct: 13.36 },
    ];
    const result = calculateQpcrEfficiency(points);
    expect(result.fittedPoints).toHaveLength(3);
    expect(result.fittedPoints[1].x).toBeCloseTo(1, 5); // log10(10) = 1
  });
});
