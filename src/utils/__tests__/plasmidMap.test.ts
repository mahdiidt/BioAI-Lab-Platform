import { describe, it, expect } from 'vitest';
import { analyzePlasmid, bpToAngleDeg, MIN_PLASMID_LENGTH, MAX_PLASMID_LENGTH } from '../plasmidMap';

// A 60 bp synthetic circular construct with exactly one EcoRI site (GAATTC)
// and one BamHI site (GGATCC), used across several tests below.
const SINGLE_CUT_PLASMID =
  'GAATTCAAAACCCCGGGGTTTTAAAACCCCGGGGTTTTAAAACCCCGGGGTTTTGGATCC';

describe('Plasmid Map — restriction site detection', () => {
  it('finds a restriction site that appears exactly once and flags it as a unique cutter', () => {
    const result = analyzePlasmid(SINGLE_CUT_PLASMID, ['EcoRI', 'BamHI']);
    expect(result.isValid).toBe(true);

    const ecoRI = result.enzymeSites.find((s) => s.enzymeName === 'EcoRI');
    expect(ecoRI).toBeDefined();
    expect(ecoRI!.positions).toEqual([1]);
    expect(ecoRI!.isUniqueCutter).toBe(true);

    const bamHI = result.enzymeSites.find((s) => s.enzymeName === 'BamHI');
    expect(bamHI!.isUniqueCutter).toBe(true);
  });

  it('detects a site that spans the circular origin (wraps from the end back to the start)', () => {
    // Rotate the sequence so the EcoRI site straddles the plasmid's 3'/5' junction.
    const rotated = SINGLE_CUT_PLASMID.slice(30) + SINGLE_CUT_PLASMID.slice(0, 30);
    const result = analyzePlasmid(rotated, ['EcoRI']);
    const ecoRI = result.enzymeSites.find((s) => s.enzymeName === 'EcoRI');
    expect(ecoRI).toBeDefined();
    expect(ecoRI!.positions.length).toBe(1);
  });

  it('does not report an enzyme with zero cut sites', () => {
    const noNotI = 'ATCG'.repeat(20); // 80bp, no NotI (GCGGCCGC) present
    const result = analyzePlasmid(noNotI, ['NotI']);
    expect(result.enzymeSites.find((s) => s.enzymeName === 'NotI')).toBeUndefined();
  });

  it('flags an enzyme cutting more than once as NOT a unique cutter', () => {
    const twoCuts = 'GAATTC' + 'A'.repeat(40) + 'GAATTC' + 'A'.repeat(20);
    const result = analyzePlasmid(twoCuts, ['EcoRI']);
    const ecoRI = result.enzymeSites.find((s) => s.enzymeName === 'EcoRI');
    expect(ecoRI!.positions.length).toBe(2);
    expect(ecoRI!.isUniqueCutter).toBe(false);
    expect(result.uniqueCutters.length).toBe(0);
  });
});

describe('Plasmid Map — validation', () => {
  it('rejects a sequence shorter than the minimum plasmid length', () => {
    const result = analyzePlasmid('ATCG', ['EcoRI']);
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toMatch(new RegExp(String(MIN_PLASMID_LENGTH)));
  });

  it('rejects a sequence longer than the maximum supported length', () => {
    const tooLong = 'ATCG'.repeat(Math.ceil((MAX_PLASMID_LENGTH + 100) / 4));
    const result = analyzePlasmid(tooLong, ['EcoRI']);
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toMatch(/too long/i);
  });

  it('rejects a sequence containing IUPAC ambiguity codes', () => {
    const withN = 'ATCGN' + 'ATCG'.repeat(20);
    const result = analyzePlasmid(withN, ['EcoRI']);
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toMatch(/ambiguity|resolved/i);
  });

  it('rejects a sequence with invalid (non-nucleotide) characters', () => {
    const result = analyzePlasmid('ATCGXYZ' + 'ATCG'.repeat(20), ['EcoRI']);
    expect(result.isValid).toBe(false);
  });
});

describe('Plasmid Map — GC content and ORFs', () => {
  it('computes an overall GC content between 0 and 100', () => {
    const result = analyzePlasmid(SINGLE_CUT_PLASMID, []);
    expect(result.gcContentOverall).toBeGreaterThanOrEqual(0);
    expect(result.gcContentOverall).toBeLessThanOrEqual(100);
  });

  it('produces a GC sliding window that tiles the full plasmid with no gaps', () => {
    const result = analyzePlasmid(SINGLE_CUT_PLASMID, []);
    expect(result.gcWindow.length).toBeGreaterThan(0);
    expect(result.gcWindow[0].startBp).toBe(1);
    expect(result.gcWindow[result.gcWindow.length - 1].endBp).toBe(result.length);
  });

  it('detects a simple forward-strand ORF', () => {
    // ATG + 20 sense codons + stop, comfortably over a low minAaLength.
    const orf = 'ATG' + 'GCT'.repeat(20) + 'TAA';
    const padded = orf + 'A'.repeat(Math.max(0, MIN_PLASMID_LENGTH - orf.length + 10));
    const result = analyzePlasmid(padded, [], 10);
    expect(result.orfs.length).toBeGreaterThan(0);
    expect(result.orfs[0].strand).toBe(1);
  });
});

describe('Plasmid Map — angle math', () => {
  it('places bp 1 at the top of the circle (-90 degrees)', () => {
    expect(bpToAngleDeg(1, 1000)).toBeCloseTo(-90, 5);
  });

  it('places the midpoint of the plasmid at the bottom (90 degrees)', () => {
    expect(bpToAngleDeg(501, 1000)).toBeCloseTo(90, 0);
  });

  it('wraps back to (approximately) the start after a full circle', () => {
    const nearEnd = bpToAngleDeg(1000, 1000);
    // One bp before completing the circle should be just under 270 degrees.
    expect(nearEnd).toBeLessThan(270);
    expect(nearEnd).toBeGreaterThan(260);
  });
});
