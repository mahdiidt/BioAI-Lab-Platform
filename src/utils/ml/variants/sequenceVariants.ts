// Reference-vs-sample DNA comparison: detects sequence differences, describes
// them in normalized VCF-style and HGVS-style notation, and (only when the
// user declares the input is a coding sequence) predicts codon / amino-acid
// consequences. Detection of a difference is NOT a biological or clinical
// interpretation.
//
// Reuses the platform's existing utilities:
//   - normalizeSequenceInput (FASTA/plain parsing) from ../sequenceValidator
//   - CODON_TABLE (standard genetic code) from ../dna
// A dedicated affine-gap aligner is used instead of the existing linear-gap
// Needleman-Wunsch helper because linear gap costs tend to fragment one
// multi-base indel into several 1-bp gaps, which would mis-report events.

import { normalizeSequenceInput } from '../sequenceValidator';
import { CODON_TABLE } from '../dna';

export const VARIANT_LIMITS = {
  maxSequenceLength: 200_000,
  /** Cells of the DP matrix for the differing core region after prefix/suffix trimming. */
  maxAlignmentCells: 2_500_000,
};

export type VariantType = 'SNV' | 'MNV' | 'insertion' | 'deletion' | 'duplication' | 'delins';

export type Consequence =
  | 'synonymous_variant'
  | 'missense_variant'
  | 'stop_gained'
  | 'stop_lost'
  | 'stop_retained_variant'
  | 'start_lost'
  | 'frameshift_variant'
  | 'inframe_deletion'
  | 'inframe_insertion'
  | 'protein_altering_variant'
  | 'upstream_of_cds'
  | 'downstream_of_cds'
  | 'cds_boundary_not_assessed';

export interface CodonChange {
  codonNumber: number;
  refCodon: string;
  altCodon: string;
  refAa: string; // three-letter
  altAa: string; // three-letter
}

export interface CodingAnnotation {
  consequence: Consequence;
  /** Predicted protein change in HGVS-like p. syntax, parenthesised because it is a prediction. */
  proteinChange: string | null;
  codonChanges: CodonChange[];
}

export interface SequenceVariant {
  type: VariantType;
  /** 1-based inclusive reference coordinates of affected bases (for insertions: flanking bases start=left, end=right). */
  refStart: number;
  refEnd: number;
  refAllele: string;
  altAllele: string;
  /** Left-normalized VCF-style representation relative to the supplied reference. */
  vcf: { pos: number; ref: string; alt: string };
  /** HGVS-style description (3'-shifted) relative to the supplied reference (no accession). */
  hgvs: string;
  coding?: CodingAnnotation;
}

export interface CodingContext {
  cdsStart: number; // 1-based
  cdsEnd: number; // 1-based inclusive (end of stop codon, or last complete codon)
  hasStartCodon: boolean;
  hasStopCodon: boolean;
  refProtein: string; // one-letter, '*' for stop
  sampleProtein: string | null;
  proteinIdentical: boolean | null;
  firstProteinDifference: number | null; // 1-based aa position
}

export interface ComparisonIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  params?: Record<string, string | number>;
}

export interface ComparisonResult {
  ok: boolean;
  reference: string;
  sample: string;
  alignedReference: string;
  alignedSample: string;
  variants: SequenceVariant[];
  identityPercent: number;
  coding: CodingContext | null;
  issues: ComparisonIssue[];
}

export interface CompareOptions {
  /** Declare that both inputs are coding sequence (CDS/cDNA) on the coding strand. */
  isCoding: boolean;
  /** 1-based position of the first base of the start codon in the reference. */
  cdsStart?: number;
}

const AA3: Record<string, string> = {
  A: 'Ala', R: 'Arg', N: 'Asn', D: 'Asp', C: 'Cys', Q: 'Gln', E: 'Glu', G: 'Gly', H: 'His', I: 'Ile',
  L: 'Leu', K: 'Lys', M: 'Met', F: 'Phe', P: 'Pro', S: 'Ser', T: 'Thr', W: 'Trp', Y: 'Tyr', V: 'Val',
  '*': 'Ter', X: 'Xaa',
};

export function aaThree(letter: string): string {
  return AA3[letter] || 'Xaa';
}

function codonLetter(codon: string): string {
  return CODON_TABLE[codon]?.letter ?? 'X';
}

/** Translate full codons until (and including) the first stop. */
export function translateUntilStop(cds: string): string {
  let out = '';
  for (let i = 0; i + 3 <= cds.length; i += 3) {
    const aa = codonLetter(cds.slice(i, i + 3));
    out += aa;
    if (aa === '*') break;
  }
  return out;
}

interface CleanResult {
  seq: string;
  issue?: ComparisonIssue;
}

export function cleanDnaInput(raw: string, which: 'reference' | 'sample'): CleanResult {
  const norm = normalizeSequenceInput(raw || '');
  if (norm.recordCount > 1) {
    return { seq: '', issue: { severity: 'error', code: 'multi_fasta', params: { which } } };
  }
  const seq = norm.sequence.toUpperCase();
  if (!seq) return { seq: '', issue: { severity: 'error', code: 'empty_sequence', params: { which } } };
  const bad: string[] = [];
  let firstBad = -1;
  for (let i = 0; i < seq.length; i++) {
    if (!'ACGT'.includes(seq[i])) {
      if (firstBad < 0) firstBad = i + 1;
      if (!bad.includes(seq[i])) bad.push(seq[i]);
    }
  }
  if (bad.length > 0) {
    const ambiguous = bad.every((c) => 'NRYSWKMBDHVU'.includes(c));
    return {
      seq: '',
      issue: {
        severity: 'error',
        code: ambiguous ? 'ambiguous_bases' : 'invalid_bases',
        params: { which, chars: bad.slice(0, 8).join(', '), pos: firstBad },
      },
    };
  }
  if (seq.length > VARIANT_LIMITS.maxSequenceLength) {
    return { seq: '', issue: { severity: 'error', code: 'sequence_too_long', params: { which, max: VARIANT_LIMITS.maxSequenceLength } } };
  }
  return { seq };
}

const MATCH = 2;
const MISMATCH = -3;
const GAP_OPEN = -6; // cost of the first gap position (includes one extension)
const GAP_EXTEND = -1;

/** Global affine-gap (Gotoh) alignment. Returns aligned strings with '-' gaps. */
export function affineGlobalAlign(a: string, b: string): { alignedA: string; alignedB: string } {
  const m = a.length;
  const n = b.length;
  if (m === 0) return { alignedA: '-'.repeat(n), alignedB: b };
  if (n === 0) return { alignedA: a, alignedB: '-'.repeat(m) };
  const W = n + 1;
  const NEG = -1e9;
  const M = new Float64Array((m + 1) * W).fill(NEG);
  const X = new Float64Array((m + 1) * W).fill(NEG); // gap in b (deletion: consumes a)
  const Y = new Float64Array((m + 1) * W).fill(NEG); // gap in a (insertion: consumes b)
  const tM = new Uint8Array((m + 1) * W);
  const tX = new Uint8Array((m + 1) * W);
  const tY = new Uint8Array((m + 1) * W);
  M[0] = 0;
  for (let i = 1; i <= m; i++) {
    X[i * W] = GAP_OPEN + (i - 1) * GAP_EXTEND;
    tX[i * W] = i === 1 ? 0 : 1;
  }
  for (let j = 1; j <= n; j++) {
    Y[j] = GAP_OPEN + (j - 1) * GAP_EXTEND;
    tY[j] = j === 1 ? 0 : 2;
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const k = i * W + j;
      const d = (i - 1) * W + (j - 1);
      const s = a[i - 1] === b[j - 1] ? MATCH : MISMATCH;
      // M: from M/X/Y diagonal (0=M,1=X,2=Y)
      let best = M[d];
      let arg = 0;
      if (X[d] > best) { best = X[d]; arg = 1; }
      if (Y[d] > best) { best = Y[d]; arg = 2; }
      M[k] = best + s;
      tM[k] = arg;
      // X: open from M (or Y) or extend X, moving up
      const u = (i - 1) * W + j;
      const openX = Math.max(M[u], Y[u]) + GAP_OPEN;
      const extX = X[u] + GAP_EXTEND;
      if (extX >= openX) { X[k] = extX; tX[k] = 1; } else { X[k] = openX; tX[k] = M[u] >= Y[u] ? 0 : 2; }
      // Y: moving left
      const l = i * W + (j - 1);
      const openY = Math.max(M[l], X[l]) + GAP_OPEN;
      const extY = Y[l] + GAP_EXTEND;
      if (extY >= openY) { Y[k] = extY; tY[k] = 2; } else { Y[k] = openY; tY[k] = M[l] >= X[l] ? 0 : 1; }
    }
  }
  let i = m;
  let j = n;
  const end = m * W + n;
  let state = 0;
  if (X[end] > M[end] && X[end] >= Y[end]) state = 1;
  else if (Y[end] > M[end] && Y[end] > X[end]) state = 2;
  const outA: string[] = [];
  const outB: string[] = [];
  while (i > 0 || j > 0) {
    const k = i * W + j;
    if (i === 0) { state = 2; }
    else if (j === 0) { state = 1; }
    if (state === 0) {
      const prev = tM[k];
      outA.push(a[i - 1]);
      outB.push(b[j - 1]);
      i--; j--;
      state = prev;
    } else if (state === 1) {
      const prev = tX[k];
      outA.push(a[i - 1]);
      outB.push('-');
      i--;
      state = prev;
    } else {
      const prev = tY[k];
      outA.push('-');
      outB.push(b[j - 1]);
      j--;
      state = prev;
    }
  }
  return { alignedA: outA.reverse().join(''), alignedB: outB.reverse().join('') };
}

interface RawEvent {
  start0: number; // 0-based start in reference (for insertion: insertion point = before ref[start0])
  end0: number; // exclusive
  ref: string;
  alt: string;
}

function extractEvents(alignedRef: string, alignedAlt: string, refOffset: number): RawEvent[] {
  const events: RawEvent[] = [];
  let refPos = refOffset;
  let k = 0;
  while (k < alignedRef.length) {
    const r = alignedRef[k];
    const s = alignedAlt[k];
    if (r !== '-' && s !== '-' && r === s) {
      refPos++;
      k++;
      continue;
    }
    const start0 = refPos;
    let refSeg = '';
    let altSeg = '';
    while (k < alignedRef.length) {
      const rr = alignedRef[k];
      const ss = alignedAlt[k];
      if (rr !== '-' && ss !== '-' && rr === ss) break;
      if (rr !== '-') { refSeg += rr; refPos++; }
      if (ss !== '-') altSeg += ss;
      k++;
    }
    events.push({ start0, end0: start0 + refSeg.length, ref: refSeg, alt: altSeg });
  }
  return events;
}

type PosFormatter = (pos1: number) => string;

function rangeStr(a: number, b: number, fmt: PosFormatter): string {
  return a === b ? fmt(a) : `${fmt(a)}_${fmt(b)}`;
}

/** Builds a fully described variant (normalization within [low, high) of the reference). */
function describeEvent(ref: string, ev: RawEvent, low: number, high: number, fmt: PosFormatter): SequenceVariant {
  const isIns = ev.ref.length === 0;
  const isDel = ev.alt.length === 0;

  if (!isIns && !isDel) {
    const type: VariantType = ev.ref.length === 1 && ev.alt.length === 1 ? 'SNV' : ev.ref.length === ev.alt.length ? 'MNV' : 'delins';
    const s1 = ev.start0 + 1;
    const e1 = ev.end0;
    const hgvs = type === 'SNV' ? `${fmt(s1)}${ev.ref}>${ev.alt}` : `${rangeStr(s1, e1, fmt)}delins${ev.alt}`;
    return { type, refStart: s1, refEnd: e1, refAllele: ev.ref, altAllele: ev.alt, vcf: { pos: s1, ref: ev.ref, alt: ev.alt }, hgvs };
  }

  if (isDel) {
      const L = ev.end0 - ev.start0;
    // left-normalize (VCF convention)
    let ls = ev.start0;
    let le = ev.end0;
    while (ls - 1 >= low && ref[ls - 1] === ref[le - 1]) { ls--; le--; }
    // right-normalize (HGVS 3' rule)
    let rs = ev.start0;
    let re = ev.end0;
    while (re < high && ref[rs] === ref[re]) { rs++; re++; }
    const vcf = ls > 0
      ? { pos: ls, ref: ref.slice(ls - 1, le), alt: ref[ls - 1] }
      : { pos: 1, ref: ref.slice(0, le + 1), alt: ref[le] ?? '' };
    const hgvs = `${rangeStr(rs + 1, re, fmt)}del`;
    void L;
    return { type: 'deletion', refStart: rs + 1, refEnd: re, refAllele: ref.slice(rs, re), altAllele: '', vcf, hgvs };
  }

  // insertion before ref[p]
  let lp = ev.start0;
  let lins = ev.alt;
  while (lp - 1 >= low && ref[lp - 1] === lins[lins.length - 1]) {
    lins = ref[lp - 1] + lins.slice(0, -1);
    lp--;
  }
  let rp = ev.start0;
  let rins = ev.alt;
  while (rp < high && ref[rp] === rins[0]) {
    rins = rins.slice(1) + ref[rp];
    rp++;
  }
  const L = rins.length;
  const vcf = lp > 0 ? { pos: lp, ref: ref[lp - 1], alt: ref[lp - 1] + lins } : { pos: 1, ref: ref[0] ?? '', alt: lins + (ref[0] ?? '') };
  if (rp - L >= 0 && ref.slice(rp - L, rp) === rins) {
    return {
      type: 'duplication',
      refStart: rp - L + 1,
      refEnd: rp,
      refAllele: '',
      altAllele: rins,
      vcf,
      hgvs: `${rangeStr(rp - L + 1, rp, fmt)}dup`,
    };
  }
  return {
    type: 'insertion',
    refStart: rp,
    refEnd: rp + 1,
    refAllele: '',
    altAllele: rins,
    vcf,
    hgvs: `${fmt(rp)}_${fmt(rp + 1)}ins${rins}`,
  };
}

function applyEvent(ref: string, ev: RawEvent): string {
  return ref.slice(0, ev.start0) + ev.alt + ref.slice(ev.end0);
}

function proteinChange(refP: string, altP: string, consequence: Consequence, firstCodon: number): string | null {
  if (consequence === 'synonymous_variant' || consequence === 'stop_retained_variant') {
    const aa = refP[firstCodon - 1];
    return aa ? `p.(${aaThree(aa)}${firstCodon}=)` : null;
  }
  if (consequence === 'start_lost') return 'p.(Met1?)';
  let i = 0;
  while (i < refP.length && i < altP.length && refP[i] === altP[i]) i++;
  if (i >= refP.length && i >= altP.length) return null;
  if (consequence === 'frameshift_variant') {
    if (i >= refP.length) return null;
    if (altP[i] === '*') return `p.(${aaThree(refP[i])}${i + 1}Ter)`;
    // HGVS long form: first changed residue, new residue, then the length of the
    // new frame up to and including its stop (Ter?) when no stop is reached.
    if (i >= altP.length) return `p.(${aaThree(refP[i])}${i + 1}fs)`;
    const newStop = altP.indexOf('*', i);
    if (newStop < 0) return `p.(${aaThree(refP[i])}${i + 1}fs)`;
    return `p.(${aaThree(refP[i])}${i + 1}${aaThree(altP[i])}fsTer${newStop - i + 1})`;
  }
  if (consequence === 'stop_gained') {
    if (i >= refP.length) return null;
    if (altP[i] === '*') return `p.(${aaThree(refP[i])}${i + 1}Ter)`;
    const stop = altP.indexOf('*', i);
    const inserted = altP.slice(i, stop >= 0 ? stop + 1 : altP.length).split('').map(aaThree).join('');
    return `p.(${aaThree(refP[i])}${i + 1}delins${inserted})`;
  }
  if (consequence === 'stop_lost') {
    const stopPos = refP.indexOf('*');
    const newAa = altP[stopPos];
    if (stopPos < 0 || !newAa) return null;
    // Extension length: distance from the original stop position to the new stop
    // in the supplied sequence; '?' when no new in-frame stop is reached.
    const newStop = altP.indexOf('*', stopPos);
    const ext = newStop > stopPos ? String(newStop - stopPos) : '?';
    return `p.(Ter${stopPos + 1}${aaThree(newAa)}extTer${ext})`;
  }
  // trim common suffix (both proteins end at their stop, if any)
  let jr = refP.length;
  let ja = altP.length;
  while (jr > i && ja > i && refP[jr - 1] === altP[ja - 1]) { jr--; ja--; }
  const delAa = refP.slice(i, jr);
  const insAa = altP.slice(i, ja);
  const posStr = (k: number) => `${aaThree(refP[k])}${k + 1}`;
  if (delAa.length === 1 && insAa.length === 1) {
    return `p.(${posStr(i)}${insAa === '*' ? 'Ter' : aaThree(insAa)})`;
  }
  if (insAa.length === 0 && delAa.length > 0) {
    return delAa.length === 1 ? `p.(${posStr(i)}del)` : `p.(${posStr(i)}_${posStr(jr - 1)}del)`;
  }
  if (delAa.length === 0 && insAa.length > 0) {
    if (i - insAa.length >= 0 && refP.slice(i - insAa.length, i) === insAa) {
      const a = i - insAa.length;
      return insAa.length === 1 ? `p.(${posStr(a)}dup)` : `p.(${posStr(a)}_${posStr(i - 1)}dup)`;
    }
    if (i === 0) return null;
    return `p.(${posStr(i - 1)}_${posStr(i)}ins${insAa.split('').map(aaThree).join('')})`;
  }
  const range = delAa.length === 1 ? posStr(i) : `${posStr(i)}_${posStr(jr - 1)}`;
  return `p.(${range}delins${insAa.split('').map(aaThree).join('')})`;
}

function annotateCoding(ref: string, ev: RawEvent, v: SequenceVariant, ctx: CodingContext): CodingAnnotation {
  const cdsS0 = ctx.cdsStart - 1;
  const cdsE0 = ctx.cdsEnd; // exclusive
  const isIns = ev.ref.length === 0;
  // Use the normalized (3'-shifted) coordinates for location checks.
  const vs0 = v.type === 'insertion' ? v.refStart : v.type === 'duplication' ? v.refEnd : v.refStart - 1; // for ins: insertion point
  const ve0 = v.type === 'insertion' || v.type === 'duplication' ? vs0 : v.refEnd;
  const pointLike = isIns;
  if (pointLike ? vs0 <= cdsS0 : ve0 <= cdsS0) return { consequence: 'upstream_of_cds', proteinChange: null, codonChanges: [] };
  if (pointLike ? vs0 >= cdsE0 : vs0 >= cdsE0) return { consequence: 'downstream_of_cds', proteinChange: null, codonChanges: [] };
  if (!pointLike && (vs0 < cdsS0 || ve0 > cdsE0)) return { consequence: 'cds_boundary_not_assessed', proteinChange: null, codonChanges: [] };

  const mutated = applyEvent(ref, ev);
  const refCds = ref.slice(cdsS0);
  const altCds = mutated.slice(cdsS0);
  const refP = ctx.refProtein;
  const altP = translateUntilStop(altCds);
  const lenDiff = ev.alt.length - ev.ref.length;
  const codonChanges: CodonChange[] = [];

  let consequence: Consequence;
  if (lenDiff === 0) {
    const firstCodon = Math.floor((ev.start0 - cdsS0) / 3);
    const lastCodon = Math.floor((ev.end0 - 1 - cdsS0) / 3);
    for (let c = firstCodon; c <= lastCodon; c++) {
      const rc = refCds.slice(c * 3, c * 3 + 3);
      const ac = altCds.slice(c * 3, c * 3 + 3);
      if (rc.length === 3 && rc !== ac) {
        codonChanges.push({ codonNumber: c + 1, refCodon: rc, altCodon: ac, refAa: aaThree(codonLetter(rc)), altAa: aaThree(codonLetter(ac)) });
      }
    }
    const refAas = codonChanges.map((c) => c.refAa);
    const altAas = codonChanges.map((c) => c.altAa);
    if (ctx.hasStartCodon && firstCodon === 0 && altCds.slice(0, 3) !== 'ATG') consequence = 'start_lost';
    else if (refAas.includes('Ter') && !altAas.includes('Ter')) consequence = 'stop_lost';
    else if (altAas.includes('Ter') && !refAas.includes('Ter')) consequence = 'stop_gained';
    else if (refAas.every((a, k) => a === altAas[k])) consequence = refAas.includes('Ter') ? 'stop_retained_variant' : 'synonymous_variant';
    else consequence = codonChanges.length === 1 ? 'missense_variant' : 'protein_altering_variant';
    return { consequence, proteinChange: proteinChange(refP, altP, consequence, firstCodon + 1), codonChanges };
  }

  const startAffected = ctx.hasStartCodon && ev.start0 < cdsS0 + 3 && altCds.slice(0, 3) !== 'ATG';
  if (startAffected) consequence = 'start_lost';
  else if (Math.abs(lenDiff) % 3 !== 0) consequence = 'frameshift_variant';
  else {
    // in-frame: did it create an earlier stop?
    const refStop = refP.indexOf('*');
    const altStop = altP.indexOf('*');
    const expectedStop = refStop + lenDiff / 3; // where the stop should land after an in-frame change
    if (altStop >= 0 && (refStop < 0 || altStop < expectedStop)) consequence = 'stop_gained';
    // The original stop was removed (e.g. an in-frame deletion spanning it): translation
    // continues to a later stop, or none is found in the supplied sequence.
    else if (refStop >= 0 && (altStop < 0 || altStop > expectedStop)) consequence = 'stop_lost';
    else if (ev.ref.length === 0) consequence = 'inframe_insertion';
    else if (ev.alt.length === 0) consequence = 'inframe_deletion';
    else consequence = 'protein_altering_variant';
  }
  return { consequence, proteinChange: proteinChange(refP, altP, consequence, 1), codonChanges };
}

function buildCodingContext(ref: string, cdsStart: number, issues: ComparisonIssue[]): CodingContext | null {
  if (!Number.isInteger(cdsStart) || cdsStart < 1 || cdsStart > ref.length - 2) {
    issues.push({ severity: 'error', code: 'bad_cds_start', params: { max: Math.max(ref.length - 2, 1) } });
    return null;
  }
  const s0 = cdsStart - 1;
  const cds = ref.slice(s0);
  const protein = translateUntilStop(cds);
  const hasStartCodon = cds.startsWith('ATG');
  const hasStopCodon = protein.endsWith('*');
  const cdsEnd = s0 + protein.length * 3; // exclusive 0-based == inclusive 1-based
  if (!hasStartCodon) issues.push({ severity: 'warning', code: 'no_start_codon', params: { codon: cds.slice(0, 3) } });
  if (!hasStopCodon) issues.push({ severity: 'warning', code: 'no_stop_codon' });
  if (protein.length < 2) {
    issues.push({ severity: 'error', code: 'cds_too_short' });
    return null;
  }
  const trailing = ref.length - cdsEnd;
  const fullCodons = Math.floor(cds.length / 3);
  if (hasStopCodon && trailing > 30 && protein.length < fullCodons * 0.5) {
    issues.push({ severity: 'warning', code: 'early_stop_check_frame', params: { codon: protein.length, trailing } });
  }
  return {
    cdsStart,
    cdsEnd,
    hasStartCodon,
    hasStopCodon,
    refProtein: protein,
    sampleProtein: null,
    proteinIdentical: null,
    firstProteinDifference: null,
  };
}

export function compareSequences(refRaw: string, sampleRaw: string, opts: CompareOptions): ComparisonResult {
  const issues: ComparisonIssue[] = [];
  const r = cleanDnaInput(refRaw, 'reference');
  const s = cleanDnaInput(sampleRaw, 'sample');
  if (r.issue) issues.push(r.issue);
  if (s.issue) issues.push(s.issue);
  const fail = (): ComparisonResult => ({
    ok: false,
    reference: r.seq,
    sample: s.seq,
    alignedReference: '',
    alignedSample: '',
    variants: [],
    identityPercent: 0,
    coding: null,
    issues,
  });
  if (r.issue || s.issue) return fail();
  const ref = r.seq;
  const alt = s.seq;

  // Trim the identical prefix and suffix, then align only the differing core.
  let pre = 0;
  while (pre < ref.length && pre < alt.length && ref[pre] === alt[pre]) pre++;
  let suf = 0;
  while (suf < ref.length - pre && suf < alt.length - pre && ref[ref.length - 1 - suf] === alt[alt.length - 1 - suf]) suf++;
  const refCore = ref.slice(pre, ref.length - suf);
  const altCore = alt.slice(pre, alt.length - suf);
  if ((refCore.length + 1) * (altCore.length + 1) > VARIANT_LIMITS.maxAlignmentCells) {
    issues.push({ severity: 'error', code: 'divergent_region_too_large', params: { refLen: refCore.length, sampleLen: altCore.length } });
    return fail();
  }
  const { alignedA, alignedB } = affineGlobalAlign(refCore, altCore);
  const alignedReference = ref.slice(0, pre) + alignedA + ref.slice(ref.length - suf);
  const alignedSample = alt.slice(0, pre) + alignedB + alt.slice(alt.length - suf);
  const raw = extractEvents(alignedA, alignedB, pre);

  let matches = 0;
  for (let k = 0; k < alignedReference.length; k++) if (alignedReference[k] === alignedSample[k] && alignedReference[k] !== '-') matches++;
  const identityPercent = alignedReference.length ? Number(((matches / alignedReference.length) * 100).toFixed(2)) : 100;
  if (identityPercent < 80) issues.push({ severity: 'warning', code: 'low_identity', params: { pct: identityPercent } });

  let coding: CodingContext | null = null;
  if (opts.isCoding) coding = buildCodingContext(ref, opts.cdsStart ?? 1, issues);
  if (issues.some((i) => i.severity === 'error')) return fail();

  const fmt: PosFormatter = coding
    ? (pos) => {
        if (pos < coding!.cdsStart) return `-${coding!.cdsStart - pos}`;
        if (pos > coding!.cdsEnd) return `*${pos - coding!.cdsEnd}`;
        return String(pos - coding!.cdsStart + 1);
      }
    : (pos) => String(pos);
  const prefix = coding ? 'c.' : '';

  const variants: SequenceVariant[] = raw.map((ev, idx) => {
    const low = idx > 0 ? raw[idx - 1].end0 : 0;
    const high = idx < raw.length - 1 ? raw[idx + 1].start0 : ref.length;
    const v = describeEvent(ref, ev, low, high, fmt);
    v.hgvs = prefix + v.hgvs;
    if (coding) v.coding = annotateCoding(ref, ev, v, coding);
    return v;
  });

  if (coding) {
    // Combined effect of all differences: translate the sample from its corresponding CDS start.
    const upstreamShift = raw
      .filter((ev) => (ev.ref.length === 0 ? ev.start0 <= coding!.cdsStart - 1 : ev.end0 <= coding!.cdsStart - 1))
      .reduce((sum, ev) => sum + ev.alt.length - ev.ref.length, 0);
    const sampleCdsStart0 = coding.cdsStart - 1 + upstreamShift;
    const sampleProtein = sampleCdsStart0 >= 0 ? translateUntilStop(alt.slice(sampleCdsStart0)) : '';
    coding.sampleProtein = sampleProtein;
    coding.proteinIdentical = sampleProtein === coding.refProtein;
    if (!coding.proteinIdentical) {
      let k = 0;
      while (k < sampleProtein.length && k < coding.refProtein.length && sampleProtein[k] === coding.refProtein[k]) k++;
      coding.firstProteinDifference = k + 1;
    }
    // Several variants in the same codon interact: per-variant predictions are then incomplete.
    const codonOwners = new Map<number, number>();
    const shared = new Set<number>();
    raw.forEach((ev) => {
      if (ev.ref.length === 0) return;
      for (let p = ev.start0; p < ev.end0; p++) {
        if (p < coding!.cdsStart - 1 || p >= coding!.cdsEnd) continue;
        const c = Math.floor((p - (coding!.cdsStart - 1)) / 3) + 1;
        const owner = codonOwners.get(c);
        if (owner !== undefined && owner !== ev.start0) shared.add(c);
        codonOwners.set(c, ev.start0);
      }
    });
    if (shared.size > 0) issues.push({ severity: 'warning', code: 'variants_share_codon', params: { codons: Array.from(shared).join(', ') } });
  }

  // Insertions at the very ends of the supplied reference have no flanking base on
  // one side, so their HGVS-style position cannot be anchored inside the sequence.
  const edge = variants.filter((v) => v.type === 'insertion' && (v.refStart === 0 || v.refStart === ref.length));
  if (edge.length > 0) {
    issues.push({ severity: 'warning', code: 'insertion_at_sequence_edge', params: { hgvs: edge.map((v) => v.hgvs).join(', ') } });
  }

  if (variants.length === 0) issues.push({ severity: 'info', code: 'identical_sequences' });

  return { ok: true, reference: ref, sample: alt, alignedReference, alignedSample, variants, identityPercent, coding, issues };
}

/** Exports detected differences as a minimal VCF 4.2 text relative to a user-named contig. */
export function variantsToVcf(result: ComparisonResult, contig = 'supplied_reference'): string {
  const safeContig = contig.replace(/[^A-Za-z0-9_.-]/g, '_') || 'supplied_reference';
  const lines = [
    '##fileformat=VCFv4.2',
    '##source=BioAI.Lab_VariantAnalyzer_sequence_comparison',
    `##contig=<ID=${safeContig},length=${result.reference.length}>`,
    '##INFO=<ID=TYPE,Number=1,Type=String,Description="Detected difference type relative to the supplied reference">',
    '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
  ];
  for (const v of result.variants) {
    lines.push([safeContig, v.vcf.pos, '.', v.vcf.ref, v.vcf.alt, '.', '.', `TYPE=${v.type}`].join('\t'));
  }
  return lines.join('\n') + '\n';
}
