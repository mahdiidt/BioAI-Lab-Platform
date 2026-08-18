import React from 'react';
import { Dna, Shield, AlertCircle, Github, Globe } from 'lucide-react';
import { getTranslation } from '../i18n';
import { Language } from '../types';

interface FooterProps {
  lang: Language;
  onLanguageChange: (lang: Language) => void;
}

export const Footer: React.FC<FooterProps> = ({ lang, onLanguageChange }) => {
  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-[#DDEDE8] dark:border-slate-800 pt-12 pb-8 text-xs text-[#64748B] dark:text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-[#DDEDE8] dark:border-slate-800">
          {/* Brand Info */}
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#0F766E] text-white flex items-center justify-center">
                <Dna className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-base text-[#12312B] dark:text-slate-100">BioAI.Lab</span>
            </div>
            <p className="text-xs text-[#64748B] dark:text-slate-400 leading-relaxed">
              {getTranslation(lang, 'brandTagline')}
            </p>
            <p className="text-[11px] text-[#0F766E] dark:text-teal-300 bg-[#ECFDF5] dark:bg-slate-800 p-2.5 rounded-lg border border-[#DDEDE8] dark:border-slate-700">
              {getTranslation(lang, 'privacyNotice')}
            </p>
          </div>

          {/* Scientific Disclaimer */}
          <div className="md:col-span-7 space-y-2 p-4 bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900 rounded-2xl text-amber-900 dark:text-amber-300">
            <div className="flex items-center gap-2 font-bold text-xs text-amber-800 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{getTranslation(lang, 'disclaimerTitle')}</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              {getTranslation(lang, 'disclaimerBody')}
            </p>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
          <div>{getTranslation(lang, 'footerRights')}</div>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[#12312B] dark:text-slate-300 hover:text-[#0F766E] dark:hover:text-teal-400 transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
