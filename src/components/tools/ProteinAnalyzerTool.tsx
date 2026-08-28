import React, { useState } from 'react';
import { SequenceInput } from '../common/SequenceInput';
import { analyzeProtein } from '../../utils/protein';
import { validateSequence } from '../../utils/sequenceValidator';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { CopyButton } from '../common/CopyButton';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { ExportButton } from '../common/ExportButton';
import { AlertTriangle } from 'lucide-react';

interface ToolProps {
  lang: Language;
}

export const ProteinAnalyzerTool: React.FC<ToolProps> = ({ lang }) => {
  const [seq, setSeq] = useState('MSKGEELFTGVVPILVELDGDVNGHKFSVSGEGEGDATYGKLTLKFICTTGKLPVPWPTLVTTFSYGVQCFSRYPDHMKQHDFFKSAMPEGYVQERTIFFKDDGNYKTRAEVKFEGDTLVNRIELKGIDFKEDGNILGHKLEYNYNSHNVYIMADKQKNGIKVNFKIRHNIEDGSVQLADHYQQNTPIGDGPVLLPDNHYLSTQSALSKDPNEKRDHMVLLEFVTAAGITHGMDELYK');

  // analyzeProtein() returns null (with no error detail) for invalid or
  // empty input. Validate separately so the UI can tell the user *why*
  // no results are shown, instead of the results panel silently vanishing.
  const validation = validateSequence(seq, 'PROTEIN');
  const stats = validation.isValid ? analyzeProtein(seq) : null;

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <SequenceInput
        value={seq}
        onChange={setSeq}
        sampleSequence="MSKGEELFTGVVPILVELDGDVNGHKFSVSGEGEGDATYGKLTLKFICTTGKLPVPWPTLVTTFSYGVQCFSRYPDHMKQHDFFKSAMPEGYVQERTIFFKDDGNYKTRAEVKFEGDTLVNRIELKGIDFKEDGNILGHKLEYNYNSHNVYIMADKQKNGIKVNFKIRHNIEDGSVQLADHYQQNTPIGDGPVLLPDNHYLSTQSALSKDPNEKRDHMVLLEFVTAAGITHGMDELYK"
        sampleLabel={getTranslation(lang, 'tool_load_egfp_seq')}
        allowedCharsRegex={/^[ACDEFGHIKLMNPQRSTVWY\s]+$/i}
        lang={lang}
      />

      {!validation.isValid && validation.errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{validation.errorMessage}</span>
        </div>
      )}

      {/* Edge case: a sequence made up entirely of '*' (stop codon markers)
          passes character validation but has zero actual residues once
          stop markers are stripped, so analyzeProtein() still returns
          null. Surface that explicitly instead of showing nothing. */}
      {validation.isValid && !stats && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{getTranslation(lang, 'tool_no_residues_after_stop')}</span>
        </div>
      )}

      {stats && (
        <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-[#12312B]">{getTranslation(lang, 'tool_calc_protein_props')}</h4>
            <ExportButton filename="protein_analysis.json" data={stats} format="json" lang={lang} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_length')}</span>
              <span className="text-lg font-bold text-[#0F766E] font-mono">{stats.length} aa</span>
            </div>
            <div className="p-3 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_isoelectric_pi')}</span>
              <span className="text-lg font-bold text-[#8B5CF6] font-mono">{stats.isoelectricPointPI}</span>
            </div>
            <div className="p-3 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_molecular_weight')}</span>
              <span className="text-lg font-bold text-[#0EA5E9] font-mono">{stats.molecularWeightDa.toLocaleString()} Da</span>
            </div>
            <div className="p-3 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
              <span className="text-[11px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_gravy_hydropathy')}</span>
              <span className="text-lg font-bold text-[#22C55E] font-mono">{stats.gravyIndex}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-[#F3FAF7] border border-[#DDEDE8] rounded-lg">
              <span className="text-[#64748B] block font-semibold mb-0.5">{getTranslation(lang, 'tool_extinction_coeff')}:</span>
              <span className="font-mono font-bold text-[#12312B]">{stats.extinctionCoeff.toLocaleString()} M⁻¹ cm⁻¹</span>
            </div>
            <div className="p-3 bg-[#F3FAF7] border border-[#DDEDE8] rounded-lg">
              <span className="text-[#64748B] block font-semibold mb-0.5">{getTranslation(lang, 'tool_net_charge_ph7')}:</span>
              <span className={`font-mono font-bold ${stats.chargeAtpH7 >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                {stats.chargeAtpH7 > 0 ? `+${stats.chargeAtpH7}` : stats.chargeAtpH7}
              </span>
            </div>
          </div>
        </div>
      )}

      <ScientificExplanation
        formula="pI calculated via Bjellqvist pKa scale bisection | GRAVY = Sum(Kyte-Doolittle hydropathy) / Length"
        biologicalMeaning="The Isoelectric Point (pI) is the pH at which a protein carries no net electrical charge. At pH < pI the protein is positively charged; at pH > pI it is negatively charged."
        lang={lang}
      />
    </div>
  );
};
