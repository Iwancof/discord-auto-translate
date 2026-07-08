import { describe, expect, it } from 'vitest';
import {
  buildLangSelectOptions,
  buildTranslateSelectOptions,
  buildVisibilityCustomId,
  parseLangSelectValue,
  parseTranslateSelectValue,
  parseVisibilityCustomId,
  TRANSLATE_LANG_SELECT_PREFIX,
  TRANSLATE_SELECT_PREFIX
} from '../src/translateMenu.js';

describe('buildLangSelectOptions', () => {
  it('lists all 6 languages', () => {
    const options = buildLangSelectOptions('ja');
    expect(options.map((o) => o.value)).toEqual(['en', 'ja', 'ko', 'ar', 'fr', 'vi']);
  });

  it('marks only the selected language as default', () => {
    const options = buildLangSelectOptions('fr');
    expect(options.filter((o) => o.default).map((o) => o.value)).toEqual(['fr']);
  });

  it('every option value round-trips through the parser', () => {
    for (const option of buildLangSelectOptions('en')) {
      expect(parseLangSelectValue(option.value)).toBe(option.value);
    }
  });
});

describe('parseLangSelectValue', () => {
  it('accepts supported languages', () => {
    expect(parseLangSelectValue('ar')).toBe('ar');
    expect(parseLangSelectValue('vi')).toBe('vi');
  });

  it('rejects unsupported values', () => {
    expect(parseLangSelectValue('de')).toBeNull();
    expect(parseLangSelectValue('')).toBeNull();
    expect(parseLangSelectValue('auto')).toBeNull();
  });
});

describe('buildTranslateSelectOptions', () => {
  it('produces exactly 2 options: private and public', () => {
    const options = buildTranslateSelectOptions('Japanese');
    expect(options.map((o) => o.value)).toEqual(['private', 'public']);
  });

  it('embeds the target language name in both labels', () => {
    for (const option of buildTranslateSelectOptions('French')) {
      expect(option.label).toContain('French');
    }
  });
});

describe('visibility customId', () => {
  it('round-trips messageId and language', () => {
    const id = buildVisibilityCustomId('123456789012345678', 'ko');
    expect(parseVisibilityCustomId(id)).toEqual({ messageId: '123456789012345678', lang: 'ko' });
  });

  it('parses legacy customIds without a language as lang: null', () => {
    expect(parseVisibilityCustomId('trsel:123456789012345678')).toEqual({
      messageId: '123456789012345678',
      lang: null
    });
  });

  it('rejects malformed customIds and unknown languages', () => {
    expect(parseVisibilityCustomId('trsel:123:de')).toBeNull();
    expect(parseVisibilityCustomId('trsel:abc:ja')).toBeNull();
    expect(parseVisibilityCustomId('other:123:ja')).toBeNull();
  });

  it('stays within the 100-char customId limit for snowflakes', () => {
    const id = buildVisibilityCustomId('9'.repeat(20), 'en');
    expect(id.length).toBeLessThanOrEqual(100);
    expect(TRANSLATE_LANG_SELECT_PREFIX.length + 20).toBeLessThanOrEqual(100);
    expect(TRANSLATE_SELECT_PREFIX.length + 20 + 3).toBeLessThanOrEqual(100);
  });
});

describe('parseTranslateSelectValue', () => {
  it('parses private and public', () => {
    expect(parseTranslateSelectValue('private')).toBe('private');
    expect(parseTranslateSelectValue('public')).toBe('public');
  });

  it('rejects unknown and empty values', () => {
    expect(parseTranslateSelectValue('broadcast')).toBeNull();
    expect(parseTranslateSelectValue('')).toBeNull();
  });
});
