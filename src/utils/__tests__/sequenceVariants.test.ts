import { describe, it, expect } from 'vitest';
import { compareSequences, affineGlobalAlign, variantsToVcf, translateUntilStop } from '../variants/sequenceVariants';

// Synthetic toy coding sequence (not a real gene): ATG + 9 codons + TAA
const CDS = 'ATGGCTGAAAAACTGTGGGAACGTTCTTAA';
//           M  A  E  K  L  W  E  R  S  *
const nc = { isCoding: false };
const coding = { isCoding: true, cdsStart: 1 };

describe('Sequence comparison: detection', () => {
  it('reports identical sequences with no variants', () => {
    const r = compareSequences(CDS, CDS, nc);
    expect(r.ok).toBe(true);
    expect(r.variants).toHaveLength(0);
    expect(r.issues.some((i) => i.code === 'identical_sequences')).toBe(true);
    expect(r.identityPercent).toBe(100);
  });

  it('detects a single-nucleotide substitution', () => {
    const r = compareSequences('ACGTACGTAC', 'ACGTTCGTAC', nc);
    expect(r.variants).toHaveLength(1);
    expect(r.variants[0]).toMatchObject({ type: 'SNV', refStart: 5, refAllele: 'A', altAllele: 'T', hgvs: '5A>T' });
    expect(r.variants[0].vcf).toEqual({ pos: 5, ref: 'A', alt: 'T' });
  });

  it('detects an adjacent multi-nucleotide substitution as one MNV', () => {
    const r = compareSequences('ACGTACGTAC', 'ACGGGCGTAC', nc);
    expect(r.variants).toHaveLength(1);
    expect(r.variants[0]).toMatchObject({ type: 'MNV', hgvs: '4_5delinsGG' });
  });

  it('detects a deletion, left-aligns VCF and 3′-shifts HGVS in a repeat', () => {
    // reference GAAAC -> GAAC: one A deleted from a run of three (positions 2-4)
    const r = compareSequences('TTGAAACTT', 'TTGAACTT', nc);
    expect(r.variants).toHaveLength(1);
    const v = r.variants[0];
    expect(v.type).toBe('deletion');
    expect(v.hgvs).toBe('6del'); // 3'-most A of the AAA run
    expect(v.vcf).toEqual({ pos: 3, ref: 'GA', alt: 'G' }); // left-normalized with anchor base
  });

  it('detects an insertion and calls a duplication when appropriate', () => {
    const ins = compareSequences('ACGTTGCA', 'ACGTCCTGCA', nc);
    expect(ins.variants).toHaveLength(1);
    expect(ins.variants[0]).toMatchObject({ type: 'insertion', altAllele: 'CC', hgvs: '4_5insCC' });
    expect(ins.variants[0].vcf).toEqual({ pos: 4, ref: 'T', alt: 'TCC' });

    const dup = compareSequences('ACGTAGCA', 'ACGTAGTAGCA', nc);
    expect(dup.variants[0].type).toBe('duplication');
    expect(dup.variants[0].hgvs).toBe('4_6dup');
  });

  it('keeps a multi-base deletion as a single event (affine gaps)', () => {
    const ref = 'ATGCCGTAGGCTTACGATCGATTGCA';
    const alt = 'ATGCCGTAGGCGATCGATTGCA'; // delete TTAC
    const r = compareSequences(ref, alt, nc);
    expect(r.variants).toHaveLength(1);
    expect(r.variants[0].type).toBe('deletion');
    expect(r.variants[0].refAllele.length).toBe(4);
  });

  it('detects several separated events', () => {
    const ref = 'AAAACCCCGGGGTTTTAAAACCCC';
    const alt = 'AAAACCTCGGGGTTTAAAACCGC';
    const r = compareSequences(ref, alt, nc);
    expect(r.variants.map((v) => v.type)).toEqual(['SNV', 'deletion', 'SNV']);
  });

  it('rejects invalid and ambiguous bases, empty input and multi-FASTA', () => {
    expect(compareSequences('ACGTX', 'ACGT', nc).issues[0].code).toBe('invalid_bases');
    expect(compareSequences('ACGNT', 'ACGT', nc).issues[0].code).toBe('ambiguous_bases');
    expect(compareSequences('', 'ACGT', nc).issues[0].code).toBe('empty_sequence');
    expect(compareSequences('>a\nACGT\n>b\nACGT', 'ACGT', nc).issues[0].code).toBe('multi_fasta');
    expect(compareSequences('ACGTX', 'ACGT', nc).ok).toBe(false);
  });

  it('accepts single-record FASTA and lowercase', () => {
    const r = compareSequences('>ref\nacgtacgt', '>s\nACGTACGA', nc);
    expect(r.ok).toBe(true);
    expect(r.variants[0].hgvs).toBe('8T>A');
  });

  it('aligner returns equal-length aligned strings that reconstruct the inputs', () => {
    const { alignedA, alignedB } = affineGlobalAlign('GATTACA', 'GCATGCA');
    expect(alignedA.length).toBe(alignedB.length);
    expect(alignedA.replace(/-/g, '')).toBe('GATTACA');
    expect(alignedB.replace(/-/g, '')).toBe('GCATGCA');
  });

  it('exports a minimal VCF', () => {
    const vcf = variantsToVcf(compareSequences('ACGTACGTAC', 'ACGTTCGTAC', nc), 'my ref');
    expect(vcf).toContain('##fileformat=VCFv4.2');
    expect(vcf).toContain('my_ref\t5\t.\tA\tT');
  });
});

describe('Sequence comparison: coding consequences', () => {
  it('translates the reference CDS', () => {
    expect(translateUntilStop(CDS)).toBe('MAEKLWERS*');
  });

  it('calls a synonymous change', () => {
    const r = compareSequences(CDS, 'ATGGCCGAAAAACTGTGGGAACGTTCTTAA', coding); // GCT->GCC Ala
    expect(r.variants[0].coding!.consequence).toBe('synonymous_variant');
    expect(r.variants[0].coding!.proteinChange).toBe('p.(Ala2=)');
    expect(r.variants[0].hgvs).toBe('c.6T>C');
  });

  it('calls a missense change with p. notation and codon table', () => {
    const r = compareSequences(CDS, 'ATGGCTGTAAAACTGTGGGAACGTTCTTAA', coding); // GAA->GTA Glu3Val
    const c = r.variants[0].coding!;
    expect(c.consequence).toBe('missense_variant');
    expect(c.proteinChange).toBe('p.(Glu3Val)');
    expect(c.codonChanges[0]).toEqual({ codonNumber: 3, refCodon: 'GAA', altCodon: 'GTA', refAa: 'Glu', altAa: 'Val' });
  });

  it('calls a nonsense (stop-gained) change', () => {
    const r = compareSequences(CDS, 'ATGGCTGAAAAACTGTGAGAACGTTCTTAA', coding); // TGG->TGA Trp6Ter
    expect(r.variants[0].coding!.consequence).toBe('stop_gained');
    expect(r.variants[0].coding!.proteinChange).toBe('p.(Trp6Ter)');
  });

  it('calls start-lost and stop-lost', () => {
    expect(compareSequences(CDS, 'ATAGCTGAAAAACTGTGGGAACGTTCTTAA', coding).variants[0].coding!.consequence).toBe('start_lost');
    expect(compareSequences(CDS, 'ATGGCTGAAAAACTGTGGGAACGTTCTCAA', coding).variants[0].coding!.consequence).toBe('stop_lost');
  });

  it('calls a frameshift for a 1-bp deletion', () => {
    const r = compareSequences(CDS, 'ATGGCTGAAAACTGTGGGAACGTTCTTAA', coding); // delete one A in AAAAA run
    const v = r.variants[0];
    expect(v.type).toBe('deletion');
    expect(v.coding!.consequence).toBe('frameshift_variant');
    expect(v.coding!.proteinChange).toMatch(/^p\.\([A-Z][a-z]{2}\d+(fs|Ter)\)$/);
  });

  it('calls an in-frame deletion of one codon', () => {
    const r = compareSequences(CDS, 'ATGGCTGAACTGTGGGAACGTTCTTAA', coding); // delete AAA (Lys4)
    const v = r.variants[0];
    expect(v.coding!.consequence).toBe('inframe_deletion');
    expect(v.coding!.proteinChange).toBe('p.(Lys4del)');
  });

  it('calls an in-frame insertion', () => {
    const r = compareSequences(CDS, 'ATGGCTGAAAAATGGCTGTGGGAACGTTCTTAA', coding); // insert TGG after Lys4
    expect(r.variants[0].coding!.consequence).toBe('inframe_insertion');
    expect(r.variants[0].coding!.proteinChange).toBe('p.(Lys4_Leu5insTrp)');
  });

  it('marks variants outside the CDS and uses c.- / c.* numbering', () => {
    const ref = 'GGCC' + CDS + 'GGTT';
    const alt = 'GACC' + CDS + 'GGTA';
    const r = compareSequences(ref, alt, { isCoding: true, cdsStart: 5 });
    expect(r.variants.map((v) => v.coding!.consequence)).toEqual(['upstream_of_cds', 'downstream_of_cds']);
    expect(r.variants[0].hgvs).toBe('c.-3G>A');
    expect(r.variants[1].hgvs).toBe('c.*4T>A');
  });

  it('warns when the declared CDS has no ATG or stop, and errors on a bad CDS start', () => {
    const noAtg = compareSequences('GCTGAAAAACTG', 'GCTGTAAAACTG', coding);
    expect(noAtg.issues.some((i) => i.code === 'no_start_codon')).toBe(true);
    expect(noAtg.issues.some((i) => i.code === 'no_stop_codon')).toBe(true);
    expect(compareSequences(CDS, CDS, { isCoding: true, cdsStart: 999 }).issues[0].code).toBe('bad_cds_start');
  });

  it('warns when separate variants hit the same codon', () => {
    // codon 3 GAA -> TAT : two non-adjacent SNVs in one codon
    const r = compareSequences(CDS, 'ATGGCTTATAAACTGTGGGAACGTTCTTAA', coding);
    expect(r.variants).toHaveLength(2);
    expect(r.issues.some((i) => i.code === 'variants_share_codon')).toBe(true);
  });

  it('reports the combined protein effect', () => {
    const r = compareSequences(CDS, 'ATGGCTGTAAAACTGTGGGAACGTTCTTAA', coding);
    expect(r.coding!.proteinIdentical).toBe(false);
    expect(r.coding!.firstProteinDifference).toBe(3);
  });

  it('does not annotate codons when the sequence is not declared coding', () => {
    const r = compareSequences(CDS, 'ATGGCTGTAAAACTGTGGGAACGTTCTTAA', nc);
    expect(r.variants[0].coding).toBeUndefined();
    expect(r.coding).toBeNull();
  });
});
