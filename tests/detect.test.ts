import { describe, expect, it } from 'vitest';
import { detectLanguage } from '../src/detect.js';

describe('detectLanguage', () => {
  it('detects Japanese scripts (hiragana/katakana) as ja', () => {
    expect(detectLanguage('これはテストです')).toBe('ja');
  });

  it('detects CJK-only text as ja', () => {
    expect(detectLanguage('翻訳お願いします')).toBe('ja');
  });

  it('detects Hangul as ko', () => {
    expect(detectLanguage('오늘 진행 상황 어때요?')).toBe('ko');
  });

  it('detects Hangul with emoji as ko', () => {
    expect(detectLanguage('안녕하세요 👋')).toBe('ko');
  });

  it('prioritizes ja over ko when hiragana/katakana present', () => {
    expect(detectLanguage('テスト 한국어')).toBe('ja');
  });

  it('defaults to English when no CJK/Hangul ranges are present', () => {
    expect(detectLanguage('Please translate this')).toBe('en');
  });
});
