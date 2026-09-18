// Plasmid Map Engine
//
// Turns a raw circular DNA sequence into everything a circular plasmid-map
// visualization needs: restriction sites (with unique-cutter detection —
// the single most useful fact for planning a linearization or subcloning
// step), candidate ORFs (reusing the same finder as the DNA Analyzer tool),
// and a GC-content sliding window for the inner heat ring.
//
// Deliberately reuses the site's existing algorithms (COMMON_ENZYMES'
// circular search logic mirrors digestDna() in restriction.ts;
// findOpenReadingFrames comes straight from dna.ts) rather than
// re-implementing sequence logic, so results stay consistent with the
// Restriction Digest and DNA Analyzer tools elsewhere on the platform.

import { validateSequence } from './sequenceValidator';
import { COMMON_ENZYMES } from './restriction';
import { findOpenReadingFrames } from './dna';

export const MIN_PLASMID_LENGTH = 50;
export const MAX_PLASMID_LENGTH = 50000;

export interface PlasmidEnzymeSite {
  enzymeName: string;
  site: string;
  type: 'blunt' | 'sticky';
  /** 1-indexed start position(s) of the recognition site on the plasmid. */
  positions: number[];
  isUniqueCutter: boolean;
}

export interface PlasmidOrf {
  frame: string; // '+1'..'+3' or '-1'..'-3'
  strand: 1 | -1;
  start: number;
  end: number;
  lengthBp: number;
  lengthAa: number;
  proteinSequence: string;
  hasAmbiguousCodons: boolean;
}

export interface CustomFeature {
  id: string;
  label: string;
  start: number;
  end: number;
  strand: 1 | -1;
  color: string;
}

export interface GcWindowPoint {
  startBp: number;
  endBp: number;
  gcPercent: number;
}

export interface PlasmidMapResult {
  isValid: boolean;
  errorMessage?: string;
  length: number;
  gcContentOverall: number;
  enzymeSites: PlasmidEnzymeSite[];
  uniqueCutters: PlasmidEnzymeSite[];
  orfs: PlasmidOrf[];
  gcWindow: GcWindowPoint[];
}

/**
 * Finds every occurrence of a recognition site on a CIRCULAR sequence,
 * returning 1-indexed start positions with no duplicate counted at the
 * wrap-around junction. Mirrors the circular search approach used by
 * digestDna() in restriction.ts, kept separate here because a plasmid map
 * needs positions grouped per-enzyme rather than merged into one cut list.
 */
function findCircularSitePositions(dna: string, site: string): number[] {
  const len = dna.length;
  if (site.length > len) return [];

  const searchSeq = dna + dna.slice(0, site.length - 1);
  const positions: number[] = [];
  let idx = searchSeq.indexOf(site);

  while (idx !== -1) {
    if (idx < len) {
      positions.push(idx + 1); // 1-indexed
    }
    idx = searchSeq.indexOf(site, idx + 1);
  }

  return positions;
}

function computeGcWindow(dna: string, segments: number): GcWindowPoint[] {
  const len = dna.length;
  const points: GcWindowPoint[] = [];
  const segLen = len / segments;

  for (let i = 0; i < segments; i++) {
    const startBp = Math.floor(i * segLen);
    const endBp = Math.floor((i + 1) * segLen);
    const slice = dna.slice(startBp, Math.max(endBp, startBp + 1));
    let gc = 0;
    for (const ch of slice) {
      if (ch === 'G' || ch === 'C') gc++;
    }
    points.push({
      startBp: startBp + 1,
      endBp: Math.max(endBp, startBp + 1),
      gcPercent: slice.length > 0 ? (gc / slice.length) * 100 : 0,
    });
  }

  return points;
}

export function analyzePlasmid(
  rawSequence: string,
  selectedEnzymeNames: string[],
  minOrfAaLength: number = 50
): PlasmidMapResult {
  const val = validateSequence(rawSequence, 'DNA');

  const empty = {
    length: 0,
    gcContentOverall: 0,
    enzymeSites: [],
    uniqueCutters: [],
    orfs: [],
    gcWindow: [],
  };

  if (!val.isValid) {
    return { isValid: false, errorMessage: val.errorMessage || 'Invalid DNA sequence.', ...empty };
  }

  const dna = val.cleanSequence.toUpperCase();
  const len = dna.length;

  if (len < MIN_PLASMID_LENGTH) {
    return {
      isValid: false,
      errorMessage: `Sequence is too short for a plasmid map (minimum ${MIN_PLASMID_LENGTH} bp).`,
      ...empty,
    };
  }

  if (len > MAX_PLASMID_LENGTH) {
    return {
      isValid: false,
      errorMessage: `Sequence is too long (${len} bp). This tool supports up to ${MAX_PLASMID_LENGTH.toLocaleString()} bp so the map stays fast and readable in the browser.`,
      ...empty,
    };
  }

  // Ambiguity codes (N, R, Y, ...) make exact restriction-site and ORF
  // scanning unreliable, so this tool - unlike some others on the platform -
  // requires a fully resolved ACGT sequence.
  if (/[^ACGT]/.test(dna)) {
    return {
      isValid: false,
      errorMessage: 'Plasmid mapping requires a fully resolved sequence (A, C, G, T only) - ambiguity codes are not supported here.',
      ...empty,
    };
  }

  let gcCount = 0;
  for (const ch of dna) if (ch === 'G' || ch === 'C') gcCount++;
  const gcContentOverall = (gcCount / len) * 100;

  const activeEnzymes = COMMON_ENZYMES.filter((e) => selectedEnzymeNames.includes(e.name));
  const enzymeSites: PlasmidEnzymeSite[] = activeEnzymes
    .map((ez) => {
      const positions = findCircularSitePositions(dna, ez.site);
      return {
        enzymeName: ez.name,
        site: ez.site,
        type: ez.type,
        positions,
        isUniqueCutter: positions.length === 1,
      };
    })
    .filter((s) => s.positions.length > 0)
    .sort((a, b) => a.enzymeName.localeCompare(b.enzymeName));

  const uniqueCutters = enzymeSites.filter((s) => s.isUniqueCutter);

  const orfsRaw = findOpenReadingFrames(dna, minOrfAaLength);
  const orfs: PlasmidOrf[] = orfsRaw.map((o) => ({
    frame: o.frame,
    strand: o.frame.startsWith('-') ? -1 : 1,
    start: o.start,
    end: o.end,
    lengthBp: o.lengthBp,
    lengthAa: o.lengthAa,
    proteinSequence: o.proteinSequence,
    hasAmbiguousCodons: o.hasAmbiguousCodons,
  }));

  // Segment count scales gently with length so short plasmids don't get an
  // absurdly coarse ring and long ones don't get thousands of slivers.
  const segments = Math.max(90, Math.min(240, Math.round(len / 40)));
  const gcWindow = computeGcWindow(dna, segments);

  return {
    isValid: true,
    length: len,
    gcContentOverall,
    enzymeSites,
    uniqueCutters,
    orfs,
    gcWindow,
  };
}

/** Maps a 1-indexed bp position to an angle in degrees, with bp 1 at the
 * top (12 o'clock) and increasing clockwise - the standard plasmid-map
 * convention used by tools like SnapGene and ApE. */
export function bpToAngleDeg(bp: number, totalLength: number): number {
  if (totalLength <= 0) return -90;
  return -90 + ((bp - 1) / totalLength) * 360;
}

export function angleToPoint(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Builds an SVG elliptical-arc path (a ring segment outline) between two
 * bp positions at a given radius, always sweeping clockwise (the direction
 * bp increases in), which is what every ring on the map needs. */
export function describeArcPath(
  cx: number,
  cy: number,
  r: number,
  startBp: number,
  endBp: number,
  totalLength: number
): string {
  const startAngle = bpToAngleDeg(startBp, totalLength);
  let endAngle = bpToAngleDeg(endBp, totalLength);
  if (endAngle < startAngle) endAngle += 360; // wraps past the origin
  const large = endAngle - startAngle > 180 ? 1 : 0;
  const p1 = angleToPoint(cx, cy, r, startAngle);
  const p2 = angleToPoint(cx, cy, r, endAngle);
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`;
}
