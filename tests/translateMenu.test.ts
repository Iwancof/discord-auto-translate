import { describe, expect, it } from 'vitest';
import {
  buildTranslateSelectOptions,
  parseTranslateSelectValue,
  TRANSLATE_SELECT_PREFIX
} from '../src/translateMenu.js';

describe('buildTranslateSelectOptions', () => {
  it('produces 6 options (3 langs × private/public)', () => {
    const options = buildTranslateSelectOptions();
    expect(options).toHaveLength(6);
  });

  it('every option value round-trips through the parser', () => {
    for (const option of buildTranslateSelectOptions()) {
      const parsed = parseTranslateSelectValue(option.value);
      expect(parsed).not.toBeNull();
    }
  });

  it('lists private options before public ones', () => {
    const options = buildTranslateSelectOptions();
    const visibilities = options.map((o) => parseTranslateSelectValue(o.value)!.visibility);
    expect(visibilities).toEqual(['private', 'private', 'private', 'public', 'public', 'public']);
  });

  it('covers all three languages in each visibility group', () => {
    const options = buildTranslateSelectOptions();
    const privateLangs = options.slice(0, 3).map((o) => parseTranslateSelectValue(o.value)!.lang);
    const publicLangs = options.slice(3).map((o) => parseTranslateSelectValue(o.value)!.lang);
    expect(privateLangs).toEqual(['en', 'ja', 'ko']);
    expect(publicLangs).toEqual(['en', 'ja', 'ko']);
  });
});

describe('parseTranslateSelectValue', () => {
  it('parses private choices', () => {
    expect(parseTranslateSelectValue('private:ja')).toEqual({ visibility: 'private', lang: 'ja' });
  });

  it('parses public choices', () => {
    expect(parseTranslateSelectValue('public:ko')).toEqual({ visibility: 'public', lang: 'ko' });
  });

  it('rejects unknown languages', () => {
    expect(parseTranslateSelectValue('private:fr')).toBeNull();
  });

  it('rejects unknown visibility', () => {
    expect(parseTranslateSelectValue('broadcast:en')).toBeNull();
  });

  it('rejects empty and malformed values', () => {
    expect(parseTranslateSelectValue('')).toBeNull();
    expect(parseTranslateSelectValue('private')).toBeNull();
    expect(parseTranslateSelectValue('private:ja:extra')).toBeNull();
  });
});

describe('TRANSLATE_SELECT_PREFIX', () => {
  it('leaves room for a snowflake ID within the 100-char customId limit', () => {
    expect(TRANSLATE_SELECT_PREFIX.length + 20).toBeLessThanOrEqual(100);
  });
});
