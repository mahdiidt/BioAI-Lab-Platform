import React, { useState } from 'react';
import { PhylogeneticTreeVisualizer } from '../visualizers/PhylogeneticTreeVisualizer';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';

interface ToolProps {
  lang: Language;
}

export const PhylogeneticTreeTool: React.FC<ToolProps> = ({ lang }) => {
  const [newick, setNewick] = useState('(Homo_sapiens:0.05, (Pan_troglodytes:0.06, Gorilla_gorilla:0.09):0.08, Mus_musculus:0.25);');

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-3">
        <label className="text-xs font-semibold text-[#12312B] uppercase tracking-wider block">
          {getTranslation(lang, 'tool_newick_tree_format')}
        </label>
        <textarea
          value={newick}
          onChange={(e) => setNewick(e.target.value)}
          rows={3}
          className="w-full p-3 rounded-xl border border-[#DDEDE8] font-mono text-xs text-[#12312B] outline-none sequence-mono-ltr"
        />
      </div>

      <PhylogeneticTreeVisualizer newickString={newick} />

      <ScientificExplanation
        formula="Newick Tree Format: (TaxonA:lengthA, (TaxonB:lengthB, TaxonC:lengthC):lengthInternal);"
        biologicalMeaning="Phylogenetic trees represent evolutionary relationships among taxa derived from genetic sequence distance matrices or maximum likelihood estimation."
        lang={lang}
      />
    </div>
  );
};

