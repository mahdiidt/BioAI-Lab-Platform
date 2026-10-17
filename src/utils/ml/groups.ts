// Group-aware (subject / patient / cohort) splitting for Cancer ML Studio.
//
// When several rows come from the same subject (e.g. a TCGA participant's tumour
// AND matched normal sample, technical replicates, or repeated biopsies), a
// random row-level split lets the model "recognise the person" instead of the
// biology, and test metrics become optimistic. These helpers assign WHOLE
// groups to one side of every train/test or train/validation boundary while
// keeping the class balance as close as practical to the overall balance.
//
// Deterministic for a given seed. Not cryptographic.

import { createRng, shuffled } from './random';

export interface GroupInfo {
  /** Distinct group ids in first-seen order. */
  ids: string[];
  /** Row indices per group (same order as ids). */
  members: number[][];
  /** [negatives, positives] per group. */
  classCounts: [number, number][];
}

export function groupRows(groups: readonly string[], y: readonly number[]): GroupInfo {
  const index = new Map<string, number>();
  const ids: string[] = [];
  const members: number[][] = [];
  const classCounts: [number, number][] = [];
  groups.forEach((g, i) => {
    let k = index.get(g);
    if (k === undefined) {
      k = ids.length;
      index.set(g, k);
      ids.push(g);
      members.push([]);
      classCounts.push([0, 0]);
    }
    members[k].push(i);
    classCounts[k][y[i] === 1 ? 1 : 0]++;
  });
  return { ids, members, classCounts };
}

export interface GroupSummary {
  groups: number;
  /** Groups with more than one row. */
  multiSampleGroups: number;
  /** Groups that contain both classes (e.g. matched tumour/normal pairs). */
  mixedLabelGroups: number;
  largestGroup: number;
}

export function summarizeGroups(groups: readonly string[], y: readonly number[]): GroupSummary {
  const g = groupRows(groups, y);
  return {
    groups: g.ids.length,
    multiSampleGroups: g.members.filter((m) => m.length > 1).length,
    mixedLabelGroups: g.classCounts.filter((c) => c[0] > 0 && c[1] > 0).length,
    largestGroup: g.members.reduce((mx, m) => Math.max(mx, m.length), 0),
  };
}

/** Group order used by both split functions: shuffled by seed, then larger groups first. */
function orderedGroups(info: GroupInfo, seed: number): number[] {
  const rng = createRng(seed);
  const order = shuffled(
    info.ids.map((_, k) => k),
    rng
  );
  // Stable sort by size (desc) keeps the seeded shuffle as the tie-breaker.
  return order
    .map((k, pos) => ({ k, pos, size: info.members[k].length }))
    .sort((a, b) => b.size - a.size || a.pos - b.pos)
    .map((o) => o.k);
}

export interface GroupSplitResult {
  trainIdx: number[];
  testIdx: number[];
  /** Number of groups on each side. */
  trainGroups: number;
  testGroups: number;
}

/**
 * Stratified GROUP train/test split. Whole groups are moved to the test side
 * greedily while that brings the per-class test counts closer to
 * round(n_c * testFraction). Returns null when no split can give the test
 * set at least one sample of each class and the training set at least two of
 * each class (the caller reports this as an infeasible evaluation).
 */
export function stratifiedGroupTrainTestSplit(
  y: readonly number[],
  groups: readonly string[],
  testFraction: number,
  seed: number
): GroupSplitResult | null {
  const info = groupRows(groups, y);
  const total: [number, number] = [0, 0];
  y.forEach((v) => total[v === 1 ? 1 : 0]++);
  const target: [number, number] = [Math.max(1, Math.round(total[0] * testFraction)), Math.max(1, Math.round(total[1] * testFraction))];
  const test: [number, number] = [0, 0];
  const inTest = new Array<boolean>(info.ids.length).fill(false);
  const cost = (t: [number, number]) => Math.abs(t[0] - target[0]) / Math.max(total[0], 1) + Math.abs(t[1] - target[1]) / Math.max(total[1], 1);

  for (const k of orderedGroups(info, seed)) {
    const c = info.classCounts[k];
    const next: [number, number] = [test[0] + c[0], test[1] + c[1]];
    if (cost(next) < cost(test) - 1e-12) {
      inTest[k] = true;
      test[0] = next[0];
      test[1] = next[1];
    }
  }
  // Repair pass: if a class is absent from the test side, add the smallest group that contains it.
  for (const cls of [0, 1] as const) {
    if (test[cls] > 0) continue;
    const candidates = info.ids
      .map((_, k) => k)
      .filter((k) => !inTest[k] && info.classCounts[k][cls] > 0)
      .sort((a, b) => info.members[a].length - info.members[b].length || a - b);
    if (candidates.length > 0) {
      const k = candidates[0];
      inTest[k] = true;
      test[0] += info.classCounts[k][0];
      test[1] += info.classCounts[k][1];
    }
  }
  const trainCounts: [number, number] = [total[0] - test[0], total[1] - test[1]];
  if (test[0] < 1 || test[1] < 1 || trainCounts[0] < 2 || trainCounts[1] < 2) return null;

  const trainIdx: number[] = [];
  const testIdx: number[] = [];
  info.members.forEach((m, k) => (inTest[k] ? testIdx : trainIdx).push(...m));
  trainIdx.sort((a, b) => a - b);
  testIdx.sort((a, b) => a - b);
  return { trainIdx, testIdx, trainGroups: inTest.filter((x) => !x).length, testGroups: inTest.filter(Boolean).length };
}

/**
 * Stratified GROUP k-fold: returns k arrays of validation row indices. Each
 * group lands in exactly one fold; groups are assigned greedily to the fold
 * that keeps every fold's class proportions closest to 1/k of each class,
 * breaking ties by the smaller fold. Folds can be empty when there are fewer
 * groups than folds; the caller must skip such folds.
 */
export function stratifiedGroupKFold(y: readonly number[], groups: readonly string[], k: number, seed: number): number[][] {
  const info = groupRows(groups, y);
  const total: [number, number] = [0, 0];
  y.forEach((v) => total[v === 1 ? 1 : 0]++);
  const foldCounts: [number, number][] = Array.from({ length: k }, () => [0, 0]);
  const foldSize = new Array<number>(k).fill(0);
  const folds: number[][] = Array.from({ length: k }, () => []);
  const ideal = 1 / k;
  const spread = (fc: [number, number][]) =>
    fc.reduce((s, c) => s + (total[0] ? (c[0] / total[0] - ideal) ** 2 : 0) + (total[1] ? (c[1] / total[1] - ideal) ** 2 : 0), 0);

  for (const g of orderedGroups(info, seed)) {
    const c = info.classCounts[g];
    let best = 0;
    let bestCost = Infinity;
    for (let f = 0; f < k; f++) {
      const trial = foldCounts.map((x, i) => (i === f ? ([x[0] + c[0], x[1] + c[1]] as [number, number]) : x));
      const cst = spread(trial);
      if (cst < bestCost - 1e-12 || (Math.abs(cst - bestCost) <= 1e-12 && foldSize[f] < foldSize[best])) {
        best = f;
        bestCost = cst;
      }
    }
    foldCounts[best][0] += c[0];
    foldCounts[best][1] += c[1];
    foldSize[best] += info.members[g].length;
    folds[best].push(...info.members[g]);
  }
  return folds.map((f) => f.sort((a, b) => a - b));
}

/** True when no group id appears on both sides (used by tests and as a runtime assertion). */
export function groupsAreDisjoint(groups: readonly string[], a: readonly number[], b: readonly number[]): boolean {
  const left = new Set(a.map((i) => groups[i]));
  return b.every((i) => !left.has(groups[i]));
}


export type PermutationUnavailableReason = 'mixed_label_groups' | 'too_few_groups';

export interface GroupPermutationResult {
  /** Row-level labels after permuting whole-group labels, or null when a valid group-level permutation is not possible. */
  y: number[] | null;
  unavailable?: PermutationUnavailableReason;
  /** Number of groups that actually take part in label exchange (they sit in a group-size stratum that contains both classes). */
  permutableGroups: number;
}

/** Minimum number of exchangeable groups required before a group-level permutation p-value is reported. */
export const MIN_PERMUTABLE_GROUPS = 8;

/**
 * Group-level label permutation. NULL HYPOTHESIS: the class label of a whole
 * group (patient/subject/cohort) is exchangeable with the label of another
 * group of the SAME SIZE, i.e. group labels carry no information about the
 * features. Only whole-group labels are moved, so every group keeps one
 * label, the group structure is preserved and the number of positive rows is
 * unchanged (exchange happens inside group-size strata).
 *
 * It is NOT possible (returns y = null) when
 *  - any group contains both classes (matched tumour/normal pairs): the label
 *    is not a property of the group, so there is nothing group-level to permute;
 *  - fewer than MIN_PERMUTABLE_GROUPS groups (or fewer than 2 per class) sit in
 *    size strata that contain both classes.
 */
export function permuteGroupLabels(y: readonly number[], groups: readonly string[], rng: () => number): GroupPermutationResult {
  const info = groupRows(groups, y);
  if (info.classCounts.some((c) => c[0] > 0 && c[1] > 0)) return { y: null, unavailable: 'mixed_label_groups', permutableGroups: 0 };
  const label = info.classCounts.map((c) => (c[1] > 0 ? 1 : 0));
  const strata = new Map<number, number[]>();
  info.members.forEach((m, k) => {
    const arr = strata.get(m.length);
    if (arr) arr.push(k);
    else strata.set(m.length, [k]);
  });
  let permutable = 0;
  const perClass: [number, number] = [0, 0];
  const exchangeable: number[][] = [];
  for (const ks of strata.values()) {
    const labels = ks.map((k) => label[k]);
    if (labels.includes(0) && labels.includes(1)) {
      exchangeable.push(ks);
      permutable += ks.length;
      labels.forEach((l) => perClass[l]++);
    }
  }
  if (permutable < MIN_PERMUTABLE_GROUPS || perClass[0] < 2 || perClass[1] < 2) return { y: null, unavailable: 'too_few_groups', permutableGroups: permutable };
  const newLabel = label.slice();
  for (const ks of exchangeable) {
    const mixed = shuffled(ks.map((k) => label[k]), rng);
    ks.forEach((k, i) => (newLabel[k] = mixed[i]));
  }
  const out = y.slice() as number[];
  info.members.forEach((m, k) => m.forEach((i) => (out[i] = newLabel[k])));
  return { y: out, permutableGroups: permutable };
}
