import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import { Language } from '../../types';

interface LanguageSelectorProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
}

const LANGUAGES: { code: Language; label: string; flag: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸', dir: 'ltr' },
  { code: 'fa', label: 'فارسی', flag: '🇮🇷', dir: 'rtl' },
  { code: 'zh', label: '中文', flag: '🇨🇳', dir: 'ltr' },
  { code: 'es', label: 'Español', flag: '🇪🇸', dir: 'ltr' },
  { code: 'fr', label: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
];

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ currentLang, onLanguageChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#DDEDE8] bg-white text-[#12312B] hover:bg-[#ECFDF5] hover:border-[#14B8A6] text-xs font-semibold transition-all cursor-pointer shadow-sm"
      >
        <Globe className="w-3.5 h-3.5 text-[#0F766E]" />
        <span>{selected.flag}</span>
        <span className="hidden sm:inline">{selected.label}</span>
        <ChevronDown className="w-3 h-3 text-[#64748B]" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-44 rounded-xl bg-white border border-[#DDEDE8] shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                onLanguageChange(lang.code);
                setIsOpen(false);
              }}
              type="button"
              className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-[#ECFDF5] transition-colors cursor-pointer ${
                currentLang === lang.code ? 'font-bold text-[#0F766E] bg-[#ECFDF5]' : 'text-[#12312B]'
              }`}
            >
              <span className="flex items-center gap-2">
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </span>
              {currentLang === lang.code && <span className="w-1.5 h-1.5 rounded-full bg-[#0F766E]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
