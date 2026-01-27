import en from '../../locales/en.json';
import ru from '../../locales/ru.json';
import type { Language } from './types';

interface Translations {
  [key: string]: string;
}

const translations: Record<Language, Translations> = { en, ru };

export function createTranslator(language: Language) {
  return (key: string): string => translations[language]?.[key] || key;
}

