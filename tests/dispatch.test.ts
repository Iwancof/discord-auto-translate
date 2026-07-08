import { describe, expect, it } from 'vitest';
import { resolveDispatch } from '../src/dispatch.js';

describe('resolveDispatch', () => {
  describe('button mode (default officialLang=en)', () => {
    it('routes ja to button-only', () => {
      expect(resolveDispatch('ja', 'auto')).toEqual({ type: 'button-only' });
    });

    it('routes ko to button-only', () => {
      expect(resolveDispatch('ko', 'auto')).toEqual({ type: 'button-only' });
    });

    it('routes en (official) to none', () => {
      expect(resolveDispatch('en', 'auto')).toEqual({ type: 'none' });
    });

    it('defaults guildMode to button when omitted', () => {
      expect(resolveDispatch('ja', 'auto')).toEqual({ type: 'button-only' });
    });
  });

  describe('auto guild mode (default officialLang=en)', () => {
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

    it('routes en (official) to none in auto mode', () => {
      expect(resolveDispatch('en', 'auto', 'auto')).toEqual({ type: 'none' });
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

  describe('officialLang=ja (non-default)', () => {
    it('button mode: ja (official) → none', () => {
      expect(resolveDispatch('ja', 'auto', 'button', 'ja')).toEqual({ type: 'none' });
    });

    it('button mode: en (non-official) → button-only', () => {
      expect(resolveDispatch('en', 'auto', 'button', 'ja')).toEqual({ type: 'button-only' });
    });

    it('button mode: ko (non-official) → button-only', () => {
      expect(resolveDispatch('ko', 'auto', 'button', 'ja')).toEqual({ type: 'button-only' });
    });

    it('auto mode: en (non-official) → auto-reply to ja', () => {
      expect(resolveDispatch('en', 'auto', 'auto', 'ja')).toEqual({
        type: 'auto-reply',
        targetLang: 'ja'
      });
    });

    it('auto mode: ko (non-official) → auto-reply to ja', () => {
      expect(resolveDispatch('ko', 'auto', 'auto', 'ja')).toEqual({
        type: 'auto-reply',
        targetLang: 'ja'
      });
    });

    it('auto mode: ja (official) → none', () => {
      expect(resolveDispatch('ja', 'auto', 'auto', 'ja')).toEqual({ type: 'none' });
    });
  });

  describe('mode × lang × officialLang matrix', () => {
    const cases: Array<{
      sourceLang: 'en' | 'ja' | 'ko';
      guildMode: 'auto' | 'button';
      officialLang: 'en' | 'ja' | 'ko';
      expectedType: string;
    }> = [
      { sourceLang: 'en', guildMode: 'button', officialLang: 'en', expectedType: 'none' },
      { sourceLang: 'ja', guildMode: 'button', officialLang: 'en', expectedType: 'button-only' },
      { sourceLang: 'ko', guildMode: 'button', officialLang: 'en', expectedType: 'button-only' },
      { sourceLang: 'en', guildMode: 'auto', officialLang: 'en', expectedType: 'none' },
      { sourceLang: 'ja', guildMode: 'auto', officialLang: 'en', expectedType: 'auto-reply' },
      { sourceLang: 'ko', guildMode: 'auto', officialLang: 'en', expectedType: 'auto-reply' },
      { sourceLang: 'ja', guildMode: 'button', officialLang: 'ja', expectedType: 'none' },
      { sourceLang: 'en', guildMode: 'button', officialLang: 'ja', expectedType: 'button-only' },
      { sourceLang: 'ja', guildMode: 'auto', officialLang: 'ja', expectedType: 'none' },
      { sourceLang: 'en', guildMode: 'auto', officialLang: 'ja', expectedType: 'auto-reply' },
      { sourceLang: 'ko', guildMode: 'auto', officialLang: 'ko', expectedType: 'none' },
      { sourceLang: 'en', guildMode: 'auto', officialLang: 'ko', expectedType: 'auto-reply' }
    ];

    for (const { sourceLang, guildMode, officialLang, expectedType } of cases) {
      it(`${sourceLang} + ${guildMode} + official=${officialLang} → ${expectedType}`, () => {
        expect(resolveDispatch(sourceLang, 'auto', guildMode, officialLang).type).toBe(expectedType);
      });
    }
  });
});
