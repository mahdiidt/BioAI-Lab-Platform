// Protein Analysis & Isoelectric Point Utilities
import { validateSequence } from './sequenceValidator';

export const AMINO_ACID_MW: Record<string, number> = {
  A: 89.09, R: 174.2, N: 132.12, D: 133.1, C: 121.16,
  E: 147.13, Q: 146.15, G: 75.07, H: 155.16, I: 131.17,
  L: 131.17, K: 146.19, M: 149.21, F: 165.19, P: 115.13,
  S: 105.09, T: 119.12, W: 204.23, Y: 181.19, V: 117.15,
};

// Kyte-Doolittle Hydropathy Scale for GRAVY calculation
export const KYTE_DOOLITTLE: Record<string, number> = {
  A: 1.8, R: -4.5, N: -3.5, D: -3.5, C: 2.5,
  E: -3.5, Q: -3.5, G: -0.4, H: -3.2, I: 4.5,
  L: 3.8, K: -3.9, M: 1.9, F: 2.8, P: -1.6,
  S: -0.8, T: -0.7, W: -0.9, Y: -1.3, V: 4.2,
};

// Bjellqvist pKa values for pI calculation
export const PKA_VALUES = {
  N_term: 7.5,
  C_term: 3.55,
  D: 4.05, // Aspartate
  E: 4.45, // Glutamate
  H: 5.98, // Histidine
  C: 9.0,  // Cysteine
  Y: 10.0, // Tyrosine
  K: 10.0, // Lysine
  R: 12.0, // Arginine
};

export function analyzeProtein(sequence: string) {
  const val = validateSequence(sequence, 'PROTEIN');
  const seq = val.cleanSequence.replace(/\*/g, '');
  const length = seq.length;

  if (length === 0 || !val.isValid) {
    return null;
  }

  const counts: Record<string, number> = {};
  for (const aa of Object.keys(AMINO_ACID_MW)) {
    counts[aa] = 0;
  }

  let mw = 0;
  let gravySum = 0;

  for (const char of seq) {
    if (AMINO_ACID_MW[char]) {
      counts[char]++;
      mw += AMINO_ACID_MW[char] - 18.015; // Subtract H2O per peptide bond
      gravySum += KYTE_DOOLITTLE[char] || 0;
    }
  }

  mw += 18.015; // Add terminal H2O

  const gravyIndex = Number((gravySum / length).toFixed(3));
  const molecularWeightDa = Number(mw.toFixed(1));

  // Percentage composition
  const percentages: Record<string, number> = {};
  for (const aa of Object.keys(counts)) {
    percentages[aa] = Number(((counts[aa] / length) * 100).toFixed(1));
  }

  // Calculate extinction coefficient (M^-1 cm^-1 at 280 nm) - Pace/Gill method
  // Extinction = (Trp * 5500) + (Tyr * 1490) + (Cystine pairs * 125)
  // Only cysteines engaged in disulfide bonds (cystine) contribute; free/unpaired Cys = 0.
  // Since bonding state isn't known from sequence alone, assume max possible pairing (floor(C/2)).
  const cystinePairs = Math.floor(counts.C / 2);
  const extinctionCoeff = counts.W * 5500 + counts.Y * 1490 + cystinePairs * 125;

  // Calculate pI by bisection method between pH 0 and pH 14
  const pi = calculateIsoelectricPoint(counts);

  // Charge at pH 7.0
  const chargeAtpH7 = Number(calculateProteinNetCharge(counts, 7.0).toFixed(2));

  return {
    length,
    molecularWeightDa,
    isoelectricPointPI: pi,
    gravyIndex,
    extinctionCoeff,
    chargeAtpH7,
    aaCounts: counts,
    aaPercentages: percentages,
    isValid: val.isValid,
    invalidChars: val.invalidChars,
  };
}

function calculateProteinNetCharge(counts: Record<string, number>, pH: number): number {
  const cN = 1 / (1 + Math.pow(10, pH - PKA_VALUES.N_term));
  const cC = -1 / (1 + Math.pow(10, PKA_VALUES.C_term - pH));

  const cD = -counts.D / (1 + Math.pow(10, PKA_VALUES.D - pH));
  const cE = -counts.E / (1 + Math.pow(10, PKA_VALUES.E - pH));
  const cCys = -counts.C / (1 + Math.pow(10, PKA_VALUES.C - pH));
  const cY = -counts.Y / (1 + Math.pow(10, PKA_VALUES.Y - pH));

  const cH = counts.H / (1 + Math.pow(10, pH - PKA_VALUES.H));
  const cK = counts.K / (1 + Math.pow(10, pH - PKA_VALUES.K));
  const cR = counts.R / (1 + Math.pow(10, pH - PKA_VALUES.R));

  return cN + cC + cD + cE + cCys + cY + cH + cK + cR;
}

function calculateIsoelectricPoint(counts: Record<string, number>): number {
  let minPh = 0.0;
  let maxPh = 14.0;
  let ph = 7.0;

  for (let iter = 0; iter < 15; iter++) {
    ph = (minPh + maxPh) / 2;
    const charge = calculateProteinNetCharge(counts, ph);

    if (charge > 0) {
      minPh = ph;
    } else {
      maxPh = ph;
    }
  }

  return Number(ph.toFixed(2));
}
