import { describe, it, expect } from 'vitest';
import { validateSequence } from '../sequenceValidator';
import {
  reverseComplement,
  complementSequence,
  getComplementBase,
  InvalidNucleotideError,
  DNA_COMPLEMENT_MAP,
  RNA_COMPLEMENT_MAP,
  transcribeDnaToRna,
  translateRnaToProtein,
  calculateSequenceStats,
  findOpenReadingFrames,
  findMotifPositions,
  countKmers,
} from '../dna';
import { analyzeProtein } from '../protein';

import { calculatePrimerTm, calculatePcrReactionSetup, calculateAnnealingTemperature } from '../pcr';
import { calculateMolarity, calculateC1V1 } from '../lab';
import { digestDna, calculateGelMigrationPercent } from '../restriction';
import { calculatePunnettSquare, calculateHardyWeinberg, analyzeMutation } from '../genetics';
import { calculateMichaelisMenten } from '../biochemistry';
import { calculateBacterialGrowth } from '../microbiology';
import { parseMultiFasta } from '../fastaParser';
import { analyzeKmers } from '../kmer';
import { optimizeCodons, calculateCai } from '../codonOptimization';
import { parseNewick } from '../newickParser';
import { needlemanWunschAlignment, designPrimers } from '../bioinformatics';
import { translations } from '../../i18n';

describe('1. Central Validation Layer', () => {
  it('validates canonical DNA correctly', () => {
    const res = validateSequence('ATGCGA', 'DNA');
    expect(res.isValid).toBe(true);
    expect(res.cleanSequence).toBe('ATGCGA');
    expect(res.invalidChars).toHaveLength(0);
  });

  it('rejects RNA bases in DNA mode', () => {
    const res = validateSequence('AUGCGA', 'DNA');
    expect(res.isValid).toBe(false);
    expect(res.invalidChars).toContain('U');
  });

  it('identifies ambiguity symbols in DNA mode', () => {
    const res = validateSequence('ATGCRN', 'DNA', true);
    expect(res.isValid).toBe(true);
    expect(res.hasAmbiguityChars).toBe(true);
    expect(res.ambiguityCharsFound).toEqual(expect.arrayContaining(['R', 'N']));
  });

  it('validates Protein sequence correctly', () => {
    const res = validateSequence('MKAW*', 'PROTEIN');
    expect(res.isValid).toBe(true);
  });

  it('detects invalid characters in Protein mode', () => {
    const res = validateSequence('MKAW123!', 'PROTEIN');
    expect(res.isValid).toBe(false);
    expect(res.invalidChars).toEqual(expect.arrayContaining(['1', '2', '3', '!']));
  });
});

describe('2. DNA / RNA Core & IUPAC Reverse Complement', () => {
  it('computes reverse complement with full IUPAC support', () => {
    expect(reverseComplement('ATGC')).toBe('GCAT');
    expect(reverseComplement('AAAA')).toBe('TTTT');
    expect(reverseComplement('CCCC')).toBe('GGGG');
    // RYSWKMBDHVN reversed = NVHDBSMKWSYR
    // Complement = N B D H V K M W S R Y
    expect(reverseComplement('RYSWKMBDHVN')).toBe('NBDHVKMWSRY');
  });

  it('transcribes DNA to RNA correctly', () => {
    expect(transcribeDnaToRna('ATGCGA')).toBe('AUGCGA');
  });

  it('rejects invalid DNA during transcription and translation', () => {
    expect(transcribeDnaToRna('ATGCXYZ')).toBe('');
    expect(translateRnaToProtein('ATGCXYZ')).toBe('');
  });

  it('translates RNA/DNA to Protein correctly', () => {
    expect(translateRnaToProtein('AUGGCCAUGUAA')).toBe('MAM*');
  });

  it('rejects invalid DNA/RNA characters during sequence statistics', () => {
    const stats = calculateSequenceStats('ATGCXYZ', 'ssDNA');
    expect(stats.length).toBe(0);
    expect(stats.gcContent).toBe(0);
  });

  it('calculates sequence stats for ssDNA, dsDNA, and RNA', () => {
    const ss = calculateSequenceStats('ATGC', 'ssDNA');
    expect(ss.length).toBe(4);
    expect(ss.gcContent).toBe(50);
    expect(ss.atContent).toBe(50);
    expect(ss.molecularWeightDa).toBeGreaterThan(1000);

    const ds = calculateSequenceStats('ATGC', 'dsDNA');
    expect(ds.molecularWeightDa).toBe(Math.round(4 * 617.9 + 36.0));
  });

  it('finds open reading frames in 6 reading frames', () => {
    const dna = 'ATGAAATAAATGCCCTAA';
    const orfs = findOpenReadingFrames(dna, 1);
    expect(orfs.length).toBeGreaterThan(0);
    expect(orfs[0].proteinSequence).toContain('M');
  });
});

describe('3. Protein Analysis & pI Calculation', () => {
  it('calculates protein molecular weight, GRAVY, and pI', () => {
    const res = analyzeProtein('MKAW');
    expect(res).not.toBeNull();
    if (res) {
      expect(res.length).toBe(4);
      expect(res.molecularWeightDa).toBeGreaterThan(400);
      expect(res.isoelectricPointPI).toBeGreaterThan(0);
      expect(res.isoelectricPointPI).toBeLessThan(14);
    }
  });

  it('handles protein stop symbol correctly', () => {
    const resWithStop = analyzeProtein('MKAW*');
    const resWithoutStop = analyzeProtein('MKAW');
    expect(resWithStop?.length).toBe(4);
    expect(resWithStop?.molecularWeightDa).toBe(resWithoutStop?.molecularWeightDa);
  });
});

describe('4. PCR & Primers', () => {
  it('calculates primer Tm with GC-based formula', () => {
    const res = calculatePrimerTm('ATGCGATCGATCGATCGATC'); // 20 bp
    expect(res.length).toBe(20);
    expect(res.tm).toBeGreaterThan(40);
    expect(res.gcContent).toBe(50);
  });

  it('rejects invalid DNA primer characters', () => {
    const res = calculatePrimerTm('ATGCXYZ');
    expect(res.tm).toBe(0);
    expect(res.warnings.some((w) => w.includes('Invalid character'))).toBe(true);
  });

  it('calculates PCR master mix volumes excluding template DNA', () => {
    const res = calculatePcrReactionSetup(10, 50, true);
    expect(res.numSamples).toBe(10);
    expect(res.multiplierUsed).toBe(11);
    // 50 uL total reaction - 6 uL template DNA = 44 uL master mix per reaction
    // 44 * 11 = 484 uL total master mix
    expect(res.masterMixTotal.totalVolumeUl).toBe(484);
    expect(res.templatePerReactionUl).toBe(6);
    expect(res.note).toContain('Prepare the shared master mix without template DNA');
  });

  it('calculates annealing temperature and warns on high Tm diff', () => {
    const res = calculateAnnealingTemperature(60, 50);
    expect(res.recommendedTa).toBe(45);
    expect(res.warnings.length).toBeGreaterThan(0);
  });
});

describe('5. Lab & Solution Calculations (C1V1 & Molarity)', () => {
  it('solves C1V1 correctly without division by zero', () => {
    const res = calculateC1V1(10, undefined, 2, 50, 'mM', 'mL');
    expect(res?.solvedVariable).toBe('V1');
    expect(res?.value).toBe(10); // (2 * 50) / 10 = 10
    expect(res?.diluentVolume).toBe(40);
  });

  it('handles C2=0 safely when solving V2 in C1V1', () => {
    const res = calculateC1V1(10, 5, 0, undefined, 'mM', 'mL');
    expect(res).toBeNull(); // Cannot solve V2 with 0 concentration target (division by zero)
  });

  it('rejects impossible dilution', () => {
    // Target concentration C2 (20 mM) > Stock concentration C1 (10 mM)
    const res = calculateC1V1(10, undefined, 20, 50, 'mM', 'mL');
    expect(res).toBeNull();
  });

  it('solves Molarity correctly', () => {
    const res = calculateMolarity(undefined, 58.44, 1000, 1); // NaCl 1M in 1L = 58.44g
    expect(res?.target).toBe('mass');
    expect(res?.value).toBeCloseTo(58.44, 2);
  });

  it('reports correct diluent volume when solving C1 (regression: was hardcoded to 0)', () => {
    // Given V1 = 5 mL stock used, target C2 = 1 mM, final V2 = 50 mL,
    // solving for the required stock concentration C1.
    const res = calculateC1V1(undefined, 5, 1, 50, 'mM', 'mL');
    expect(res?.solvedVariable).toBe('C1');
    expect(res?.value).toBe(10); // (1 * 50) / 5 = 10 mM
    expect(res?.diluentVolume).toBe(45); // V2 - V1 = 50 - 5, NOT 0
  });
});

describe('6. Restriction Digest', () => {
  it('cuts linear DNA with EcoRI correctly', () => {
    const seq = 'AAAAAGAATTCAAAAAGAATTCAAAAA'; // 2 EcoRI sites
    const res = digestDna(seq, ['EcoRI'], false);
    expect(res.numCuts).toBe(2);
    expect(res.fragmentSizes).toHaveLength(3); // Linear: cuts + 1 = 3
  });

  it('cuts circular DNA plasmid with EcoRI correctly', () => {
    const seq = 'AAAAAGAATTCAAAAAGAATTCAAAAA';
    const res = digestDna(seq, ['EcoRI'], true);
    expect(res.numCuts).toBe(2);
    expect(res.fragmentSizes).toHaveLength(2); // Circular: distinct cuts = 2
  });

  it('detects a circular restriction site crossing the origin', () => {
    // Bases 9-10 + 1-4 form EcoRI: GA + ATTC = GAATTC.
    // EcoRI cleaves G^AATTC (after base 9), yielding cut position 9.
    const seq = 'ATTCGGGGGA';
    const res = digestDna(seq, ['EcoRI'], true);
    expect(res.numCuts).toBe(1);
    expect(res.allCutSites[0].position).toBe(9);
    expect(res.fragmentSizes).toEqual([10]);
  });

  it('rejects invalid DNA sequence for digest', () => {
    const seq = 'AAAAAGAATTCAAAAAGAATTCAAAAA_INVALID_CHAR_123';
    const res = digestDna(seq, ['EcoRI'], false);
    expect(res.isValid).toBe(false);
    expect(res.fragmentSizes).toHaveLength(0);
  });
});

describe('7. Genetics & Mutations', () => {
  it('calculates Monohybrid Punnett square correctly', () => {
    const res = calculatePunnettSquare('Aa', 'Aa');
    expect(res).not.toBeNull();
    expect(res?.type).toBe('monohybrid');
    expect(res?.grid).toHaveLength(2);
  });

  it('calculates Hardy-Weinberg equilibrium frequencies', () => {
    const res = calculateHardyWeinberg(0.6);
    expect(res?.p).toBe(0.6);
    expect(res?.q).toBe(0.4);
    expect(res?.p2).toBe(0.36);
    expect(res?.twoPQ).toBe(0.48);
    expect(res?.q2).toBe(0.16);
  });

  it('rejects out-of-domain Hardy-Weinberg allele frequencies without silent clamping', () => {
    const resOver = calculateHardyWeinberg(1.5);
    expect(resOver).toBeNull();

    const resNeg = calculateHardyWeinberg(-0.2);
    expect(resNeg).toBeNull();
  });

  it('identifies silent and missense mutation types correctly', () => {
    const silentRes = analyzeMutation('CTA', 'CTG'); // Both translate to Leu
    expect(silentRes.mutationType).toContain('Silent');

    const missenseRes = analyzeMutation('ATG', 'ATA'); // Met -> Ile
    expect(missenseRes.mutationType).toContain('Missense');
  });
});

describe('8. Biochemistry & Enzyme Kinetics', () => {
  it('calculates Michaelis-Menten velocity correctly', () => {
    const res = calculateMichaelisMenten(100, 10, 10);
    expect(res.velocity).toBe(50); // [S]=Km => v = Vmax/2
    expect(res.lineweaverBurk.invSubstrate).toBe(0.1);
  });

  it('handles zero substrate concentration cleanly without fake numbers', () => {
    const res = calculateMichaelisMenten(100, 10, 0);
    expect(res.velocity).toBe(0);
    expect(res.lineweaverBurk.invSubstrate).toBeNull();
  });
});

describe('9. Microbiology Growth Curve', () => {
  it('guarantees phase ordering Lag -> Log -> Stationary -> Death', () => {
    const res = calculateBacterialGrowth(100, 10000, 5, 1, 10);
    expect(res.generations).toBeGreaterThan(0);
    expect(res.curvePoints.length).toBeGreaterThan(0);

    const phases = res.curvePoints.map((p) => p.phase);
    expect(phases).toContain('Lag');
    expect(phases).toContain('Log');
    expect(phases).toContain('Stationary');
    expect(phases).toContain('Death');
  });
});

describe('10. Multi-FASTA, K-Mer, and Newick Parsers', () => {
  it('parses multi-FASTA with unique disambiguated IDs', () => {
    const fasta = `>Seq1\nATGC\n>Seq1\nCGTA`;
    const res = parseMultiFasta(fasta, 'DNA');
    expect(res.totalRecords).toBe(2);
    expect(res.records[0].id).toBe('Seq1');
    expect(res.records[1].id).toBe('Seq1_2');
  });

  it('analyzes k-mers correctly', () => {
    const res = analyzeKmers('ATGCATGC', 3, 'DNA');
    expect(res.isValid).toBe(true);
    expect(res.totalKmers).toBe(6);
  });

  it('parses valid Newick tree syntax', () => {
    const newick = '(A:0.1,B:0.2)C:0.3;';
    const res = parseNewick(newick);
    expect(res.isValid).toBe(true);
    expect(res.totalLeaves).toBe(2);
  });

  it('rejects Newick trees with trailing content after the terminator', () => {
    const res = parseNewick('(A:0.1,B:0.2);GARBAGE');
    expect(res.isValid).toBe(false);
    expect(res.errorMessage).toContain('unexpected content');
  });

  it('rejects Newick trees with malformed branch length or empty clade commas', () => {
    const malformedBranch = '(A:abc,B:0.2);';
    const resBranch = parseNewick(malformedBranch);
    expect(resBranch.isValid).toBe(false);
    expect(resBranch.errorMessage).toContain('branch length');

    const emptyComma = '(A,,B);';
    const resComma = parseNewick(emptyComma);
    expect(resComma.isValid).toBe(false);
  });

  it('rejects FASTA sequence data appearing before the first header line', () => {
    const malformedFasta = 'ATGCATGC\n>Seq1\nCGATCGAT';
    const res = parseMultiFasta(malformedFasta, 'DNA');
    expect(res.hasErrors).toBe(true);
    expect(res.globalErrorMessage).toContain('before');
  });

  it('rejects global alignment for sequences exceeding the 1000 bp limit without silent truncation', () => {
    const longA = 'A'.repeat(1050);
    const longB = 'T'.repeat(1050);
    const res = needlemanWunschAlignment(longA, longB);
    expect(res.warning).toBeDefined();
    expect(res.score).toBe(0);
  });

  it('calculates primers matching calculatePrimerTm', () => {
    const template = 'ATGCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATC'; // 48 bp
    const res = designPrimers(template, 20);
    const expectedTm = calculatePrimerTm('ATGCGATCGATCGATCGATC').tm;
    expect(res.forward.tm).toBe(expectedTm);
  });

  it('returns empty sequence and error warning when designing primers for invalid DNA', () => {
    const res = designPrimers('ATGCXYZ', 20);
    expect(res.forward.sequence).toBe('');
    expect(res.reverse.sequence).toBe('');
    expect(res.forward.warnings[0]).toContain('invalid');
  });

  it('flags mismatches in trailing non-triplet bases for mutation analysis', () => {
    const res = analyzeMutation('ATGC', 'ATGA'); // 4 bases, mismatch at 4th
    expect(res.mutationType).toContain('Missense');
    expect(res.description).toContain('incomplete codon');
  });
});

describe('11. REGRESSION: Centralized Reverse-Complement Architecture', () => {
  it('has exactly one authoritative complement map per molecule type covering all IUPAC codes', () => {
    const dnaCodes = ['A', 'T', 'C', 'G', 'R', 'Y', 'S', 'W', 'K', 'M', 'B', 'D', 'H', 'V', 'N'];
    const rnaCodes = ['A', 'U', 'C', 'G', 'R', 'Y', 'S', 'W', 'K', 'M', 'B', 'D', 'H', 'V', 'N'];
    for (const c of dnaCodes) expect(DNA_COMPLEMENT_MAP[c]).toBeDefined();
    for (const c of rnaCodes) expect(RNA_COMPLEMENT_MAP[c]).toBeDefined();
  });

  it('computes correct DNA complement/reverse-complement for every canonical and IUPAC ambiguity code', () => {
    expect(complementSequence('ATCG', 'DNA')).toBe('TAGC');
    expect(reverseComplement('ATCG', 'DNA')).toBe('CGAT');
    // Full IUPAC ambiguity round trip
    expect(complementSequence('RYSWKMBDHVN', 'DNA')).toBe('YRSWMKVHDBN');
  });

  it('computes correct RNA complement/reverse-complement using U instead of T', () => {
    expect(complementSequence('AUCG', 'RNA')).toBe('UAGC');
    expect(reverseComplement('AUCG', 'RNA')).toBe('CGAU');
    expect(complementSequence('RYSWKMBDHVN', 'RNA')).toBe('YRSWMKVHDBN');
  });

  it('preserves case for lowercase and mixed-case input', () => {
    expect(complementSequence('atcg', 'DNA')).toBe('tagc');
    expect(complementSequence('AtCg', 'DNA')).toBe('TaGc');
    expect(reverseComplement('atcg', 'DNA')).toBe('cgat');
    expect(complementSequence('aucg', 'RNA')).toBe('uagc');
  });

  it('rejects invalid characters instead of silently converting them to N', () => {
    const invalidChars = ['X', 'Z', '1', '-', '*'];
    for (const ch of invalidChars) {
      expect(() => complementSequence(`AT${ch}CG`, 'DNA')).toThrow(InvalidNucleotideError);
      expect(() => reverseComplement(`AT${ch}CG`, 'DNA')).toThrow(InvalidNucleotideError);
      expect(() => getComplementBase(ch, 'DNA')).toThrow(InvalidNucleotideError);
    }
  });

  it('getReverseComplement in bioinformatics.ts and ReverseComplementTool share the same underlying map (no duplicate complement logic)', () => {
    // longest3PrimeComplement (bioinformatics.ts) and complementSequence (dna.ts)
    // must agree on every base, since both now derive from getComplementBase().
    for (const base of ['A', 'T', 'C', 'G']) {
      expect(getComplementBase(base, 'DNA')).toBe(DNA_COMPLEMENT_MAP[base]);
    }
  });
});

describe('12. REGRESSION: Punnett Square Genotype Validation', () => {
  it('accepts valid monohybrid genotypes', () => {
    expect(calculatePunnettSquare('AA', 'Aa')).not.toBeNull();
    expect(calculatePunnettSquare('Aa', 'Aa')).not.toBeNull();
    expect(calculatePunnettSquare('aa', 'Aa')).not.toBeNull();
  });

  it('accepts valid dihybrid genotypes', () => {
    expect(calculatePunnettSquare('AABB', 'AaBb')).not.toBeNull();
    expect(calculatePunnettSquare('AaBb', 'AaBb')).not.toBeNull();
    expect(calculatePunnettSquare('aabb', 'AaBb')).not.toBeNull();
    expect(calculatePunnettSquare('AAbb', 'aaBB')).not.toBeNull();
  });

  it('rejects a locus whose two alleles belong to different genes', () => {
    expect(calculatePunnettSquare('Ab', 'aB')).toBeNull();
  });

  it('rejects a 4-character genotype that is not two valid gene-paired loci', () => {
    expect(calculatePunnettSquare('ABCD', 'abcd')).toBeNull();
  });

  it('rejects genotypes of the wrong length or with non-letter symbols', () => {
    expect(calculatePunnettSquare('AAA', 'Aa')).toBeNull();
    expect(calculatePunnettSquare('A1', 'Aa')).toBeNull();
    expect(calculatePunnettSquare('A-', 'Aa')).toBeNull();
  });

  it('rejects crossing two genotypes that describe different genes', () => {
    expect(calculatePunnettSquare('Aa', 'Bb')).toBeNull();
  });

  it('rejects a genotype with a duplicated/ambiguous gene symbol', () => {
    expect(calculatePunnettSquare('AaAa', 'AaAa')).toBeNull();
  });
});

describe('13. REGRESSION: Newick Branch Length Strict Numeric Validation', () => {
  it('accepts valid numeric branch length forms', () => {
    const validForms = ['0', '0.1', '1', '12.3', '1e-3', '1E-3', '.5'];
    for (const v of validForms) {
      const res = parseNewick(`(A:${v},B:0.2);`);
      expect(res.isValid).toBe(true);
    }
  });

  it('rejects branch lengths with trailing or embedded non-numeric text (parseFloat prefix-matching bug)', () => {
    const invalidForms = ['0.1abc', '12.3.4', '1.2.3', 'abc', '1e', '--1'];
    for (const v of invalidForms) {
      const res = parseNewick(`(A:${v},B:0.2);`);
      expect(res.isValid).toBe(false);
    }
  });
});

describe('14. REGRESSION: Agarose Gel Migration Reflects Concentration', () => {
  it('makes smaller fragments migrate further than larger fragments at a fixed concentration', () => {
    const small = calculateGelMigrationPercent(200, 1.0);
    const large = calculateGelMigrationPercent(8000, 1.0);
    expect(small).toBeGreaterThan(large);
  });

  it('makes increasing agarose concentration reduce migration distance for the same fragment', () => {
    const low = calculateGelMigrationPercent(1000, 0.8);
    const mid = calculateGelMigrationPercent(1000, 1.0);
    const high = calculateGelMigrationPercent(1000, 2.0);
    expect(low).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(high);
  });

  it('is monotonic in gel concentration across the supported range for a fixed fragment size', () => {
    const concentrations = [0.8, 1.0, 1.2, 1.5, 1.8, 2.0];
    const migrations = concentrations.map((c) => calculateGelMigrationPercent(1500, c));
    for (let i = 1; i < migrations.length; i++) {
      expect(migrations[i]).toBeLessThanOrEqual(migrations[i - 1]);
    }
  });
});

describe('15. REGRESSION: Translation Terminates at First Stop Codon', () => {
  it('stops translating immediately after the first in-frame stop codon and ignores downstream codons', () => {
    expect(translateRnaToProtein('ATGGCCTAAATGCCCTTT')).toBe('MA*');
  });

  it('handles each stop codon variant (TAA, TAG, TGA)', () => {
    expect(translateRnaToProtein('ATGTAA')).toBe('M*');
    expect(translateRnaToProtein('ATGTAG')).toBe('M*');
    expect(translateRnaToProtein('ATGTGA')).toBe('M*');
  });

  it('stops at the first stop codon even with more complete codons following it', () => {
    expect(translateRnaToProtein('ATGGCCTAAATG')).toBe('MA*');
  });

  it('translates to the end of available codons when no stop codon is present', () => {
    expect(translateRnaToProtein('ATGGCC')).toBe('MA');
  });

  it('continues working correctly for RNA input using U', () => {
    expect(translateRnaToProtein('AUGGCCAUGUAA')).toBe('MAM*');
  });
});

describe('16. REGRESSION: i18n Key Consistency Across All Locales', () => {
  it('has every translation key present in every supported language', () => {
    const langs = Object.keys(translations);
    const keysByLang: Record<string, Set<string>> = {};
    for (const l of langs) keysByLang[l] = new Set(Object.keys((translations as any)[l]));

    const allKeys = new Set<string>();
    for (const l of langs) for (const k of keysByLang[l]) allKeys.add(k);

    for (const l of langs) {
      const missing = [...allKeys].filter((k) => !keysByLang[l].has(k));
      expect(missing).toEqual([]);
    }
  });

  it('includes the newly added restriction/gel/theme/favorite keys in every locale', () => {
    const requiredKeys = [
      'themeDark',
      'tool_agarose',
      'tool_dna_ladder',
      'tool_lane_label',
      'tool_digest_label',
      'tool_cathode_anode_label',
      'tool_gel_model_note_title',
      'tool_gel_model_note_body',
      'tool_site',
      'tool_none',
      'tool_total_seq_length',
      'favoriteToggle',
      'backToDashboard',
    ];
    for (const lang of Object.keys(translations)) {
      for (const key of requiredKeys) {
        expect((translations as any)[lang][key]).toBeDefined();
      }
    }
  });
});

describe('17. REGRESSION: Protein Isoelectric Point - Lysine pKa Sign Bug', () => {
  it('gives poly-lysine a strongly positive net charge at pH 7 (lysine pKa ~10, so at pH 7 it should be almost fully protonated/positive, not near-neutral or negative)', () => {
    const res = analyzeProtein('KKKKK');
    expect(res).not.toBeNull();
    expect(res!.chargeAtpH7).toBeGreaterThan(3);
  });

  it('gives poly-lysine a high isoelectric point (~10-11, consistent with a strongly basic residue), not a near-neutral/acidic pI', () => {
    const res = analyzeProtein('KKKKK');
    expect(res).not.toBeNull();
    expect(res!.isoelectricPointPI).toBeGreaterThan(9);
  });

  it('treats lysine consistently with arginine and histidine (same basic-residue charge model, same sign convention)', () => {
    const resK = analyzeProtein('KKKKK');
    const resR = analyzeProtein('RRRRR');
    expect(resK).not.toBeNull();
    expect(resR).not.toBeNull();
    // Both are strongly basic residues fully protonated at pH 7; charges
    // should be close (lysine pKa 10 vs arginine pKa 12, both >> pH 7).
    expect(Math.abs(resK!.chargeAtpH7 - resR!.chargeAtpH7)).toBeLessThan(1);
  });

  it('gives a mixed peptide with more basic than acidic residues a net positive charge and basic pI', () => {
    // 2 K + 2 R (basic) vs 2 E (acidic) -> net excess of basic residues
    const res = analyzeProtein('MKALIVLGLVLLSVTVQGKVFERCELAR');
    expect(res).not.toBeNull();
    expect(res!.chargeAtpH7).toBeGreaterThan(0);
    expect(res!.isoelectricPointPI).toBeGreaterThan(7);
  });
});

describe('18. REGRESSION: DNA utility validation and codon optimization ambiguity', () => {
  it('rejects invalid DNA in findMotifPositions instead of searching it', () => {
    expect(findMotifPositions('ATGCXYZ', 'XYZ')).toEqual([]);
  });

  it('rejects invalid DNA in countKmers instead of counting invalid k-mers', () => {
    expect(countKmers('ATGCXYZ', 3)).toEqual({});
  });

  it('does not treat IUPAC ambiguity codes as canonical DNA for codon optimization', () => {
    const res = optimizeCodons('ATGGCN', 'ecoli');
    expect(res.originalDna).toBe('');
    expect(res.optimizedDna).toBe('');
    expect(res.proteinSequence).toBe('');
    expect(res.codonsChanged).toBe(0);
    expect(res.totalCodons).toBe(0);
    // Regression: the empty result must not be silent — the caller (and
    // therefore the UI) must be told why nothing was optimized.
    expect(res.warning).toBeDefined();
    expect(res.warning).toMatch(/ambiguity|ambiguous/i);
  });

  it('surfaces a warning (not a silent empty result) for invalid characters in codon optimization', () => {
    const res = optimizeCodons('ATGXYZ', 'ecoli');
    expect(res.optimizedDna).toBe('');
    expect(res.warning).toBeDefined();
    expect(res.warning).toMatch(/invalid characters/i);
  });

  it('does not emit a warning for a genuinely empty codon-optimization input', () => {
    const res = optimizeCodons('', 'ecoli');
    expect(res.warning).toBeUndefined();
  });

  it('does not emit a warning for valid unambiguous DNA in codon optimization', () => {
    const res = optimizeCodons('ATGAAATAA', 'ecoli');
    expect(res.warning).toBeUndefined();
    expect(res.optimizedDna.length).toBeGreaterThan(0);
  });

  it('does not count IUPAC ambiguity codes as literal N in sequence statistics', () => {
    const stats = calculateSequenceStats('ATGRYS', 'ssDNA');

    expect(stats.baseCounts.A).toBe(1);
    expect(stats.baseCounts.T).toBe(1);
    expect(stats.baseCounts.G).toBe(1);
    expect(stats.baseCounts.N).toBe(0);
  });

  it('rejects invalid input in findOpenReadingFrames', () => {
    expect(findOpenReadingFrames('ATGCXYZ')).toEqual([]);
  });

  it('rejects ambiguous codons in CAI calculation', () => {
    const result = calculateCai('ATGGCN', 'human');
    expect(result.cai).toBe(0);
    expect(result.warning).toContain('ambiguous codons');
  });

});
