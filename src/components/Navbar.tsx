import React, { useState } from 'react';
import { Dna, Search, Star, Menu, X, ShieldCheck, Sparkles, BookOpen } from 'lucide-react';
import { LanguageSelector } from './common/LanguageSelector';
import { ThemeSelector } from './common/ThemeSelector';
import { getTranslation } from '../i18n';
import { Language, Theme } from '../types';

interface NavbarProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
  onOpenSearch: () => void;
  favoriteCount: number;
  onOpenFavorites: () => void;
  onNavigateHome: () => void;
  onSelectCategory: (catId: string) => void;
  onOpenGuide: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentLang,
  onLanguageChange,
  currentTheme,
  onThemeChange,
  onOpenSearch,
  favoriteCount,
  onOpenFavorites,
  onNavigateHome,
  onSelectCategory,
  onOpenGuide,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-[#DDEDE8] dark:border-slate-800 shadow-2xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={onNavigateHome}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0F766E] to-[#14B8A6] flex items-center justify-center text-white shadow-md shadow-[#0F766E]/20 group-hover:scale-105 transition-transform">
            <Dna className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg text-[#12312B] dark:text-slate-100 tracking-tight">
                BioAI<span className="text-[#0F766E] dark:text-teal-400">.Lab</span>
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-[#ECFDF5] dark:bg-slate-900 text-[#0F766E] dark:text-teal-400 border border-[#DDEDE8] dark:border-slate-800 rounded-md tracking-wider">
                PRO LAB
              </span>
            </div>
            <span className="text-[10px] text-[#64748B] dark:text-slate-400 block font-medium">
              {getTranslation(currentLang, 'brandSubtitle')}
            </span>
          </div>
        </div>

        {/* Global Search Button Trigger (Center Desktop) */}
        <button
          onClick={onOpenSearch}
          type="button"
          className="hidden md:flex items-center gap-3 px-4 py-2 rounded-xl bg-[#F3FAF7] dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-800 text-[#64748B] dark:text-slate-400 hover:border-[#14B8A6] hover:bg-white dark:hover:bg-slate-800 text-xs font-medium transition-all w-80 cursor-pointer shadow-2xs"
        >
          <Search className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
          <span className="flex-1 text-left">{getTranslation(currentLang, 'searchPlaceholder')}</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-slate-800 border border-[#DDEDE8] dark:border-slate-700 rounded text-[#0F766E] dark:text-teal-400 font-bold">
            Ctrl+K
          </kbd>
        </button>

        {/* Action Controls Right */}
        <div className="hidden md:flex items-center gap-3">
          {/* Platform & Tools Guide Button */}
          <button
            onClick={onOpenGuide}
            type="button"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#DDEDE8] dark:border-slate-800 bg-white dark:bg-slate-900 text-[#12312B] dark:text-slate-100 hover:bg-[#ECFDF5] dark:hover:bg-slate-800 hover:border-[#14B8A6] transition-all cursor-pointer shadow-2xs text-xs font-semibold"
            title={getTranslation(currentLang, 'navAbout')}
          >
            <BookOpen className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
            <span className="hidden lg:inline">{getTranslation(currentLang, 'navAbout')}</span>
          </button>

          {/* Favorites Button */}
          <button
            onClick={onOpenFavorites}
            type="button"
            className="relative p-2 rounded-lg border border-[#DDEDE8] dark:border-slate-800 bg-white dark:bg-slate-900 text-[#12312B] dark:text-slate-100 hover:bg-[#ECFDF5] dark:hover:bg-slate-800 hover:border-[#14B8A6] transition-all cursor-pointer shadow-2xs"
            title={getTranslation(currentLang, 'navFavorites')}
          >
            <Star className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
            {favoriteCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#0F766E] text-white">
                {favoriteCount}
              </span>
            )}
          </button>

          {/* Privacy Client-Side Badge */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#ECFDF5] dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-800 text-[11px] font-medium text-[#0F766E] dark:text-teal-400">
            <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>{getTranslation(currentLang, 'localClientSide')}</span>
          </div>

          <LanguageSelector currentLang={currentLang} onLanguageChange={onLanguageChange} />
          <ThemeSelector currentTheme={currentTheme} onThemeChange={onThemeChange} lang={currentLang} />
        </div>

        {/* Mobile Menu Button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={onOpenSearch}
            type="button"
            className="p-2 rounded-lg border border-[#DDEDE8] dark:border-slate-800 bg-white dark:bg-slate-900 text-[#0F766E] dark:text-teal-400"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            type="button"
            className="p-2 rounded-lg border border-[#DDEDE8] dark:border-slate-800 bg-white dark:bg-slate-900 text-[#12312B] dark:text-slate-100"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#DDEDE8] dark:border-slate-800 bg-white dark:bg-slate-950 p-4 space-y-4 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400">Language & Theme</span>
            <div className="flex items-center gap-2">
              <LanguageSelector currentLang={currentLang} onLanguageChange={onLanguageChange} />
              <ThemeSelector currentTheme={currentTheme} onThemeChange={onThemeChange} lang={currentLang} />
            </div>
          </div>

          <button
            onClick={() => {
              onOpenGuide();
              setMobileMenuOpen(false);
            }}
            type="button"
            className="w-full py-2.5 px-3 rounded-lg bg-[#ECFDF5] dark:bg-slate-900 text-[#0F766E] dark:text-teal-400 font-semibold text-xs flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            <span>{getTranslation(currentLang, 'navAbout')}</span>
          </button>

          <button
            onClick={() => {
              onOpenFavorites();
              setMobileMenuOpen(false);
            }}
            type="button"
            className="w-full py-2.5 px-3 rounded-lg bg-[#ECFDF5] dark:bg-slate-900 text-[#0F766E] dark:text-teal-400 font-semibold text-xs flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Star className="w-4 h-4 fill-current text-[#F59E0B]" />
              <span>{getTranslation(currentLang, 'favoriteTools')}</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-xs font-mono text-[#12312B] dark:text-slate-200">{favoriteCount}</span>
          </button>
        </div>
      )}
    </header>
  );
};
