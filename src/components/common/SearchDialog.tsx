import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Star, ArrowRight } from 'lucide-react';
import { TOOL_REGISTRY, CATEGORIES } from '../../data/toolRegistry';
import { getTranslation } from '../../i18n';
import { Language, ToolMeta } from '../../types';

interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTool: (toolId: string) => void;
  lang: Language;
}

export const SearchDialog: React.FC<SearchDialogProps> = ({
  isOpen,
  onClose,
  onSelectTool,
  lang,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const filteredTools = TOOL_REGISTRY.filter((tool) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const title = getTranslation(lang, tool.titleKey).toLowerCase();
    const desc = getTranslation(lang, tool.descKey).toLowerCase();
    const matchesKeyword = tool.keywords.some((k) => k.toLowerCase().includes(q));
    const cat = tool.category.toLowerCase();

    return title.includes(q) || desc.includes(q) || matchesKeyword || cat.includes(q);
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredTools.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredTools.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredTools[selectedIndex]) {
        onSelectTool(filteredTools[selectedIndex].id);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-xs z-50 flex items-start justify-center pt-20 p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label={getTranslation(lang, 'searchPlaceholder')}
    >
      <div className="bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header Search Input */}
        <div className="p-4 border-b border-[#DDEDE8] dark:border-slate-800 flex items-center gap-3 bg-[#ECFDF5] dark:bg-slate-800/90">
          <Search className="w-5 h-5 text-[#0F766E] dark:text-teal-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={getTranslation(lang, 'searchPlaceholder')}
            aria-label={getTranslation(lang, 'searchPlaceholder')}
            className="w-full bg-transparent text-[#12312B] dark:text-slate-100 outline-none text-sm font-medium placeholder:text-[#64748B] dark:placeholder:text-slate-400"
          />
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-lg text-[#64748B] dark:text-slate-400 hover:text-[#12312B] dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="p-2 overflow-y-auto flex-1 space-y-1">
          {filteredTools.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#64748B] dark:text-slate-400">
              {getTranslation(lang, 'noToolsFound')}
            </div>
          ) : (
            filteredTools.map((tool, idx) => {
              const catObj = CATEGORIES.find((c) => c.id === tool.category);
              const isSelected = idx === selectedIndex;

              return (
                <button
                  key={tool.id}
                  onClick={() => {
                    onSelectTool(tool.id);
                    onClose();
                  }}
                  type="button"
                  className={`w-full text-left p-3 rounded-xl flex items-center justify-between gap-3 transition-all cursor-pointer ${
                    isSelected ? 'bg-[#ECFDF5] dark:bg-slate-800 border border-[#14B8A6]/40 dark:border-slate-700' : 'hover:bg-[#F3FAF7] dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#0F766E]/10 dark:bg-slate-800 text-[#0F766E] dark:text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Search className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-[#12312B] dark:text-slate-100">
                          {getTranslation(lang, tool.titleKey)}
                        </span>
                        {catObj && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-700 text-[#0F766E] dark:text-teal-400">
                            {getTranslation(lang, catObj.nameKey)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400 line-clamp-1 mt-0.5">
                        {getTranslation(lang, tool.descKey)}
                      </p>
                    </div>
                  </div>

                  <ArrowRight className={`w-4 h-4 text-[#0F766E] dark:text-teal-400 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-[#F3FAF7] dark:bg-slate-950 border-t border-[#DDEDE8] dark:border-slate-800 text-[11px] text-[#64748B] dark:text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-700 font-mono text-slate-700 dark:text-slate-300">↑↓</kbd> {getTranslation(lang, 'kbd_navigate')}
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-700 font-mono text-slate-700 dark:text-slate-300">↵</kbd> {getTranslation(lang, 'kbd_select')}
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-700 font-mono text-slate-700 dark:text-slate-300">ESC</kbd> {getTranslation(lang, 'kbd_close')}
            </span>
          </div>
          <span>BioAI.Lab Platform</span>
        </div>
      </div>
    </div>
  );
};
