import { describe, it, expect } from 'vitest';
import { parseDelimitedTable, profileColumns, suggestColumns, buildDataset, parseNumericCell } from '../ml/csvDataset';
import { generateSyntheticExpressionCsv, SYNTHETIC_HEADER_NOTE } from '../ml/syntheticData';

function load(text: string, label = 'condition', id: string | null = 'sample_id', positiveClass?: string) {
  const table = parseDelimitedTable(text);
  const profiles = profileColumns(table);
  return { table, profiles, built: buildDataset(table, profiles, { labelColumn: label, idColumn: id, positiveClass }) };
}

function rows(n: number, labelFn: (i: number) => string, extra = ''): string {
  const out = [`sample_id,condition${extra ? ',' + extra : ''},G1,G2`];
  for (let i = 0; i < n; i++) out.push(`S${i},${labelFn(i)}${extra ? ',x' : ''},${i % 7},${(i * 3) % 5}`);
  return out.join('\n');
}

describe('ML CSV parsing', () => {
  it('parses quoted fields, escaped quotes, CRLF and comment lines', () => {
    const t = parseDelimitedTable('# comment\r\nid,"label, text",G1\r\nA,"say ""hi""",1.5\r\nB,x,2\r\n');
    expect(t.header).toEqual(['id', 'label, text', 'G1']);
    expect(t.rows).toEqual([
      ['A', 'say "hi"', '1.5'],
      ['B', 'x', '2'],
    ]);
    expect(t.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('auto-detects tab and semicolon delimiters', () => {
    expect(parseDelimitedTable('a\tb\tc\n1\t2\t3').delimiter).toBe('\t');
    expect(parseDelimitedTable('a;b;c\n1;2;3').delimiter).toBe(';');
  });

  it('rejects empty input', () => {
    expect(parseDelimitedTable('').issues[0].code).toBe('empty_file');
    expect(parseDelimitedTable('   \n  ').issues[0].code).toBe('empty_file');
  });

  it('flags ragged rows with line numbers', () => {
    const t = parseDelimitedTable('a,b,c\n1,2,3\n1,2\n4,5,6');
    const issue = t.issues.find((i) => i.code === 'ragged_rows');
    expect(issue).toBeDefined();
    expect(issue!.params!.lines).toBe('3');
    expect(t.rows).toHaveLength(2);
  });

  it('flags duplicate column names as an error', () => {
    const t = parseDelimitedTable('id,label,G1,G1\nA,x,1,2');
    const issue = t.issues.find((i) => i.code === 'duplicate_columns');
    expect(issue?.severity).toBe('error');
    expect(String(issue?.params?.names)).toContain('G1');
  });

  it('reports an unterminated quote', () => {
    expect(parseDelimitedTable('a,b\n"x,1').issues[0].code).toBe('unterminated_quote');
  });

  it('parses numeric cells strictly', () => {
    expect(parseNumericCell('1.5e3')).toBe(1500);
    expect(Number.isNaN(parseNumericCell('NA') as number)).toBe(true);
    expect(Number.isNaN(parseNumericCell('') as number)).toBe(true);
    expect(parseNumericCell('1,5')).toBeNull();
    expect(parseNumericCell('Infinity')).toBeNull();
    expect(parseNumericCell('abc')).toBeNull();
  });
});

describe('ML dataset construction and validation', () => {
  it('suggests id and label columns', () => {
    const { table, profiles } = load(rows(20, (i) => (i % 2 ? 'tumor' : 'normal')));
    expect(suggestColumns(table, profiles)).toEqual({ idColumn: 'sample_id', labelColumn: 'condition' });
  });

  it('builds a binary dataset and picks the tumour-like label as positive', () => {
    const { built } = load(rows(20, (i) => (i % 2 ? 'tumor' : 'normal')));
    expect(built.dataset).not.toBeNull();
    expect(built.dataset!.classes).toEqual(['normal', 'tumor']);
    expect(built.dataset!.classCounts).toEqual([10, 10]);
    expect(built.dataset!.featureNames).toEqual(['G1', 'G2']);
  });

  it('honours an explicit positive class', () => {
    const { built } = load(rows(20, (i) => (i % 2 ? 'tumor' : 'normal')), 'condition', 'sample_id', 'normal');
    expect(built.dataset!.classes).toEqual(['tumor', 'normal']);
  });

  it('rejects a one-class dataset', () => {
    const { built } = load(rows(20, () => 'tumor'));
    expect(built.dataset).toBeNull();
    expect(built.issues.some((i) => i.code === 'one_class')).toBe(true);
  });

  it('rejects more than two classes', () => {
    const { built } = load(rows(30, (i) => ['a', 'b', 'c'][i % 3]));
    expect(built.dataset).toBeNull();
    expect(built.issues.some((i) => i.code === 'too_many_classes')).toBe(true);
  });

  it('detects a continuous numeric label', () => {
    const { built } = load(rows(30, (i) => String(i * 1.1)));
    expect(built.issues.some((i) => i.code === 'label_continuous')).toBe(true);
  });

  it('drops samples with missing labels and warns', () => {
    const { built } = load(rows(24, (i) => (i === 3 ? 'NA' : i % 2 ? 'tumor' : 'normal')));
    expect(built.dataset!.y).toHaveLength(23);
    expect(built.issues.some((i) => i.code === 'missing_labels_dropped')).toBe(true);
  });

  it('errors when a label column is missing entirely', () => {
    const { built } = load(rows(20, (i) => (i % 2 ? 'tumor' : 'normal')), 'diagnosis');
    expect(built.issues[0].code).toBe('label_not_found');
  });

  it('errors on tiny datasets and too few samples per class', () => {
    expect(load(rows(6, (i) => (i % 2 ? 'tumor' : 'normal'))).built.issues.some((i) => i.code === 'too_few_samples')).toBe(true);
    expect(load(rows(20, (i) => (i < 3 ? 'tumor' : 'normal'))).built.issues.some((i) => i.code === 'too_few_per_class')).toBe(true);
  });

  it('warns about class imbalance and small datasets', () => {
    const { built } = load(rows(40, (i) => (i < 8 ? 'tumor' : 'normal')));
    expect(built.dataset).not.toBeNull();
    expect(built.issues.some((i) => i.code === 'class_imbalance')).toBe(true);
    expect(built.issues.some((i) => i.code === 'small_dataset')).toBe(true);
  });

  it('excludes non-numeric feature columns with a warning', () => {
    const text = 'sample_id,condition,G1,notes\n' + Array.from({ length: 20 }, (_, i) => `S${i},${i % 2 ? 'tumor' : 'normal'},${i}.5,${i % 3 ? 'ok' : '5'}`).join('\n');
    const { built } = load(text);
    expect(built.dataset!.featureNames).toEqual(['G1']);
    expect(built.issues.some((i) => i.code === 'non_numeric_features_excluded')).toBe(true);
  });

  it('rejects duplicate sample ids (they would leak across the split)', () => {
    const text = 'sample_id,condition,G1\n' + Array.from({ length: 20 }, (_, i) => `S${i === 5 ? 4 : i},${i % 2 ? 'tumor' : 'normal'},${i}`).join('\n');
    expect(load(text).built.issues.some((i) => i.code === 'duplicate_sample_ids')).toBe(true);
  });

  it('detects a batch column confounded with the label', () => {
    const text = 'sample_id,condition,batch,G1\n' + Array.from({ length: 20 }, (_, i) => `S${i},${i % 2 ? 'tumor' : 'normal'},${i % 2 ? 'B1' : 'B2'},${i}.5`).join('\n');
    const { built } = load(text);
    expect(built.issues.some((i) => i.code === 'batch_confounded')).toBe(true);
    expect(built.dataset!.featureNames).toEqual(['G1']);
  });

  it('keeps missing feature values as NaN for later train-only imputation', () => {
    const text = 'sample_id,condition,G1\n' + Array.from({ length: 20 }, (_, i) => `S${i},${i % 2 ? 'tumor' : 'normal'},${i === 2 ? 'NA' : i + '.5'}`).join('\n');
    const { built } = load(text);
    expect(Number.isNaN(built.dataset!.X[2][0])).toBe(true);
    expect(built.dataset!.missingValueCount).toBe(1);
  });

  it('warns when features outnumber samples', () => {
    const header = 'sample_id,condition,' + Array.from({ length: 30 }, (_, j) => `G${j}`).join(',');
    const body = Array.from({ length: 12 }, (_, i) => `S${i},${i % 2 ? 'tumor' : 'normal'},` + Array.from({ length: 30 }, (_, j) => (i * j) % 11).join(','));
    expect(load([header, ...body].join('\n')).built.issues.some((i) => i.code === 'high_dimensional')).toBe(true);
  });
});

describe('Synthetic educational dataset', () => {
  it('is deterministic, clearly labelled, and uses artificial gene names', () => {
    const a = generateSyntheticExpressionCsv();
    const b = generateSyntheticExpressionCsv();
    expect(a).toBe(b);
    expect(a.startsWith(SYNTHETIC_HEADER_NOTE)).toBe(true);
    const { built } = load(a);
    expect(built.dataset).not.toBeNull();
    expect(built.dataset!.featureNames.every((f) => /^SYN_GENE_\d{3}$/.test(f))).toBe(true);
    expect(built.dataset!.classCounts).toEqual([30, 36]);
  });
});

describe('scientific input hardening', () => {
  it('parses decimal-comma spreadsheet exports when semicolon-delimited', () => {
    const t = parseDelimitedTable(['id;condition;G1;G2', 's1;normal;1,25;2,5', 's2;tumor;3,25;4,5', 's3;normal;1,5;2,0', 's4;tumor;3,5;4,0', 's5;normal;1,75;2,25', 's6;tumor;3,75;4,25', 's7;normal;1,0;2,75', 's8;tumor;3,0;4,75', 's9;normal;1,1;2,1', 's10;tumor;3,1;4,1'].join('\n'));
    expect(t.decimalComma).toBe(true);
    const b = buildDataset(t, profileColumns(t), { labelColumn: 'condition', idColumn: 'id' });
    expect(b.dataset?.featureNames).toEqual(['G1', 'G2']);
    expect(b.dataset?.X[0][0]).toBeCloseTo(1.25, 6);
  });

  it('does not call a negated cancer label positive', () => {
    const b = load(rows(12, (i) => (i % 2 ? 'tumor' : 'non-tumor'))).built;
    expect(b.dataset?.classes[1]).toBe('tumor');
  });

  it('flags a feature that exactly reproduces the label', () => {
    const text = ['id,label,leak,g1', ...Array.from({ length: 10 }, (_, i) => `s${i},${i % 2 ? 'case' : 'control'},${i % 2},${i + 0.1}`)].join('\n');
    const t = parseDelimitedTable(text);
    const b = buildDataset(t, profileColumns(t), { labelColumn: 'label', idColumn: 'id' });
    expect(b.issues.some((x) => x.code === 'possible_label_leak')).toBe(true);
  });
});
