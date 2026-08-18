// Restriction Enzymes & Combined Cut Digest Engine
import { validateSequence } from './sequenceValidator';

export interface RestrictionEnzyme {
  name: string;
  site: string;
  cutIndex5: number; // Cut offset on 5' strand
  type: 'blunt' | 'sticky';
  supplier?: string;
}

export const COMMON_ENZYMES: RestrictionEnzyme[] = [
  { name: 'EcoRI', site: 'GAATTC', cutIndex5: 1, type: 'sticky' },
  { name: 'BamHI', site: 'GGATCC', cutIndex5: 1, type: 'sticky' },
  { name: 'HindIII', site: 'AAGCTT', cutIndex5: 1, type: 'sticky' },
  { name: 'XhoI', site: 'CTCGAG', cutIndex5: 1, type: 'sticky' },
  { name: 'NotI', site: 'GCGGCCGC', cutIndex5: 2, type: 'sticky' },
  { name: 'PstI', site: 'CTGCAG', cutIndex5: 5, type: 'sticky' },
  { name: 'SalI', site: 'GTCGAC', cutIndex5: 1, type: 'sticky' },
  { name: 'SpeI', site: 'ACTAGT', cutIndex5: 1, type: 'sticky' },
  { name: 'HaeIII', site: 'GGCC', cutIndex5: 2, type: 'blunt' },
  { name: 'SmaI', site: 'CCCGGG', cutIndex5: 3, type: 'blunt' },
  { name: 'XbaI', site: 'TCTAGA', cutIndex5: 1, type: 'sticky' },
  { name: 'SacI', site: 'GAGCTC', cutIndex5: 5, type: 'sticky' },
];

export interface CutSiteInfo {
  position: number; // 1-indexed bp cut site
  enzymeName: string;
}

export interface DigestResult {
  dnaLength: number;
  isCircular: boolean;
  selectedEnzymeNames: string[];
  allCutSites: CutSiteInfo[];
  fragmentSizes: number[];
  numCuts: number;
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Performs restriction digestion.
 * Combines ALL cut positions from selected enzymes into one ordered list to calculate combined fragment sizes.
 */
export function digestDna(
  sequence: string,
  selectedEnzymes: string[],
  isCircular = false
): DigestResult {
  const val = validateSequence(sequence, 'DNA');

  if (!val.isValid) {
    return {
      dnaLength: 0,
      isCircular,
      selectedEnzymeNames: selectedEnzymes,
      allCutSites: [],
      fragmentSizes: [],
      numCuts: 0,
      isValid: false,
      errorMessage: val.errorMessage || 'DNA sequence contains invalid characters.',
    };
  }

  const dna = val.cleanSequence;
  const len = dna.length;

  if (len === 0 || selectedEnzymes.length === 0) {
    return {
      dnaLength: len,
      isCircular,
      selectedEnzymeNames: selectedEnzymes,
      allCutSites: [],
      fragmentSizes: len > 0 ? [len] : [],
      numCuts: 0,
      isValid: val.isValid,
      errorMessage: val.isValid ? undefined : val.errorMessage,
    };
  }

  const activeEnzymes = COMMON_ENZYMES.filter((e) => selectedEnzymes.includes(e.name));
  const cutSiteMap: Map<number, string[]> = new Map();

  for (const ez of activeEnzymes) {
    const site = ez.site;
    const searchSeq = isCircular ? dna + dna.slice(0, site.length - 1) : dna;
    let idx = searchSeq.indexOf(site);

    while (idx !== -1) {
      if (idx < len) {
        const cutPos = (idx + ez.cutIndex5) % len || len; // 1-indexed bp cut site (1..len)
        if (!cutSiteMap.has(cutPos)) {
          cutSiteMap.set(cutPos, []);
        }
        if (!cutSiteMap.get(cutPos)!.includes(ez.name)) {
          cutSiteMap.get(cutPos)!.push(ez.name);
        }
      }
      idx = searchSeq.indexOf(site, idx + 1);
    }
  }

  const sortedCutPositions = Array.from(cutSiteMap.keys()).sort((a, b) => a - b);
  const allCutSites: CutSiteInfo[] = sortedCutPositions.map((pos) => ({
    position: pos,
    enzymeName: cutSiteMap.get(pos)!.join(' + '),
  }));

  const numCuts = allCutSites.length;
  const fragmentSizes: number[] = [];

  if (numCuts === 0) {
    fragmentSizes.push(len);
  } else if (!isCircular) {
    // Linear DNA digestion
    const boundaries = [0, ...sortedCutPositions, len];
    for (let i = 0; i < boundaries.length - 1; i++) {
      const fragLen = boundaries[i + 1] - boundaries[i];
      if (fragLen > 0) fragmentSizes.push(fragLen);
    }
  } else {
    // Circular DNA plasmid digestion
    for (let i = 0; i < numCuts - 1; i++) {
      fragmentSizes.push(sortedCutPositions[i + 1] - sortedCutPositions[i]);
    }
    // Wraparound fragment from last cut back to first cut
    const wrapFrag = len - sortedCutPositions[numCuts - 1] + sortedCutPositions[0];
    if (wrapFrag > 0) fragmentSizes.push(wrapFrag);
  }

  return {
    dnaLength: len,
    isCircular,
    selectedEnzymeNames: selectedEnzymes,
    allCutSites,
    fragmentSizes: fragmentSizes.sort((a, b) => b - a), // Sort largest to smallest
    numCuts,
    isValid: val.isValid,
    errorMessage: val.isValid ? undefined : val.errorMessage,
  };
}

/**
 * Computes the vertical migration percentage (10-90, distance travelled
 * from the sample well) of a DNA fragment on a simulated agarose gel.
 *
 * Base model: migration distance is inversely proportional to
 * log10(fragment size), within a supported size window [minBp, maxBp].
 * This mirrors the classic Southern (1979) style approximation also
 * used for real DNA ladders.
 *
 * Gel concentration effect: increasing agarose % increases the density
 * of the gel matrix, which increases drag and REDUCES migration
 * distance for a given fragment size (this is why denser gels, e.g.
 * 2.0%, are used to resolve small fragments - large fragments barely
 * move through them - while looser gels, e.g. 0.8%, are used to
 * resolve large fragments). This is modeled as a simple, monotonic
 * scaling of the migration ratio relative to a 1.0% baseline (the
 * concentration the base distance window above is calibrated
 * against): concentrationFactor = 1.0 / gelConcentrationPercent.
 *
 * This is an educational approximation for visualization purposes, not
 * a physical electrophoresis mobility model (real mobility depends on
 * voltage, buffer, DNA conformation, run time, etc. - see the UI note).
 */
export function calculateGelMigrationPercent(
  sizeBp: number,
  gelConcentrationPercent = 1.0,
  maxBp = 10000,
  minBp = 100
): number {
  if (
    !Number.isFinite(sizeBp) ||
    !Number.isFinite(gelConcentrationPercent) ||
    !Number.isFinite(maxBp) ||
    !Number.isFinite(minBp) ||
    sizeBp <= 0 ||
    gelConcentrationPercent <= 0 ||
    minBp <= 0 ||
    maxBp <= minBp
  ) {
    return 0;
  }

  const safeConc = gelConcentrationPercent;
  const logMax = Math.log10(maxBp);
  const logMin = Math.log10(minBp);
  const logS = Math.log10(Math.max(sizeBp, minBp));

  // Smaller fragments move further (higher percentage down the gel)
  const ratio = (logMax - logS) / (logMax - logMin);

  const BASELINE_CONCENTRATION_PERCENT = 1.0;
  const concentrationFactor = BASELINE_CONCENTRATION_PERCENT / safeConc;

  const scaledRatio = ratio * concentrationFactor;
  return Math.max(10, Math.min(90, 10 + scaledRatio * 80));
}

export const DNA_LADDERS = {
  kb1: {
    name: '1 kb DNA Ladder',
    bandsBp: [10000, 8000, 6000, 5000, 4000, 3000, 2000, 1500, 1000, 500],
  },
  bp100: {
    name: '100 bp DNA Ladder',
    bandsBp: [1500, 1200, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100],
  },
};