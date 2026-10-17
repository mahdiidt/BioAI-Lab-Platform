import { describe, it, expect } from 'vitest';
import { parseVcf, isValidGenotype, VCF_LIMITS } from '../variants/vcfParser';

const header = (extra = '') =>
  `##fileformat=VCFv4.2\n##reference=GRCh38\n${extra}##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tS1\n`;
const rec = (pos: number, alt: string, sample: string, fmt = 'GT') => `chr1\t${pos}\t.\tA\t${alt}\t.\tPASS\t.\t${fmt}\t${sample}\n`;
const codes = (r: ReturnType<typeof parseVcf>) => r.issues.map((i) => i.code);

describe('isValidGenotype (VCF spec)', () => {
  it('accepts missing, partially missing, haploid, phased and unphased genotypes', () => {
    for (const gt of ['.', './.', '.|.', './1', '1/.', '.|0', '0', '1', '0/0', '0/1', '1|0', '0/1/1', '0|1|1']) expect(isValidGenotype(gt, 1), gt).toBe(true);
  });
  it('rejects malformed genotypes and allele indexes beyond the ALT count', () => {
    for (const gt of ['', 'a/b', '0//1', '0/1/', '/1', '0-1', '5/9', '2/2', '1.5', '0 /1', '-1/1']) expect(isValidGenotype(gt, 1), `"${gt}"`).toBe(false);
    expect(isValidGenotype('2/2', 2)).toBe(true);
    expect(isValidGenotype('3/3', 2)).toBe(false);
  });
});

describe('genotype warnings are emitted even when no line was skipped', () => {
  it('GT 5/9 on a single-ALT record', () => {
    const r = parseVcf(header() + rec(100, 'G', '5/9'));
    expect(r.skippedLines).toBe(0);
    expect(codes(r)).toContain('vcf_bad_genotype');
    expect(r.issues.find((i) => i.code === 'vcf_bad_genotype')?.params).toMatchObject({ line: 5, value: '5/9' });
    expect(r.records[0].validGenotypeSamples).toBe(0);
    expect(r.counts.malformedGenotypes).toBe(1);
    expect(r.ok).toBe(true); // a malformed genotype is a warning, the coordinates are still usable
  });

  it('malformed GT such as a/b or 0//1', () => {
    const r = parseVcf(header() + rec(100, 'G', 'a/b') + rec(200, 'G', '0//1'));
    expect(r.counts.malformedGenotypes).toBe(2);
    expect(r.issues.filter((i) => i.code === 'vcf_bad_genotype')).toHaveLength(2);
  });

  it('valid partially missing genotype ./1 is NOT flagged', () => {
    const r = parseVcf(header() + rec(100, 'G', './1') + rec(200, 'G', '1|.'));
    expect(codes(r)).not.toContain('vcf_bad_genotype');
    expect(r.records.map((x) => x.validGenotypeSamples)).toEqual([1, 1]);
    expect(r.records[0].firstSampleGenotype).toBe('./1');
  });

  it('fully missing GT value (".") is valid', () => {
    const r = parseVcf(header() + rec(100, 'G', '.'));
    expect(codes(r)).not.toContain('vcf_bad_genotype');
    expect(r.records[0].validGenotypeSamples).toBe(1);
  });

  it('records without a GT field in FORMAT carry no genotype and raise no genotype warning', () => {
    const r = parseVcf(header() + rec(100, 'G', '35', 'DP'));
    expect(r.records[0].validGenotypeSamples).toBeNull();
    expect(r.records[0].firstSampleGenotype).toBeNull();
    expect(codes(r)).not.toContain('vcf_bad_genotype');
  });

  it('GT present in FORMAT but trailing sample fields dropped is treated as missing, an empty field is malformed', () => {
    const dropped = parseVcf(header() + rec(100, 'G', '.', 'DP:GT'));
    expect(codes(dropped)).not.toContain('vcf_bad_genotype');
    const empty = parseVcf(header() + rec(100, 'G', ''));
    expect(codes(empty)).toContain('vcf_bad_genotype');
  });

  it('multiallelic records accept indexes up to the number of ALT alleles', () => {
    const ok = parseVcf(header() + rec(100, 'G,T', '2/2'));
    expect(codes(ok)).not.toContain('vcf_bad_genotype');
    const bad = parseVcf(header() + rec(100, 'G,T', '3/1'));
    expect(codes(bad)).toContain('vcf_bad_genotype');
  });

  it('still reported together with other skipped lines', () => {
    const r = parseVcf(header() + rec(100, 'G', '5/9') + 'chr1\tnotanumber\t.\tA\tG\t.\tPASS\t.\tGT\t0/1\n');
    expect(r.skippedLines).toBe(1);
    expect(codes(r)).toEqual(expect.arrayContaining(['vcf_lines_skipped', 'vcf_bad_genotype']));
  });
});

describe('issue lists are bounded and totals are preserved', () => {
  const N = 5000;
  it('many malformed genotypes', () => {
    let body = '';
    for (let i = 1; i <= N; i++) body += rec(i * 10, 'G', '7/7');
    const r = parseVcf(header() + body);
    expect(r.counts.malformedGenotypes).toBe(N);
    expect(r.issues.filter((i) => i.code === 'vcf_bad_genotype')).toHaveLength(VCF_LIMITS.maxDetailedPerCode);
    const more = r.issues.find((i) => i.code === 'vcf_bad_genotype_more');
    expect(more?.params).toEqual({ count: N - VCF_LIMITS.maxDetailedPerCode, total: N });
    expect(r.issues.length).toBeLessThan(VCF_LIMITS.maxReportedIssues);
  });

  it('many symbolic / unsupported ALT records', () => {
    let body = '';
    for (let i = 1; i <= N; i++) body += rec(i * 10, '<DEL>', '0/1');
    const r = parseVcf(header() + body);
    expect(r.counts.unsupportedAlt).toBe(N);
    expect(r.issues.filter((i) => i.code === 'vcf_unsupported_alt')).toHaveLength(VCF_LIMITS.maxDetailedPerCode);
    expect(r.issues.find((i) => i.code === 'vcf_unsupported_alt_more')?.params).toEqual({ count: N - VCF_LIMITS.maxDetailedPerCode, total: N });
    expect(r.records).toHaveLength(N);
  });

  it('many positions beyond the declared contig stay fatal but bounded', () => {
    let body = '';
    for (let i = 1; i <= 200; i++) body += `chr21\t${50_000_000 + i}\t.\tA\tG\t.\tPASS\t.\n`;
    const r = parseVcf(`##fileformat=VCFv4.2\n##contig=<ID=chr21,length=46709983,assembly=GRCh38>\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n${body}`);
    expect(r.ok).toBe(false);
    expect(r.counts.outOfContig).toBe(200);
    expect(r.issues.filter((i) => i.code === 'vcf_pos_out_of_contig')).toHaveLength(VCF_LIMITS.maxDetailedPerCode);
    expect(r.issues.find((i) => i.code === 'vcf_pos_out_of_contig_more')?.params).toEqual({ count: 200 - VCF_LIMITS.maxDetailedPerCode, total: 200 });
  });
});
