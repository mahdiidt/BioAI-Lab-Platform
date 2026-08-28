import React from 'react';
import { Sparkles, ArrowRight, Dna, ShieldCheck, Cpu, Microscope } from 'lucide-react';
import { getTranslation } from '../i18n';
import { Language } from '../types';
import { TOOL_REGISTRY } from '../data/toolRegistry';

interface HeroProps {
  lang: Language;
  onExploreClick: () => void;
  onBrowseCategoriesClick: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  lang,
  onExploreClick,
  onBrowseCategoriesClick,
}) => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#ECFDF5]/60 via-[#F3FAF7] to-[#F3FAF7] dark:from-slate-900/60 dark:via-slate-950 dark:to-slate-950 border-b border-[#DDEDE8] dark:border-slate-800 pt-12 pb-16 lg:pt-16 lg:pb-20">
      {/* Background Cell & Grid Overlay */}
      <div className="absolute inset-0 bg-scientific-grid pointer-events-none opacity-50 dark:opacity-20" />
      <div className="absolute inset-0 bg-cell-pattern pointer-events-none opacity-50 dark:opacity-20" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Text Content */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* Top Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-800 shadow-2xs text-xs font-semibold text-[#0F766E] dark:text-teal-400">
              <Sparkles className="w-3.5 h-3.5 text-[#14B8A6]" />
              <span>BioAI.Lab Platform • {TOOL_REGISTRY.length}+ Professional Laboratory Tools</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#12312B] dark:text-slate-100 tracking-tight leading-[1.15]">
              {getTranslation(lang, 'taglineText')}
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-lg text-[#64748B] dark:text-slate-400 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
              {getTranslation(lang, 'taglineSub')}
            </p>

            {/* Action CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <button
                onClick={onExploreClick}
                type="button"
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#0F766E] hover:bg-[#0d625b] text-white font-bold text-sm shadow-md shadow-[#0F766E]/20 transition-all flex items-center justify-center gap-2 cursor-pointer group"
              >
                <span>{getTranslation(lang, 'exploreToolsBtn')}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={onBrowseCategoriesClick}
                type="button"
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-[#ECFDF5] dark:hover:bg-slate-800 text-[#0F766E] dark:text-teal-400 border border-[#DDEDE8] dark:border-slate-800 font-bold text-sm transition-all cursor-pointer shadow-2xs"
              >
                {getTranslation(lang, 'browseCategoriesBtn')}
              </button>
            </div>

            {/* Platform Highlights Banner */}
            <div className="pt-6 grid grid-cols-3 gap-4 border-t border-[#DDEDE8]/80 dark:border-slate-800 text-left">
              <div>
                <span className="block text-xl font-extrabold text-[#0F766E] dark:text-teal-400 font-mono">100%</span>
                <span className="text-xs text-[#64748B] dark:text-slate-400 font-medium">{getTranslation(lang, 'hero_local_browser_privacy')}</span>
              </div>
              <div>
                <span className="block text-xl font-extrabold text-[#0EA5E9] font-mono">{TOOL_REGISTRY.length}+</span>
                <span className="text-xs text-[#64748B] dark:text-slate-400 font-medium">{getTranslation(lang, 'hero_bio_genetics_tools')}</span>
              </div>
              <div>
                <span className="block text-xl font-extrabold text-[#8B5CF6] font-mono">6</span>
                <span className="text-xs text-[#64748B] dark:text-slate-400 font-medium">{getTranslation(lang, 'hero_supported_languages')}</span>
              </div>
            </div>
          </div>

          {/* Right Animated 3D DNA Helix & Scientific Visual */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-72 h-80 sm:w-80 sm:h-96 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-[#DDEDE8] dark:border-slate-800 shadow-xl p-6 flex flex-col items-center justify-between overflow-hidden">
              <div className="w-full flex items-center justify-between text-xs text-[#64748B] dark:text-slate-400 border-b border-[#DDEDE8] dark:border-slate-800 pb-3">
                <span className="font-bold text-[#0F766E] dark:text-teal-400 flex items-center gap-1.5">
                  <Microscope className="w-4 h-4" /> DNA Double Helix (3D Model)
                </span>
                <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-ping" />
              </div>

              {/* 3D Animated DNA Helix SVG Canvas */}
              <div className="dna-3d-container relative my-auto py-4">
                <div className="dna-3d-helix flex flex-col items-center space-y-3">
                  {[1, 2, 3, 4, 5, 6, 7].map((step) => {
                    const angle = step * 35;
                    return (
                      <div
                        key={step}
                        style={{ transform: `rotateY(${angle}deg)` }}
                        className="w-48 h-3.5 flex items-center justify-between px-2"
                      >
                        <div className="w-3.5 h-3.5 rounded-full bg-[#0F766E] shadow-sm shadow-[#0F766E]" />
                        <div className="flex-1 h-0.5 bg-gradient-to-r from-[#0F766E] via-[#14B8A6] to-[#0EA5E9] mx-1 opacity-80" />
                        <div className="w-3.5 h-3.5 rounded-full bg-[#0EA5E9] shadow-sm shadow-[#0EA5E9]" />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="w-full text-center text-[11px] text-[#64748B] dark:text-slate-400 font-mono bg-[#ECFDF5] dark:bg-slate-800 py-2 rounded-xl border border-[#DDEDE8] dark:border-slate-700">
                B-DNA Double Helix • 10.5 bp / Turn
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
