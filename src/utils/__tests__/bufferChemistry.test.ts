import { describe, it, expect } from 'vitest';
import { calculatePhFromRatio, calculateMixingVolumes, BUFFER_SYSTEMS } from '../bufferChemistry';

describe('Henderson-Hasselbalch: calculatePhFromRatio', () => {
  it('returns pH exactly equal to pKa when [A-] = [HA] (textbook case)', () => {
    // log10(1) = 0, so pH should equal pKa exactly for equal concentrations
    const pH = calculatePhFromRatio(4.76, 0.1, 0.1);
    expect(pH).toBeCloseTo(4.76, 3);
  });

  it('increases pH above pKa when base form dominates', () => {
    const pH = calculatePhFromRatio(7.21, 0.2, 0.1); // ratio = 2
    expect(pH).toBeCloseTo(7.21 + Math.log10(2), 3);
    expect(pH).toBeGreaterThan(7.21);
  });

  it('decreases pH below pKa when acid form dominates', () => {
    const pH = calculatePhFromRatio(8.06, 0.1, 0.4); // ratio = 0.25
    expect(pH).toBeCloseTo(8.06 + Math.log10(0.25), 3);
    expect(pH).toBeLessThan(8.06);
  });

  it('rejects non-positive base concentration', () => {
    expect(() => calculatePhFromRatio(4.76, 0, 0.1)).toThrow();
    expect(() => calculatePhFromRatio(4.76, -0.1, 0.1)).toThrow();
  });

  it('rejects non-positive acid concentration', () => {
    expect(() => calculatePhFromRatio(4.76, 0.1, 0)).toThrow();
    expect(() => calculatePhFromRatio(4.76, 0.1, -0.1)).toThrow();
  });

  it('rejects pKa outside 0-14', () => {
    expect(() => calculatePhFromRatio(-1, 0.1, 0.1)).toThrow();
    expect(() => calculatePhFromRatio(15, 0.1, 0.1)).toThrow();
  });
});

describe('Henderson-Hasselbalch: calculateMixingVolumes', () => {
  it('splits volume evenly when target pH equals pKa', () => {
    const res = calculateMixingVolumes(7.21, 7.21, 0.5, 100);
    expect(res.acidVolumeMl).toBeCloseTo(50, 1);
    expect(res.baseVolumeMl).toBeCloseTo(50, 1);
    expect(res.percentIonized).toBeCloseTo(50, 1);
    expect(res.bufferingCapacityWarning).toBeNull();
  });

  it('acid + base volumes always sum to total volume', () => {
    const res = calculateMixingVolumes(4.76, 5.3, 0.1, 250);
    expect(res.acidVolumeMl + res.baseVolumeMl).toBeCloseTo(250, 2);
  });

  it('round-trips: feeding the output volumes back into calculatePhFromRatio recovers the target pH', () => {
    const pKa = 6.35;
    const targetPh = 6.9;
    const res = calculateMixingVolumes(pKa, targetPh, 0.2, 500);
    const recoveredPh = calculatePhFromRatio(pKa, res.baseVolumeMl, res.acidVolumeMl);
    expect(recoveredPh).toBeCloseTo(targetPh, 2);
  });

  it('round-trips for a pH below the pKa as well', () => {
    const pKa = 8.06;
    const targetPh = 7.4;
    const res = calculateMixingVolumes(pKa, targetPh, 1, 1000);
    const recoveredPh = calculatePhFromRatio(pKa, res.baseVolumeMl, res.acidVolumeMl);
    expect(recoveredPh).toBeCloseTo(targetPh, 2);
  });

  it('flags a buffering capacity warning when target pH is more than 1 unit from pKa', () => {
    const res = calculateMixingVolumes(4.76, 6.5, 0.1, 100);
    expect(res.bufferingCapacityWarning).not.toBeNull();
  });

  it('does not flag a warning when target pH is within pKa ± 1', () => {
    const res = calculateMixingVolumes(4.76, 5.5, 0.1, 100);
    expect(res.bufferingCapacityWarning).toBeNull();
  });

  it('rejects non-positive total concentration', () => {
    expect(() => calculateMixingVolumes(7.21, 7.21, 0, 100)).toThrow();
    expect(() => calculateMixingVolumes(7.21, 7.21, -0.5, 100)).toThrow();
  });

  it('rejects non-positive total volume', () => {
    expect(() => calculateMixingVolumes(7.21, 7.21, 0.5, 0)).toThrow();
    expect(() => calculateMixingVolumes(7.21, 7.21, 0.5, -10)).toThrow();
  });

  it('rejects target pH outside 0-14', () => {
    expect(() => calculateMixingVolumes(7.21, -1, 0.5, 100)).toThrow();
    expect(() => calculateMixingVolumes(7.21, 20, 0.5, 100)).toThrow();
  });
});

describe('BUFFER_SYSTEMS', () => {
  it('contains at least the five common systems plus a custom option', () => {
    const ids = BUFFER_SYSTEMS.map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(['acetate', 'citrate', 'phosphate', 'tris', 'bicarbonate', 'custom']));
  });

  it('every listed pKa is within the valid 0-14 range', () => {
    for (const system of BUFFER_SYSTEMS) {
      expect(system.pKa).toBeGreaterThanOrEqual(0);
      expect(system.pKa).toBeLessThanOrEqual(14);
    }
  });
});
