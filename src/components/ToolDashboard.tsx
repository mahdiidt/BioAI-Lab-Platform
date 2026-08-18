import React, { useState } from 'react';
import { TOOL_REGISTRY, CATEGORIES } from '../data/toolRegistry';
import { getTranslation } from '../i18n';
import { Language, ToolMeta } from '../types';
import { Search, Star, Filter, Sparkles, BookOpen, ChevronRight } from 'lucide-react';

interface ToolDashboardProps {
  lang: Language;
  selectedCategory: string;
  onSelectCategory: (catId: string) => void;
  showFavoritesOnly?: boolean;
  onClearFavoritesFilter?: () => void;
  favorites: string[];
  onToggleFavorite: (toolId: string) => void;
  onOpenTool: (toolId: string) => void;
}

export const ToolDashboard: React.FC<ToolDashboardProps> = ({
  lang,
  selectedCategory,
  onSelectCategory,
  showFavoritesOnly = false,
  onClearFavoritesFilter,
  favorites,
  onToggleFavorite,
  onOpenTool,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTools = TOOL_REGISTRY.filter((tool) => {
    // Filter by Favorites mode
    if (showFavoritesOnly && !favorites.includes(tool.id)) {
      return false;
    }
    // Filter by Category
    if (selectedCategory !== 'all' && tool.category !== selectedCategory) {
      return false;
    }
    // Filter by Search Query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const title = getTranslation(lang, tool.titleKey).toLowerCase();
      const desc = getTranslation(lang, tool.descKey).toLowerCase();
      const matchesKwd = tool.keywords.some((k) => k.toLowerCase().includes(q));
      return title.includes(q) || desc.includes(q) || matchesKwd;
    }
    return true;
  });

  const favoriteTools = TOOL_REGISTRY.filter((t) => favorites.includes(t.id));

  return (
    <section id="tools" className="py-12 bg-[#F3FAF7] dark:bg-slate-950 min-h-[600px]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#DDEDE8] dark:border-slate-800 pb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-[#12312B] dark:text-slate-100 flex items-center gap-3">
              <span>{getTranslation(lang, 'navTools')} & Scientific Calculators</span>
              {showFavoritesOnly && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#F59E0B]/10 text-[#D97706] border border-[#F59E0B]/30">
                  <Star className="w-3.5 h-3.5 fill-[#F59E0B]" />
                  <span>{getTranslation(lang, 'favoritesOnly')}</span>
                  {onClearFavoritesFilter && (
                    <button
                      onClick={onClearFavoritesFilter}
                      type="button"
                      className="ml-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                      title={getTranslation(lang, 'showAllTools')}
                    >
                      ×
                    </button>
                  )}
                </span>
              )}
            </h2>
            <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
              Select a tool to launch interactive analysis or simulation.
            </p>
          </div>

          {/* Search Filter Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-[#0F766E] dark:text-teal-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${TOOL_REGISTRY.length}+ scientific tools...`}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#DDEDE8] dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-[#12312B] dark:text-slate-100 focus:ring-2 focus:ring-[#14B8A6] outline-none shadow-2xs"
            />
          </div>
        </div>

        {/* Category Pills Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => onSelectCategory('all')}
            type="button"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-[#0F766E] text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 text-[#12312B] dark:text-slate-200 border border-[#DDEDE8] dark:border-slate-800 hover:bg-[#ECFDF5] dark:hover:bg-slate-800'
            }`}
          >
            All Tools ({TOOL_REGISTRY.length})
          </button>

          {CATEGORIES.map((cat) => {
            const count = TOOL_REGISTRY.filter((t) => t.category === cat.id).length;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                type="button"
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#0F766E] text-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-[#12312B] dark:text-slate-200 border border-[#DDEDE8] dark:border-slate-800 hover:bg-[#ECFDF5] dark:hover:bg-slate-800'
                }`}
              >
                <span>{getTranslation(lang, cat.nameKey)}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-[#F3FAF7] dark:bg-slate-800 text-[#0F766E] dark:text-teal-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Favorites Section if available */}
        {favorites.length > 0 && selectedCategory === 'all' && !searchTerm && (
          <div className="space-y-3 p-5 bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-800 rounded-2xl shadow-2xs">
            <h3 className="text-xs font-bold text-[#0F766E] dark:text-teal-400 uppercase tracking-wider flex items-center gap-2">
              <Star className="w-4 h-4 fill-[#F59E0B] text-[#F59E0B]" />
              <span>{getTranslation(lang, 'favoriteTools')} ({favoriteTools.length})</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {favoriteTools.map((tool) => (
                <div
                  key={tool.id}
                  onClick={() => onOpenTool(tool.id)}
                  className="p-3 bg-[#ECFDF5] dark:bg-slate-800 border border-[#14B8A6]/30 dark:border-slate-700 rounded-xl hover:bg-[#d1fae5] dark:hover:bg-slate-700 transition-all cursor-pointer flex items-center justify-between"
                >
                  <span className="font-bold text-xs text-[#12312B] dark:text-slate-100">
                    {getTranslation(lang, tool.titleKey)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tools Grid */}
        {filteredTools.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-[#DDEDE8] dark:border-slate-800 text-xs text-[#64748B] dark:text-slate-400">
            {getTranslation(lang, 'noToolsFound')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTools.map((tool) => {
              const isFav = favorites.includes(tool.id);
              const catObj = CATEGORIES.find((c) => c.id === tool.category);

              return (
                <div
                  key={tool.id}
                  onClick={() => onOpenTool(tool.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenTool(tool.id);
                    }
                  }}
                  className="p-5 rounded-2xl border border-[#DDEDE8] dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#14B8A6] hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
                >
                  <div className="space-y-3">
                    {/* Header Top Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {catObj && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] dark:bg-slate-800 text-[#0F766E] dark:text-teal-400 border border-[#DDEDE8] dark:border-slate-700">
                            {getTranslation(lang, catObj.nameKey)}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono text-[#64748B] dark:text-slate-400 bg-[#F3FAF7] dark:bg-slate-800 uppercase border border-[#DDEDE8] dark:border-slate-700">
                          {tool.educationalLevel || 'Research'}
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(tool.id);
                        }}
                        type="button"
                        className="p-1.5 rounded-lg hover:bg-[#ECFDF5] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title={getTranslation(lang, 'favoriteToggle')}
                      >
                        <Star
                          className={`w-4 h-4 transition-colors ${
                            isFav ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#64748B] dark:text-slate-400 hover:text-[#F59E0B]'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="font-bold text-base text-[#12312B] dark:text-slate-100 group-hover:text-[#0F766E] dark:group-hover:text-teal-400 transition-colors">
                        {getTranslation(lang, tool.titleKey)}
                      </h3>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {getTranslation(lang, tool.descKey)}
                      </p>
                    </div>
                  </div>

                  {/* Keywords & Action Row */}
                  <div className="pt-2 border-t border-[#DDEDE8] dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-[#64748B] dark:text-slate-400 font-mono truncate max-w-[180px]">
                      {tool.keywords.slice(0, 3).join(', ')}
                    </span>
                    <span className="font-bold text-[#0F766E] dark:text-teal-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                      {getTranslation(lang, 'launchTool')} <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};