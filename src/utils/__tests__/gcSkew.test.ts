import { describe, it, expect } from 'vitest';
import { analyzeGcSkew, parseFastaGC } from '../gcSkew';

describe('gcSkew — parsing and validation', () => {
  it('rejects sequences shorter than 50 nt', () => {
    const res = analyzeGcSkew('ACGT'.repeat(5), 'x');
    expect(res.isValid).toBe(false);
    expect(res.errorCode).toBe('too_short');
  });

  it('parses FASTA and plain sequences', () => {
    expect(parseFastaGC('>a\nACGT\nACGT')[0]).toEqual({ name: 'a', sequence: 'ACGTACGT' });
    expect(parseFastaGC('acgtacgt')[0].sequence).toBe('ACGTACGT');
  });
});

describe('gcSkew — biology', () => {
  it('computes overall GC content', () => {
    const res = analyzeGcSkew('GC'.repeat(50) + 'AT'.repeat(50), 'x', 50, 10);
    expect(res.isValid).toBe(true);
    expect(res.stats.overallGC).toBeCloseTo(0.5, 5);
  });

  it('places the cumulative-skew maximum (terminus) where G-rich turns C-rich', () => {
    // G > C for the first half, C > G for the second: cumulative skew rises
    // then falls, so its maximum sits at the switch (~position 5000).
    const gRich = 'GGGA'.repeat(1250); // 5000 nt, skew +1
    const cRich = 'CCCA'.repeat(1250); // 5000 nt, skew -1
    const res = analyzeGcSkew(gRich + cRich, 'x', 200, 50);
    const ter = res.landmarks.find((l) => l.type === 'ter');
    expect(ter).toBeDefined();
    expect(Math.abs(ter!.position - 5000)).toBeLessThan(300);
  });
});

describe('gcSkew — safety cap (regression: step 1 on a genome froze the tab)', () => {
  it('never produces more than ~20,000 windows and reports the step actually used', () => {
    const seq = 'ACGT'.repeat(250_000); // 1 Mb
    const started = Date.now();
    const res = analyzeGcSkew(seq, 'x', 500, 1);
    expect(res.isValid).toBe(true);
    expect(res.dataPoints.length).toBeLessThanOrEqual(20001);
    expect(res.stepSize).toBeGreaterThan(1);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it('keeps the requested step when it is already coarse enough', () => {
    const res = analyzeGcSkew('ACGT'.repeat(1000), 'x', 100, 100);
    expect(res.stepSize).toBe(100);
  });
});
