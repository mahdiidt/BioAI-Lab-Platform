// Pedigree Analysis Engine
//
// Two independent, pure (no-React) pieces:
//  1. layoutPedigree() - turns a flat list of individuals (with optional
//     parent links) into x/y coordinates plus couple- and child-connector
//     lines, ready for an SVG renderer to draw.
//  2. inferInheritancePattern() - applies standard, textbook pedigree-
//     reading heuristics to suggest which Mendelian inheritance pattern(s)
//     the data is consistent with, and explicitly reports which patterns
//     are ruled out and why. Real pedigrees are often ambiguous with small
//     family sizes, so this reports "most consistent with" rather than a
//     single definitive answer, and says so when evidence is thin.

export type Sex = 'M' | 'F';

export interface Individual {
  id: string;
  sex: Sex;
  generation: number;
  affected: boolean;
  fatherId?: string;
  motherId?: string;
}

export interface PositionedIndividual extends Individual {
  x: number;
  y: number;
}

export interface CoupleLink {
  aId: string;
  bId: string;
  x1: number;
  x2: number;
  y: number;
}

export interface ChildLink {
  parentMidX: number;
  parentY: number;
  childX: number;
  childY: number;
  childId: string;
}

export interface PedigreeLayout {
  individuals: PositionedIndividual[];
  coupleLinks: CoupleLink[];
  childLinks: ChildLink[];
  generations: number[];
  width: number;
  height: number;
}

const X_SPACING = 90;
const Y_SPACING = 130;
const MARGIN = 60;

/**
 * Finds every "couple" - two individuals who are jointly the recorded
 * parents of at least one child in the dataset - so they can be placed
 * adjacent to each other and joined with a mating-pair connector line.
 */
function findCouples(individuals: Individual[]): Map<string, string> {
  const partnerOf = new Map<string, string>();
  for (const ind of individuals) {
    if (ind.fatherId && ind.motherId) {
      partnerOf.set(ind.fatherId, ind.motherId);
      partnerOf.set(ind.motherId, ind.fatherId);
    }
  }
  return partnerOf;
}

export function layoutPedigree(individuals: Individual[]): PedigreeLayout {
  if (individuals.length === 0) {
    return { individuals: [], coupleLinks: [], childLinks: [], generations: [], width: 0, height: 0 };
  }

  const byId = new Map(individuals.map((i) => [i.id, i]));
  const partnerOf = findCouples(individuals);
  const generations = Array.from(new Set(individuals.map((i) => i.generation))).sort((a, b) => a - b);

  const positioned = new Map<string, PositionedIndividual>();
  const coupleLinks: CoupleLink[] = [];
  const seenCouple = new Set<string>();

  generations.forEach((gen, genIdx) => {
    const y = MARGIN + genIdx * Y_SPACING;
    const genIndividuals = individuals.filter((i) => i.generation === gen);

    // Order: cluster full sibling groups together, ordered by their
    // parents' average x position (from the previous generation) so a
    // family visually sits under its parents; founders (no parents in the
    // dataset) keep their original relative order.
    const withParentX = genIndividuals.map((ind) => {
      const father = ind.fatherId ? positioned.get(ind.fatherId) : undefined;
      const mother = ind.motherId ? positioned.get(ind.motherId) : undefined;
      const parentX =
        father && mother ? (father.x + mother.x) / 2 : father ? father.x : mother ? mother.x : undefined;
      return { ind, parentX };
    });

    const sorted = [...withParentX].sort((a, b) => {
      if (a.parentX === undefined && b.parentX === undefined) return 0;
      if (a.parentX === undefined) return 1;
      if (b.parentX === undefined) return -1;
      return a.parentX - b.parentX;
    });

    // Keep already-paired partners adjacent even if one of them belongs to
    // a different sibling cluster ordering.
    const placed = new Set<string>();
    const orderedIds: string[] = [];
    for (const { ind } of sorted) {
      if (placed.has(ind.id)) continue;
      orderedIds.push(ind.id);
      placed.add(ind.id);
      const partnerId = partnerOf.get(ind.id);
      if (partnerId && byId.get(partnerId)?.generation === gen && !placed.has(partnerId)) {
        orderedIds.push(partnerId);
        placed.add(partnerId);
      }
    }

    orderedIds.forEach((id, idx) => {
      const ind = byId.get(id)!;
      positioned.set(id, { ...ind, x: MARGIN + idx * X_SPACING, y });
    });

    // Couple connector lines for this generation.
    for (const id of orderedIds) {
      const partnerId = partnerOf.get(id);
      if (!partnerId) continue;
      const key = [id, partnerId].sort().join('|');
      if (seenCouple.has(key)) continue;
      seenCouple.add(key);
      const a = positioned.get(id);
      const b = positioned.get(partnerId);
      if (a && b && a.generation === b.generation) {
        coupleLinks.push({ aId: id, bId: partnerId, x1: Math.min(a.x, b.x), x2: Math.max(a.x, b.x), y: a.y });
      }
    }
  });

  const childLinks: ChildLink[] = [];
  for (const ind of individuals) {
    if (!ind.fatherId && !ind.motherId) continue;
    const father = ind.fatherId ? positioned.get(ind.fatherId) : undefined;
    const mother = ind.motherId ? positioned.get(ind.motherId) : undefined;
    const child = positioned.get(ind.id);
    if (!child) continue;
    const parentMidX = father && mother ? (father.x + mother.x) / 2 : father ? father.x : mother ? mother.x : child.x;
    const parentY = father?.y ?? mother?.y ?? child.y - Y_SPACING;
    childLinks.push({ parentMidX, parentY, childX: child.x, childY: child.y, childId: ind.id });
  }

  const allX = Array.from(positioned.values()).map((p) => p.x);
  const allY = Array.from(positioned.values()).map((p) => p.y);

  return {
    individuals: Array.from(positioned.values()),
    coupleLinks,
    childLinks,
    generations,
    width: (allX.length ? Math.max(...allX) : 0) + MARGIN,
    height: (allY.length ? Math.max(...allY) : 0) + MARGIN,
  };
}

// ---------------------------------------------------------------------------
// Inheritance pattern inference
// ---------------------------------------------------------------------------

export type InheritancePattern = 'autosomal_dominant' | 'autosomal_recessive' | 'x_linked_dominant' | 'x_linked_recessive';

export interface InferenceResult {
  mostLikely: InheritancePattern[];
  ruledOut: { pattern: InheritancePattern; reason: string }[];
  notes: string;
}

export function inferInheritancePattern(individuals: Individual[]): InferenceResult {
  const byId = new Map(individuals.map((i) => [i.id, i]));
  const affected = individuals.filter((i) => i.affected);
  const ruledOut: { pattern: InheritancePattern; reason: string }[] = [];

  if (affected.length === 0) {
    return {
      mostLikely: [],
      ruledOut: [],
      notes: 'No affected individuals were entered - add at least one affected individual to infer a pattern.',
    };
  }

  const hasParentsRecorded = (ind: Individual) => ind.fatherId && ind.motherId && byId.has(ind.fatherId) && byId.has(ind.motherId);

  // Rule 1: two unaffected parents with an affected child => must be recessive.
  let recessiveEvidence = false;
  let recessiveExampleId: string | null = null;
  for (const ind of affected) {
    if (!hasParentsRecorded(ind)) continue;
    const father = byId.get(ind.fatherId!)!;
    const mother = byId.get(ind.motherId!)!;
    if (!father.affected && !mother.affected) {
      recessiveEvidence = true;
      recessiveExampleId = ind.id;
      break;
    }
  }

  if (recessiveEvidence) {
    ruledOut.push({
      pattern: 'autosomal_dominant',
      reason: `${recessiveExampleId} is affected but both recorded parents are unaffected - a dominant trait cannot skip a generation like this (assuming full penetrance).`,
    });
    ruledOut.push({
      pattern: 'x_linked_dominant',
      reason: `${recessiveExampleId} is affected but both recorded parents are unaffected - the same skipped-generation logic rules out X-linked dominant too.`,
    });
  }

  // Rule 2: every affected individual (with recorded parents) has at least
  // one affected parent => consistent with dominant; if this ever fails
  // where recessiveEvidence is false too, we don't have enough to call it
  // either way from this rule alone.
  let everyAffectedHasAffectedParent = true;
  let checkedAny = false;
  for (const ind of affected) {
    if (!hasParentsRecorded(ind)) continue;
    checkedAny = true;
    const father = byId.get(ind.fatherId!)!;
    const mother = byId.get(ind.motherId!)!;
    if (!father.affected && !mother.affected) {
      everyAffectedHasAffectedParent = false;
    }
  }

  // Rule 3 (clean X-linkage exclusion): an affected father with an
  // affected son rules out X-linked patterns, since a father passes Y (not
  // X) to his sons - the son's affected status can't have come from dad's X.
  let fatherToSonEvidence = false;
  let fatherToSonExample: string | null = null;
  for (const ind of affected) {
    if (ind.sex !== 'M' || !ind.fatherId) continue;
    const father = byId.get(ind.fatherId);
    if (father && father.affected && father.sex === 'M') {
      fatherToSonEvidence = true;
      fatherToSonExample = ind.id;
      break;
    }
  }
  if (fatherToSonEvidence) {
    ruledOut.push({
      pattern: 'x_linked_recessive',
      reason: `${fatherToSonExample} is an affected male with an affected father - fathers pass a Y chromosome (not X) to sons, so this transmission is inconsistent with X-linkage.`,
    });
    ruledOut.push({
      pattern: 'x_linked_dominant',
      reason: `${fatherToSonExample} is an affected male with an affected father - same father-to-son logic rules out X-linked dominant.`,
    });
  }

  // Rule 4: sex ratio signal among affected individuals.
  const affectedMales = affected.filter((i) => i.sex === 'M').length;
  const affectedFemales = affected.filter((i) => i.sex === 'F').length;
  const stronglyMaleBiased = affected.length >= 3 && affectedFemales === 0;

  // Rule 5: X-linked dominant signature - an affected father (unaffected
  // mother) whose daughters are ALL affected and sons are NONE affected.
  let xLinkedDominantSignature = false;
  for (const ind of individuals) {
    if (!ind.affected || ind.sex !== 'M') continue;
    const children = individuals.filter((c) => c.fatherId === ind.id);
    const mother = children[0]?.motherId ? byId.get(children[0].motherId!) : undefined;
    if (!mother || mother.affected) continue;
    const daughters = children.filter((c) => c.sex === 'F');
    const sons = children.filter((c) => c.sex === 'M');
    if (daughters.length > 0 && sons.length > 0 && daughters.every((d) => d.affected) && sons.every((s) => !s.affected)) {
      xLinkedDominantSignature = true;
    }
  }

  const ruledOutPatterns = new Set(ruledOut.map((r) => r.pattern));
  const candidates: InheritancePattern[] = (
    ['autosomal_dominant', 'autosomal_recessive', 'x_linked_dominant', 'x_linked_recessive'] as InheritancePattern[]
  ).filter((p) => !ruledOutPatterns.has(p));

  let mostLikely: InheritancePattern[] = candidates;

  if (xLinkedDominantSignature && candidates.includes('x_linked_dominant')) {
    mostLikely = ['x_linked_dominant'];
  } else if (recessiveEvidence && stronglyMaleBiased && candidates.includes('x_linked_recessive')) {
    mostLikely = candidates.filter((p) => p === 'x_linked_recessive' || p === 'autosomal_recessive');
  } else if (recessiveEvidence) {
    mostLikely = candidates.filter((p) => p === 'autosomal_recessive' || p === 'x_linked_recessive');
  } else if (everyAffectedHasAffectedParent && checkedAny) {
    mostLikely = candidates.filter((p) => p === 'autosomal_dominant' || p === 'x_linked_dominant');
  }

  const notesParts: string[] = [];
  if (!checkedAny) {
    notesParts.push('Few individuals have both parents recorded in this pedigree, so generation-skipping could not be evaluated - add more generations for a more confident answer.');
  }
  if (affectedMales !== affectedFemales && !stronglyMaleBiased) {
    notesParts.push('Affected individuals are not evenly split between sexes, but the sample is too small to draw a firm conclusion from sex ratio alone.');
  }
  if (mostLikely.length > 1) {
    notesParts.push('More than one pattern remains consistent with this data - a larger pedigree or molecular testing would be needed to distinguish them further.');
  }
  if (mostLikely.length === 0) {
    notesParts.push('The recorded relationships produced conflicting evidence for every standard pattern - double-check the entered parent/child and affected-status data.');
  }

  return {
    mostLikely,
    ruledOut,
    notes: notesParts.join(' ') || 'Pattern inferred from standard pedigree-reading rules.',
  };
}
