import { describe, it, expect } from 'vitest';
import { parseVcf, classifyAllele, DEMO_VCF, looksGzipped, normalizeChromName } from '../variants/vcfParser';

const HEADER = '##fileformat=VCFv4.2\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO';

describe('VCF parsing', () => {
  it('parses the synthetic demo file', () => {
    const r = parseVcf(DEMO_VCF);
    expect(r.ok).toBe(true);
    expect(r.records).toHaveLength(4);
    expect(r.sampleCount).toBe(1);
    expect(r.build.build).toBe('GRCh38');
    expect(r.records[0].alleles[0].type).toBe('deletion');
    expect(r.records[1].firstSampleGenotype).toBe('0/1');
  });

  it('classifies allele types', () => {
    expect(classifyAllele('A', 'G')).toBe('SNV');
    expect(classifyAllele('AC', 'GT')).toBe('MNV');
    expect(classifyAllele('A', 'AT')).toBe('insertion');
    expect(classifyAllele('ATG', 'A')).toBe('deletion');
    expect(classifyAllele('ATG', 'C')).toBe('delins');
    expect(classifyAllele('A', '<DEL>')).toBe('symbolic');
    expect(classifyAllele('A', 'A[2:321682[')).toBe('breakend');
    expect(classifyAllele('A', '*')).toBe('spanning_deletion');
  });

  it('splits multi-allelic records', () => {
    const r = parseVcf(`${HEADER}\n1\t100\t.\tA\tG,AT\t.\tPASS\t.`);
    expect(r.records[0].alleles.map((a) => a.type)).toEqual(['SNV', 'insertion']);
  });

  it('rejects empty files and files without a #CHROM header', () => {
    expect(parseVcf('').issues[0].code).toBe('vcf_empty');
    const r = parseVcf('##fileformat=VCFv4.2\n1\t100\t.\tA\tG\t.\t.\t.');
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'vcf_missing_header')).toBe(true);
  });

  it('skips and reports malformed records with line numbers', () => {
    const r = parseVcf(
      `${HEADER}\n1\tabc\t.\tA\tG\t.\t.\t.\n1\t100\t.\tAXT\tG\t.\t.\t.\n1\t101\t.\tA\tA\t.\t.\t.\n1 102 . A G . . .\n1\t103\t.\tA\tG\t.\t.\t.`
    );
    expect(r.ok).toBe(true);
    expect(r.records).toHaveLength(1);
    expect(r.skippedLines).toBe(4);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain('vcf_bad_pos');
    expect(codes).toContain('vcf_bad_ref');
    expect(codes).toContain('vcf_bad_alt');
    expect(codes).toContain('vcf_not_tab_delimited');
    expect(r.issues.find((i) => i.code === 'vcf_bad_pos')!.params!.line).toBe(3);
  });

  it('detects genome build from contig lengths and flags conflicts / unknown builds', () => {
    const b37 = parseVcf(`##fileformat=VCFv4.2\n##contig=<ID=1,length=249250621>\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n1\t5\t.\tA\tG\t.\t.\t.`);
    expect(b37.build.build).toBe('GRCh37');
    const conflict = parseVcf(`##fileformat=VCFv4.2\n##reference=GRCh38\n##contig=<ID=1,length=249250621>\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO`);
    expect(conflict.build.conflict).toBe(true);
    expect(conflict.build.build).toBeNull();
    const unknown = parseVcf(`${HEADER}\n1\t5\t.\tA\tG\t.\t.\t.`);
    expect(unknown.build.build).toBeNull();
    expect(unknown.issues.some((i) => i.code === 'vcf_build_unknown')).toBe(true);
  });

  it('warns about a missing fileformat line and duplicates', () => {
    const r = parseVcf('#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n1\t5\t.\tA\tG\t.\t.\t.\n1\t5\t.\tA\tG\t.\t.\t.');
    expect(r.issues.some((i) => i.code === 'vcf_no_fileformat')).toBe(true);
    expect(r.issues.some((i) => i.code === 'vcf_duplicates')).toBe(true);
  });

  it('detects gzip magic bytes and normalizes chromosome names', () => {
    expect(looksGzipped(new Uint8Array([0x1f, 0x8b, 8]))).toBe(true);
    expect(looksGzipped(new Uint8Array([0x23, 0x23]))).toBe(false);
    expect(normalizeChromName('chrM')).toBe('MT');
    expect(normalizeChromName('chr17')).toBe('17');
  });
});
