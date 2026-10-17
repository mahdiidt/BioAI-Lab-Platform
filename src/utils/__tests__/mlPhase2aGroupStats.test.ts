import { describe, it, expect } from 'vitest';
import { runExperiment, isExperimentError, DEFAULT_EXPERIMENT_CONFIG, featureStatsToCsv, type ExperimentConfig, type ExperimentResult } from '../ml/pipeline';
import { permuteGroupLabels, stratifiedGroupKFold, stratifiedGroupTrainTestSplit, groupsAreDisjoint, MIN_PERMUTABLE_GROUPS } from '../ml/groups';
import { createRng } from '../ml/random';
import type { MlDataset } from '../ml/csvDataset';

/** Standard normal from a seeded RNG (Box-Muller). */
function gauss(rng: () => number) {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

interface RepeatedOpts {
  subjects: number;
  replicates: number;
  seed: number;
  /** 'subject' = label is a property of the whole subject (null data: labels carry no information). 'paired' = every subject contributes one row of each class. */
  labelMode: 'subject' | 'paired';
  signal?: number;
}

/** Repeated-measure data: a strong subject effect on every feature, tiny replicate noise, optional true class signal. */
function repeatedMeasures(o: RepeatedOpts): MlDataset {
  const rng = createRng(o.seed);
  const X: Float64Array[] = [];
  const y: number[] = [];
  const groups: string[] = [];
  const ids: string[] = [];
  for (let s = 0; s < o.subjects; s++) {
    const subjLabel = s % 2; // balanced
    const effect = [gauss(rng) * 2, gauss(rng) * 2, gauss(rng) * 2];
    for (let r = 0; r < o.replicates; r++) {
      const label = o.labelMode === 'subject' ? subjLabel : r % 2;
      X.push(Float64Array.from(effect.map((e, j) => e + gauss(rng) * 0.3 + (j === 0 ? (o.signal ?? 0) * label : 0))));
      y.push(label);
      groups.push(`P${s}`);
      ids.push(`S${s}_${r}`);
    }
  }
  const c1 = y.filter((v) => v === 1).length;
  return { X, y, sampleIds: ids, featureNames: ['F1', 'F2', 'F3'], classes: ['normal', 'tumor'], classCounts: [y.length - c1, c1], missingValueCount: 0, excludedColumns: [], droppedSamples: 0, batchChecks: [], groups, groupColumn: 'patient', fingerprint: `rm-${o.seed}` };
}

const cfg = (patch: Partial<ExperimentConfig> = {}): ExperimentConfig => ({
  ...DEFAULT_EXPERIMENT_CONFIG,
  groupAware: true,
  permutations: 19,
  cvFolds: 3,
  preprocess: { ...DEFAULT_EXPERIMENT_CONFIG.preprocess, topK: 0 },
  ...patch,
});

function run(d: MlDataset, c: ExperimentConfig): ExperimentResult {
  const r = runExperiment(d, c);
  if (isExperimentError(r)) throw new Error(`experiment error: ${r.error.code}`);
  return r;
}

describe('permuteGroupLabels (group-level null)', () => {
  const y = [0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 1];
  const g = ['A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'D', 'D', 'E', 'E', 'F', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  // sizes: A,B=3 (one 0, one 1); C,D,E,F=2 (C0 D1 E0 F1); G,H,I,J,K,L=1 (G0 H1 I0 J1 K0 L1)

  it('moves whole-group labels only: every group keeps one label and class counts are unchanged', () => {
    const res = permuteGroupLabels(y, g, createRng(5));
    expect(res.y).not.toBeNull();
    const yp = res.y!;
    const byGroup = new Map<string, Set<number>>();
    g.forEach((gi, i) => (byGroup.get(gi) ?? byGroup.set(gi, new Set()).get(gi)!).add(yp[i]));
    for (const labels of byGroup.values()) expect(labels.size).toBe(1);
    expect(yp.filter((v) => v === 1).length).toBe(y.filter((v) => v === 1).length);
    expect(res.permutableGroups).toBe(12);
  });

  it('exchanges labels only between groups of the same size', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const yp = permuteGroupLabels(y, g, createRng(seed)).y!;
      const sizeOf = (grp: string) => g.filter((x) => x === grp).length;
      for (const size of [1, 2, 3]) {
        const idx = g.map((_, i) => i).filter((i) => sizeOf(g[i]) === size);
        expect(idx.filter((i) => yp[i] === 1).length).toBe(idx.filter((i) => y[i] === 1).length);
      }
    }
  });

  it('actually permutes (not the identity) for most seeds', () => {
    const changed = Array.from({ length: 20 }, (_, s) => permuteGroupLabels(y, g, createRng(s + 1)).y!.some((v, i) => v !== y[i])).filter(Boolean).length;
    expect(changed).toBeGreaterThan(15);
  });

  it('is unavailable when a group contains both classes (matched pairs): row shuffling would break the structure', () => {
    const gy = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
    const gg = ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'E', 'E', 'F', 'F', 'G', 'G', 'H', 'H'];
    const res = permuteGroupLabels(gy, gg, createRng(1));
    expect(res.y).toBeNull();
    expect(res.unavailable).toBe('mixed_label_groups');
  });

  it(`is unavailable with fewer than ${MIN_PERMUTABLE_GROUPS} exchangeable groups`, () => {
    const gy = [0, 0, 1, 1, 0, 1, 0, 1];
    const gg = ['A', 'A', 'B', 'B', 'C', 'D', 'E', 'F'];
    const res = permuteGroupLabels(gy, gg, createRng(1));
    expect(res.y).toBeNull();
    expect(res.unavailable).toBe('too_few_groups');
  });
});

describe('group-aware experiment consistency', () => {
  it('train/test and every CV fold keep each group on one side (synthetic repeated measures)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const d = repeatedMeasures({ subjects: 20, replicates: 3, seed, labelMode: 'subject' });
      const sp = stratifiedGroupTrainTestSplit(d.y, d.groups!, 0.25, seed);
      expect(sp).not.toBeNull();
      expect(groupsAreDisjoint(d.groups!, sp!.trainIdx, sp!.testIdx)).toBe(true);
      const trainY = sp!.trainIdx.map((i) => d.y[i]);
      const trainG = sp!.trainIdx.map((i) => d.groups![i]);
      const folds = stratifiedGroupKFold(trainY, trainG, 3, seed);
      const where = new Map<string, number>();
      folds.forEach((f, k) => f.forEach((i) => {
        const prev = where.get(trainG[i]);
        expect(prev === undefined || prev === k).toBe(true);
        where.set(trainG[i], k);
      }));
    }
  });

  it('the experiment reports disjoint train/test subjects and a group-level permutation', () => {
    const d = repeatedMeasures({ subjects: 24, replicates: 3, seed: 3, labelMode: 'subject' });
    const r = run(d, cfg());
    expect(r.evaluation.mode).toBe('group');
    const subj = (id: string) => id.split('_')[0];
    const train = new Set(r.splitIds.train.map(subj));
    expect(r.splitIds.test.some((id) => train.has(subj(id)))).toBe(false);
    expect(r.baselines.permutation.mode).toBe('group');
    expect(r.baselines.permutation.n).toBe(19);
    expect(r.baselines.permutation.pValue).not.toBeNull();
    expect(r.baselines.permutation.permutableGroups).toBeGreaterThanOrEqual(8);
    expect(r.baselines.shuffledLabels).not.toBeNull();
  });
});

describe('statistics that would treat repeated samples as independent are switched off', () => {
  it('group-aware mode with repeated samples: p and q are not reported, descriptive columns remain', () => {
    const r = run(repeatedMeasures({ subjects: 24, replicates: 3, seed: 4, labelMode: 'subject' }), cfg());
    expect(r.featureStatsInference).toBe('unavailable_repeated_groups');
    expect(r.featureStats.length).toBeGreaterThan(0);
    for (const f of r.featureStats) {
      expect(f.pValue).toBeNull();
      expect(f.qValue).toBeNull();
      expect(Number.isFinite(f.difference)).toBe(true);
    }
    const csv = featureStatsToCsv(r);
    expect(csv.split('\n').length).toBeGreaterThan(1);
  });

  it('repeated groups present but group-aware mode off: p/q still computed but labelled as optimistic', () => {
    const r = run(repeatedMeasures({ subjects: 24, replicates: 3, seed: 4, labelMode: 'subject' }), cfg({ groupAware: false }));
    expect(r.featureStatsInference).toBe('rows_with_ignored_groups');
    expect(r.featureStats.some((f) => f.pValue !== null)).toBe(true);
    expect(r.warnings.map((w) => w.code)).toContain('groups_not_used');
    expect(r.baselines.permutation.mode).toBe('row');
  });

  it('no repeated groups: ordinary row-level inference is unchanged', () => {
    const d = repeatedMeasures({ subjects: 40, replicates: 1, seed: 6, labelMode: 'subject', signal: 3 });
    const r = run(d, cfg({ groupAware: false }));
    expect(r.featureStatsInference).toBe('independent_rows');
    expect(r.featureStats.some((f) => f.pValue !== null)).toBe(true);
  });
});

describe('permutation control is unavailable (not faked) when no valid group-level null exists', () => {
  it('matched tumour/normal pairs in group-aware mode', () => {
    const r = run(repeatedMeasures({ subjects: 16, replicates: 2, seed: 8, labelMode: 'paired', signal: 2 }), cfg());
    expect(r.baselines.permutation.mode).toBe('unavailable');
    expect(r.baselines.permutation.unavailableReason).toBe('mixed_label_groups');
    expect(r.baselines.permutation.pValue).toBeNull();
    expect(r.baselines.shuffledLabels).toBeNull();
    expect(r.warnings.map((w) => w.code)).toContain('permutation_unavailable_mixed_groups');
  });

  it('too few exchangeable groups', () => {
    const r = run(repeatedMeasures({ subjects: 8, replicates: 3, seed: 9, labelMode: 'subject' }), cfg({ testFraction: 0.25 }));
    expect(r.baselines.permutation.mode).toBe('unavailable');
    expect(r.baselines.permutation.unavailableReason).toBe('too_few_groups');
    expect(r.warnings.map((w) => w.code)).toContain('permutation_unavailable_few_groups');
  });
});

describe('group-level permutation on repeated-measure null data', () => {
  it('does not report "significant" results far more often than chance when labels carry no information', () => {
    // Strong subject effects + subject-level random labels = pure null. With 19 permutations the
    // smallest possible p is 0.05, so P(p <= 0.05) should be around 5% for a valid test.
    const sims = 40;
    let rejected = 0;
    let valid = 0;
    for (let s = 1; s <= sims; s++) {
      const r = run(repeatedMeasures({ subjects: 24, replicates: 3, seed: 100 + s, labelMode: 'subject' }), cfg({ seed: s }));
      if (r.baselines.permutation.pValue === null) continue;
      valid++;
      if (r.baselines.permutation.pValue <= 0.05) rejected++;
    }
    expect(valid).toBeGreaterThanOrEqual(sims - 2);
    // Loose, deterministic bound (seeds are fixed): a valid null should not reject in a large share of runs.
    expect(rejected / valid).toBeLessThanOrEqual(0.2);
    console.info(`[group permutation null check] rejected ${rejected}/${valid} at p<=0.05 (nominal ~5%)`);
  });

  it('detects a real subject-level class signal', () => {
    const r = run(repeatedMeasures({ subjects: 40, replicates: 3, seed: 21, labelMode: 'subject', signal: 4 }), cfg({ permutations: 49 }));
    expect(r.test.rocAuc).toBeGreaterThan(0.9);
    expect(r.baselines.permutation.pValue).not.toBeNull();
    expect(r.baselines.permutation.pValue!).toBeLessThanOrEqual(0.05);
  });
});
