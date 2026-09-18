import { describe, it, expect } from 'vitest';
import { predictSecondaryStructure, P_ALPHA, P_BETA, P_TURN } from '../secondaryStructure';

describe('Chou-Fasman — propensity tables', () => {
  it('has all 20 standard amino acids in every table', () => {
    const aas = 'ACDEFGHIKLMNPQRSTVWY'.split('');
    for (const aa of aas) {
      expect(P_ALPHA[aa]).toBeGreaterThan(0);
      expect(P_BETA[aa]).toBeGreaterThan(0);
      expect(P_TURN[aa]).toBeGreaterThan(0);
    }
  });

  it('gives glutamate (E) the highest helix propensity, as in the original paper', () => {
    const maxAa = Object.entries(P_ALPHA).sort((a, b) => b[1] - a[1])[0][0];
    expect(maxAa).toBe('E');
  });

  it('gives valine (V) the highest sheet propensity, as in the original paper', () => {
    const maxAa = Object.entries(P_BETA).sort((a, b) => b[1] - a[1])[0][0];
    expect(maxAa).toBe('V');
  });
});

describe('Chou-Fasman — prediction behavior', () => {
  it('predicts a strong helix region for a poly-Ala/Glu/Leu/Met stretch (classic high-propensity helix formers)', () => {
    const helixLike = 'MEEEAALLAAMMEELLAAEEMMLLAAEEMM' + 'GPGPGP'; // helix-forming core + a clear breaker tail
    const result = predictSecondaryStructure(helixLike);
    expect(result.isValid).toBe(true);
    expect(result.helixPercent).toBeGreaterThan(0);
  });

  it('predicts a strong sheet region for a poly-Val/Ile/Tyr stretch (classic high-propensity sheet formers)', () => {
    const sheetLike = 'VVIIYYVVIIYYVVIIYYVVIIYY' + 'GPGPGP';
    const result = predictSecondaryStructure(sheetLike);
    expect(result.isValid).toBe(true);
    expect(result.sheetPercent).toBeGreaterThan(0);
  });

  it('classifies a low-propensity Gly/Pro-rich sequence as mostly coil', () => {
    const coilLike = 'GPGPGPGPGPGPGPGPGPGPGPGPGPGPGPGP';
    const result = predictSecondaryStructure(coilLike);
    expect(result.isValid).toBe(true);
    expect(result.coilPercent).toBeGreaterThan(50);
  });

  it('reports helix + sheet + coil percentages summing to ~100%', () => {
    const seq = 'MEEEAALLAAMMEELLAAEEMMLLAAEEMMVVIIYYVVIIYYGPGPGPSSSSNNNN';
    const result = predictSecondaryStructure(seq);
    const total = result.helixPercent + result.sheetPercent + result.coilPercent;
    expect(total).toBeCloseTo(100, 5);
  });

  it('produces a structure array with one entry per residue', () => {
    const seq = 'MEEEAALLAAMMEELLAAEEMMLLAAEEMM';
    const result = predictSecondaryStructure(seq);
    expect(result.structure.length).toBe(result.length);
    expect(result.structure.length).toBe(seq.length);
  });

  it('segments the structure array into contiguous, non-overlapping runs covering the full sequence', () => {
    const seq = 'MEEEAALLAAMMEELLAAEEMMLLAAEEMMVVIIYYVVIIYYGPGPGPSSSSNNNN';
    const result = predictSecondaryStructure(seq);
    let covered = 0;
    for (const seg of result.segments) {
      expect(seg.end).toBeGreaterThanOrEqual(seg.start);
      covered += seg.end - seg.start + 1;
    }
    expect(covered).toBe(result.length);
  });
});

describe('Chou-Fasman — validation', () => {
  it('rejects a sequence shorter than the minimum length', () => {
    const result = predictSecondaryStructure('MEEAAL');
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toMatch(/short/i);
  });

  it('rejects a sequence containing ambiguity codes like X', () => {
    const result = predictSecondaryStructure('MEEEAALLAAXMMEELLAAEEMMLLAAEEMM');
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toMatch(/standard amino acids|invalid character/i);
  });

  it('rejects an empty or whitespace-only sequence', () => {
    const result = predictSecondaryStructure('   ');
    expect(result.isValid).toBe(false);
  });
});
