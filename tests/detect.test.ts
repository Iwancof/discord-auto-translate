import { describe, expect, it } from 'vitest';
import { detectLanguage } from '../src/detect.js';

describe('detectLanguage', () => {
  it('detects Japanese scripts and CJK characters as ja', () => {
    expect(detectLanguage('これはテストです')).toBe('ja');
    expect(detectLanguage('翻訳お願いします')).toBe('ja');
  });

  it('defaults to English when Japanese ranges are absent', () => {
    expect(detectLanguage('Please translate this')).toBe('en');
  });
});
