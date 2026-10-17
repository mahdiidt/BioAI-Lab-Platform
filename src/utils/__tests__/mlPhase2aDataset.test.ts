import { describe, it, expect } from 'vitest';
import {
  parseDelimitedTable,
  profileColumns,
  suggestColumns,
  buildDataset,
  isBatchLikeName,
  isIdentifierLikeName,
  type BuildDatasetOptions,
} from '../ml/csvDataset';
import { stratifiedGroupTrainTestSplit } from '../ml/groups';

// Deterministic pseudo-random values so fixtures never change between runs.
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function load(csv: string, opts: Partial<BuildDatasetOptions> & { labelColumn: string }) {
  const table = parseDelimitedTable(csv);
  const profiles = profileColumns(table);
  return { table, profiles, built: buildDataset(table, profiles, opts as BuildDatasetOptions), suggested: suggestColumns(table, profiles) };
}

const codes = (r: { issues: { code: string }[] }) => r.issues.map((i) => i.code);

describe('numeric patient identifiers', () => {
  const rnd = lcg(1);
  // 2 samples per patient; the numeric patient column name is deliberately not one a regex would know about for "pid"/"MRN"
  const make = (idName: string) =>
    'sample_id,' + idName + ',condition,G1,G2\n' +
    Array.from({ length: 40 }, (_, i) => `S${i},${100 + Math.floor(i / 2)},${i % 2 ? 'tumor' : 'normal'},${(rnd() * 5).toFixed(3)},${(rnd() * 5).toFixed(3)}`).join('\n');

  for (const name of ['PatientID', 'patient_id', 'pid', 'MRN']) {
    it(`never silently uses a numeric "${name}" column as a predictive feature`, () => {
      const { built } = load(make(name), { labelColumn: 'condition', idColumn: 'sample_id' });
      expect(built.dataset!.featureNames).not.toContain(name);
      expect(built.dataset!.excludedColumns.find((c) => c.name === name)?.reason).toBe('suspected_identifier');
      expect(codes(built)).toContain('identifier_columns_excluded');
      expect(built.featureReview!.find((r) => r.name === name)?.flags).toContain('identifier_name');
    });
  }

  it('lets the user pick ANY column (here an oddly named numeric one) as the group column', () => {
    const csv = make('subjectCode').replace(/subjectCode/, 'xq7');
    const { built, profiles } = load(csv, { labelColumn: 'condition', idColumn: 'sample_id', groupColumn: 'xq7' });
    expect(profiles.find((p) => p.name === 'xq7')!.isNumeric).toBe(true);
    expect(built.dataset!.groups).not.toBeNull();
    expect(built.dataset!.groupColumn).toBe('xq7');
    expect(built.dataset!.qc.groupSummary).toMatchObject({ groups: 20, multiSampleGroups: 20 });
    expect(built.dataset!.featureNames).toEqual(['G1', 'G2']);
  });

  it('flags nearly-unique integer columns whose name says nothing (and respects an explicit override)', () => {
    const order = Array.from({ length: 40 }, (_, i) => (i * 17) % 40 + 5000); // unique, not sequential
    const csv =
      'sample_id,condition,key,G1,G2\n' +
      Array.from({ length: 40 }, (_, i) => `S${i},${i % 2 ? 'tumor' : 'normal'},${order[i]},${(rnd() * 3).toFixed(3)},${(rnd() * 3).toFixed(3)}`).join('\n');
    const base = load(csv, { labelColumn: 'condition', idColumn: 'sample_id' });
    expect(base.built.featureReview!.find((r) => r.name === 'key')?.flags).toContain('integer_unique');
    expect(base.built.dataset!.featureNames).not.toContain('key');
    const forced = load(csv, { labelColumn: 'condition', idColumn: 'sample_id', featureOverrides: { key: 'include' } });
    expect(forced.built.dataset!.featureNames).toContain('key');
    expect(codes(forced.built)).toContain('suspicious_columns_included');
  });

  it('flags a row counter (sequential integers)', () => {
    const csv = 'sample_id,condition,n,G1\n' + Array.from({ length: 30 }, (_, i) => `S${i},${i % 2 ? 'tumor' : 'normal'},${i + 1},${(rnd() * 2).toFixed(3)}`).join('\n');
    const { built } = load(csv, { labelColumn: 'condition', idColumn: 'sample_id' });
    expect(built.featureReview!.find((r) => r.name === 'n')?.flags).toContain('sequential');
  });

  it('does not flag every column of an integer count matrix as an identifier', () => {
    const r = lcg(9);
    const csv = 'sample_id,condition,A,B,C\n' + Array.from({ length: 40 }, (_, i) => `S${i},${i % 2 ? 'tumor' : 'normal'},${Math.floor(r() * 5000) + 100},${Math.floor(r() * 9000) + 100},${Math.floor(r() * 7000) + 100}`).join('\n');
    const { built } = load(csv, { labelColumn: 'condition', idColumn: 'sample_id' });
    expect(built.dataset!.featureNames).toEqual(['A', 'B', 'C']);
  });
});

describe('numeric batch / site columns', () => {
  const rnd = lcg(3);
  it('excludes a numeric batch column by default and lets the user include it again', () => {
    const csv = 'sample_id,condition,batch,G1,G2\n' + Array.from({ length: 40 }, (_, i) => `S${i},${i < 20 ? 'normal' : 'tumor'},${i < 20 ? 1 : 2},${(rnd() * 4).toFixed(3)},${(rnd() * 4).toFixed(3)}`).join('\n');
    const base = load(csv, { labelColumn: 'condition', idColumn: 'sample_id' });
    const item = base.built.featureReview!.find((r) => r.name === 'batch')!;
    expect(item.flags).toEqual(expect.arrayContaining(['batch_name', 'low_cardinality', 'label_confounded']));
    expect(item.defaultExcluded).toBe(true);
    expect(base.built.dataset!.featureNames).not.toContain('batch');
    const forced = load(csv, { labelColumn: 'condition', idColumn: 'sample_id', featureOverrides: { batch: 'include' } });
    expect(forced.built.dataset!.featureNames).toContain('batch');
  });

  it('warns about an unnamed low-cardinality column that tracks the label but keeps it unless the user excludes it', () => {
    const csv = 'sample_id,condition,x7,G1,G2\n' + Array.from({ length: 40 }, (_, i) => `S${i},${i < 20 ? 'normal' : 'tumor'},${i < 20 ? 3 : 4},${(rnd() * 4).toFixed(3)},${(rnd() * 4).toFixed(3)}`).join('\n');
    const base = load(csv, { labelColumn: 'condition', idColumn: 'sample_id' });
    expect(base.built.featureReview!.find((r) => r.name === 'x7')?.flags).toContain('label_confounded');
    expect(codes(base.built)).toContain('suspicious_columns_included');
    const excluded = load(csv, { labelColumn: 'condition', idColumn: 'sample_id', featureOverrides: { x7: 'exclude' } });
    expect(excluded.built.dataset!.featureNames).not.toContain('x7');
    expect(excluded.built.dataset!.excludedColumns.find((c) => c.name === 'x7')?.reason).toBe('user_excluded');
  });
});

describe('biological names are not mistaken for batch terms', () => {
  it('matches whole name tokens only', () => {
    for (const gene of ['RUNX1', 'RUNX2', 'RUNX3', 'RUNDC1', 'PLAT', 'LABA1', 'SITEX', 'ID1', 'ID3', 'PID1']) {
      expect(isBatchLikeName(gene), gene).toBe(false);
      expect(isIdentifierLikeName(gene), gene).toBe(false);
    }
    for (const name of ['batch', 'Batch_2', 'run_id', 'siteCode', 'plate', 'lane1', 'sequencer']) expect(isBatchLikeName(name), name).toBe(true);
  });

  it('keeps RUNX1 as a feature even with an invalid cell (previously dropped as "auxiliary")', () => {
    const rnd = lcg(5);
    const csv = 'sample_id,condition,G1,RUNX1,G3\n' + Array.from({ length: 60 }, (_, i) => `S${i},${i % 2 ? 'tumor' : 'normal'},${rnd().toFixed(3)},${i === 5 ? '#DIV/0!' : rnd().toFixed(3)},${rnd().toFixed(3)}`).join('\n');
    const { built } = load(csv, { labelColumn: 'condition', idColumn: 'sample_id' });
    expect(built.dataset!.featureNames).toContain('RUNX1');
    expect(built.dataset!.excludedColumns.some((c) => c.name === 'RUNX1')).toBe(false);
    expect(built.dataset!.qc.invalidCells).toBe(1);
  });
});

describe('comment and header handling', () => {
  it('uses a "#"-prefixed header line as the header and says so (never promotes the first data row)', () => {
    const t = parseDelimitedTable('#sample_id,condition,G1\nS1,a,1.5\nS2,b,2.5\n');
    expect(t.header).toEqual(['sample_id', 'condition', 'G1']);
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0][0]).toBe('S1');
    expect(t.issues.map((i) => i.code)).toContain('header_hash_prefixed');
  });

  it('skips genuine comment blocks above the header and reports how many', () => {
    const t = parseDelimitedTable('# exported 2026-01-01\n# by lab X\nsample_id,condition,G1\nS1,a,1.5\nS2,b,2.5\n');
    expect(t.header).toEqual(['sample_id', 'condition', 'G1']);
    expect(t.rows).toHaveLength(2);
    expect(t.issues.find((i) => i.code === 'comment_lines_skipped')?.params).toMatchObject({ count: 2 });
    expect(t.issues.map((i) => i.code)).not.toContain('header_hash_prefixed');
  });

  it('reports comment lines inside the data too', () => {
    const t = parseDelimitedTable('sample_id,condition,G1\nS1,a,1.5\n# note\nS2,b,2.5\n');
    expect(t.rows).toHaveLength(2);
    expect(t.issues.find((i) => i.code === 'comment_lines_skipped')?.params).toMatchObject({ count: 1 });
  });
});

describe('ID and group suggestions', () => {
  const rows = (patientFirst: boolean, numeric: boolean) =>
    (patientFirst ? 'patient_id,sample_id' : 'sample_id,patient_id') + ',condition,G1\n' +
    Array.from({ length: 24 }, (_, i) => {
      const pat = numeric ? String(1000 + Math.floor(i / 2)) : `P${Math.floor(i / 2)}`;
      const base = [`S${i}`, pat];
      return `${(patientFirst ? [base[1], base[0]] : base).join(',')},${i % 2 ? 'tumor' : 'normal'},${(i * 0.37).toFixed(2)}`;
    }).join('\n');

  for (const numeric of [false, true]) {
    it(`suggests sample_id as ID and patient_id as group when patient_id comes first (numeric=${numeric})`, () => {
      const { suggested } = load(rows(true, numeric), { labelColumn: 'condition' });
      expect(suggested).toMatchObject({ idColumn: 'sample_id', groupColumn: 'patient_id', labelColumn: 'condition' });
    });
    it(`gives the same suggestion when sample_id comes first (numeric=${numeric})`, () => {
      const { suggested } = load(rows(false, numeric), { labelColumn: 'condition' });
      expect(suggested).toMatchObject({ idColumn: 'sample_id', groupColumn: 'patient_id' });
    });
  }

  it('does not invent a group column for unrecognised names (the user chooses)', () => {
    const csv = 'sample_id,subjectCode,condition,G1\n' + Array.from({ length: 12 }, (_, i) => `S${i},${i >> 1},${i % 2 ? 'tumor' : 'normal'},${i}.5`).join('\n');
    const { suggested } = load(csv, { labelColumn: 'condition' });
    expect(suggested.groupColumn ?? null).toBeNull();
  });

  it('keeps the established result shape when no group is found', () => {
    const csv = 'sample_id,condition,G1\n' + Array.from({ length: 12 }, (_, i) => `S${i},${i % 2 ? 'tumor' : 'normal'},${i}.5`).join('\n');
    expect(load(csv, { labelColumn: 'condition' }).suggested).toEqual({ idColumn: 'sample_id', labelColumn: 'condition' });
  });
});

describe('explicit duplicate-row handling', () => {
  const rnd = lcg(11);
  const base = Array.from({ length: 24 }, (_, i) => ({ id: `S${i}`, label: i < 12 ? 'normal' : 'tumor', a: (rnd() * 5).toFixed(3), b: (rnd() * 5).toFixed(3) }));
  // rows 0..7 are duplicated with the same label under new IDs
  const dupes = base.slice(0, 8).map((r, k) => ({ ...r, id: `D${k}` }));
  const csv = 'sample_id,condition,A,B\n' + [...base, ...dupes].map((r) => `${r.id},${r.label},${r.a},${r.b}`).join('\n');

  it("'keep' (default) keeps the rows and warns", () => {
    const { built } = load(csv, { labelColumn: 'condition', idColumn: 'sample_id' });
    expect(built.dataset!.y).toHaveLength(32);
    expect(codes(built)).toContain('duplicate_feature_rows');
    expect(built.dataset!.qc.duplicateRows).toBe(8);
    expect(built.dataset!.groups).toBeNull();
  });

  it("'remove' drops same-label repeats and says how many", () => {
    const { built } = load(csv, { labelColumn: 'condition', idColumn: 'sample_id', duplicateHandling: 'remove' });
    expect(built.dataset!.y).toHaveLength(24);
    expect(built.dataset!.qc.duplicatesRemoved).toBe(8);
    expect(built.issues.find((i) => i.code === 'duplicates_removed')?.params).toMatchObject({ count: 8 });
    expect(built.dataset!.sampleIds.some((id) => id.startsWith('D'))).toBe(false);
  });

  it("'group' treats identical rows as one group, so they can never straddle a split", () => {
    const { built } = load(csv, { labelColumn: 'condition', idColumn: 'sample_id', duplicateHandling: 'group' });
    const d = built.dataset!;
    expect(d.y).toHaveLength(32);
    expect(d.groups).not.toBeNull();
    expect(d.groupColumn).toBe('(identical rows)');
    expect(codes(built)).toContain('duplicates_grouped');
    expect(codes(built)).not.toContain('duplicate_feature_rows');
    const idx = (id: string) => d.sampleIds.indexOf(id);
    for (let k = 0; k < 8; k++) expect(d.groups![idx(`S${k}`)]).toBe(d.groups![idx(`D${k}`)]);
    for (let seed = 1; seed <= 25; seed++) {
      const sp = stratifiedGroupTrainTestSplit(d.y, d.groups!, 0.25, seed);
      if (!sp) continue;
      const trainGroups = new Set(sp.trainIdx.map((i) => d.groups![i]));
      expect(sp.testIdx.some((i) => trainGroups.has(d.groups![i]))).toBe(false);
    }
  });

  it("'group' merges with an existing group column instead of replacing it", () => {
    const withPatients = 'sample_id,patient,condition,A,B\n' + [...base, ...dupes].map((r, i) => `${r.id},P${i % 16},${r.label},${r.a},${r.b}`).join('\n');
    const { built } = load(withPatients, { labelColumn: 'condition', idColumn: 'sample_id', groupColumn: 'patient', duplicateHandling: 'group' });
    const d = built.dataset!;
    expect(d.groupColumn).toBe('patient + identical rows');
    const idx = (id: string) => d.sampleIds.indexOf(id);
    for (let k = 0; k < 8; k++) expect(d.groups![idx(`S${k}`)]).toBe(d.groups![idx(`D${k}`)]);
  });

  it('reports identical rows that carry different labels', () => {
    const conflict = 'sample_id,condition,A,B\n' + base.map((r) => `${r.id},${r.label},${r.a},${r.b}`).join('\n') + `\nX1,${base[0].label === 'normal' ? 'tumor' : 'normal'},${base[0].a},${base[0].b}\n`;
    const { built } = load(conflict, { labelColumn: 'condition', idColumn: 'sample_id' });
    expect(codes(built)).toContain('duplicate_rows_conflicting_labels');
  });
});
