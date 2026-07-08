export const TRANSLATE_SELECT_PREFIX = 'trsel:';

export type TranslateVisibility = 'private' | 'public';

export interface TranslateSelectOption {
  label: string;
  value: string;
}

// The menu only picks where to show the translation; the target language is
// always the invoker's /language setting (shown in the labels for clarity).
export function buildTranslateSelectOptions(targetLangName: string): TranslateSelectOption[] {
  return [
    { label: `\u{1F512} ${targetLangName} — only you`, value: 'private' },
    { label: `\u{1F4E2} ${targetLangName} — post to channel`, value: 'public' }
  ];
}

export function parseTranslateSelectValue(value: string): TranslateVisibility | null {
  return value === 'private' || value === 'public' ? value : null;
}
