import { describe, it, expect } from 'vitest';
import { buildPWM, getConsensus, getTotalIC, discoverMotifs, analyzeAlignedMotif } from '../motifDiscovery';

describe('motifDiscovery — buildPWM / consensus / information content', () => {
  it('builds a fully conserved PWM with max information content at every position', () => {
    const seqs = ['ATGC', 'ATGC', 'ATGC', 'ATGC'];
    const pwm = buildPWM(seqs, 'DNA', 0.01);
    expect(pwm).toHaveLength(4);
    expect(getConsensus(pwm)).toBe('ATGC');
    // Each position is 100% conserved, so IC should be close to the DNA max (2 bits).
    for (const p of pwm) {
      expect(p.informationContent).toBeGreaterThan(1.9);
    }
    expect(getTotalIC(pwm)).toBeGreaterThan(4 * 1.9);
  });

  it('gives low information content at a fully degenerate position', () => {
    const seqs = ['A', 'C', 'G', 'T'];
    const pwm = buildPWM(seqs, 'DNA', 0.01);
    expect(pwm[0].informationContent).toBeLessThan(0.1);
  });
});

describe('motifDiscovery — analyzeAlignedMotif', () => {
  it('rejects fewer than 2 sequences', () => {
    const res = analyzeAlignedMotif(['ATGC']);
    expect(res.isValid).toBe(false);
  });

  it('produces a consensus, PWM, and all three export formats for aligned DNA', () => {
    const res = analyzeAlignedMotif(['ATGCGA', 'ATGCGA', 'ATGCCA', 'ATGCGA'], 'DNA');
    expect(res.isValid).toBe(true);
    expect(res.consensus).toBe('ATGCGA');
    expect(res.motifLength).toBe(6);
    expect(res.jasparMatrix).toContain('>ATGCGA');
    expect(res.memeMotif).toContain('MEME version 5');
    expect(res.transfacMatrix).toContain('ID ATGCGA');
  });
});

describe('motifDiscovery — discoverMotifs', () => {
  it('rejects fewer than 2 usable sequences', () => {
    const res = discoverMotifs(['ATGCATGC'], 6);
    expect(res.isValid).toBe(false);
  });

  it('finds a motif shared across unaligned sequences with flanking noise', () => {
    const seqs = [
      'CGATCGATGCGATCGATCG',
      'TATATGCGATCGCCCGAT',
      'ATGCGATCGATCGATCGA',
      'CCCATGCGATCGAATTTT',
      'GGATGCGATCGATGATCG',
    ];
    const res = discoverMotifs(seqs, 8, 1, 5);
    expect(res.isValid).toBe(true);
    expect(res.motifs.length).toBeGreaterThan(0);
    // The shared core "ATGCGATC" should surface as (close to) the top motif.
    expect(res.motifs[0].consensus).toMatch(/ATGCGATC|TGCGATCG/);
  });

  describe('performance caps (regression: unbounded input could block the tab for 10-16s)', () => {
    it('rejects more sequences than the in-browser cap instead of hanging', () => {
      const seqs = Array.from({ length: 21 }, (_, i) => `ATGCATGCATGCATGC${i}`);
      const res = discoverMotifs(seqs, 6, 1, 5);
      expect(res.isValid).toBe(false);
      expect(res.errorMessage).toMatch(/too many sequences/i);
    });

    it('rejects a sequence over the length cap instead of hanging', () => {
      const long = 'ATGC'.repeat(100); // 400 chars > 300 cap
      const seqs = [long, 'ATGCATGCATGCATGCATGC'];
      const res = discoverMotifs(seqs, 6, 1, 5);
      expect(res.isValid).toBe(false);
      expect(res.errorMessage).toMatch(/too long/i);
    });

    it('accepts input right at the cap', () => {
      const seqs = Array.from({ length: 20 }, () => 'ATGCATGCATGCATGCATGC'.repeat(1).padEnd(50, 'A'));
      const res = discoverMotifs(seqs, 6, 1, 5);
      expect(res.isValid).toBe(true);
    });
  });
});
