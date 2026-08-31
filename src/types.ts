export type Language = 'en' | 'fa' | 'zh' | 'es' | 'fr' | 'de';

export type Theme = 'light' | 'dark' | 'system';

export type ToolCategory =
  | 'dna_rna'
  | 'genetics'
  | 'pcr_primers'
  | 'restriction'
  | 'protein'
  | 'lab_calc'
  | 'biochemistry'
  | 'microbiology'
  | 'bioinformatics'
  | 'cell_mol';

export type EducationalLevel = 'basic' | 'intermediate' | 'advanced' | 'research';

export interface ToolMeta {
  id: string;
  titleKey: string;
  descKey: string;
  category: ToolCategory;
  iconName: string;
  keywords: string[];
  educationalLevel: EducationalLevel;
  level?: string;
  badge?: string;
  popular?: boolean;
  featured?: boolean;
}

export interface CategoryMeta {
  id: ToolCategory;
  nameKey: string;
  descKey: string;
  iconName: string;
  color: string;
}

// Sequence Analysis Types
export interface SequenceStats {
  length: number;
  gcContent: number;
  atContent: number;
  molecularWeight: number;
  molecularWeightDa?: number;
  baseCounts: { [base: string]: number };
  purityEstimate?: string;
}

export interface ORFResult {
  frame: number; // +1, +2, +3, -1, -2, -3
  start: number;
  end: number;
  lengthBp: number;
  lengthAa: number;
  proteinSequence: string;
}

export interface PrimerResult {
  sequence: string;
  length: number;
  gcContent: number;
  tm: number;
  warnings: string[];
}

export interface PrimerPairResult {
  forward: PrimerResult;
  reverse: PrimerResult;
  score: number;
  warnings: string[];
}

export interface PCRSetupResult {
  forwardPrimer: PrimerResult;
  reversePrimer: PrimerResult;
  ampliconLength: number;
  recommendedTa: number;
  masterMixVolumeUl: number;
  primersVolumeUl: number;
  templateVolumeUl: number;
  waterVolumeUl: number;
}

export interface RestrictionCut {
  enzyme: string;
  site: string;
  positions: number[];
  cutPosition?: number;
  fragmentSizes?: number[];
  matches?: number;
  cutType: 'sticky_5' | 'sticky_3' | 'blunt';
}

export interface GelBand {
  id: string;
  sizeBp: number;
  relativeIntensity: number; // 0 to 1
  label?: string;
}

export interface ProteinStats {
  length: number;
  molecularWeightDa: number;
  isoelectricPointPI: number;
  extinctionCoefficient: number;
  extinctionCoeff?: number;
  gravyIndex: number;
  chargeAtpH7: number;
  aaComposition: { [aa: string]: number };
  aaPercentage: { [aa: string]: number };
}

export interface PunnettResult {
  p1Alleles: string[];
  p2Alleles: string[];
  grid: string[][];
  genotypeRatios: { [genotype: string]: number };
  phenotypeRatios: { [phenotype: string]: number };
}

export interface AlignmentResult {
  alignmentA?: string;
  alignmentB?: string;
  alignedA?: string;
  alignedB?: string;
  matchLine?: string;
  seqA?: string;
  seqB?: string;
  length?: number;
  score: number;
  identityPercent: number;
  similarityPercent?: number;
  gapsCount?: number;
  gaps?: number;
  matchesCount?: number;
  matches?: number;
  mismatchesCount?: number;
  mismatches?: number;
  // Local alignment (Smith-Waterman) only: 1-based start/end positions of
  // the aligned region within each original input sequence.
  startA?: number;
  endA?: number;
  startB?: number;
  endB?: number;
}

export interface EnzymeKineticsPoint {
  substrateConc: number; // [S]
  velocity: number;      // v
  inhibitedVelocity?: number;
}

export interface GrowthCurvePoint {
  timeHours: number;
  cellDensityOD600: number;
  phase: 'lag' | 'log' | 'stationary' | 'death';
}

// Legacy type aliases for backward compatibility
export type DnaRnaResult = SequenceStats;
export type ProteinResult = ProteinStats;
export type ORFItem = ORFResult;
export type PrimerOption = PrimerResult;
export interface NewickNode {
  name?: string;
  length?: number;
  children?: NewickNode[];
}
export interface CodonOptimizationResult {
  optimizedSequence: string;
  caiScore: number;
}
