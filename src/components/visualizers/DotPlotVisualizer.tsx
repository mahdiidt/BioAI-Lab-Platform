import { describe, it, expect } from 'vitest';
import { computeDotPlot, DOTPLOT_MAX_LENGTH } from '../dotplot';

// Deterministic PRNG so the tests never flake.
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randSeq(n: number, r: () => number) {
  let s = '';
  for (let i = 0; i < n; i++) s += 'ACGT'[Math.floor(r() * 4)];
  return s;
}
function revComp(s: string) {
  const m: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C' };
  return s.split('').reverse().map((c) => m[c]).join('');
}

describe('dotplot — basics', () => {
  it('rejects sequences shorter than 5', () => {
    const res = computeDotPlot('ACG', 'ACGTACGT', 'a', 'b');
    expect(res.isValid).toBe(false);
    expect(res.errorCode).toBe('too_short');
  });

  it('self comparison produces a main-diagonal region and full-length diagonal', () => {
    const s = randSeq(300, rng(1));
    const res = computeDotPlot(s, s, 'a', 'a', 11, 0.9, false);
    expect(res.isValid).toBe(true);
    expect(res.stats.selfComparison).toBe(true);
    expect(res.regions.some((r) => r.type === 'diagonal')).toBe(true);
    expect(res.stats.longestDiagonal).toBeGreaterThanOrEqual(290);
  });

  it('detects an inverted repeat (reverse complement) as anti-diagonal dots', () => {
    const r = rng(2);
    const block = randSeq(120, r);
    const a = randSeq(100, r) + block + randSeq(100, r);
    const b = randSeq(80, r) + revComp(block) + randSeq(120, r);
    const res = computeDotPlot(a, b, 'a', 'b', 11, 0.9, true);
    expect(res.stats.longestAntiDiag).toBeGreaterThanOrEqual(100);
    expect(res.regions.some((x) => x.type === 'inverted_repeat')).toBe(true);
  });
});

describe('dotplot — regression: downsampled long sequences must not miss repeats', () => {
  // Previously both axes were subsampled with the same step, so only diagonals
  // whose offset was a multiple of the step ever produced dots. A 1 kb shared
  // block at any other offset vanished (9 dots instead of ~250).
  for (const pad of [100, 99, 101, 102, 103]) {
    it(`finds a 1000 bp shared block with offset ${500 - pad} in 3 kb sequences`, () => {
      const r = rng(10 + pad);
      const a = randSeq(3000, r);
      const shared = a.slice(500, 1500);
      const b = randSeq(pad, r) + shared + randSeq(3000 - pad - 1000, r);
      const res = computeDotPlot(a, b, 'a', 'b', 11, 0.9, false, 800);
      expect(res.isValid).toBe(true);
      expect(res.stats.longestDiagonal).toBeGreaterThanOrEqual(900);
      expect(res.regions.some((x) => x.type === 'direct_repeat')).toBe(true);
    });
  }
});

describe('dotplot — safety caps (regression: unbounded input froze the tab)', () => {
  it('rejects sequences over the length cap', () => {
    const res = computeDotPlot('A'.repeat(DOTPLOT_MAX_LENGTH + 1), 'ACGTACGTACGT', 'a', 'b');
    expect(res.isValid).toBe(false);
    expect(res.errorCode).toBe('too_long');
  });

  it('aborts with too_dense instead of building millions of dots', () => {
    const r = rng(7);
    const a = randSeq(3000, r);
    const b = randSeq(3000, r);
    // window 1 / threshold 0.3 makes ~25% of all cells "hits" (~2M dots)
    const started = Date.now();
    const res = computeDotPlot(a, b, 'a', 'b', 1, 0.3, true, 800);
    expect(res.isValid).toBe(false);
    expect(res.errorCode).toBe('too_dense');
    expect(Date.now() - started).toBeLessThan(5000);
  });
});
