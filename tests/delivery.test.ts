import { describe, expect, it } from 'vitest';
import { TranslationCache } from '../src/delivery.js';

describe('TranslationCache', () => {
  it('returns undefined for cache miss', () => {
    const cache = new TranslationCache();
    expect(cache.get('msg-1', 'ja')).toBeUndefined();
  });

  it('stores and retrieves a translation', () => {
    const cache = new TranslationCache();
    cache.set('msg-1', 'ja', '翻訳結果');
    expect(cache.get('msg-1', 'ja')).toBe('翻訳結果');
  });

  it('separates entries by language', () => {
    const cache = new TranslationCache();
    cache.set('msg-1', 'ja', '日本語');
    cache.set('msg-1', 'ko', '한국어');
    expect(cache.get('msg-1', 'ja')).toBe('日本語');
    expect(cache.get('msg-1', 'ko')).toBe('한국어');
  });

  it('evicts oldest entry when exceeding maxSize', () => {
    const cache = new TranslationCache(3);
    cache.set('a', 'en', 'A');
    cache.set('b', 'en', 'B');
    cache.set('c', 'en', 'C');
    cache.set('d', 'en', 'D');
    expect(cache.get('a', 'en')).toBeUndefined();
    expect(cache.get('b', 'en')).toBe('B');
    expect(cache.get('d', 'en')).toBe('D');
  });

  it('updating existing key does not grow the keys array', () => {
    const cache = new TranslationCache(3);
    cache.set('a', 'en', 'A1');
    cache.set('b', 'en', 'B1');
    cache.set('c', 'en', 'C1');
    cache.set('b', 'en', 'B2');
    expect(cache.get('b', 'en')).toBe('B2');
    expect(cache.get('a', 'en')).toBe('A1');
    expect(cache.get('c', 'en')).toBe('C1');
  });

  it('defaults to maxSize 200', () => {
    const cache = new TranslationCache();
    for (let i = 0; i < 201; i++) {
      cache.set(`m${i}`, 'en', `v${i}`);
    }
    expect(cache.get('m0', 'en')).toBeUndefined();
    expect(cache.get('m200', 'en')).toBe('v200');
  });
});

describe('customId format', () => {
  it('uses tr:<messageId> pattern', () => {
    const messageId = '1234567890';
    const customId = `tr:${messageId}`;
    expect(customId).toBe('tr:1234567890');
    expect(customId.startsWith('tr:')).toBe(true);
    expect(customId.slice(3)).toBe(messageId);
  });
});
