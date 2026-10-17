import { describe, it, expect } from 'vitest';
import { groupsAreDisjoint, stratifiedGroupKFold, stratifiedGroupTrainTestSplit, summarizeGroups } from '../ml/groups';
import { benjaminiHochberg, boxStats, runExperiment, DEFAULT_EXPERIMENT_CONFIG, isExperimentError } from '../ml/pipeline';

describe('group-aware evaluation', () => {
  const y = [0, 0, 1, 1, 0, 1, 0, 1];
  const g = ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D'];
  it('keeps complete subjects out of the opposite split', () => {
    const s = stratifiedGroupTrainTestSplit(y, g, 0.5, 42);
    expect(s).not.toBeNull();
    expect(groupsAreDisjoint(g, s!.trainIdx, s!.testIdx)).toBe(true);
    expect(s!.trainIdx.length + s!.testIdx.length).toBe(y.length);
  });
  it('assigns each group to one and only one fold', () => {
    const folds = stratifiedGroupKFold(y, g, 3, 42);
    const seen = new Map<string, number>();
    folds.forEach((f, k) => f.forEach((i) => { const prev = seen.get(g[i]); seen.set(g[i], prev === undefined ? k : prev === k ? k : -2); }));
    expect(Array.from(seen.values()).every((k) => k >= 0)).toBe(true);
  });

  it('runs a leakage-safe experiment without splitting a subject', () => {
    const yy: number[] = [];
    const xx: Float64Array[] = [];
    const gg: string[] = [];
    for (let subject = 0; subject < 12; subject++) {
      const label = subject < 6 ? 0 : 1;
      for (let replicate = 0; replicate < 2; replicate++) {
        yy.push(label); gg.push(`P${subject}`);
        xx.push(Float64Array.from([label * 3 + replicate * 0.1, subject, replicate]));
      }
    }
    const data = { X: xx, y: yy, sampleIds: yy.map((_, i) => `S${i}`), featureNames: ['G1', 'G2', 'G3'], classes: ['normal', 'tumor'] as [string, string], classCounts: [12, 12] as [number, number], missingValueCount: 0, excludedColumns: [], droppedSamples: 0, batchChecks: [], groups: gg, groupColumn: 'patient_id', fingerprint: 'fixture' };
    const r = runExperiment(data, { ...DEFAULT_EXPERIMENT_CONFIG, groupAware: true, preprocess: { ...DEFAULT_EXPERIMENT_CONFIG.preprocess, topK: 2 }, cvFolds: 3 });
    expect(isExperimentError(r)).toBe(false);
    if (!isExperimentError(r)) {
      expect(r.evaluation.mode).toBe('group');
      // No subject may appear on both sides of the train/test split.
      const subjectOf = (id: string) => gg[Number(id.slice(1))];
      const trainSubjects = new Set(r.splitIds.train.map(subjectOf));
      expect(r.splitIds.test.some((id) => trainSubjects.has(subjectOf(id)))).toBe(false);
    }
  });

  it('summarizes repeated and mixed-label groups', () => {
    expect(summarizeGroups(y.map((_, i) => ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D'][i]), y)).toMatchObject({ groups: 4, multiSampleGroups: 4, mixedLabelGroups: 2 });
  });
});

describe('interpretation helpers', () => {
  it('controls BH q-values monotonically', () => {
    const q = benjaminiHochberg([0.01, 0.04, 0.5, null]);
    expect(q[0]).toBeLessThanOrEqual(q[1]!);
    expect(q[1]).toBeLessThanOrEqual(q[2]!);
    expect(q[3]).toBeNull();
  });
  it('returns a five-number summary without inventing values', () => {
    expect(boxStats([1, 2, 3, 4])).toMatchObject({ n: 4, min: 1, median: 2.5, max: 4 });
    expect(boxStats([])).toBeNull();
  });
});
