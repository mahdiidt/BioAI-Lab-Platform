import { describe, it, expect } from 'vitest';
import { layoutPedigree, inferInheritancePattern, Individual } from '../pedigree';

describe('Pedigree — layout', () => {
  it('places founders (no recorded parents) in generation 1 at the top', () => {
    const individuals: Individual[] = [
      { id: 'I-1', sex: 'M', generation: 1, affected: false },
      { id: 'I-2', sex: 'F', generation: 1, affected: false },
    ];
    const layout = layoutPedigree(individuals);
    expect(layout.individuals).toHaveLength(2);
    const ys = layout.individuals.map((i) => i.y);
    expect(new Set(ys).size).toBe(1); // both in the same generation row
  });

  it('places later generations at a strictly greater y than earlier ones', () => {
    const individuals: Individual[] = [
      { id: 'I-1', sex: 'M', generation: 1, affected: false },
      { id: 'I-2', sex: 'F', generation: 1, affected: false },
      { id: 'II-1', sex: 'F', generation: 2, affected: false, fatherId: 'I-1', motherId: 'I-2' },
    ];
    const layout = layoutPedigree(individuals);
    const gen1Y = layout.individuals.find((i) => i.id === 'I-1')!.y;
    const gen2Y = layout.individuals.find((i) => i.id === 'II-1')!.y;
    expect(gen2Y).toBeGreaterThan(gen1Y);
  });

  it('creates a couple link for two individuals who share a child', () => {
    const individuals: Individual[] = [
      { id: 'I-1', sex: 'M', generation: 1, affected: false },
      { id: 'I-2', sex: 'F', generation: 1, affected: false },
      { id: 'II-1', sex: 'F', generation: 2, affected: false, fatherId: 'I-1', motherId: 'I-2' },
    ];
    const layout = layoutPedigree(individuals);
    expect(layout.coupleLinks).toHaveLength(1);
    expect(new Set([layout.coupleLinks[0].aId, layout.coupleLinks[0].bId])).toEqual(new Set(['I-1', 'I-2']));
  });

  it('creates one child link per individual with at least one recorded parent', () => {
    const individuals: Individual[] = [
      { id: 'I-1', sex: 'M', generation: 1, affected: false },
      { id: 'I-2', sex: 'F', generation: 1, affected: false },
      { id: 'II-1', sex: 'F', generation: 2, affected: false, fatherId: 'I-1', motherId: 'I-2' },
      { id: 'II-2', sex: 'M', generation: 2, affected: false, fatherId: 'I-1', motherId: 'I-2' },
    ];
    const layout = layoutPedigree(individuals);
    expect(layout.childLinks).toHaveLength(2);
  });

  it('returns an empty layout for an empty individual list', () => {
    const layout = layoutPedigree([]);
    expect(layout.individuals).toHaveLength(0);
    expect(layout.width).toBe(0);
  });
});

describe('Pedigree — inheritance inference', () => {
  it('identifies an autosomal recessive pattern: two unaffected parents, an affected child, roughly even sex ratio', () => {
    const individuals: Individual[] = [
      { id: 'I-1', sex: 'M', generation: 1, affected: false },
      { id: 'I-2', sex: 'F', generation: 1, affected: false },
      { id: 'II-1', sex: 'F', generation: 2, affected: true, fatherId: 'I-1', motherId: 'I-2' },
      { id: 'II-2', sex: 'M', generation: 2, affected: true, fatherId: 'I-1', motherId: 'I-2' },
    ];
    const result = inferInheritancePattern(individuals);
    expect(result.mostLikely).toContain('autosomal_recessive');
    expect(result.mostLikely).not.toContain('autosomal_dominant');
    expect(result.mostLikely).not.toContain('x_linked_dominant');
  });

  it('rules out both dominant patterns when an affected child has two unaffected parents', () => {
    const individuals: Individual[] = [
      { id: 'I-1', sex: 'M', generation: 1, affected: false },
      { id: 'I-2', sex: 'F', generation: 1, affected: false },
      { id: 'II-1', sex: 'F', generation: 2, affected: true, fatherId: 'I-1', motherId: 'I-2' },
    ];
    const result = inferInheritancePattern(individuals);
    const ruledOutPatterns = result.ruledOut.map((r) => r.pattern);
    expect(ruledOutPatterns).toContain('autosomal_dominant');
    expect(ruledOutPatterns).toContain('x_linked_dominant');
  });

  it('rules out X-linked patterns when an affected father has an affected son', () => {
    const individuals: Individual[] = [
      { id: 'I-1', sex: 'M', generation: 1, affected: true },
      { id: 'I-2', sex: 'F', generation: 1, affected: false },
      { id: 'II-1', sex: 'M', generation: 2, affected: true, fatherId: 'I-1', motherId: 'I-2' },
    ];
    const result = inferInheritancePattern(individuals);
    const ruledOutPatterns = result.ruledOut.map((r) => r.pattern);
    expect(ruledOutPatterns).toContain('x_linked_recessive');
    expect(ruledOutPatterns).toContain('x_linked_dominant');
  });

  it('flags the X-linked dominant signature: affected father, unaffected mother, all daughters affected, no sons affected', () => {
    const individuals: Individual[] = [
      { id: 'I-1', sex: 'M', generation: 1, affected: true },
      { id: 'I-2', sex: 'F', generation: 1, affected: false },
      { id: 'II-1', sex: 'F', generation: 2, affected: true, fatherId: 'I-1', motherId: 'I-2' },
      { id: 'II-2', sex: 'F', generation: 2, affected: true, fatherId: 'I-1', motherId: 'I-2' },
      { id: 'II-3', sex: 'M', generation: 2, affected: false, fatherId: 'I-1', motherId: 'I-2' },
    ];
    const result = inferInheritancePattern(individuals);
    expect(result.mostLikely).toEqual(['x_linked_dominant']);
  });

  it('returns an empty result with a clear note when no affected individuals are entered', () => {
    const individuals: Individual[] = [
      { id: 'I-1', sex: 'M', generation: 1, affected: false },
      { id: 'I-2', sex: 'F', generation: 1, affected: false },
    ];
    const result = inferInheritancePattern(individuals);
    expect(result.mostLikely).toHaveLength(0);
    expect(result.notes.length).toBeGreaterThan(0);
  });
});
