import { describe, expect, it } from 'vitest';
import { CompanionTracker, TranslationCache } from '../src/delivery.js';

describe('CompanionTracker', () => {
  it('returns undefined for untracked message', () => {
    const tracker = new CompanionTracker();
    expect(tracker.get('msg-1')).toBeUndefined();
  });

  it('tracks and retrieves a companion', () => {
    const tracker = new CompanionTracker();
    tracker.track('orig-1', 'bot-1');
    expect(tracker.get('orig-1')).toBe('bot-1');
    expect(tracker.size).toBe(1);
  });

  it('removes and returns companion ID', () => {
    const tracker = new CompanionTracker();
    tracker.track('orig-1', 'bot-1');
    const removed = tracker.remove('orig-1');
    expect(removed).toBe('bot-1');
    expect(tracker.get('orig-1')).toBeUndefined();
    expect(tracker.size).toBe(0);
  });

  it('returns undefined when removing untracked message', () => {
    const tracker = new CompanionTracker();
    expect(tracker.remove('nonexist')).toBeUndefined();
  });

  it('updates companion ID for same original', () => {
    const tracker = new CompanionTracker();
    tracker.track('orig-1', 'bot-1');
    tracker.track('orig-1', 'bot-2');
    expect(tracker.get('orig-1')).toBe('bot-2');
    expect(tracker.size).toBe(1);
  });

  it('evicts oldest entry at maxSize', () => {
    const tracker = new CompanionTracker(3);
    tracker.track('a', 'ba');
    tracker.track('b', 'bb');
    tracker.track('c', 'bc');
    tracker.track('d', 'bd');
    expect(tracker.get('a')).toBeUndefined();
    expect(tracker.get('b')).toBe('bb');
    expect(tracker.get('d')).toBe('bd');
    expect(tracker.size).toBe(3);
  });

  it('defaults to maxSize 500', () => {
    const tracker = new CompanionTracker();
    for (let i = 0; i < 501; i++) {
      tracker.track(`orig-${i}`, `bot-${i}`);
    }
    expect(tracker.get('orig-0')).toBeUndefined();
    expect(tracker.get('orig-500')).toBe('bot-500');
    expect(tracker.size).toBe(500);
  });
});

describe('TranslationCache.invalidateMessage', () => {
  it('removes all language entries for a message', () => {
    const cache = new TranslationCache();
    cache.set('msg-1', 'ja', '日本語');
    cache.set('msg-1', 'ko', '한국어');
    cache.set('msg-2', 'ja', '別のメッセージ');

    cache.invalidateMessage('msg-1');
    expect(cache.get('msg-1', 'ja')).toBeUndefined();
    expect(cache.get('msg-1', 'ko')).toBeUndefined();
    expect(cache.get('msg-2', 'ja')).toBe('別のメッセージ');
  });

  it('does nothing for non-existent message', () => {
    const cache = new TranslationCache();
    cache.set('msg-1', 'en', 'hello');
    cache.invalidateMessage('msg-999');
    expect(cache.get('msg-1', 'en')).toBe('hello');
  });

  it('does not break eviction after invalidation', () => {
    const cache = new TranslationCache(3);
    cache.set('a', 'en', 'A');
    cache.set('b', 'en', 'B');
    cache.invalidateMessage('a');
    cache.set('c', 'en', 'C');
    cache.set('d', 'en', 'D');
    cache.set('e', 'en', 'E');
    expect(cache.get('b', 'en')).toBeUndefined();
    expect(cache.get('e', 'en')).toBe('E');
  });
});
