// Laboratory Calculators & Solutions Utilities

export interface MolarityResult {
  target: 'mass' | 'molarity' | 'volume';
  value: number;
  unit: string;
  formula: string;
  calculationSteps: string[];
}

export function calculateMolarity(
  massG?: number,
  mw?: number,
  volumeMl?: number,
  molarityM?: number
): MolarityResult | null {
  const isNum = (v: unknown): v is number => v !== undefined && v !== null && typeof v === 'number' && Number.isFinite(v);

  const volL = isNum(volumeMl) ? volumeMl / 1000 : undefined;

  if (isNum(mw) && mw > 0 && isNum(volL) && volL > 0 && isNum(molarityM) && molarityM >= 0 && !isNum(massG)) {
    // Solve Mass
    const mass = molarityM * mw * volL;
    return {
      target: 'mass',
      value: Number(mass.toFixed(4)),
      unit: 'g',
      formula: 'Mass (g) = Molarity (M) × MW (g/mol) × Volume (L)',
      calculationSteps: [
        `Molarity (M) = ${molarityM} mol/L`,
        `Molecular Weight (MW) = ${mw} g/mol`,
        `Volume (L) = ${volumeMl} mL / 1000 = ${volL} L`,
        `Mass = ${molarityM} × ${mw} × ${volL} = ${mass.toFixed(4)} g`,
      ],
    };
  }

  if (isNum(massG) && massG >= 0 && isNum(mw) && mw > 0 && isNum(volL) && volL > 0 && !isNum(molarityM)) {
    // Solve Molarity
    const m = massG / (mw * volL);
    return {
      target: 'molarity',
      value: Number(m.toFixed(4)),
      unit: 'M',
      formula: 'Molarity (M) = Mass (g) / [MW (g/mol) × Volume (L)]',
      calculationSteps: [
        `Mass = ${massG} g`,
        `MW = ${mw} g/mol`,
        `Volume = ${volL} L`,
        `Molarity = ${massG} / (${mw} × ${volL}) = ${m.toFixed(4)} M`,
      ],
    };
  }

  if (isNum(massG) && massG >= 0 && isNum(mw) && mw > 0 && isNum(molarityM) && molarityM > 0 && !isNum(volumeMl)) {
    // Solve Volume
    const vL = massG / (molarityM * mw);
    const vMl = vL * 1000;
    return {
      target: 'volume',
      value: Number(vMl.toFixed(2)),
      unit: 'mL',
      formula: 'Volume (L) = Mass (g) / [Molarity (M) × MW (g/mol)]',
      calculationSteps: [
        `Mass = ${massG} g`,
        `Molarity = ${molarityM} M`,
        `MW = ${mw} g/mol`,
        `Volume (L) = ${massG} / (${molarityM} × ${mw}) = ${vL.toFixed(4)} L (${vMl.toFixed(2)} mL)`,
      ],
    };
  }

  return null;
}

export interface C1V1Result {
  solvedVariable: 'V1' | 'V2' | 'C1' | 'C2';
  value: number;
  unit: string;
  diluentVolume: number; // Volume of solvent to add
  formula: string;
  calculationSteps: string[];
}

export function calculateC1V1(
  c1?: number,
  v1?: number,
  c2?: number,
  v2?: number,
  cUnit = 'mM',
  vUnit = 'mL'
): C1V1Result | null {
  const isNum = (v: unknown): v is number => v !== undefined && v !== null && typeof v === 'number' && Number.isFinite(v);

  // C1 * V1 = C2 * V2
  if (isNum(c1) && c1 > 0 && isNum(c2) && c2 >= 0 && isNum(v2) && v2 > 0 && !isNum(v1)) {
    if (c2 > c1) return null; // Target concentration cannot exceed stock concentration in a dilution
    const calcV1 = (c2 * v2) / c1;
    const diluent = Math.max(0, v2 - calcV1);
    return {
      solvedVariable: 'V1',
      value: Number(calcV1.toFixed(3)),
      unit: vUnit,
      diluentVolume: Number(diluent.toFixed(3)),
      formula: 'V1 = (C2 × V2) / C1',
      calculationSteps: [
        `C1 = ${c1} ${cUnit}, C2 = ${c2} ${cUnit}, V2 = ${v2} ${vUnit}`,
        `V1 = (${c2} × ${v2}) / ${c1} = ${calcV1.toFixed(3)} ${vUnit}`,
        `Diluent Volume (H2O/Buffer) = V2 - V1 = ${v2} - ${calcV1.toFixed(3)} = ${diluent.toFixed(3)} ${vUnit}`,
      ],
    };
  }

  if (isNum(c1) && c1 > 0 && isNum(v1) && v1 > 0 && isNum(c2) && c2 > 0 && !isNum(v2)) {
    if (c2 > c1) return null; // Target concentration cannot exceed stock concentration in a dilution
    const calcV2 = (c1 * v1) / c2;
    const diluent = Math.max(0, calcV2 - v1);
    return {
      solvedVariable: 'V2',
      value: Number(calcV2.toFixed(3)),
      unit: vUnit,
      diluentVolume: Number(diluent.toFixed(3)),
      formula: 'V2 = (C1 × V1) / C2',
      calculationSteps: [
        `C1 = ${c1} ${cUnit}, V1 = ${v1} ${vUnit}, C2 = ${c2} ${cUnit}`,
        `V2 = (${c1} × ${v1}) / ${c2} = ${calcV2.toFixed(3)} ${vUnit}`,
        `Diluent Volume to add = V2 - V1 = ${diluent.toFixed(3)} ${vUnit}`,
      ],
    };
  }

  if (isNum(v1) && v1 > 0 && isNum(c2) && c2 >= 0 && isNum(v2) && v2 > 0 && !isNum(c1)) {
    if (v2 < v1) return null; // Target volume cannot be smaller than stock volume in a dilution
    const calcC1 = (c2 * v2) / v1;
    return {
      solvedVariable: 'C1',
      value: Number(calcC1.toFixed(3)),
      unit: cUnit,
      diluentVolume: 0,
      formula: 'C1 = (C2 × V2) / V1',
      calculationSteps: [
        `V1 = ${v1} ${vUnit}, C2 = ${c2} ${cUnit}, V2 = ${v2} ${vUnit}`,
        `C1 = (${c2} × ${v2}) / ${v1} = ${calcC1.toFixed(3)} ${cUnit}`,
      ],
    };
  }

  if (isNum(c1) && c1 > 0 && isNum(v1) && v1 > 0 && isNum(v2) && v2 > 0 && !isNum(c2)) {
    if (v2 < v1) return null; // Target volume cannot be smaller than stock volume in a dilution
    const calcC2 = (c1 * v1) / v2;
    return {
      solvedVariable: 'C2',
      value: Number(calcC2.toFixed(3)),
      unit: cUnit,
      diluentVolume: Math.max(0, v2 - v1),
      formula: 'C2 = (C1 × V1) / V2',
      calculationSteps: [
        `C1 = ${c1} ${cUnit}, V1 = ${v1} ${vUnit}, V2 = ${v2} ${vUnit}`,
        `C2 = (${c1} × ${v1}) / ${v2} = ${calcC2.toFixed(3)} ${cUnit}`,
      ],
    };
  }

  return null;
}

export function calculateCellDensityOd600(
  od600: number,
  organism = 'E. coli',
  customFactorCellsPerMlPerOd = 8e8
) {
  const isNum = (v: unknown): v is number => v !== undefined && v !== null && typeof v === 'number' && Number.isFinite(v);

  if (!isNum(od600) || od600 < 0) {
    return {
      od600: 0,
      organism,
      cellsPerMl: 0,
      formattedCells: '0',
      disclaimer: 'Approximate educational conversion; actual relationship depends on strain, medium, spectrophotometer pathlength and experimental calibration.',
    };
  }

  const factor = organism === 'Yeast' ? 3e7 : customFactorCellsPerMlPerOd;
  const density = od600 * factor;

  return {
    od600,
    organism,
    cellsPerMl: density,
    formattedCells: density.toExponential(3),
    disclaimer: 'Approximate educational conversion; actual relationship depends on strain, medium, spectrophotometer pathlength and experimental calibration.',
  };
}
