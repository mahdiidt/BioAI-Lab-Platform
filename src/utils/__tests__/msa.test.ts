import { describe, it, expect } from 'vitest';
import { parseFasta, progressiveMSA, detectSequenceType } from '../msa';

describe('MSA — FASTA parsing', () => {
  it('parses a multi-FASTA block into name/seq pairs', () => {
    const seqs = parseFasta('>A\nATGC\n>B\nATGA');
    expect(seqs).toEqual([
      { name: 'A', seq: 'ATGC' },
      { name: 'B', seq: 'ATGA' },
    ]);
  });
});

describe('MSA — sequence type detection', () => {
  it('detects DNA', () => {
    expect(detectSequenceType([{ name: 'a', seq: 'ATGCATGCATGC' }])).toBe('dna');
  });

  it('detects protein', () => {
    expect(detectSequenceType([{ name: 'a', seq: 'MEEPQSDPSVEPPLSQETFSDLWKLLPENNVL' }])).toBe('protein');
  });
});

describe('MSA — progressive alignment (DNA)', () => {
  it('aligns near-identical DNA sequences with high identity and no gaps', () => {
    const seqs = parseFasta(
      '>a\nATGCGATACGCTTACGCATCGATCGATCG\n' +
        '>b\nATGCGATACCCTTACGCATCGATCGATCG\n' +
        '>c\nATGCAATACGCTTACGCATCAATCGATCG'
    );
    const res = progressiveMSA(seqs, 2, -1, -2, 'auto');
    expect(res.isValid).toBe(true);
    expect(res.type).toBe('dna');
    expect(res.names).toEqual(['a', 'b', 'c']);
    expect(res.aligned.every((s) => s.length === res.stats.alignLen)).toBe(true);
    expect(res.stats.identPct).toBeGreaterThan(80);
    expect(res.stats.gapPct).toBe(0);
    expect(res.consensus.length).toBe(res.stats.alignLen);
  });

  it('rejects fewer than 2 sequences', () => {
    const res = progressiveMSA(parseFasta('>only\nATGC'));
    expect(res.isValid).toBe(false);
    expect(res.errorMessage).toMatch(/at least 2/i);
  });

  it('rejects a sequence over the length cap instead of silently truncating it', () => {
    const long = 'A'.repeat(401);
    const seqs = [
      { name: 'a', seq: long },
      { name: 'b', seq: 'A'.repeat(50) },
    ];
    const res = progressiveMSA(seqs, 2, -1, -2, 'dna');
    expect(res.isValid).toBe(false);
    expect(res.errorMessage).toMatch(/too long/i);
  });

  it('rejects more sequences than the in-browser cap', () => {
    const seqs = Array.from({ length: 21 }, (_, i) => ({ name: `s${i}`, seq: 'ATGCATGCATGC' }));
    const res = progressiveMSA(seqs, 2, -1, -2, 'dna');
    expect(res.isValid).toBe(false);
    expect(res.errorMessage).toMatch(/too many sequences/i);
  });

  it('rejects an invalid character with a per-sequence error rather than an opaque failure', () => {
    const seqs = [
      { name: 'bad', seq: 'ATGCXATGC' },
      { name: 'ok', seq: 'ATGCAATGC' },
    ];
    const res = progressiveMSA(seqs, 2, -1, -2, 'dna');
    expect(res.isValid).toBe(false);
    expect(res.errorMessage).toContain('bad');
  });
});

describe('MSA — RNA input (regression: RNA was previously validated as DNA and rejected)', () => {
  it('aligns RNA sequences (containing U) without being misvalidated as DNA', () => {
    const seqs = parseFasta('>a\nAUGCGAUACGCUUACGCAUCGAUCGAUCG\n>b\nAUGCGAUACCCUUACGCAUCGAUCGAUCG');
    const res = progressiveMSA(seqs, 2, -1, -2, 'auto');
    expect(res.isValid).toBe(true);
    expect(res.aligned.every((s) => !s.includes('T'))).toBe(true);
  });

  it('also works when the UI\'s explicit "DNA/RNA" option is selected', () => {
    const seqs = parseFasta('>a\nAUGCGAUACGCUUACGCAUCGAUCGAUCG\n>b\nAUGCGAUACCCUUACGCAUCGAUCGAUCG');
    const res = progressiveMSA(seqs, 2, -1, -2, 'dna');
    expect(res.isValid).toBe(true);
  });
});

describe('MSA — progressive alignment (protein)', () => {
  it('aligns protein sequences and reports type=protein', () => {
    const seqs = parseFasta(
      '>p1\nMEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGP\n' +
        '>p2\nMTAMEESQSDISLELPLSQETFSGLWKLLPPEDILPSPHCMDDLLLPQDVEEFFEGPSEA'
    );
    const res = progressiveMSA(seqs, 2, -1, -2, 'auto');
    expect(res.isValid).toBe(true);
    expect(res.type).toBe('protein');
  });
});
