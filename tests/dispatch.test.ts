import { describe, expect, it } from 'vitest';
import { resolveDispatch } from '../src/dispatch.js';

describe('resolveDispatch', () => {
  it('routes ja to auto-reply in English', () => {
    expect(resolveDispatch('ja', 'auto')).toEqual({ type: 'auto-reply', targetLang: 'en' });
  });

  it('routes ko to auto-reply in English', () => {
    expect(resolveDispatch('ko', 'auto')).toEqual({ type: 'auto-reply', targetLang: 'en' });
  });

  it('routes en to button-only', () => {
    expect(resolveDispatch('en', 'auto')).toEqual({ type: 'button-only' });
  });

  it('log_only mode with en source logs to ja', () => {
    expect(resolveDispatch('en', 'log_only')).toEqual({ type: 'log', targetLang: 'ja' });
  });

  it('log_only mode with ja source logs to en', () => {
    expect(resolveDispatch('ja', 'log_only')).toEqual({ type: 'log', targetLang: 'en' });
  });

  it('log_only mode with ko source logs to en', () => {
    expect(resolveDispatch('ko', 'log_only')).toEqual({ type: 'log', targetLang: 'en' });
  });
});
