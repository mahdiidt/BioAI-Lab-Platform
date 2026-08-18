// Genetics & Genomics Calculators
import { translateRnaToProtein } from './dna';
import { validateSequence } from './sequenceValidator';

export interface PunnettResult {
  p1: string;
  p2: string;
  type: 'monohybrid' | 'dihybrid';
  p1Gametes: string[];
  p2Gametes: string[];
  grid: string[][]; // row = p1Gamete, col = p2Gamete
  genotypeCounts: Record<string, number>;
  genotypeRatios: Record<string, { count: number; ratio: number; percent: number }>;
  phenotypeRatios: Record<string, { count: number; ratio: number; percent: number }>;
  assumptions: string;
}

/**
 * Splits a genotype string into its per-locus allele pairs and validates
 * genuine Mendelian genotype structure:
 *  - the genotype must be a non-empty even-length run of letters
 *  - each locus (consecutive pair of characters) must represent the SAME
 *    gene, i.e. both characters share the same letter case-insensitively
 *    (e.g. "Aa", "AA", "aa" - NOT "Ab", which mixes two different genes)
 *  - each gene symbol may only appear once in the genotype (e.g. "AaAa"
 *    is rejected as an ambiguous duplicate locus)
 *
 * Returns the list of locus pairs (e.g. "AaBb" -> ["Aa", "Bb"]) or null
 * if the genotype is not a structurally valid diploid genotype.
 */
function parseGenotypeLoci(genotype: string): string[] | null {
  if (!/^[A-Za-z]+$/.test(genotype)) return null;
  if (genotype.length === 0 || genotype.length % 2 !== 0) return null;

  const loci: string[] = [];
  const usedGeneSymbols = new Set<string>();

  for (let i = 0; i < genotype.length; i += 2) {
    const a = genotype[i];
    const b = genotype[i + 1];

    // Both alleles at a locus must belong to the same gene (same letter,
    // case-insensitive) - "Ab" is not a valid single-locus genotype.
    if (a.toUpperCase() !== b.toUpperCase()) return null;

    const geneSymbol = a.toUpperCase();
    if (usedGeneSymbols.has(geneSymbol)) return null; // duplicate/ambiguous locus
    usedGeneSymbols.add(geneSymbol);

    loci.push(a + b);
  }

  return loci;
}

/**
 * Calculates Punnett Square for Monohybrid (2x2, e.g. "Aa" x "Aa") or Dihybrid (4x4, e.g. "AaBb" x "AaBb").
 *
 * Returns null if either genotype is not a structurally valid diploid
 * genotype (see parseGenotypeLoci), if the two parents don't describe
 * the same set of loci in the same order, or if the cross is neither a
 * 1-locus (monohybrid) nor 2-locus (dihybrid) cross.
 */
export function calculatePunnettSquare(p1Input: string, p2Input: string): PunnettResult | null {
  const p1 = p1Input.trim().replace(/\s+/g, '');
  const p2 = p2Input.trim().replace(/\s+/g, '');

  const assumptions =
    'Assumes standard Mendelian complete dominance (uppercase allele is dominant over lowercase allele) and independent assortment without genetic linkage or epistasis.';

  const p1Loci = parseGenotypeLoci(p1);
  const p2Loci = parseGenotypeLoci(p2);

  if (!p1Loci || !p2Loci) return null;
  if (p1Loci.length !== p2Loci.length) return null;
  if (p1Loci.length !== 1 && p1Loci.length !== 2) return null;

  // Both parents must describe the same gene(s), at the same locus
  // position, e.g. "AaBb" x "aabb" (both: locus A, locus B) is valid;
  // "Aa" x "Bb" (different genes) is not a meaningful single cross.
  for (let i = 0; i < p1Loci.length; i++) {
    if (p1Loci[i][0].toUpperCase() !== p2Loci[i][0].toUpperCase()) return null;
  }

  if (p1.length === 2 && p2.length === 2) {
    // Monohybrid cross
    const p1Gametes = [p1[0], p1[1]];
    const p2Gametes = [p2[0], p2[1]];

    const grid: string[][] = [];
    const genotypeCounts: Record<string, number> = {};
    const phenotypeCounts: Record<string, number> = {};

    for (let r = 0; r < 2; r++) {
      const row: string[] = [];
      for (let c = 0; c < 2; c++) {
        const alleles = [p1Gametes[r], p2Gametes[c]].sort((a, b) => {
          if (a.toUpperCase() === b.toUpperCase()) {
            return a === a.toUpperCase() ? -1 : 1;
          }
          return a.toUpperCase().localeCompare(b.toUpperCase());
        });
        const gt = alleles.join('');
        row.push(gt);
        genotypeCounts[gt] = (genotypeCounts[gt] || 0) + 1;

        // Phenotype: Uppercase present = Dominant
        const traitA = gt.includes(p1Gametes[0].toUpperCase()) || gt.includes(p2Gametes[0].toUpperCase())
          ? `Dominant (${p1Gametes[0].toUpperCase()}_)`
          : `Recessive (${p1Gametes[0].toLowerCase()}${p1Gametes[0].toLowerCase()})`;
        
        phenotypeCounts[traitA] = (phenotypeCounts[traitA] || 0) + 1;
      }
      grid.push(row);
    }

    const total = 4;
    const genotypeRatios: Record<string, { count: number; ratio: number; percent: number }> = {};
    for (const [gt, count] of Object.entries(genotypeCounts)) {
      genotypeRatios[gt] = {
        count,
        ratio: count / total,
        percent: Number(((count / total) * 100).toFixed(1)),
      };
    }

    const phenotypeRatios: Record<string, { count: number; ratio: number; percent: number }> = {};
    for (const [pheno, count] of Object.entries(phenotypeCounts)) {
      phenotypeRatios[pheno] = {
        count,
        ratio: count / total,
        percent: Number(((count / total) * 100).toFixed(1)),
      };
    }

    return {
      p1,
      p2,
      type: 'monohybrid',
      p1Gametes,
      p2Gametes,
      grid,
      genotypeCounts,
      genotypeRatios,
      phenotypeRatios,
      assumptions,
    };
  } else if (p1.length === 4 && p2.length === 4) {
    // Dihybrid cross (e.g. AaBb x AaBb)
    const getDihybridGametes = (p: string) => {
      const g1 = [p[0], p[1]];
      const g2 = [p[2], p[3]];
      const gametes: string[] = [];
      for (const a1 of g1) {
        for (const a2 of g2) {
          gametes.push(`${a1}${a2}`);
        }
      }
      return gametes;
    };

    const p1Gametes = getDihybridGametes(p1);
    const p2Gametes = getDihybridGametes(p2);

    const grid: string[][] = [];
    const genotypeCounts: Record<string, number> = {};
    const phenotypeCounts: Record<string, number> = {};

    for (let r = 0; r < 4; r++) {
      const row: string[] = [];
      for (let c = 0; c < 4; c++) {
        const g1 = p1Gametes[r];
        const g2 = p2Gametes[c];

        // Gene 1 alleles
        const trait1 = [g1[0], g2[0]].sort((a, b) => {
          if (a.toUpperCase() === b.toUpperCase()) return a === a.toUpperCase() ? -1 : 1;
          return a.toUpperCase().localeCompare(b.toUpperCase());
        }).join('');

        // Gene 2 alleles
        const trait2 = [g1[1], g2[1]].sort((a, b) => {
          if (a.toUpperCase() === b.toUpperCase()) return a === a.toUpperCase() ? -1 : 1;
          return a.toUpperCase().localeCompare(b.toUpperCase());
        }).join('');

        const gt = `${trait1}${trait2}`;
        row.push(gt);
        genotypeCounts[gt] = (genotypeCounts[gt] || 0) + 1;

        // Phenotypes
        const gene1Dom = trait1.includes(trait1[0].toUpperCase()) && trait1[0] === trait1[0].toUpperCase();
        const gene2Dom = trait2.includes(trait2[0].toUpperCase()) && trait2[0] === trait2[0].toUpperCase();

        const p1Label = gene1Dom ? `Trait 1 Dom (${trait1[0]}_)` : `Trait 1 Rec (${trait1[0]}${trait1[0]})`;
        const p2Label = gene2Dom ? `Trait 2 Dom (${trait2[0]}_)` : `Trait 2 Rec (${trait2[0]}${trait2[0]})`;
        const pheno = `${p1Label} + ${p2Label}`;

        phenotypeCounts[pheno] = (phenotypeCounts[pheno] || 0) + 1;
      }
      grid.push(row);
    }

    const total = 16;
    const genotypeRatios: Record<string, { count: number; ratio: number; percent: number }> = {};
    for (const [gt, count] of Object.entries(genotypeCounts)) {
      genotypeRatios[gt] = {
        count,
        ratio: count / total,
        percent: Number(((count / total) * 100).toFixed(1)),
      };
    }

    const phenotypeRatios: Record<string, { count: number; ratio: number; percent: number }> = {};
    for (const [pheno, count] of Object.entries(phenotypeCounts)) {
      phenotypeRatios[pheno] = {
        count,
        ratio: count / total,
        percent: Number(((count / total) * 100).toFixed(1)),
      };
    }

    return {
      p1,
      p2,
      type: 'dihybrid',
      p1Gametes,
      p2Gametes,
      grid,
      genotypeCounts,
      genotypeRatios,
      phenotypeRatios,
      assumptions,
    };
  }

  return null;
}

export function calculateHardyWeinberg(p?: number, q?: number, p2?: number, pq2?: number, q2?: number) {
  let calcP: number | undefined = p;
  let calcQ: number | undefined = q;

  if (calcP !== undefined && Number.isFinite(calcP)) {
    if (calcP < 0 || calcP > 1) return null;
    calcQ = 1 - calcP;
  } else if (calcQ !== undefined && Number.isFinite(calcQ)) {
    if (calcQ < 0 || calcQ > 1) return null;
    calcP = 1 - calcQ;
  } else if (q2 !== undefined && Number.isFinite(q2)) {
    if (q2 < 0 || q2 > 1) return null;
    calcQ = Math.sqrt(q2);
    calcP = 1 - calcQ;
  } else if (p2 !== undefined && Number.isFinite(p2)) {
    if (p2 < 0 || p2 > 1) return null;
    calcP = Math.sqrt(p2);
    calcQ = 1 - calcP;
  } else {
    return null;
  }

  if (calcP < 0 || calcP > 1 || calcQ < 0 || calcQ > 1) return null;

  const freqP2 = Math.pow(calcP, 2);
  const freq2PQ = 2 * calcP * calcQ;
  const freqQ2 = Math.pow(calcQ, 2);

  return {
    p: Number(calcP.toFixed(4)),
    q: Number(calcQ.toFixed(4)),
    p2: Number(freqP2.toFixed(4)),
    twoPQ: Number(freq2PQ.toFixed(4)),
    q2: Number(freqQ2.toFixed(4)),
    isEquilibrium: Math.abs(freqP2 + freq2PQ + freqQ2 - 1) < 0.0001,
  };
}

export function analyzeMutation(originalDna: string, mutatedDna: string) {
  const valOrig = validateSequence(originalDna, 'DNA');
  const valMut = validateSequence(mutatedDna, 'DNA');

  if (!valOrig.isValid) {
    return {
      mutationType: 'Invalid Input',
      description: `Original sequence contains invalid characters: ${valOrig.invalidChars.join(', ')}`,
      changedCodons: [],
      isFrameshift: false,
    };
  }

  if (!valMut.isValid) {
    return {
      mutationType: 'Invalid Input',
      description: `Mutated sequence contains invalid characters: ${valMut.invalidChars.join(', ')}`,
      changedCodons: [],
      isFrameshift: false,
    };
  }

  const orig = valOrig.cleanSequence.replace(/U/g, 'T');
  const mut = valMut.cleanSequence.replace(/U/g, 'T');

  if (!orig || !mut) {
    return {
      mutationType: 'Invalid Input',
      description: 'One or both sequence inputs are empty.',
      changedCodons: [],
      isFrameshift: false,
    };
  }

  const lenDiff = mut.length - orig.length;

  if (lenDiff !== 0) {
    const isFrameshift = Math.abs(lenDiff) % 3 !== 0;
    const isInsertion = lenDiff > 0;
    const sizeBp = Math.abs(lenDiff);

    let mutationType = isInsertion
      ? isFrameshift
        ? 'Potential Frameshift Insertion'
        : 'In-Frame Insertion'
      : isFrameshift
      ? 'Potential Frameshift Deletion'
      : 'In-Frame Deletion';

    let description = isFrameshift
      ? `Length change of ${lenDiff > 0 ? '+' : ''}${lenDiff} bp is not a multiple of 3. Potential frameshift based on coding-frame assumptions downstream.`
      : `In-frame ${isInsertion ? 'insertion' : 'deletion'} of ${sizeBp} bp (${sizeBp / 3} codon(s)). Preserves reading frame downstream.`;

    return {
      mutationType,
      description,
      changedCodons: [],
      lenDiff,
      isFrameshift,
      label: 'Potential frameshift based on coding-frame assumptions.',
    };
  }

  // Same length: Substitution / Point Mutation
  let mismatches = 0;
  const changedCodons: Array<{ position: number; origCodon: string; mutCodon: string; origAa: string; mutAa: string }> = [];

  for (let i = 0; i < orig.length; i++) {
    if (orig[i] !== mut[i]) {
      mismatches++;
    }
  }

  if (mismatches === 0) {
    return {
      mutationType: 'No Mutation (100% Identical)',
      description: 'The mutated DNA sequence is identical to the original sequence.',
      changedCodons: [],
      isFrameshift: false,
    };
  }

  const rem = orig.length % 3;
  let isSilent = true;
  let isNonsense = false;
  let isMissense = false;
  let nonTripletMismatch = false;

  for (let i = 0; i <= orig.length - 3; i += 3) {
    const origCodon = orig.substring(i, i + 3);
    const mutCodon = mut.substring(i, i + 3);

    if (origCodon !== mutCodon) {
      const origAa = translateRnaToProtein(origCodon);
      const mutAa = translateRnaToProtein(mutCodon);

      changedCodons.push({
        position: i + 1,
        origCodon,
        mutCodon,
        origAa,
        mutAa,
      });

      if (origAa !== mutAa) {
        isSilent = false;
        if (mutAa === '*') {
          isNonsense = true;
        } else {
          isMissense = true;
        }
      }
    }
  }

  // Check trailing non-triplet bases if present
  if (rem > 0) {
    const trailingStart = orig.length - rem;
    const origTrail = orig.substring(trailingStart);
    const mutTrail = mut.substring(trailingStart);
    if (origTrail !== mutTrail) {
      nonTripletMismatch = true;
      isSilent = false;
      changedCodons.push({
        position: trailingStart + 1,
        origCodon: origTrail,
        mutCodon: mutTrail,
        origAa: 'Partial Codon',
        mutAa: 'Partial Codon',
      });
    }
  }

  let mutationType = 'Synonymous (Silent) Substitution';
  let description = 'Nucleotide point substitution that does not alter the encoded amino acid due to codon degeneracy.';

  if (isNonsense) {
    mutationType = 'Nonsense Point Mutation';
    description = 'Substitution introduces a premature STOP codon (*), truncating the protein product.';
  } else if (isMissense || nonTripletMismatch) {
    mutationType = 'Missense Point Mutation';
    description = nonTripletMismatch
      ? 'Point substitution in trailing incomplete codon region (sequence length is not a multiple of 3).'
      : 'Substitution alters a codon, replacing an amino acid in the protein sequence.';
  }


  return {
    mutationType,
    description,
    changedCodons,
    mismatchCount: mismatches,
    isFrameshift: false,
    label: 'Point substitution in coding region.',
  };
}