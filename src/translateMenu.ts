import type { UserLang } from './db.js';

export const TRANSLATE_SELECT_PREFIX = 'trsel:';

export interface TranslateSelectChoice {
  visibility: 'private' | 'public';
  lang: UserLang;
}

const LANG_NAMES: Record<UserLang, string> = { en: 'English', ja: 'Japanese', ko: 'Korean' };
const LANGS: readonly UserLang[] = ['en', 'ja', 'ko'];

export interface TranslateSelectOption {
  label: string;
  value: string;
}

export function buildTranslateSelectOptions(): TranslateSelectOption[] {
  const privateOptions = LANGS.map((lang) => ({
    label: `\u{1F512} ${LANG_NAMES[lang]} — only you`,
    value: `private:${lang}`
  }));
  const publicOptions = LANGS.map((lang) => ({
    label: `\u{1F4E2} ${LANG_NAMES[lang]} — post to channel`,
    value: `public:${lang}`
  }));
  return [...privateOptions, ...publicOptions];
}

export function parseTranslateSelectValue(value: string): TranslateSelectChoice | null {
  const match = value.match(/^(private|public):(en|ja|ko)$/);
  if (!match) return null;
  return { visibility: match[1] as 'private' | 'public', lang: match[2] as UserLang };
}
