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

  it('returns en for empty string', () => {
    expect(detectLanguage('')).toBe('en');
  });

  it('returns en for numbers only', () => {
    expect(detectLanguage('1234567890')).toBe('en');
  });

  it('detects ko for Hangul+CJK mix without kana', () => {
    expect(detectLanguage('한국語')).toBe('ko');
  });

  it('prioritizes ja when kana and hangul are both present', () => {
    expect(detectLanguage('こんにちは 안녕하세요')).toBe('ja');
  });

  it('detects Arabic script as ar', () => {
    expect(detectLanguage('مرحبا بالجميع')).toBe('ar');
  });

  it('detects Arabic with Latin/emoji mix as ar', () => {
    expect(detectLanguage('hello كيف الحال؟ 👋')).toBe('ar');
  });

  it('detects Vietnamese sentence with tone marks as vi', () => {
    expect(detectLanguage('Xin chào mọi người, hôm nay thế nào?')).toBe('vi');
  });

  it('detects Vietnamese via d-bar (đ) as vi', () => {
    expect(detectLanguage('Tiếng Việt rất đẹp')).toBe('vi');
  });

  it('detects French accented text as fr', () => {
    expect(detectLanguage('Ça va très bien, merci.')).toBe('fr');
  });

  it('detects fr for French-only accents without Vietnamese-specific letters', () => {
    expect(detectLanguage('Où êtes-vous né ? À côté de l’église.')).toBe('fr');
  });

  it('prioritizes ja over ar when kana and Arabic are both present', () => {
    expect(detectLanguage('こんにちは مرحبا')).toBe('ja');
  });

  it('prioritizes vi over fr when Vietnamese-specific letters are present', () => {
    expect(detectLanguage('Cà phê sữa đá à la carte')).toBe('vi');
  });

  it('returns en for accent-free Latin text', () => {
    expect(detectLanguage('Bonjour tout le monde')).toBe('en');
  });
});
