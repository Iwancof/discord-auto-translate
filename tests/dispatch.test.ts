import { describe, expect, it } from 'vitest';
import { resolveDispatch } from '../src/dispatch.js';

describe('resolveDispatch', () => {
  describe('button mode (default)', () => {
    it('routes ja to button-only', () => {
      expect(resolveDispatch('ja', 'auto')).toEqual({ type: 'button-only' });
    });

    it('routes ko to button-only', () => {
      expect(resolveDispatch('ko', 'auto')).toEqual({ type: 'button-only' });
    });

    it('routes en to button-only', () => {
      expect(resolveDispatch('en', 'auto')).toEqual({ type: 'button-only' });
    });

    it('all languages produce button-only in button guild mode', () => {
      for (const lang of ['en', 'ja', 'ko'] as const) {
        expect(resolveDispatch(lang, 'auto', 'button').type).toBe('button-only');
      }
    });

    it('defaults guildMode to button when omitted', () => {
      expect(resolveDispatch('ja', 'auto')).toEqual({ type: 'button-only' });
    });
  });

  describe('auto guild mode', () => {
    it('routes ja to auto-reply with en target', () => {
      expect(resolveDispatch('ja', 'auto', 'auto')).toEqual({
        type: 'auto-reply',
        targetLang: 'en'
      });
    });

    it('routes ko to auto-reply with en target', () => {
      expect(resolveDispatch('ko', 'auto', 'auto')).toEqual({
        type: 'auto-reply',
        targetLang: 'en'
      });
    });

    it('routes en to button-only even in auto mode', () => {
      expect(resolveDispatch('en', 'auto', 'auto')).toEqual({ type: 'button-only' });
    });
  });

  describe('log_only mode (highest priority)', () => {
    it('log_only mode with en source logs to ja', () => {
      expect(resolveDispatch('en', 'log_only')).toEqual({ type: 'log', targetLang: 'ja' });
    });

    it('log_only mode with ja source logs to en', () => {
      expect(resolveDispatch('ja', 'log_only')).toEqual({ type: 'log', targetLang: 'en' });
    });

    it('log_only mode with ko source logs to en', () => {
      expect(resolveDispatch('ko', 'log_only')).toEqual({ type: 'log', targetLang: 'en' });
    });

    it('log_only overrides auto guild mode', () => {
      expect(resolveDispatch('ja', 'log_only', 'auto')).toEqual({
        type: 'log',
        targetLang: 'en'
      });
    });

    it('log_only overrides button guild mode', () => {
      expect(resolveDispatch('ja', 'log_only', 'button')).toEqual({
        type: 'log',
        targetLang: 'en'
      });
    });
  });

  describe('mode × language matrix', () => {
    const cases: Array<{
      sourceLang: 'en' | 'ja' | 'ko';
      guildMode: 'auto' | 'button';
      expectedType: string;
    }> = [
      { sourceLang: 'en', guildMode: 'button', expectedType: 'button-only' },
      { sourceLang: 'ja', guildMode: 'button', expectedType: 'button-only' },
      { sourceLang: 'ko', guildMode: 'button', expectedType: 'button-only' },
      { sourceLang: 'en', guildMode: 'auto', expectedType: 'button-only' },
      { sourceLang: 'ja', guildMode: 'auto', expectedType: 'auto-reply' },
      { sourceLang: 'ko', guildMode: 'auto', expectedType: 'auto-reply' }
    ];

    for (const { sourceLang, guildMode, expectedType } of cases) {
      it(`${sourceLang} + ${guildMode} → ${expectedType}`, () => {
        expect(resolveDispatch(sourceLang, 'auto', guildMode).type).toBe(expectedType);
      });
    }
  });
});
