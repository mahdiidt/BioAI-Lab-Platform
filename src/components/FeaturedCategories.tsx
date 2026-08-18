import React from 'react';
import { CATEGORIES, TOOL_REGISTRY } from '../data/toolRegistry';
import { getTranslation } from '../i18n';
import { Language } from '../types';
import { ArrowRight, Dna, Activity, Flame, ShieldAlert, Cpu, FlaskConical, Beaker, Bug, GitCommit, Layers } from 'lucide-react';

interface FeaturedCategoriesProps {
  lang: Language;
  onSelectCategory: (catId: string) => void;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  dna_rna: Dna,
  genetics: Activity,
  pcr_primers: Flame,
  restriction: ShieldAlert,
  protein: Cpu,
  lab_calc: FlaskConical,
  biochemistry: Beaker,
  microbiology: Bug,
  bioinformatics: GitCommit,
  cell_mol: Layers,
};

export const FeaturedCategories: React.FC<FeaturedCategoriesProps> = ({
  lang,
  onSelectCategory,
}) => {
  return (
    <section id="categories" className="py-12 bg-white dark:bg-slate-900 border-b border-[#DDEDE8] dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#12312B] dark:text-slate-100">
            Scientific Domains & Tool Categories
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400">
            Explore specialized calculators, analyzers, and simulators grouped by biological field.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.id] || Dna;
            const count = TOOL_REGISTRY.filter((t) => t.category === cat.id).length;

            return (
              <div
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className="p-5 rounded-2xl border border-[#DDEDE8] dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#14B8A6] hover:bg-[#ECFDF5]/50 dark:hover:bg-slate-800/80 transition-all cursor-pointer group shadow-2xs space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-[#0F766E]/10 dark:bg-slate-800 text-[#0F766E] dark:text-teal-400 flex items-center justify-center group-hover:bg-[#0F766E] group-hover:text-white transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#ECFDF5] dark:bg-slate-800 text-[#0F766E] dark:text-teal-400 border border-[#DDEDE8] dark:border-slate-700">
                      {count} Tools
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-[#12312B] dark:text-slate-100 group-hover:text-[#0F766E] dark:group-hover:text-teal-400 transition-colors">
                      {getTranslation(lang, cat.nameKey)}
                    </h3>
                    <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {getTranslation(lang, cat.descKey)}
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-1 text-xs font-bold text-[#0F766E] dark:text-teal-400 group-hover:translate-x-1 transition-transform">
                  <span>{getTranslation(lang, 'exploreToolsBtn')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};