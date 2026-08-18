// Microbiology & Cell Culture Utilities

export interface BacterialGrowthResult {
  generations: number;
  generationTimeHours: number;
  generationTimeMins: number;
  growthRateK: number;
  curvePoints: Array<{ timeHours: number; population: number; phase: 'Lag' | 'Log' | 'Stationary' | 'Death' }>;
  modelDisclaimer: string;
}

export function calculateBacterialGrowth(
  n0: number,
  nt: number,
  timeHours: number,
  lagPhaseHours = 1,
  stationaryTimeHours = 10
): BacterialGrowthResult {
  const isNum = (v: unknown): v is number => v !== undefined && v !== null && typeof v === 'number' && Number.isFinite(v);

  if (!isNum(n0) || n0 <= 0 || !isNum(nt) || nt <= n0 || !isNum(timeHours) || timeHours <= 0) {
    return {
      generations: 0,
      generationTimeHours: 0,
      generationTimeMins: 0,
      growthRateK: 0,
      curvePoints: [],
      modelDisclaimer: 'Mathematical educational growth model.',
    };
  }

  // Number of generations n = log2(Nt / N0)
  const generations = (Math.log(nt) - Math.log(n0)) / Math.LN2;
  const generationTimeHours = timeHours / generations;
  const generationTimeMins = generationTimeHours * 60;
  const growthRateK = Math.LN2 / generationTimeHours;

  // Generate educational growth curve points across 4 phases: Lag, Log, Stationary, Death
  const lagEnd = Math.max(0, lagPhaseHours);
  const logEnd = lagEnd + timeHours;
  const statEnd = Math.max(logEnd, logEnd + Math.max(0, stationaryTimeHours));

  const totalCurveHours = Math.max(statEnd * 1.5, 24);
  const steps = 40;
  const stepHours = totalCurveHours / steps;

  const curvePoints: Array<{ timeHours: number; population: number; phase: 'Lag' | 'Log' | 'Stationary' | 'Death' }> = [];

  for (let i = 0; i <= steps; i++) {
    const t = i * stepHours;
    let pop = n0;
    let phase: 'Lag' | 'Log' | 'Stationary' | 'Death' = 'Lag';

    if (t <= lagEnd) {
      phase = 'Lag';
      pop = n0;
    } else if (t <= logEnd) {
      phase = 'Log';
      const logTime = t - lagEnd;
      pop = n0 * Math.pow(2, logTime / generationTimeHours);
    } else if (t <= statEnd) {
      phase = 'Stationary';
      pop = nt;
    } else {
      phase = 'Death';
      const deathTime = t - statEnd;
      pop = Math.max(0, nt * Math.exp(-0.15 * deathTime));
    }

    curvePoints.push({
      timeHours: Number(t.toFixed(1)),
      population: Math.round(pop),
      phase,
    });
  }

  return {
    generations: Number(generations.toFixed(2)),
    generationTimeHours: Number(generationTimeHours.toFixed(2)),
    generationTimeMins: Number(generationTimeMins.toFixed(1)),
    growthRateK: Number(growthRateK.toFixed(3)),
    curvePoints,
    modelDisclaimer: 'Mathematical educational growth model simulating Lag, Log (Exponential), Stationary, and Death phases.',
  };
}

export const GRAM_STAIN_STEPS = [
  {
    step: 1,
    reagent: 'Crystal Violet (Primary Stain)',
    duration: '60 seconds',
    effectGramPos: 'Stains thick peptidoglycan wall purple/blue.',
    effectGramNeg: 'Stains thin peptidoglycan wall purple/blue.',
    colorPos: '#7e22ce',
    colorNeg: '#7e22ce',
  },
  {
    step: 2,
    reagent: 'Gram\'s Iodine (Mordant)',
    duration: '60 seconds',
    effectGramPos: 'Forms large insoluble Crystal Violet-Iodine (CV-I) complexes inside cell wall.',
    effectGramNeg: 'Forms CV-I complexes inside cell wall.',
    colorPos: '#581c87',
    colorNeg: '#581c87',
  },
  {
    step: 3,
    reagent: '95% Ethanol / Acetone (Decolorizer)',
    duration: '10–15 seconds',
    effectGramPos: 'Dehydrates thick peptidoglycan, trapping CV-I complex (remains purple).',
    effectGramNeg: 'Dissolves outer lipopolysaccharide (LPS) layer; CV-I washes out (becomes colorless).',
    colorPos: '#581c87',
    colorNeg: '#e2e8f0',
  },
  {
    step: 4,
    reagent: 'Safranin (Counterstain)',
    duration: '45–60 seconds',
    effectGramPos: 'Gram-positive cells remain deep purple (Safranin mask).',
    effectGramNeg: 'Decolorized Gram-negative cells absorb Safranin stain pink/red.',
    colorPos: '#581c87',
    colorNeg: '#e11d48',
  },
];
