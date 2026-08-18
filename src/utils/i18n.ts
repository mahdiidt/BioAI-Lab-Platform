// Re-export from central i18n system in src/i18n
import { translations as centralTranslations, getTranslation } from '../i18n';
import { Language, Theme } from '../types';

export type { Language, Theme };
export const translations = centralTranslations;
export { getTranslation };
