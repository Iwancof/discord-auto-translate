import type { UserLang } from './db.js';

export const LANGS: readonly UserLang[] = ['en', 'ja', 'ko', 'ar', 'fr', 'vi'];

export const LANG_NAMES: Record<UserLang, string> = {
  en: 'English',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  fr: 'French',
  vi: 'Vietnamese'
};

export const LANG_CHOICES = LANGS.map((lang) => ({ name: LANG_NAMES[lang], value: lang }));

export function formatLang(lang: UserLang): string {
  return LANG_NAMES[lang];
}
