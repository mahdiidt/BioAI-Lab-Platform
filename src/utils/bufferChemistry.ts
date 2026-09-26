// Henderson-Hasselbalch Buffer Chemistry Utilities
//
// pH = pKa + log10( [A-] / [HA] )
//
// Given a target pH, a pKa, and a total buffer concentration, the ratio
// [A-]/[HA] follows directly from the equation above. Combined with the
// mass-balance constraint [A-] + [HA] = totalConcentration, this lets us
// compute exactly how much acid-form stock and base-form stock (both
// prepared at the same total concentration) must be mixed to hit a target
// pH and total volume.

export interface BufferSystem {
  id: string;
  name: string;
  pKa: number;
  note?: string;
}

// Representative pKa values for common laboratory buffer systems.
// Polyprotic acids (e.g. citrate) have multiple pKa values; a single
// representative value is used here for simplicity (see `note`).
export const BUFFER_SYSTEMS: BufferSystem[] = [
  { id: 'acetate', name: 'Acetate (acetic acid / sodium acetate)', pKa: 4.76 },
  {
    id: 'citrate',
    name: 'Citrate (citric acid / sodium citrate)',
    pKa: 4.76,
    note: 'Citric acid is triprotic (pKa1 ≈ 3.13, pKa2 ≈ 4.76, pKa3 ≈ 6.40). pKa2 is used here as a single representative value; real citrate buffers involve all three equilibria.',
  },
  { id: 'phosphate', name: 'Phosphate (NaH₂PO₄ / Na₂HPO₄)', pKa: 7.21 },
  { id: 'tris', name: 'Tris (Tris base / Tris-HCl)', pKa: 8.06 },
  { id: 'bicarbonate', name: 'Bicarbonate (carbonic acid / bicarbonate)', pKa: 6.35 },
  { id: 'custom', name: 'Custom pKa', pKa: 7.0 },
];

export interface MixingVolumesResult {
  acidVolumeMl: number;
  baseVolumeMl: number;
  ratio: number;
  percentIonized: number;
  bufferingCapacityWarning: string | null;
  formula: string;
}

const isFiniteNumber = (v: unknown): v is number =>
  v !== undefined && v !== null && typeof v === 'number' && Number.isFinite(v);

function validatePka(pKa: number, label = 'pKa'): void {
  if (!isFiniteNumber(pKa) || pKa < 0 || pKa > 14) {
    throw new Error(`Invalid ${label}: must be a finite number between 0 and 14.`);
  }
}

function validatePositive(value: number, label: string): void {
  if (!isFiniteNumber(value) || value <= 0) {
    throw new Error(`Invalid ${label}: must be a positive finite number.`);
  }
}

/**
 * Calculates buffer pH from the Henderson-Hasselbalch equation:
 *   pH = pKa + log10( [A-] / [HA] )
 *
 * @param pKa acid dissociation constant (0-14)
 * @param concentrationBase concentration of the conjugate base form [A-], must be > 0
 * @param concentrationAcid concentration of the weak acid form [HA], must be > 0
 */
export function calculatePhFromRatio(pKa: number, concentrationBase: number, concentrationAcid: number): number {
  validatePka(pKa);
  validatePositive(concentrationBase, 'base concentration [A-]');
  validatePositive(concentrationAcid, 'acid concentration [HA]');

  const ratio = concentrationBase / concentrationAcid;
  const pH = pKa + Math.log10(ratio);
  return Number(pH.toFixed(3));
}

/**
 * Given a target pH, a pKa, and a total buffer concentration + volume,
 * computes the volumes of acid-form stock and base-form stock (both
 * assumed prepared at `totalConcentrationM`) needed to mix to reach the
 * target pH, using Henderson-Hasselbalch plus simple mass balance
 * ([A-] + [HA] = totalConcentrationM).
 *
 * @param pKa acid dissociation constant (0-14)
 * @param targetPh desired final buffer pH (0-14)
 * @param totalConcentrationM total buffer concentration (M), must be > 0
 * @param totalVolumeMl total final buffer volume (mL), must be > 0
 */
export function calculateMixingVolumes(
  pKa: number,
  targetPh: number,
  totalConcentrationM: number,
  totalVolumeMl: number
): MixingVolumesResult {
  validatePka(pKa);
  validatePka(targetPh, 'target pH');
  validatePositive(totalConcentrationM, 'total buffer concentration');
  validatePositive(totalVolumeMl, 'total volume');

  // [A-]/[HA] = 10^(pH - pKa)
  const ratio = Math.pow(10, targetPh - pKa);

  // Mass balance: V_acid + V_base = totalVolumeMl, with both stocks at the
  // same total concentration, so the volume ratio equals the mole ratio.
  const acidVolumeMl = totalVolumeMl / (1 + ratio);
  const baseVolumeMl = totalVolumeMl - acidVolumeMl;

  const percentIonized = (ratio / (1 + ratio)) * 100;

  const deltaFromPka = Math.abs(targetPh - pKa);
  const bufferingCapacityWarning =
    deltaFromPka > 1
      ? `Target pH is ${deltaFromPka.toFixed(2)} units from the pKa (${pKa}). Buffers resist pH change effectively only within about pKa ± 1 — consider a buffer system with a pKa closer to your target pH.`
      : null;

  return {
    acidVolumeMl: Number(acidVolumeMl.toFixed(3)),
    baseVolumeMl: Number(baseVolumeMl.toFixed(3)),
    ratio: Number(ratio.toFixed(4)),
    percentIonized: Number(percentIonized.toFixed(2)),
    bufferingCapacityWarning,
    formula: 'pH = pKa + log10([A-] / [HA])',
  };
}
