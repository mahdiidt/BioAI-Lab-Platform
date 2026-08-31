import React, { useEffect } from 'react';
import { TOOL_REGISTRY, CATEGORIES } from '../data/toolRegistry';
import { getTranslation } from '../i18n';
import { Language } from '../types';
import { ArrowLeft, Star, ShieldCheck } from 'lucide-react';
import { ErrorBoundary } from './common/ErrorBoundary';

// Import Specific Tool Components
import { DnaAnalyzerTool } from './tools/DnaAnalyzerTool';
import { ReverseComplementTool } from './tools/ReverseComplementTool';
import { FastaParserTool } from './tools/FastaParserTool';
import { KmerTool } from './tools/KmerTool';
import { PunnettSquareTool } from './tools/PunnettSquareTool';
import { MutationAnalyzerTool } from './tools/MutationAnalyzerTool';
import { CodonOptimizationTool } from './tools/CodonOptimizationTool';
import { CrisprGuideDesignerTool } from './tools/CrisprGuideDesignerTool';
import { PrimerDesignerTool } from './tools/PrimerDesignerTool';
import { RestrictionDigestTool } from './tools/RestrictionDigestTool';
import { AgaroseGelSimTool } from './tools/AgaroseGelSimTool';
import { ProteinAnalyzerTool } from './tools/ProteinAnalyzerTool';
import { MolarityCalcTool } from './tools/MolarityCalcTool';
import { MichaelisMentenTool } from './tools/MichaelisMentenTool';
import { BacterialGrowthTool } from './tools/BacterialGrowthTool';
import { GlobalAlignmentTool } from './tools/GlobalAlignmentTool';
import { LocalAlignmentTool } from './tools/LocalAlignmentTool';
import { RnaSecondaryStructureTool } from './tools/RnaSecondaryStructureTool';
import { StatisticalTestTool } from './tools/StatisticalTestTool';
import { PhylogeneticTreeTool } from './tools/PhylogeneticTreeTool';
import { GramStainTool } from './tools/GramStainTool';

interface ToolDetailModalProps {
  toolId: string;
  lang: Language;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export const ToolDetailModal: React.FC<ToolDetailModalProps> = ({
  toolId,
  lang,
  onClose,
  isFavorite,
  onToggleFavorite,
}) => {
  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Lock background scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const toolMeta = TOOL_REGISTRY.find((t) => t.id === toolId);
  if (!toolMeta) return null;

  const catObj = CATEGORIES.find((c) => c.id === toolMeta.category);

  // Render Tool Component mapping
  const renderToolBody = () => {
    switch (toolId) {
      case 'dna_analyzer':
        return <DnaAnalyzerTool lang={lang} initialTab="dna" />;
      case 'gc_content':
        return <DnaAnalyzerTool lang={lang} initialTab="gc" />;
      case 'transcription':
        return <DnaAnalyzerTool lang={lang} initialTab="transcription" />;
      case 'translation':
        return <DnaAnalyzerTool lang={lang} initialTab="translation" />;
      case 'orf_finder':
        return <DnaAnalyzerTool lang={lang} initialTab="orf" />;

      case 'fasta_parser':
        return <FastaParserTool lang={lang} />;

      case 'kmer_counter':
        return <KmerTool lang={lang} />;

      case 'reverse_complement':
        return <ReverseComplementTool lang={lang} />;

      case 'punnett_square':
        return <PunnettSquareTool lang={lang} initialTab="punnett" />;
      case 'hardy_weinberg':
        return <PunnettSquareTool lang={lang} initialTab="hardy" />;

      case 'mutation_analyzer':
        return <MutationAnalyzerTool lang={lang} />;

      case 'codon_optimization':
        return <CodonOptimizationTool lang={lang} />;

      case 'crispr_guide_designer':
        return <CrisprGuideDesignerTool lang={lang} />;

      case 'primer_designer':
        return <PrimerDesignerTool lang={lang} initialTab="design" />;
      case 'primer_tm':
        return <PrimerDesignerTool lang={lang} initialTab="tm" />;
      case 'pcr_reaction_setup':
        return <PrimerDesignerTool lang={lang} initialTab="setup" />;

      case 'restriction_digest':
        return <RestrictionDigestTool lang={lang} />;

      case 'agarose_gel_simulator':
        return <AgaroseGelSimTool lang={lang} />;

      case 'protein_analyzer':
        return <ProteinAnalyzerTool lang={lang} />;

      case 'molarity_calc':
        return <MolarityCalcTool lang={lang} initialTab="molarity" />;
      case 'c1v1_calc':
        return <MolarityCalcTool lang={lang} initialTab="c1v1" />;
      case 'od600_density':
        return <MolarityCalcTool lang={lang} initialTab="od600" />;

      case 'michaelis_menten':
        return <MichaelisMentenTool lang={lang} />;

      case 'bacterial_growth':
        return <BacterialGrowthTool lang={lang} />;

      case 'gram_stain':
        return <GramStainTool lang={lang} />;

      case 'global_alignment':
        return <GlobalAlignmentTool lang={lang} />;

      case 'local_alignment':
        return <LocalAlignmentTool lang={lang} />;

      case 'rna_secondary_structure':
        return <RnaSecondaryStructureTool lang={lang} />;

      case 'statistical_test':
        return <StatisticalTestTool lang={lang} />;

      case 'phylogenetic_tree':
        return <PhylogeneticTreeTool lang={lang} />;

      default:
        return <DnaAnalyzerTool lang={lang} />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tool-modal-title"
      className="fixed inset-0 z-50 bg-[#121826]/40 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Tool Header Bar */}
        <div className="p-5 border-b border-[#DDEDE8] dark:border-slate-800 bg-[#ECFDF5] dark:bg-slate-800/90 flex items-center justify-between gap-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              type="button"
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-700 text-[#0F766E] dark:text-teal-400 hover:bg-[#d1fae5] dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs"
              title={getTranslation(lang, 'backToDashboard')}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="tool-modal-title" className="text-base sm:text-lg font-extrabold text-[#12312B] dark:text-slate-100">
                  {getTranslation(lang, toolMeta.titleKey)}
                </h2>
                {catObj && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white dark:bg-slate-900 text-[#0F766E] dark:text-teal-400 border border-[#DDEDE8] dark:border-slate-700">
                    {getTranslation(lang, catObj.nameKey)}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#64748B] dark:text-slate-400 line-clamp-1">
                {getTranslation(lang, toolMeta.descKey)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleFavorite}
              type="button"
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-700 text-[#12312B] dark:text-slate-100 hover:bg-[#F3FAF7] dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs"
              title={getTranslation(lang, 'favoriteToggle')}
            >
              <Star
                className={`w-5 h-5 ${
                  isFavorite ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#64748B] dark:text-slate-400'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Tool Workspace Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-white dark:bg-slate-900">
          <ErrorBoundary key={toolId} lang={lang} fallbackTitle={`Error rendering ${getTranslation(lang, toolMeta.titleKey)}`}>
            {renderToolBody()}
          </ErrorBoundary>
        </div>

        {/* Footer Bar */}
        <div className="px-6 py-3 bg-[#F3FAF7] dark:bg-slate-950 border-t border-[#DDEDE8] dark:border-slate-800 text-xs text-[#64748B] dark:text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#22C55E]" />
            <span>Client-side local execution • Zero external sequence telemetry</span>
          </div>
          <span>BioAI.Lab Scientific Engine</span>
        </div>
      </div>
    </div>
  );
};
