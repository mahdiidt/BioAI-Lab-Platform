import { describe, it, expect } from 'vitest';
import {
  buildClinVarTerm,
  spdiMatchesQuery,
  reviewStatusStars,
  normalizeClassification,
  parseESummary,
  parseESearchIds,
  lookupClinVar,
  minimalAllele,
  type ClinVarQuery,
} from '../variants/clinvar';

// NOTE: the JSON below is a hand-written STRUCTURAL FIXTURE that mimics the
// shape of an E-utilities esummary response. It is not real ClinVar content.
const q38: ClinVarQuery = { key: 'k1', chrom: 'chr17', pos: 1000, ref: 'G', alt: 'A', build: 'GRCh38' };
const fixture = {
  result: {
    uids: ['111', '222'],
    '111': {
      uid: '111',
      accession: 'VCV000000111',
      title: 'FIXTURE variant one',
      germline_classification: { description: 'Likely pathogenic', review_status: 'criteria provided, multiple submitters, no conflicts', last_evaluated: '2024/01/01 00:00', trait_set: [{ trait_name: 'Fixture condition' }] },
      variation_set: [{ canonical_spdi: 'NC_000017.11:999:G:A', variant_type: 'single nucleotide variant' }],
    },
    '222': {
      uid: '222',
      accession: 'VCV000000222',
      title: 'FIXTURE variant two',
      germline_classification: { description: 'Conflicting classifications of pathogenicity', review_status: 'criteria provided, conflicting classifications' },
      variation_set: [{ canonical_spdi: 'NC_000017.11:999:G:T', variant_type: 'single nucleotide variant' }],
    },
  },
};

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

describe('ClinVar helpers', () => {
  it('builds position queries for the selected build only', () => {
    expect(buildClinVarTerm(q38).term).toBe('17[chr] AND 1000[chrpos38]');
    expect(buildClinVarTerm({ ...q38, build: 'GRCh37' }).term).toBe('17[chr] AND 1000[chrpos37]');
    expect(buildClinVarTerm({ ...q38, ref: 'GA', alt: 'G' }).term).toBe('17[chr] AND 1000:1002[chrpos38]');
    expect(buildClinVarTerm({ ...q38, chrom: 'chrUn_gl000220' }).reason).toBe('unsupported_chrom');
    expect(buildClinVarTerm({ ...q38, alt: '<DEL>' }).reason).toBe('unsupported_allele');
  });

  it('matches SPDI alleles exactly, including repeat-context deletions', () => {
    expect(spdiMatchesQuery('NC_000017.11:999:G:A', q38)).toBe(true);
    expect(spdiMatchesQuery('NC_000017.11:999:G:T', q38)).toBe(false);
    expect(spdiMatchesQuery('NC_000001.11:999:G:A', q38)).toBe(false);
    // ClinVar expands deletions over the repeat (TTT -> TT); VCF left-aligned: anchor C + T
    const del: ClinVarQuery = { key: 'd', chrom: '1', pos: 99, ref: 'CT', alt: 'C', build: 'GRCh38' };
    expect(spdiMatchesQuery('NC_000001.11:99:TTT:TT', del)).toBe(true);
    expect(minimalAllele(98, 'CT', 'C')).toEqual({ start0: 99, del: 'T', ins: '' });
  });

  it('maps review status to stars and normalizes classifications', () => {
    expect(reviewStatusStars('practice guideline')).toBe(4);
    expect(reviewStatusStars('reviewed by expert panel')).toBe(3);
    expect(reviewStatusStars('criteria provided, multiple submitters, no conflicts')).toBe(2);
    expect(reviewStatusStars('criteria provided, single submitter')).toBe(1);
    expect(reviewStatusStars('criteria provided, conflicting classifications')).toBe(1);
    expect(reviewStatusStars('no assertion criteria provided')).toBe(0);
    expect(normalizeClassification('Pathogenic')).toBe('pathogenic');
    expect(normalizeClassification('Benign/Likely benign')).toBe('benign_likely_benign');
    expect(normalizeClassification('Uncertain significance')).toBe('uncertain_significance');
    expect(normalizeClassification('Conflicting classifications of pathogenicity')).toBe('conflicting');
    expect(normalizeClassification('drug response')).toBe('other');
    expect(normalizeClassification(undefined)).toBe('not_provided');
  });

  it('parses esummary and only marks the exact allele as a match', () => {
    const recs = parseESummary(fixture, q38);
    expect(recs).toHaveLength(2);
    expect(recs[0]).toMatchObject({ accession: 'VCV000000111', normalizedClass: 'likely_pathogenic', stars: 2, alleleMatch: true, conditions: ['Fixture condition'] });
    expect(recs[1]).toMatchObject({ alleleMatch: false, isConflicting: true, normalizedClass: 'conflicting' });
    expect(recs[0].url).toBe('https://www.ncbi.nlm.nih.gov/clinvar/variation/111/');
  });

  it('rejects malformed responses', () => {
    expect(() => parseESearchIds({})).toThrow();
    expect(() => parseESummary({ nope: 1 }, q38)).toThrow();
  });
});

describe('ClinVar lookup (mocked network)', () => {
  const noSleep = async () => undefined;

  it('returns exact matches only for the queried allele', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      return url.includes('esearch') ? jsonResponse({ esearchresult: { idlist: ['111', '222'] } }) : jsonResponse(fixture);
    }) as unknown as typeof fetch;
    const [res] = await lookupClinVar([q38], { fetchImpl, sleep: noSleep, minIntervalMs: 0 });
    expect(res.status).toBe('exact_match');
    expect(res.records.map((r) => r.uid)).toEqual(['111']);
    expect(calls[0]).toContain('esearch.fcgi?db=clinvar');
    expect(calls[0]).not.toContain('api_key');
  });

  it('reports position-only overlaps without claiming a match', async () => {
    const fetchImpl = (async (url: string) =>
      url.includes('esearch') ? jsonResponse({ esearchresult: { idlist: ['222'] } }) : jsonResponse({ result: { uids: ['222'], '222': fixture.result['222'] } })) as unknown as typeof fetch;
    const [res] = await lookupClinVar([q38], { fetchImpl, sleep: noSleep, minIntervalMs: 0 });
    expect(res.status).toBe('position_only');
    expect(res.records[0].alleleMatch).toBe(false);
  });

  it('handles no records, rate limits, HTTP errors, network failures and bad JSON honestly', async () => {
    const empty = (async () => jsonResponse({ esearchresult: { idlist: [] } })) as unknown as typeof fetch;
    expect((await lookupClinVar([q38], { fetchImpl: empty, sleep: noSleep, minIntervalMs: 0 }))[0].status).toBe('no_record');

    let n = 0;
    const limited = (async () => {
      n++;
      return jsonResponse({}, 429);
    }) as unknown as typeof fetch;
    const rl = await lookupClinVar([q38], { fetchImpl: limited, sleep: noSleep, minIntervalMs: 0 });
    expect(rl[0].status).toBe('rate_limited');
    expect(n).toBe(2); // one retry

    const down = (async () => jsonResponse({}, 503)) as unknown as typeof fetch;
    expect((await lookupClinVar([q38], { fetchImpl: down, sleep: noSleep, minIntervalMs: 0 }))[0]).toMatchObject({ status: 'error', errorCode: 'http', httpStatus: 503 });

    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect((await lookupClinVar([q38], { fetchImpl: offline, sleep: noSleep, minIntervalMs: 0 }))[0]).toMatchObject({ status: 'error', errorCode: 'network' });

    const garbage = (async () => jsonResponse({ unexpected: true })) as unknown as typeof fetch;
    expect((await lookupClinVar([q38], { fetchImpl: garbage, sleep: noSleep, minIntervalMs: 0 }))[0]).toMatchObject({ status: 'error', errorCode: 'parse' });
  });

  it('does not query unsupported contigs or symbolic alleles', async () => {
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return jsonResponse({});
    }) as unknown as typeof fetch;
    const res = await lookupClinVar([{ ...q38, chrom: 'supplied_reference' }], { fetchImpl, sleep: noSleep, minIntervalMs: 0 });
    expect(res[0].status).toBe('not_queryable');
    expect(called).toBe(false);
  });

  it('caps the batch size', async () => {
    const fetchImpl = (async () => jsonResponse({ esearchresult: { idlist: [] } })) as unknown as typeof fetch;
    const many = Array.from({ length: 15 }, (_, i) => ({ ...q38, key: String(i), pos: 1000 + i }));
    expect(await lookupClinVar(many, { fetchImpl, sleep: noSleep, minIntervalMs: 0 })).toHaveLength(10);
  });
});

describe('ClinVar retrieval bounds', () => {
  it('exposes when ESearch has more hits than retrieved ids', async () => {
    const fetchImpl = (async (url: string) => url.includes('esearch')
      ? jsonResponse({ esearchresult: { count: '25', idlist: ['222'] } })
      : jsonResponse({ result: { uids: ['222'], '222': fixture.result['222'] } })) as unknown as typeof fetch;
    const [res] = await lookupClinVar([q38], { fetchImpl, sleep: async () => undefined, minIntervalMs: 0 });
    expect(res.moreRecords).toBe(true);
  });
});
