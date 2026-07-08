import { describe, expect, it } from 'vitest';
import { extractTranslatable, isTrivial, shouldTranslate, type MessageLike } from '../src/filter.js';

function message(overrides: Partial<MessageLike>): MessageLike {
  return {
    content: 'Please review this tomorrow.',
    author: { bot: false },
    webhookId: null,
    attachments: { size: 0 },
    ...overrides
  };
}

describe('extractTranslatable', () => {
  it('replaces code blocks and inline code with placeholders', () => {
    expect(extractTranslatable('check `foo()`\n```ts\nconst x = 1;\n```')).toBe(
      'check [code]\n[code]'
    );
  });

  it('drops empty, url-only, and emoji-only messages', () => {
    expect(extractTranslatable('   ')).toBeNull();
    expect(extractTranslatable('https://example.com https://example.org/a')).toBeNull();
    expect(extractTranslatable('😀 <:party:1234567890>')).toBeNull();
  });
});

describe('isTrivial', () => {
  it('matches short acknowledgements and slang', () => {
    expect(isTrivial('lol')).toBe(true);
    expect(isTrivial('ok!')).toBe(true);
    expect(isTrivial('草')).toBe(true);
    expect(isTrivial('それな')).toBe(true);
  });

  it('keeps substantial chat text', () => {
    expect(isTrivial('Please review this patch tomorrow')).toBe(false);
  });
});

describe('shouldTranslate', () => {
  it('excludes bot, webhook, attachment-only, trivial, long, and mostly-code messages', () => {
    expect(shouldTranslate(message({ author: { bot: true } }))).toBe(false);
    expect(shouldTranslate(message({ webhookId: 'webhook-id' }))).toBe(false);
    expect(shouldTranslate(message({ content: '', attachments: { size: 1 } }))).toBe(false);
    expect(shouldTranslate(message({ content: 'thanks' }))).toBe(false);
    expect(shouldTranslate(message({ content: 'a'.repeat(2001) }))).toBe(false);
    expect(shouldTranslate(message({ content: '```ts\nconst a = 1;\nconst b = 2;\n``` ok' }))).toBe(
      false
    );
  });

  it('accepts normal non-trivial messages', () => {
    expect(shouldTranslate(message({ content: 'Can you review this before the meeting?' }))).toBe(
      true
    );
  });
});
