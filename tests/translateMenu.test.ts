import { describe, expect, it } from 'vitest';
import {
  buildTranslateSelectOptions,
  parseTranslateSelectValue,
  TRANSLATE_SELECT_PREFIX
} from '../src/translateMenu.js';

describe('buildTranslateSelectOptions', () => {
  it('produces exactly 2 options: private and public', () => {
    const options = buildTranslateSelectOptions('Japanese');
    expect(options).toHaveLength(2);
    expect(options.map((o) => o.value)).toEqual(['private', 'public']);
  });

  it('embeds the target language name in both labels', () => {
    const options = buildTranslateSelectOptions('French');
    for (const option of options) {
      expect(option.label).toContain('French');
    }
  });

  it('every option value round-trips through the parser', () => {
    for (const option of buildTranslateSelectOptions('English')) {
      expect(parseTranslateSelectValue(option.value)).not.toBeNull();
    }
  });
});

describe('parseTranslateSelectValue', () => {
  it('parses private', () => {
    expect(parseTranslateSelectValue('private')).toBe('private');
  });

  it('parses public', () => {
    expect(parseTranslateSelectValue('public')).toBe('public');
  });

  it('rejects unknown, empty, and legacy values', () => {
    expect(parseTranslateSelectValue('broadcast')).toBeNull();
    expect(parseTranslateSelectValue('')).toBeNull();
    expect(parseTranslateSelectValue('private:ja')).toBeNull();
  });
});

describe('TRANSLATE_SELECT_PREFIX', () => {
  it('leaves room for a snowflake ID within the 100-char customId limit', () => {
    expect(TRANSLATE_SELECT_PREFIX.length + 20).toBeLessThanOrEqual(100);
  });
});
