import React, { useMemo } from 'react';
import { SequenceInput } from '../common/SequenceInput';
import { ExportButton } from '../common/ExportButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { SecondaryStructureVisualizer } from '../visualizers/SecondaryStructureVisualizer';
import { predictSecondaryStructure } from '../../utils/secondaryStructure';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Waves, AlertTriangle } from 'lucide-react';

interface ToolProps {
  lang: Language;
}

const SAMPLE_PROTEIN =
  'MSKGEELFTGVVPILVELDGDVNGHKFSVSGEGEGDATYGKLTLKFICTTGKLPVPWPTLVTTFSYGVQCFSRYPDHMKQHDFFKSAMPEGYVQERTIFFKDDGNYKTRAEVKFEGDTLVNRIELKGIDFKEDGNILGHKLEYNYNSHNVYIMADKQKNGIKVNFKIRHNIEDGSVQLADHYQQNTPIGDGPVLLPDNHYLSTQSALSKDPNEKRDHMVLLEFVTAAGITHGMDELYK';

export const SecondaryStructureTool: React.FC<ToolProps> = ({ lang }) => {
  const [seq, setSeq] = React.useState(SAMPLE_PROTEIN);
  const [hoveredResidue, setHoveredResidue] = React.useState<number | null>(null);

  const result = useMemo(() => predictSecondaryStructure(seq), [seq]);

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <SequenceInput
        value={seq}
        onChange={setSeq}
        sampleSequence={SAMPLE_PROTEIN}
        sampleLabel={getTranslation(lang, 'tool_load_egfp_seq')}
        allowedCharsRegex={/^[ACDEFGHIKLMNPQRSTVWY\s]+$/i}
        lang={lang}
      />

      {!result.isValid ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{result.errorMessage}</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-center">
              <span className="block text-[10px] font-bold text-red-700 uppercase tracking-wide">{getTranslation(lang, 'tool_ss_helix')}</span>
              <span className="block text-xl font-extrabold text-red-700 font-mono">{result.helixPercent.toFixed(1)}%</span>
            </div>
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-center">
              <span className="block text-[10px] font-bold text-amber-700 uppercase tracking-wide">{getTranslation(lang, 'tool_ss_sheet')}</span>
              <span className="block text-xl font-extrabold text-amber-700 font-mono">{result.sheetPercent.toFixed(1)}%</span>
            </div>
            <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-2xl text-center">
              <span className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide">{getTranslation(lang, 'tool_ss_coil')}</span>
              <span className="block text-xl font-extrabold text-slate-600 font-mono">{result.coilPercent.toFixed(1)}%</span>
            </div>
          </div>

          {/* Composition bar */}
          <div className="w-full h-3 rounded-full overflow-hidden flex border border-[#DDEDE8]">
            <div style={{ width: `${result.helixPercent}%`, backgroundColor: '#DC2626' }} />
            <div style={{ width: `${result.sheetPercent}%`, backgroundColor: '#D97706' }} />
            <div style={{ width: `${result.coilPercent}%`, backgroundColor: '#94A3B8' }} />
          </div>

          <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-3">
              <h4 className="font-bold text-sm text-[#12312B] flex items-center gap-2">
                <Waves className="w-4 h-4 text-[#0F766E]" />
                {getTranslation(lang, 'tool_ss_predicted_structure')}
              </h4>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-3 text-[10px] font-semibold text-[#64748B]">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-full bg-[#DC2626]" />{getTranslation(lang, 'tool_ss_helix')}</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-[#D97706]" style={{ clipPath: 'polygon(0 0, 70% 0, 100% 50%, 70% 100%, 0 100%)' }} />{getTranslation(lang, 'tool_ss_sheet')}</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#94A3B8]" />{getTranslation(lang, 'tool_ss_coil')}</span>
                </div>
                <ExportButton filename="secondary_structure.json" data={result} format="json" lang={lang} />
              </div>
            </div>

            <div className="overflow-x-auto">
              <SecondaryStructureVisualizer sequence={result.sequence} structure={result.structure} onHoverResidue={setHoveredResidue} />
            </div>

            {hoveredResidue !== null && (
              <div className="text-[11px] font-mono text-[#0F766E] bg-[#F0FDF9] rounded-lg px-3 py-1.5 inline-block">
                {getTranslation(lang, 'tool_cut_pos')} {hoveredResidue + 1}: <b>{result.sequence[hoveredResidue]}</b> —{' '}
                {result.structure[hoveredResidue] === 'H'
                  ? getTranslation(lang, 'tool_ss_helix')
                  : result.structure[hoveredResidue] === 'E'
                  ? getTranslation(lang, 'tool_ss_sheet')
                  : getTranslation(lang, 'tool_ss_coil')}
              </div>
            )}
          </div>

          <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs">
            <h4 className="font-bold text-sm text-[#12312B] mb-3">{getTranslation(lang, 'tool_ss_segments')}</h4>
            <div className="flex flex-wrap gap-1.5">
              {result.segments
                .filter((s) => s.code !== 'C')
                .map((s, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border"
                    style={{
                      color: s.code === 'H' ? '#DC2626' : '#D97706',
                      backgroundColor: s.code === 'H' ? '#FEF2F2' : '#FFFBEB',
                      borderColor: s.code === 'H' ? '#FECACA' : '#FDE68A',
                    }}
                  >
                    {s.code === 'H' ? getTranslation(lang, 'tool_ss_helix') : getTranslation(lang, 'tool_ss_sheet')} {s.start}-{s.end}
                  </span>
                ))}
              {result.segments.every((s) => s.code === 'C') && (
                <span className="text-xs text-[#94A3B8]">{getTranslation(lang, 'tool_ss_no_segments')}</span>
              )}
            </div>
          </div>
        </>
      )}

      <ScientificExplanation
        formula="P(α), P(β), P(turn) per residue (Chou-Fasman, 1974) — nucleate a window where the average propensity exceeds threshold, then extend while it stays elevated"
        biologicalMeaning="Chou-Fasman predicts a protein's local secondary structure - alpha helix, beta sheet, or coil - purely from its amino acid sequence, using conformational propensities derived statistically from proteins with known 3D structures. Certain residues (like Glu, Ala, Leu) favor helices; others (like Val, Ile, Tyr) favor sheets; still others (like Gly, Pro) favor turns and break both."
        assumptions="Each residue's propensity is treated independently of its 3D context (no knowledge of the actual fold, disulfide bonds, or ligand binding is used) - exactly as in the original 1974 method, which predates modern machine-learning-based predictors."
        limitations="Chou-Fasman was a landmark method but is now a relatively low-accuracy predictor by modern standards (roughly 50-60% per-residue accuracy on typical proteins) - contemporary tools reach 80%+ using evolutionary information and deep learning. Use this as a historical/educational reference, not for research decisions."
        lang={lang}
      />
    </div>
  );
};
