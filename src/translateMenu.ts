import type { UserLang } from './db.js';
import { LANG_NAMES, LANGS } from './langs.js';

export const TRANSLATE_LANG_SELECT_PREFIX = 'trlang:';
export const TRANSLATE_SELECT_PREFIX = 'trsel:';

export type TranslateVisibility = 'private' | 'public';

export interface SelectOptionSpec {
  label: string;
  value: string;
  default?: boolean;
}

// Row 1: target language, pre-selected to the invoker's /language setting.
export function buildLangSelectOptions(selected: UserLang): SelectOptionSpec[] {
  return LANGS.map((lang) => ({
    label: LANG_NAMES[lang],
    value: lang,
    default: lang === selected
  }));
}

export function parseLangSelectValue(value: string): UserLang | null {
  return (LANGS as readonly string[]).includes(value) ? (value as UserLang) : null;
}

// Row 2: where to show the translation. The chosen language is carried in the
// customId so the flow survives restarts without server-side state.
export function buildTranslateSelectOptions(targetLangName: string): SelectOptionSpec[] {
  return [
    { label: `\u{1F512} ${targetLangName} — only you`, value: 'private' },
    { label: `\u{1F4E2} ${targetLangName} — post to channel`, value: 'public' }
  ];
}

export function buildVisibilityCustomId(messageId: string, lang: UserLang): string {
  return `${TRANSLATE_SELECT_PREFIX}${messageId}:${lang}`;
}

export interface VisibilityRef {
  messageId: string;
  // null for legacy customIds minted before the language row existed;
  // callers fall back to the invoker's /language setting.
  lang: UserLang | null;
}

export function parseVisibilityCustomId(customId: string): VisibilityRef | null {
  const withLang = customId.match(/^trsel:(\d+):([a-z]{2})$/);
  if (withLang) {
    const lang = parseLangSelectValue(withLang[2]);
    if (!lang) return null;
    return { messageId: withLang[1], lang };
  }
  const legacy = customId.match(/^trsel:(\d+)$/);
  if (legacy) return { messageId: legacy[1], lang: null };
  return null;
}

export function parseTranslateSelectValue(value: string): TranslateVisibility | null {
  return value === 'private' || value === 'public' ? value : null;
}
