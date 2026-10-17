import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { translations, getTranslation } from '../../i18n';
import type { Language } from '../../types';

const LANGS: Language[] = ['en', 'fa', 'zh', 'es', 'fr', 'de'];
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/** Issue codes written as `code: 'xxx'` in a source file. */
function issueCodes(src: string): string[] {
  return Array.from(new Set(Array.from(src.matchAll(/code:\s*'([a-z0-9_]+)'/g), (m) => m[1])));
}
const placeholders = (s: string) => Array.from(new Set(Array.from(s.matchAll(/\{([A-Za-z0-9_]+)\}/g), (m) => m[1]))).sort();

// Codes that the pipeline builds dynamically (ternary), so a literal scan cannot see them.
const DYNAMIC_ML_CODES = ['permutation_unavailable_mixed_groups', 'permutation_unavailable_few_groups'];

const mlCodes = Array.from(
  new Set([
    ...issueCodes(read('../ml/csvDataset.ts')),
    ...issueCodes(read('../ml/pipeline.ts')),
    ...issueCodes(read('../ml/groups.ts')),
    ...DYNAMIC_ML_CODES,
  ])
);
const vcfCodes = issueCodes(read('../variants/vcfParser.ts'));

describe('translation dictionaries', () => {
  it('contain the same keys in all six languages', () => {
    const en = Object.keys(translations.en).sort();
    for (const l of LANGS) expect(Object.keys(translations[l]).sort(), l).toEqual(en);
  });

  it('have no empty values', () => {
    for (const l of LANGS) for (const [k, v] of Object.entries(translations[l])) expect(v.trim().length, `${l}.${k}`).toBeGreaterThan(0);
  });

  it('use the same {placeholders} in every language for the keys touched by this phase', () => {
    const keys = Object.keys(translations.en).filter((k) => /^(ml_issue_|var_issue_vcf|ml_group|ml_duplicates|ml_flag_|ml_feature|ml_stats_|ml_permutation|var_clinvar_)/.test(k));
    expect(keys.length).toBeGreaterThan(40);
    for (const k of keys) for (const l of LANGS) expect(placeholders(translations[l][k]), `${l}.${k}`).toEqual(placeholders(translations.en[k]));
  });
});

describe('issue-code keys expected by the Issues components exist in all languages', () => {
  it('ML issue codes -> ml_issue_<code>', () => {
    expect(mlCodes.length).toBeGreaterThan(30);
    for (const l of LANGS) {
      const missing = mlCodes.filter((c) => !translations[l][`ml_issue_${c}`]);
      // codes that are only ever logged internally are not shown to users; none are expected to be missing
      expect(missing, `${l} missing ml_issue_*`).toEqual([]);
    }
  });

  it('VCF issue codes -> var_issue_<code> (the previous vcf_issue_vcf_* keys were never looked up)', () => {
    expect(vcfCodes).toEqual(expect.arrayContaining(['vcf_bad_genotype', 'vcf_unsupported_alt', 'vcf_pos_out_of_contig', 'vcf_bad_genotype_more', 'vcf_unsupported_alt_more', 'vcf_pos_out_of_contig_more'].filter((c) => !c.endsWith('_more'))));
    const all = Array.from(new Set([...vcfCodes, 'vcf_bad_genotype_more', 'vcf_unsupported_alt_more', 'vcf_pos_out_of_contig_more']));
    for (const l of LANGS) {
      const missing = all.filter((c) => !translations[l][`var_issue_${c}`]);
      expect(missing, `${l} missing var_issue_*`).toEqual([]);
    }
    for (const l of LANGS) expect(Object.keys(translations[l]).filter((k) => k.startsWith('vcf_issue_')), l).toEqual([]);
  });

  it('getTranslation resolves the corrected VCF keys instead of echoing the key', () => {
    for (const l of LANGS) {
      const text = getTranslation(l, 'var_issue_vcf_bad_genotype');
      expect(text).not.toBe('var_issue_vcf_bad_genotype');
      expect(text).toContain('{line}');
    }
  });
});

describe('translations are real translations, not English copies', () => {
  const PHASE_KEYS = [
    'var_issue_vcf_bad_genotype', 'var_issue_vcf_unsupported_alt', 'var_issue_vcf_pos_out_of_contig',
    'var_issue_vcf_bad_genotype_more', 'var_issue_vcf_unsupported_alt_more', 'var_issue_vcf_pos_out_of_contig_more',
    'ml_group_column', 'ml_no_group_column', 'ml_group_aware', 'ml_group_note', 'ml_group_help',
    'ml_features_review_title', 'ml_features_review_note', 'ml_feature_use', 'ml_exclude_extra',
    'ml_issue_header_hash_prefixed', 'ml_issue_comment_lines_skipped', 'ml_issue_identifier_columns_excluded',
    'ml_issue_suspicious_columns_included', 'ml_issue_duplicates_removed', 'ml_issue_duplicates_grouped',
    'ml_issue_duplicate_rows_conflicting_labels', 'ml_issue_permutation_unavailable_mixed_groups',
    'ml_issue_permutation_unavailable_few_groups', 'ml_duplicates_help', 'ml_stats_unavailable_group',
    'ml_stats_ignored_groups', 'ml_permutation_group_note', 'var_clinvar_will_send', 'var_clinvar_ip_note',
    'var_clinvar_consent_scope', 'ml_issue_groups_not_used', 'ml_issue_group_split_infeasible', 'ml_issue_too_few_groups',
  ];

  it('differ from English in every non-English language', () => {
    for (const k of PHASE_KEYS) for (const l of LANGS.filter((x) => x !== 'en')) expect(translations[l][k], `${l}.${k}`).not.toBe(translations.en[k]);
  });

  it('use the right script', () => {
    for (const k of PHASE_KEYS) {
      expect(translations.fa[k], `fa.${k}`).toMatch(/[\u0600-\u06FF]/);
      expect(translations.zh[k], `zh.${k}`).toMatch(/[\u4E00-\u9FFF]/);
    }
  });

  it('Persian strings avoid Arabic-Indic letter variants (ي ك) so text stays natural and searchable', () => {
    for (const k of PHASE_KEYS) expect(translations.fa[k], `fa.${k}`).not.toMatch(/[\u064A\u0643]/);
  });
});
