import { Language } from '../types';
import { en } from './en';
import { fa } from './fa';
import { zh } from './zh';
import { es } from './es';
import { fr } from './fr';
import { de } from './de';

export const translations: Record<Language, Record<string, string>> = {
  en,
  fa,
  zh,
  es,
  fr,
  de,
};

export function getTranslation(lang: Language, key: string, fallback?: string): string {
  const dict = translations[lang] || translations.en;
  return dict[key] || translations.en[key] || fallback || key;
}
