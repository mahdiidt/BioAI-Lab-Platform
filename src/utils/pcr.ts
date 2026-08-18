// PCR & Primer Thermodynamics Utilities

export function calculatePrimerTm(
  primerSeq: string
): {
  tm: number;
  gcContent: number;
  length: number;
  warnings: string[];
} {
  const primer = primerSeq.replace(/\s+/g, '').toUpperCase();
  const length = primer.length;
  const warnings: string[] = [];

  if (length === 0) {
    return {
      tm: 0,
      gcContent: 0,
      length: 0,
      warnings: ['Sequence is empty.'],
    };
  }

  let gCount = 0;
  let cCount = 0;
  let aCount = 0;
  let tCount = 0;

  // PCR primers are strict DNA sequences: A, T, C, G only.
  for (const base of primer) {
    if (base === 'G') {
      gCount++;
    } else if (base === 'C') {
      cCount++;
    } else if (base === 'A') {
      aCount++;
    } else if (base === 'T') {
      tCount++;
    } else {
      warnings.push(
        `Invalid character '${base}' in DNA primer. Only A, T, C and G are allowed.`
      );
    }
  }

  if (warnings.length > 0) {
    return {
      tm: 0,
      gcContent: 0,
      length,
      warnings,
    };
  }

  const gcCount = gCount + cCount;
  const gcContent = Number(((gcCount / length) * 100).toFixed(1));

  let tm = 0;

  if (length < 14) {
    // Wallace Rule:
    // Tm = 2 × (A + T) + 4 × (G + C)
    tm = 2 * (aCount + tCount) + 4 * gcCount;
  } else {
    // GC-based long-primer Tm estimate.
    // This is NOT a nearest-neighbor thermodynamic calculation.
    tm = 64.9 + (41 * (gcCount - 16.4)) / length;
  }

  tm = Number(tm.toFixed(1));

  // Primer quality warnings
  if (length < 18) {
    warnings.push(
      'Primer is shorter than recommended 18 bp and may have low specificity.'
    );
  }

  if (length > 28) {
    warnings.push(
      'Primer is longer than recommended 28 bp and may form secondary structures.'
    );
  }

  if (gcContent < 40) {
    warnings.push(
      'GC content is below 40%, which may result in weak hybridization.'
    );
  }

  if (gcContent > 60) {
    warnings.push(
      'GC content is above 60%, which may increase the risk of non-specific binding.'
    );
  }

  // 3' GC clamp check
  const last3 = primer.slice(-3);
  let gcIn3End = 0;

  for (const base of last3) {
    if (base === 'G' || base === 'C') {
      gcIn3End++;
    }
  }

  if (gcIn3End === 0) {
    warnings.push(
      "No G/C clamp at the 3' end; this may reduce polymerase priming efficiency."
    );
  }

  if (gcIn3End === 3) {
    warnings.push(
      "Very strong 3' GC clamp; more than 2 G/C bases may increase non-specific priming."
    );
  }

  return {
    tm,
    gcContent,
    length,
    warnings,
  };
}

export function calculatePcrReactionSetup(
  numSamples: number,
  reactionVolumeUl = 50,
  includeExcess = true
) {
  const safeSamples = Math.max(1, Math.floor(numSamples));
  const safeVolume = Math.max(1, reactionVolumeUl);

  // Add 10% excess for pipetting loss when requested.
  const multiplier = includeExcess
    ? safeSamples * 1.1
    : safeSamples;

  const scale = safeVolume / 50;

  // Example PCR recipe for one reaction.
  // Template DNA is intentionally kept separate from the shared master mix.
  const perRxn = {
    water: 32.5 * scale,
    buffer10x: 5.0 * scale,
    dntp10mM: 1.0 * scale,
    fwdPrimer10uM: 2.5 * scale,
    revPrimer10uM: 2.5 * scale,
    taqPolymerase: 0.5 * scale,
    templateDna: 6.0 * scale,
  };

  // Shared master mix volume per reaction, excluding template DNA.
  const masterMixPerRxnVolume =
    safeVolume - perRxn.templateDna;

  const masterMixTotal = {
    water: Number(
      (perRxn.water * multiplier).toFixed(1)
    ),

    buffer10x: Number(
      (perRxn.buffer10x * multiplier).toFixed(1)
    ),

    dntp10mM: Number(
      (perRxn.dntp10mM * multiplier).toFixed(1)
    ),

    fwdPrimer10uM: Number(
      (perRxn.fwdPrimer10uM * multiplier).toFixed(1)
    ),

    revPrimer10uM: Number(
      (perRxn.revPrimer10uM * multiplier).toFixed(1)
    ),

    taqPolymerase: Number(
      (perRxn.taqPolymerase * multiplier).toFixed(1)
    ),

    totalVolumeUl: Number(
      (masterMixPerRxnVolume * multiplier).toFixed(1)
    ),
  };

  return {
    numSamples: safeSamples,
    reactionVolumeUl: safeVolume,

    multiplierUsed: Number(
      multiplier.toFixed(2)
    ),

    perRxn,

    masterMixTotal,

    templatePerReactionUl: Number(
      perRxn.templateDna.toFixed(2)
    ),

    note:
      'Example PCR setup. Prepare the shared master mix without template DNA, then add template DNA separately to each reaction.',
  };
}

export function calculateAnnealingTemperature(
  fwdTm: number,
  revTm: number
) {
  const minTm = Math.min(fwdTm, revTm);
  const tmDiff = Math.abs(fwdTm - revTm);

  // Approximate starting point only.
  // Actual annealing temperature should be optimized experimentally.
  const recommendedTa = Math.round(minTm - 5);

  const warnings: string[] = [];

  if (tmDiff > 5) {
    warnings.push(
      `Tm difference between forward (${fwdTm}°C) and reverse (${revTm}°C) is ${tmDiff.toFixed(
        1
      )}°C. A mismatch greater than 5°C may reduce PCR efficiency.`
    );
  }

  warnings.push(
    'Annealing temperature is an approximate starting point and should be optimized experimentally.'
  );

  return {
    recommendedTa,
    tmDiff: Number(tmDiff.toFixed(1)),
    warnings,
  };
}
