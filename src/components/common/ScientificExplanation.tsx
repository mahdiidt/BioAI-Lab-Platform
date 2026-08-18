import React, { useState } from 'react';
import { ChevronDown, BookOpen, AlertCircle } from 'lucide-react';
import { getTranslation } from '../../i18n';
import { Language } from '../../types';

interface ScientificExplanationProps {
  formula?: string;
  assumptions?: string;
  biologicalMeaning?: string;
  limitations?: string;
  lang?: Language;
}

export const ScientificExplanation: React.FC<ScientificExplanationProps> = ({
  formula,
  assumptions,
  biologicalMeaning,
  limitations,
  lang = 'en',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentLang: Language = (lang as Language) || 'en';

  return (
    <div className="mt-6 border border-[#DDEDE8] dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl overflow-hidden transition-all shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        className="w-full px-5 py-3.5 bg-[#ECFDF5] dark:bg-slate-800 hover:bg-[#d1fae5] dark:hover:bg-slate-700 flex items-center justify-between text-left transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
          <span className="font-semibold text-sm text-[#12312B] dark:text-slate-100">
            {getTranslation(currentLang, 'howItWorks')}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-[#0F766E] dark:text-teal-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="p-5 space-y-4 text-xs text-[#12312B] dark:text-slate-200 bg-white dark:bg-slate-900 border-t border-[#DDEDE8] dark:border-slate-800">
          {formula && (
            <div>
              <h5 className="font-bold text-[#0F766E] dark:text-teal-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <span>{getTranslation(currentLang, 'formulaHeader')}</span>
              </h5>
              <div className="p-3 bg-[#F3FAF7] dark:bg-slate-800 border border-[#DDEDE8] dark:border-slate-700 rounded-lg sequence-mono-ltr text-[#0F766E] dark:text-teal-300 font-mono text-xs">
                {formula}
              </div>
            </div>
          )}

          {biologicalMeaning && (
            <div>
              <h5 className="font-bold text-[#12312B] dark:text-slate-100 mb-1">{getTranslation(currentLang, 'biologicalPrinciples')}</h5>
              <p className="leading-relaxed text-[#64748B] dark:text-slate-400">{biologicalMeaning}</p>
            </div>
          )}

          {assumptions && (
            <div>
              <h5 className="font-bold text-[#12312B] dark:text-slate-100 mb-1">{getTranslation(currentLang, 'modelAssumptions')}</h5>
              <p className="leading-relaxed text-[#64748B] dark:text-slate-400">{assumptions}</p>
            </div>
          )}

          {limitations && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg flex items-start gap-2 text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">{getTranslation(currentLang, 'limitationsHeader')}:</span>
                <span className="leading-relaxed">{limitations}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
