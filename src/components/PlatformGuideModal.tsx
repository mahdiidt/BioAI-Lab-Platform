import React, { useEffect, useState } from 'react';
import { CATEGORIES, TOOL_REGISTRY } from '../data/toolRegistry';
import { getTranslation } from '../i18n';
import { Language, ToolMeta } from '../types';
import {
  X,
  ShieldCheck,
  Star,
  Sparkles,
  ChevronRight,
  ChevronDown,
  BookOpen,
  AlertCircle,
  Compass,
  // Icon set referenced by CATEGORIES / TOOL_REGISTRY iconName fields
  Dna,
  GitBranch,
  Flame,
  Scissors,
  Activity,
  Calculator,
  FlaskConical,
  Microscope,
  Network,
  Repeat,
  ArrowRightLeft,
  Binary,
  PieChart,
  Search,
  FileText,
  BarChart2,
  Grid,
  Scale,
  Zap,
  Sliders,
  Crosshair,
  Thermometer,
  TestTube,
  Box,
  FlaskRound,
  TrendingDown,
  Eye,
  TrendingUp,
  LineChart,
  Shield,
  AlignLeft,
  GitMerge,
  Target,
  GitCompare,
  Waves,
  Sigma,
} from 'lucide-react';

interface PlatformGuideModalProps {
  lang: Language;
  onClose: () => void;
  onOpenTool: (toolId: string) => void;
}

// Maps every iconName string used in toolRegistry.ts to its Lucide component
const ICON_MAP: Record<string, React.ElementType> = {
  Dna, GitBranch, Flame, Scissors, Activity, Calculator, FlaskConical, Microscope, Network,
  Repeat, ArrowRightLeft, Binary, PieChart, Search, FileText, BarChart2, Grid, Scale, Zap,
  Sliders, Crosshair, Thermometer, TestTube, Box, FlaskRound, TrendingDown, Eye, TrendingUp,
  LineChart, Shield, AlignLeft, GitMerge, Target, GitCompare, Waves, Sigma,
};
const LEVEL_COLORS: Record<string, string> = {
  basic: 'text-[#0F766E] dark:text-teal-400 bg-[#ECFDF5] dark:bg-slate-800 border-[#DDEDE8] dark:border-slate-700',
  intermediate: 'text-[#0369A1] dark:text-sky-400 bg-sky-50 dark:bg-slate-800 border-sky-200 dark:border-slate-700',
  advanced: 'text-[#B45309] dark:text-amber-400 bg-amber-50 dark:bg-slate-800 border-amber-200 dark:border-slate-700',
  research: 'text-[#BE185D] dark:text-pink-400 bg-pink-50 dark:bg-slate-800 border-pink-200 dark:border-slate-700',
};

// Every tool's extended guide copy (when to use / what to enter / output meaning / example)
// is stored under i18n keys derived from its own titleKey, e.g. 'tool_dna_analyzer_title' ->
// 'tool_dna_analyzer_when' / '_input' / '_output' / '_example'. Falls back to English
// automatically via getTranslation() if a language has not translated these yet.
function guideKeyPrefix(tool: ToolMeta): string {
  return tool.titleKey.replace(/_title$/, '');
}

export const PlatformGuideModal: React.FC<PlatformGuideModalProps> = ({ lang, onClose, onOpenTool }) => {
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const toggleExpanded = (toolId: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleOpenTool = (toolId: string) => {
    onOpenTool(toolId);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-modal-title"
      className="fixed inset-0 z-50 bg-[#121826]/40 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-800 rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header Bar */}
        <div className="p-5 border-b border-[#DDEDE8] dark:border-slate-800 bg-[#ECFDF5] dark:bg-slate-800/90 flex items-center justify-between gap-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0F766E] to-[#14B8A6] flex items-center justify-center text-white shadow-md shadow-[#0F766E]/20 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="guide-modal-title" className="text-base sm:text-lg font-extrabold text-[#12312B] dark:text-slate-100">
                  {getTranslation(lang, 'navAbout')}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white dark:bg-slate-900 text-[#0F766E] dark:text-teal-400 border border-[#DDEDE8] dark:border-slate-700">
                  {getTranslation(lang, 'guideBadge')}
                </span>
              </div>
              <p className="text-xs text-[#64748B] dark:text-slate-400 line-clamp-1">
                {getTranslation(lang, 'brandTagline')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-700 text-[#0F766E] dark:text-teal-400 hover:bg-[#d1fae5] dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs shrink-0"
            title={getTranslation(lang, 'kbd_close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-8 bg-white dark:bg-slate-900">
          {/* Intro */}
          <div className="space-y-4">
            <p className="text-sm text-[#334155] dark:text-slate-300 leading-relaxed max-w-4xl">
              {getTranslation(lang, 'guideIntro')}
            </p>
            <p className="text-sm text-[#334155] dark:text-slate-300 leading-relaxed max-w-4xl">
              {getTranslation(lang, 'guideIntroExtended')}
            </p>

            <div className="flex flex-wrap gap-3">
              <div className="px-4 py-2.5 rounded-xl bg-[#F3FAF7] dark:bg-slate-800 border border-[#DDEDE8] dark:border-slate-700 flex items-center gap-2">
                <span className="text-lg font-extrabold text-[#0F766E] dark:text-teal-400">{TOOL_REGISTRY.length}</span>
                <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400">{getTranslation(lang, 'navTools')}</span>
              </div>
              <div className="px-4 py-2.5 rounded-xl bg-[#F3FAF7] dark:bg-slate-800 border border-[#DDEDE8] dark:border-slate-700 flex items-center gap-2">
                <span className="text-lg font-extrabold text-[#0F766E] dark:text-teal-400">{CATEGORIES.length}</span>
                <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400">{getTranslation(lang, 'navCategories')}</span>
              </div>
              <div className="px-4 py-2.5 rounded-xl bg-[#ECFDF5] dark:bg-slate-800 border border-[#DDEDE8] dark:border-slate-700 flex items-center gap-2 text-[#0F766E] dark:text-teal-400">
                <ShieldCheck className="w-4 h-4 text-[#22C55E] shrink-0" />
                <span className="text-xs font-semibold">{getTranslation(lang, 'localClientSide')}</span>
              </div>
            </div>

            <div className="p-4 bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900 rounded-2xl text-amber-900 dark:text-amber-300 max-w-4xl">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-800 dark:text-amber-200 mb-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{getTranslation(lang, 'disclaimerTitle')}</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                {getTranslation(lang, 'disclaimerBody')}
              </p>
            </div>
          </div>

          {/* Which Tool Should I Use? - quick decision guide */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#0F766E]/10 dark:bg-slate-800 text-[#0F766E] dark:text-teal-400 flex items-center justify-center shrink-0">
                <Compass className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-[#12312B] dark:text-slate-100">
                  {getTranslation(lang, 'guideDecisionTitle')}
                </h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  {getTranslation(lang, 'guideDecisionSubtitle')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {TOOL_REGISTRY.map((tool) => {
                const prefix = guideKeyPrefix(tool);
                return (
                  <button
                    key={tool.id}
                    onClick={() => handleOpenTool(tool.id)}
                    type="button"
                    className="text-left p-3 rounded-xl border border-[#DDEDE8] dark:border-slate-800 bg-[#F3FAF7] dark:bg-slate-800/60 hover:border-[#14B8A6] hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer flex items-start gap-3 group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#334155] dark:text-slate-300 leading-relaxed">
                        {getTranslation(lang, `${prefix}_when`)}
                      </p>
                      <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold text-[#0F766E] dark:text-teal-400">
                        {getTranslation(lang, tool.titleKey)}
                        <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Categories & Tools */}
          <div className="space-y-8">
            {CATEGORIES.map((cat) => {
              const CatIcon = ICON_MAP[cat.iconName] || Dna;
              const catTools = TOOL_REGISTRY.filter((t) => t.category === cat.id);
              if (catTools.length === 0) return null;

              return (
                <div key={cat.id} className="space-y-4">
                  {/* Category Header */}
                  <div className="flex items-start gap-3 pb-3 border-b border-[#DDEDE8] dark:border-slate-800">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: cat.color }}
                    >
                      <CatIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-[#12312B] dark:text-slate-100">
                        {getTranslation(lang, cat.nameKey)}
                      </h3>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                        {getTranslation(lang, cat.descKey)}
                      </p>
                    </div>
                    <span className="ml-auto shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#F3FAF7] dark:bg-slate-800 text-[#64748B] dark:text-slate-400 border border-[#DDEDE8] dark:border-slate-700 whitespace-nowrap">
                      {catTools.length} {getTranslation(lang, 'navTools')}
                    </span>
                  </div>

                  {/* Tools Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {catTools.map((tool) => {
                      const ToolIcon = ICON_MAP[tool.iconName] || Dna;
                      const levelClass = LEVEL_COLORS[tool.educationalLevel] || LEVEL_COLORS.basic;

                      const prefix = guideKeyPrefix(tool);
                      const isExpanded = expandedTools.has(tool.id);

                      return (
                        <div
                          key={tool.id}
                          className="rounded-2xl border border-[#DDEDE8] dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#14B8A6] hover:shadow-md transition-all flex flex-col group"
                        >
                          <button
                            onClick={() => handleOpenTool(tool.id)}
                            type="button"
                            className="text-left p-4 flex flex-col gap-3 cursor-pointer"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="w-9 h-9 rounded-lg bg-[#0F766E]/10 dark:bg-slate-800 text-[#0F766E] dark:text-teal-400 flex items-center justify-center shrink-0 group-hover:bg-[#0F766E] group-hover:text-white transition-colors">
                                <ToolIcon className="w-4.5 h-4.5" />
                              </div>
                              <div className="flex items-center gap-1 flex-wrap justify-end">
                                {tool.popular && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#F59E0B]/10 text-[#B45309] dark:text-amber-400 border border-[#F59E0B]/30">
                                    <Star className="w-2.5 h-2.5 fill-current" />
                                    {getTranslation(lang, 'badgePopular')}
                                  </span>
                                )}
                                {tool.featured && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#0F766E]/10 text-[#0F766E] dark:text-teal-400 border border-[#0F766E]/30">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    {getTranslation(lang, 'badgeFeatured')}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="space-y-1 flex-1">
                              <h4 className="font-bold text-sm text-[#12312B] dark:text-slate-100 group-hover:text-[#0F766E] dark:group-hover:text-teal-400 transition-colors leading-snug">
                                {getTranslation(lang, tool.titleKey)}
                              </h4>
                              <p className="text-xs text-[#64748B] dark:text-slate-400 leading-relaxed">
                                {getTranslation(lang, tool.descKey)}
                              </p>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-[#DDEDE8] dark:border-slate-800">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${levelClass}`}>
                                {getTranslation(lang, 'guideLevelLabel')}: {tool.educationalLevel}
                              </span>
                              <span className="flex items-center gap-0.5 text-[11px] font-bold text-[#0F766E] dark:text-teal-400 group-hover:translate-x-1 transition-transform">
                                {getTranslation(lang, 'launchTool')}
                                <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </button>

                          {/* Quick Guide: when to use / what to enter / output meaning / example */}
                          <div className="px-4 pb-3 -mt-1">
                            <button
                              onClick={() => toggleExpanded(tool.id)}
                              type="button"
                              className="w-full flex items-center justify-between gap-2 py-1.5 text-[11px] font-bold text-[#64748B] dark:text-slate-400 hover:text-[#0F766E] dark:hover:text-teal-400 transition-colors cursor-pointer"
                            >
                              <span>{getTranslation(lang, 'quickGuideLabel')}</span>
                              <ChevronDown
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                              />
                            </button>

                            {isExpanded && (
                              <div className="mt-1 space-y-2 text-[11px] leading-relaxed text-[#334155] dark:text-slate-300 border-t border-[#DDEDE8] dark:border-slate-800 pt-2.5">
                                <div>
                                  <span className="font-bold text-[#12312B] dark:text-slate-100">
                                    {getTranslation(lang, 'guideWhenLabel')}:
                                  </span>{' '}
                                  {getTranslation(lang, `${prefix}_when`)}
                                </div>
                                <div>
                                  <span className="font-bold text-[#12312B] dark:text-slate-100">
                                    {getTranslation(lang, 'guideInputLabel')}:
                                  </span>{' '}
                                  {getTranslation(lang, `${prefix}_input`)}
                                </div>
                                <div>
                                  <span className="font-bold text-[#12312B] dark:text-slate-100">
                                    {getTranslation(lang, 'guideOutputLabel')}:
                                  </span>{' '}
                                  {getTranslation(lang, `${prefix}_output`)}
                                </div>
                                <div>
                                  <span className="font-bold text-[#12312B] dark:text-slate-100">
                                    {getTranslation(lang, 'guideExampleLabel')}:
                                  </span>{' '}
                                  {getTranslation(lang, `${prefix}_example`)}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Bar */}
        <div className="px-6 py-3 bg-[#F3FAF7] dark:bg-slate-950 border-t border-[#DDEDE8] dark:border-slate-800 text-xs text-[#64748B] dark:text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#22C55E]" />
            <span>{getTranslation(lang, 'privacyNotice')}</span>
          </div>
          <span>BioAI.Lab</span>
        </div>
      </div>
    </div>
  );
};
