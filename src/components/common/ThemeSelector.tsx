import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Theme, Language } from '../../types';
import { getTranslation } from '../../i18n';

interface ThemeSelectorProps {
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
  lang?: Language;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ currentTheme, onThemeChange, lang = 'en' }) => {
  const currentLang: Language = (lang as Language) || 'en';
  return (
    <div className="inline-flex items-center p-1 rounded-lg border border-[#DDEDE8] bg-white shadow-xs dark:bg-slate-900 dark:border-slate-800">
      <button
        onClick={() => onThemeChange('light')}
        type="button"
        className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
          currentTheme === 'light'
            ? 'bg-[#0F766E] text-white shadow-xs'
            : 'text-[#64748B] hover:text-[#12312B] dark:text-slate-400 dark:hover:text-slate-200'
        }`}
        title={getTranslation(currentLang, 'themeLight')}
      >
        <Sun className="w-3.5 h-3.5" />
        <span className="hidden md:inline">{getTranslation(currentLang, 'themeLight')}</span>
      </button>

      <button
        onClick={() => onThemeChange('dark')}
        type="button"
        className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
          currentTheme === 'dark'
            ? 'bg-[#0F766E] text-white shadow-xs'
            : 'text-[#64748B] hover:text-[#12312B] dark:text-slate-400 dark:hover:text-slate-200'
        }`}
        title={getTranslation(currentLang, 'themeDark')}
      >
        <Moon className="w-3.5 h-3.5" />
        <span className="hidden md:inline">{getTranslation(currentLang, 'themeDark')}</span>
      </button>

      <button
        onClick={() => onThemeChange('system')}
        type="button"
        className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
          currentTheme === 'system'
            ? 'bg-[#0F766E] text-white shadow-xs'
            : 'text-[#64748B] hover:text-[#12312B] dark:text-slate-400 dark:hover:text-slate-200'
        }`}
        title={getTranslation(currentLang, 'themeSystem')}
      >
        <Monitor className="w-3.5 h-3.5" />
        <span className="hidden md:inline">{getTranslation(currentLang, 'themeSystem')}</span>
      </button>
    </div>
  );
};
