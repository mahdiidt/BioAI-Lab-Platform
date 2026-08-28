import React, { useState, useEffect } from 'react';
import { SequenceInput } from '../common/SequenceInput';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { CopyButton } from '../common/CopyButton';
import { ExportButton } from '../common/ExportButton';
import {
  calculateSequenceStats,
  transcribeDnaToRna,
  translateRnaToProtein,
  reverseComplement,
  findOpenReadingFrames,
  getDetailedBaseComposition,
} from '../../utils/dna';
import { validateSequence } from '../../utils/sequenceValidator';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Dna, PieChart, ArrowRightLeft, Binary, Search, AlertTriangle, Info } from 'lucide-react';

interface ToolProps {
  lang: Language;
  initialTab?: 'dna' | 'gc' | 'transcription' | 'translation' | 'orf';
}

type Molecule = 'DNA' | 'RNA';
type MwModel = 'ssDNA' | 'dsDNA' | 'RNA';

const SAMPLE_DNA = 'ATGCGATACGCTTACGCATCGATCGATCGATCGATCG';
const SAMPLE_RNA = 'AUGCGAUACGCUUACGCAUCGAUCGAUCGAUCGAUCG';

export const DnaAnalyzerTool: React.FC<ToolProps> = ({ lang, initialTab = 'dna' }) => {
  const [molecule, setMolecule] = useState<Molecule>('DNA');
  const [sequence, setSequence] = useState(SAMPLE_DNA);
  const [mwModel, setMwModel] = useState<MwModel>('ssDNA');
  const [activeTab, setActiveTab] = useState<'dna' | 'gc' | 'transcription' | 'translation' | 'orf'>(initialTab);

  // RNA has no ssDNA/dsDNA distinction; keep the MW model in sync with the
  // selected molecule rather than letting a stale DNA-only model leak
  // into an RNA calculation (or vice versa).
  useEffect(() => {
    if (molecule === 'RNA') {
      setMwModel('RNA');
    } else if (mwModel === 'RNA') {
      setMwModel('ssDNA');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [molecule]);

  const validation = validateSequence(sequence, molecule);
  const cleanSeq = validation.cleanSequence;

  const stats = calculateSequenceStats(cleanSeq, mwModel);
  const composition = validation.isValid ? getDetailedBaseComposition(cleanSeq, molecule) : null;

  // Transcription is DNA -> RNA specific. It is only computed/shown when
  // the input is actually DNA; an RNA input is not "transcribed" as if it
  // were DNA (see spec item 8).
  const rna = molecule === 'DNA' ? transcribeDnaToRna(cleanSeq) : cleanSeq;
  const protein = validation.isValid ? translateRnaToProtein(cleanSeq) : '';
  const proteinAaLength = protein.replace(/\*/g, '').length;
  const proteinHasStop = protein.includes('*');

  // reverseComplement/findOpenReadingFrames throw on invalid nucleotide
  // characters (they no longer silently substitute 'N'), so only run
  // them once the sequence has actually passed validation.
  const revComp = validation.isValid ? reverseComplement(cleanSeq, molecule) : '';

  // ORF analysis is DNA-specific (it searches for ATG/TAA/TAG/TGA reading
  // frames). It is intentionally not run against RNA input — see spec
  // item 11/12.
  const orfs = validation.isValid && molecule === 'DNA' ? findOpenReadingFrames(cleanSeq) : [];

  const sampleSequence = molecule === 'DNA' ? SAMPLE_DNA : SAMPLE_RNA;
  const sampleLabelKey = molecule === 'DNA' ? 'tool_load_sample_dna' : 'tool_load_sample_rna';
  const allowedCharsRegex =
    molecule === 'DNA' ? /^[ATCGRYSWKMBDHVN\s]+$/i : /^[AUCGRYSWKMBDHVN\s]+$/i;

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      {/* Molecule Type Selector */}
      <div>
        <span className="text-xs font-bold text-[#12312B] block mb-1.5">
          {getTranslation(lang, 'tool_molecule_type')}
        </span>
        <div role="group" aria-label={getTranslation(lang, 'tool_molecule_type')} className="inline-flex items-center gap-2 p-1 bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl">
          {(['DNA', 'RNA'] as Molecule[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={molecule === m}
              onClick={() => setMolecule(m)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                molecule === m
                  ? 'bg-[#0F766E] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#12312B]'
              }`}
            >
              {getTranslation(lang, m === 'DNA' ? 'tool_molecule_dna' : 'tool_molecule_rna')}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div role="tablist" aria-label={getTranslation(lang, 'tool_dna_analyzer_title')} className="flex items-center gap-2 border-b border-[#DDEDE8] pb-3 overflow-x-auto">
        <button
          role="tab"
          aria-selected={activeTab === 'dna'}
          onClick={() => setActiveTab('dna')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'dna'
              ? 'bg-[#0F766E] text-white shadow-xs'
              : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
          }`}
        >
          <Dna className="w-4 h-4" /> {getTranslation(lang, 'tool_dna_analyzer_title')}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'gc'}
          onClick={() => setActiveTab('gc')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'gc'
              ? 'bg-[#0F766E] text-white shadow-xs'
              : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
          }`}
        >
          <PieChart className="w-4 h-4" /> {getTranslation(lang, 'tool_gc_content')}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'transcription'}
          onClick={() => setActiveTab('transcription')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'transcription'
              ? 'bg-[#0F766E] text-white shadow-xs'
              : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" /> {getTranslation(lang, 'tool_transcription_title')}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'translation'}
          onClick={() => setActiveTab('translation')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'translation'
              ? 'bg-[#0F766E] text-white shadow-xs'
              : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
          }`}
        >
          <Binary className="w-4 h-4" /> {getTranslation(lang, 'tool_translation_title')}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'orf'}
          onClick={() => setActiveTab('orf')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'orf'
              ? 'bg-[#0F766E] text-white shadow-xs'
              : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
          }`}
        >
          <Search className="w-4 h-4" /> {getTranslation(lang, 'tool_orf_title')}
        </button>
      </div>

      <SequenceInput
        value={sequence}
        onChange={setSequence}
        sampleSequence={sampleSequence}
        sampleLabel={getTranslation(lang, sampleLabelKey)}
        allowedCharsRegex={allowedCharsRegex}
        lang={lang}
      />

      {!validation.isValid && validation.errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-700 font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="space-y-0.5">
            <span>{validation.errorMessage}</span>
            {validation.isFasta && validation.recordCount > 1 && (
              <span className="block text-rose-600/80 font-normal">{getTranslation(lang, 'tool_multi_fasta_rejected_hint')}</span>
            )}
          </div>
        </div>
      )}

      {/* Results Section */}
      {validation.isValid && composition && (
        <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-3">
            <h4 className="font-bold text-sm text-[#12312B]">
              {getTranslation(lang, 'resultsHeader')}
            </h4>
            <div className="flex items-center gap-2">
              <ExportButton filename="dna_analysis.json" data={{ molecule, stats, composition, rna: molecule === 'DNA' ? rna : undefined, protein, revComp, orfs }} format="json" lang={lang} />
            </div>
          </div>

          {/* QC Section */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-[#12312B] flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#0F766E]" /> {getTranslation(lang, 'tool_qc_header')}
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="p-2.5 bg-slate-50 border border-[#DDEDE8] rounded-lg">
                <span className="text-[10px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_length')}</span>
                <span className="text-sm font-bold text-[#12312B] font-mono">{stats.length.toLocaleString()}</span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-[#DDEDE8] rounded-lg">
                <span className="text-[10px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_qc_canonical_bases')}</span>
                <span className="text-sm font-bold text-[#12312B] font-mono">{composition.canonicalTotal.toLocaleString()}</span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-[#DDEDE8] rounded-lg">
                <span className="text-[10px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_qc_ambiguous_bases')}</span>
                <span className="text-sm font-bold text-[#12312B] font-mono">{composition.ambiguousTotal.toLocaleString()}</span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-[#DDEDE8] rounded-lg">
                <span className="text-[10px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_qc_n_count')}</span>
                <span className="text-sm font-bold text-[#12312B] font-mono">{(composition.ambiguous.N || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_length')}</span>
              <span className="text-lg font-bold text-[#0F766E] font-mono">{stats.length.toLocaleString()} {molecule === 'DNA' ? 'bp' : 'nt'}</span>
            </div>
            <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_gc_content')}</span>
              <span className="text-lg font-bold text-[#22C55E] font-mono">{stats.gcContent}%</span>
            </div>
            <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_at_content')}</span>
              <span className="text-lg font-bold text-[#0EA5E9] font-mono">{stats.atContent}%</span>
            </div>
            <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_mol_weight')}</span>
              <span className="text-lg font-bold text-[#8B5CF6] font-mono">{stats.molecularWeightDa.toLocaleString()} Da</span>
            </div>
          </div>

          {validation.hasAmbiguityChars && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-[11px] text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>{getTranslation(lang, 'tool_gc_ambiguous_note')}</span>
            </div>
          )}

          {/* Molecular Weight Model Selector */}
          <div className="flex items-center justify-between flex-wrap gap-2 p-3 bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl">
            <span className="text-xs font-semibold text-[#12312B]">{getTranslation(lang, 'tool_mw_model')}</span>
            <div className="flex items-center gap-1.5">
              {(molecule === 'DNA' ? (['ssDNA', 'dsDNA'] as MwModel[]) : (['RNA'] as MwModel[])).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mwModel === m}
                  onClick={() => setMwModel(m)}
                  disabled={molecule === 'RNA'}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    molecule === 'RNA' ? 'cursor-default' : 'cursor-pointer'
                  } ${
                    mwModel === m
                      ? 'bg-[#0F766E] text-white'
                      : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
                  }`}
                >
                  {getTranslation(lang, m === 'ssDNA' ? 'tool_mw_model_ssdna' : m === 'dsDNA' ? 'tool_mw_model_dsdna' : 'tool_mw_model_rna')}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-[#64748B] -mt-3 italic">{getTranslation(lang, 'tool_mw_approx_note')}</p>

          {/* Nucleotide Breakdown Bar */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-[#12312B]">{getTranslation(lang, 'tool_nucleotide_comp')}</span>
            <div className="h-3 rounded-full bg-slate-100 flex overflow-hidden border border-[#DDEDE8]">
              <div style={{ width: `${(composition.canonical.A / (stats.length || 1)) * 100}%` }} className="bg-emerald-500" title="A" />
              {molecule === 'DNA' ? (
                <div style={{ width: `${(composition.canonical.T / (stats.length || 1)) * 100}%` }} className="bg-sky-500" title="T" />
              ) : (
                <div style={{ width: `${(composition.canonical.U / (stats.length || 1)) * 100}%` }} className="bg-sky-500" title="U" />
              )}
              <div style={{ width: `${(composition.canonical.G / (stats.length || 1)) * 100}%` }} className="bg-amber-500" title="G" />
              <div style={{ width: `${(composition.canonical.C / (stats.length || 1)) * 100}%` }} className="bg-purple-500" title="C" />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-[#64748B] pt-1 flex-wrap gap-x-3">
              <span className="text-emerald-700 font-medium">A: {composition.canonical.A}</span>
              <span className="text-sky-700 font-medium">{molecule === 'DNA' ? 'T' : 'U'}: {molecule === 'DNA' ? composition.canonical.T : composition.canonical.U}</span>
              <span className="text-amber-700 font-medium">G: {composition.canonical.G}</span>
              <span className="text-purple-700 font-medium">C: {composition.canonical.C}</span>
            </div>

            {composition.ambiguousTotal > 0 && (
              <div className="pt-2 space-y-1">
                <span className="text-[11px] font-semibold text-[#64748B]">{getTranslation(lang, 'tool_ambiguous_bases_header')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(composition.ambiguous).map(([sym, count]) => (
                    <span key={sym} className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      {sym}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tab Specific Views */}
          {activeTab === 'orf' ? (
            <div className="space-y-3 pt-2">
              {molecule === 'RNA' ? (
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-2 text-xs text-sky-800">
                  <Info className="w-4 h-4 shrink-0 text-sky-600 mt-0.5" />
                  <span>{getTranslation(lang, 'tool_rna_orf_note')}</span>
                </div>
              ) : (
                <>
                  <h5 className="text-xs font-bold text-[#12312B]">{getTranslation(lang, 'tool_orfs_found')} ({orfs.length})</h5>
                  {orfs.length === 0 ? (
                    <p className="text-xs text-[#64748B] italic">{getTranslation(lang, 'tool_no_orfs_found')}</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {orfs.map((orf, i) => (
                        <div key={i} className="p-3 bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold text-[#0F766E]">
                            <span>{getTranslation(lang, 'tool_frame')} {orf.frame} (bp {orf.start}..{orf.end})</span>
                            <span className="font-mono">{orf.lengthAa} aa ({orf.lengthBp} bp)</span>
                          </div>
                          {orf.hasAmbiguousCodons && (
                            <div className="flex items-center gap-1.5 text-[10px] text-amber-700 font-medium">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>{getTranslation(lang, 'tool_orf_ambiguous_codon_warning')}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2">
                            <div className="p-2 bg-white border border-[#DDEDE8] rounded-lg font-mono text-xs text-[#8B5CF6] break-all sequence-mono-ltr flex-1">
                              {orf.proteinSequence}
                            </div>
                            <CopyButton textToCopy={orf.proteinSequence} lang={lang} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : activeTab === 'transcription' ? (
            <div className="space-y-3 pt-2">
              {molecule === 'RNA' ? (
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-2 text-xs text-sky-800">
                  <Info className="w-4 h-4 shrink-0 text-sky-600 mt-0.5" />
                  <span>{getTranslation(lang, 'tool_rna_transcription_note')}</span>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[#12312B]">{getTranslation(lang, 'tool_transcribed_mrna')}</span>
                    <CopyButton textToCopy={rna} lang={lang} />
                  </div>
                  <div className="p-2.5 bg-[#F3FAF7] border border-[#DDEDE8] rounded-lg font-mono text-xs text-[#0F766E] break-all sequence-mono-ltr">
                    {rna}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'translation' ? (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="p-2.5 bg-slate-50 border border-[#DDEDE8] rounded-lg">
                  <span className="text-[10px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_reading_frame_used')}</span>
                  <span className="text-sm font-bold text-[#12312B] font-mono">+1</span>
                </div>
                <div className="p-2.5 bg-slate-50 border border-[#DDEDE8] rounded-lg">
                  <span className="text-[10px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_start_position')}</span>
                  <span className="text-sm font-bold text-[#12312B] font-mono">1</span>
                </div>
                <div className="p-2.5 bg-slate-50 border border-[#DDEDE8] rounded-lg">
                  <span className="text-[10px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_stop_codon_present')}</span>
                  <span className="text-sm font-bold text-[#12312B] font-mono">{getTranslation(lang, proteinHasStop ? 'tool_yes' : 'tool_no')}</span>
                </div>
                <div className="p-2.5 bg-slate-50 border border-[#DDEDE8] rounded-lg">
                  <span className="text-[10px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_aa_length')}</span>
                  <span className="text-sm font-bold text-[#12312B] font-mono">{proteinAaLength}</span>
                </div>
              </div>
              <p className="text-[10px] text-[#64748B] italic">{getTranslation(lang, 'tool_translation_depends_on_frame')}</p>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[#12312B]">{getTranslation(lang, 'tool_translated_protein')}</span>
                  <CopyButton textToCopy={protein} lang={lang} />
                </div>
                <div className="p-2.5 bg-[#F3FAF7] border border-[#DDEDE8] rounded-lg font-mono text-xs text-[#8B5CF6] break-all sequence-mono-ltr">
                  {protein}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[#12312B]">{getTranslation(lang, 'tool_reverse_complement_strand')}</span>
                  <CopyButton textToCopy={revComp} lang={lang} />
                </div>
                <div className="p-2.5 bg-[#F3FAF7] border border-[#DDEDE8] rounded-lg font-mono text-xs text-[#0EA5E9] break-all sequence-mono-ltr">
                  {revComp}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <ScientificExplanation
        formula="GC% = [(G + C) / (canonical A/T(U)/G/C bases)] × 100"
        biologicalMeaning="GC bonds contain 3 hydrogen bonds (G≡C) compared to 2 in AT/AU pairs. Higher GC content increases thermal denaturation melting temperature (Tm) and structural stability. IUPAC ambiguity codes (R, Y, N, etc.) are excluded from both the numerator and denominator — they are never guessed at or counted as a canonical base."
        assumptions="This is an educational, computational sequence-analysis tool: transcription/translation/ORF logic implements the standard genetic code on a linear molecule; translation always starts at position 1 of reading frame +1 of the sequence as entered and does not search for a biological start codon. Reverse complement and ORF search use full IUPAC ambiguity support, but an ORF containing an ambiguous codon is flagged rather than presented as a fully-resolved protein."
        limitations="Molecular weight is an approximation for the selected model only (ssDNA, dsDNA, or RNA) and does not account for modified nucleosides, secondary structure, or buffer/salt conditions. ORF analysis is DNA-specific; it is not run on RNA input. This tool does not perform BLAST-style homology search or claim research-grade accuracy."
        lang={lang}
      />
    </div>
  );
};
