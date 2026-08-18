// Biochemistry & Enzyme Kinetics Utilities

export interface MichaelisMentenResult {
  velocity: number;
  effectiveKm: number;
  effectiveVmax: number;
  percentVmax: number;
  catalyticEfficiency: number;
  lineweaverBurk: {
    invSubstrate: number | null;
    invVelocity: number | null;
    warningNote: string;
  };
  curvePoints: Array<{ substrate: number; velocity: number }>;
  lineweaverBurkPoints: Array<{ invSubstrate: number; invVelocity: number }>;
  formula: string;
  disclaimer: string;
}

export function calculateMichaelisMenten(
  vmax: number,
  km: number,
  substrateConc: number,
  inhibitorConc = 0,
  ki = 1,
  inhibitionType: 'none' | 'competitive' | 'noncompetitive' = 'none'
): MichaelisMentenResult {
  const isNum = (v: unknown): v is number => v !== undefined && v !== null && typeof v === 'number' && Number.isFinite(v);

  const fallbackLb = {
    invSubstrate: null,
    invVelocity: null,
    warningNote: 'Lineweaver-Burk double-reciprocal transformation distorts experimental error structures at low substrate concentrations.',
  };

  if (!isNum(km) || km <= 0 || !isNum(vmax) || vmax <= 0 || !isNum(substrateConc) || substrateConc < 0) {
    return {
      velocity: 0,
      effectiveKm: 0,
      effectiveVmax: 0,
      percentVmax: 0,
      catalyticEfficiency: 0,
      lineweaverBurk: fallbackLb,
      curvePoints: [],
      lineweaverBurkPoints: [],
      formula: 'v = (Vmax × [S]) / (Km + [S])',
      disclaimer: 'Invalid input parameters. Vmax and Km must be positive non-zero numbers.',
    };
  }

  let effectiveKm = km;
  let effectiveVmax = vmax;

  if (inhibitionType === 'competitive' && isNum(ki) && ki > 0 && isNum(inhibitorConc) && inhibitorConc > 0) {
    effectiveKm = km * (1 + inhibitorConc / ki);
  } else if (inhibitionType === 'noncompetitive' && isNum(ki) && ki > 0 && isNum(inhibitorConc) && inhibitorConc > 0) {
    effectiveVmax = vmax / (1 + inhibitorConc / ki);
  }

  // v = Vmax * [S] / (Km + [S])
  const velocity = (effectiveVmax * substrateConc) / (effectiveKm + substrateConc);
  const percentVmax = Number(((velocity / (effectiveVmax || 1)) * 100).toFixed(1));
  const catalyticEfficiency = Number((effectiveVmax / (effectiveKm || 1)).toFixed(2));

  const invS = substrateConc > 0 ? Number((1 / substrateConc).toFixed(4)) : null;
  const invV = velocity > 0 ? Number((1 / velocity).toFixed(4)) : null;

  const lineweaverBurk = {
    invSubstrate: invS,
    invVelocity: invV,
    warningNote: 'Lineweaver-Burk double-reciprocal transformation distorts experimental error structures at low substrate concentrations.',
  };

  // Direct curve points
  const maxS = Math.max(substrateConc * 2, effectiveKm * 5);
  const steps = 30;
  const step = maxS / steps;

  const curvePoints: Array<{ substrate: number; velocity: number }> = [];
  const lineweaverBurkPoints: Array<{ invSubstrate: number; invVelocity: number }> = [];

  for (let i = 0; i <= steps; i++) {
    const s = i * step;
    const v = (effectiveVmax * s) / (effectiveKm + s);

    curvePoints.push({
      substrate: Number(s.toFixed(2)),
      velocity: Number(v.toFixed(3)),
    });

    if (s > 0 && v > 0) {
      lineweaverBurkPoints.push({
        invSubstrate: Number((1 / s).toFixed(4)),
        invVelocity: Number((1 / v).toFixed(4)),
      });
    }
  }

  return {
    velocity: Number(velocity.toFixed(3)),
    effectiveKm: Number(effectiveKm.toFixed(2)),
    effectiveVmax: Number(effectiveVmax.toFixed(2)),
    percentVmax,
    catalyticEfficiency,
    lineweaverBurk,
    curvePoints,
    lineweaverBurkPoints,
    formula: 'v = (Vmax × [S]) / (Km + [S])',
    disclaimer:
      'Lineweaver-Burk is an educational double-reciprocal transformation. Note: Reciprocal transformations alter error structure and amplify experimental error at low substrate concentrations.',
  };
}
